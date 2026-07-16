/**
 * Metrics Service — In-memory metrics tracking for observability.
 *
 * Tracks:
 * - Request latency (per-route histograms)
 * - Payment success rate (PAID vs FAILED counts)
 * - Booking success rate (CONFIRMED vs FAILED counts)
 *
 * Metrics are stored in-memory and emitted as structured JSON logs.
 * Designed with hooks for external metrics services (Prometheus, Datadog, etc.)
 *
 * Requirements: 19.2, 19.3, 19.4, 19.5
 */

import { createLogger } from './logger.js';

const logger = createLogger('metrics');


export interface LatencyMetric {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
}

export interface CounterMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

export interface MetricsSummary {
  requestLatency: {
    count: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  payments: {
    total: number;
    paid: number;
    failed: number;
    successRate: number;
  };
  bookings: {
    total: number;
    confirmed: number;
    failed: number;
    successRate: number;
  };
}

export interface MetricsService {
  /** Record a request latency measurement */
  recordLatency(metric: LatencyMetric): void;

  /** Increment payment counter (PAID or FAILED) */
  recordPaymentEvent(status: 'PAID' | 'FAILED'): void;

  /** Increment booking counter (CONFIRMED or FAILED) */
  recordBookingEvent(status: 'CONFIRMED' | 'FAILED'): void;

  /** Record a webhook processing event */
  recordWebhookEvent(success: boolean): void;

  /** Get current metrics summary */
  getSummary(): MetricsSummary;

  /** Get payment success rate (0-1) */
  getPaymentSuccessRate(): number;

  /** Get booking success rate (0-1) */
  getBookingSuccessRate(): number;

  /** Reset all metrics (useful for testing) */
  reset(): void;
}


/** Sliding window size for latency measurements */
const LATENCY_WINDOW_SIZE = 1000;

class MetricsServiceImpl implements MetricsService {
  private latencies: number[] = [];
  private paymentPaid = 0;
  private paymentFailed = 0;
  private bookingConfirmed = 0;
  private bookingFailed = 0;
  private webhookSuccess = 0;
  private webhookFailure = 0;

  recordLatency(metric: LatencyMetric): void {
    // Keep a sliding window of latency measurements
    this.latencies.push(metric.durationMs);
    if (this.latencies.length > LATENCY_WINDOW_SIZE) {
      this.latencies.shift();
    }

    // Emit structured log for each request
    logger.info('request_latency', {
      method: metric.method,
      path: metric.path,
      statusCode: metric.statusCode,
      durationMs: metric.durationMs,
      metric_type: 'histogram',
    });
  }

  recordPaymentEvent(status: 'PAID' | 'FAILED'): void {
    if (status === 'PAID') {
      this.paymentPaid++;
    } else {
      this.paymentFailed++;
    }

    const total = this.paymentPaid + this.paymentFailed;
    const successRate = total > 0 ? this.paymentPaid / total : 0;

    logger.info('payment_event', {
      status,
      total_paid: this.paymentPaid,
      total_failed: this.paymentFailed,
      success_rate: successRate,
      metric_type: 'counter',
    });
  }

  recordBookingEvent(status: 'CONFIRMED' | 'FAILED'): void {
    if (status === 'CONFIRMED') {
      this.bookingConfirmed++;
    } else {
      this.bookingFailed++;
    }

    const total = this.bookingConfirmed + this.bookingFailed;
    const successRate = total > 0 ? this.bookingConfirmed / total : 0;

    logger.info('booking_event', {
      status,
      total_confirmed: this.bookingConfirmed,
      total_failed: this.bookingFailed,
      success_rate: successRate,
      metric_type: 'counter',
    });
  }

  recordWebhookEvent(success: boolean): void {
    if (success) {
      this.webhookSuccess++;
    } else {
      this.webhookFailure++;
    }

    logger.info('webhook_event', {
      success,
      total_success: this.webhookSuccess,
      total_failure: this.webhookFailure,
      metric_type: 'counter',
    });
  }

  getSummary(): MetricsSummary {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const count = sorted.length;

    const paymentTotal = this.paymentPaid + this.paymentFailed;
    const bookingTotal = this.bookingConfirmed + this.bookingFailed;

    return {
      requestLatency: {
        count,
        avgMs: count > 0 ? sorted.reduce((a, b) => a + b, 0) / count : 0,
        p50Ms: count > 0 ? sorted[Math.floor(count * 0.5)] : 0,
        p95Ms: count > 0 ? sorted[Math.floor(count * 0.95)] : 0,
        p99Ms: count > 0 ? sorted[Math.floor(count * 0.99)] : 0,
      },
      payments: {
        total: paymentTotal,
        paid: this.paymentPaid,
        failed: this.paymentFailed,
        successRate: paymentTotal > 0 ? this.paymentPaid / paymentTotal : 0,
      },
      bookings: {
        total: bookingTotal,
        confirmed: this.bookingConfirmed,
        failed: this.bookingFailed,
        successRate: bookingTotal > 0 ? this.bookingConfirmed / bookingTotal : 0,
      },
    };
  }

  getPaymentSuccessRate(): number {
    const total = this.paymentPaid + this.paymentFailed;
    return total > 0 ? this.paymentPaid / total : 0;
  }

  getBookingSuccessRate(): number {
    const total = this.bookingConfirmed + this.bookingFailed;
    return total > 0 ? this.bookingConfirmed / total : 0;
  }

  reset(): void {
    this.latencies = [];
    this.paymentPaid = 0;
    this.paymentFailed = 0;
    this.bookingConfirmed = 0;
    this.bookingFailed = 0;
    this.webhookSuccess = 0;
    this.webhookFailure = 0;
  }
}


let instance: MetricsService | null = null;

/**
 * Get the singleton MetricsService instance.
 */
export function getMetricsService(): MetricsService {
  if (!instance) {
    instance = new MetricsServiceImpl();
  }
  return instance;
}

/**
 * Create a fresh MetricsService (useful for testing).
 */
export function createMetricsService(): MetricsService {
  return new MetricsServiceImpl();
}
