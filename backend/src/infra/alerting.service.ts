/**
 * Alerting Service — Log-based alerting with hooks for external services.
 *
 * Monitors:
 * - Webhook processing failures
 * - Bookings stuck in document generation beyond threshold
 * - Queue backlog exceeding threshold
 *
 * Alerts are emitted as structured JSON logs at 'error' level with
 * alert_type metadata. External alerting services (PagerDuty, Opsgenie, etc.)
 * can consume these logs via log aggregation.
 *
 * Requirements: 19.3, 19.4, 19.5
 */

import { createLogger } from './logger.js';
import { queryRows } from '../db/index.js';

const logger = createLogger('alerting');


export interface AlertConfig {
  /** How long a booking can stay in DOCUMENTS_GENERATING before alerting (ms). Default: 1 hour */
  bookingPendingThresholdMs: number;
  /** Maximum queue backlog before alerting. Default: 100 */
  queueBacklogThreshold: number;
  /** Interval for running periodic checks (ms). Default: 60 seconds */
  checkIntervalMs: number;
}

export interface Alert {
  type: AlertType;
  severity: 'warning' | 'critical';
  message: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export type AlertType =
  | 'webhook_processing_failure'
  | 'booking_stuck_documents'
  | 'queue_backlog_exceeded';

export type AlertHandler = (alert: Alert) => void | Promise<void>;

export interface AlertingService {
  /** Trigger an alert for a webhook processing failure */
  alertWebhookFailure(paymentId: string, error: string): void;

  /** Check for bookings stuck in document generation beyond threshold */
  checkStuckBookings(): Promise<void>;

  /** Check for queue backlog exceeding threshold */
  checkQueueBacklog(): Promise<void>;

  /** Run all periodic checks */
  runChecks(): Promise<void>;

  /** Start periodic alert checks */
  startPeriodicChecks(): void;

  /** Stop periodic alert checks */
  stopPeriodicChecks(): void;

  /** Register an external alert handler (hook for external services) */
  registerHandler(handler: AlertHandler): void;

  /** Get the current configuration */
  getConfig(): AlertConfig;
}


const DEFAULT_CONFIG: AlertConfig = {
  bookingPendingThresholdMs: parseInt(
    process.env.ALERT_BOOKING_PENDING_THRESHOLD_MS || '3600000',
    10,
  ), // 1 hour
  queueBacklogThreshold: parseInt(
    process.env.ALERT_QUEUE_BACKLOG_THRESHOLD || '100',
    10,
  ),
  checkIntervalMs: parseInt(
    process.env.ALERT_CHECK_INTERVAL_MS || '60000',
    10,
  ), // 60 seconds
};


class AlertingServiceImpl implements AlertingService {
  private config: AlertConfig;
  private handlers: AlertHandler[] = [];
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  alertWebhookFailure(paymentId: string, error: string): void {
    const alert: Alert = {
      type: 'webhook_processing_failure',
      severity: 'critical',
      message: `Webhook processing failed for payment ${paymentId}: ${error}`,
      metadata: { paymentId, error },
      timestamp: new Date().toISOString(),
    };

    this.emit(alert);
  }

  async checkStuckBookings(): Promise<void> {
    try {
      const thresholdDate = new Date(
        Date.now() - this.config.bookingPendingThresholdMs,
      ).toISOString();

      const stuckBookings = await queryRows<{ id: string; created_at: string }>(
        `SELECT id, created_at FROM bookings
         WHERE status = 'DOCUMENTS_GENERATING'
         AND created_at < $1`,
        [thresholdDate],
      );

      if (stuckBookings.length > 0) {
        const alert: Alert = {
          type: 'booking_stuck_documents',
          severity: 'warning',
          message: `${stuckBookings.length} booking(s) stuck in document generation beyond threshold (${this.config.bookingPendingThresholdMs}ms)`,
          metadata: {
            count: stuckBookings.length,
            bookingIds: stuckBookings.map((b) => b.id),
            thresholdMs: this.config.bookingPendingThresholdMs,
          },
          timestamp: new Date().toISOString(),
        };

        this.emit(alert);
      }
    } catch (error) {
      logger.error('Failed to check stuck bookings', {
        error: (error as Error).message,
      });
    }
  }

  async checkQueueBacklog(): Promise<void> {
    try {
      const result = await queryRows<{ count: string }>(
        `SELECT COUNT(*) as count FROM document_jobs WHERE status = 'QUEUED'`,
      );

      const backlog = parseInt(result[0]?.count || '0', 10);

      if (backlog > this.config.queueBacklogThreshold) {
        const alert: Alert = {
          type: 'queue_backlog_exceeded',
          severity: 'warning',
          message: `Queue backlog (${backlog}) exceeds threshold (${this.config.queueBacklogThreshold})`,
          metadata: {
            currentBacklog: backlog,
            threshold: this.config.queueBacklogThreshold,
          },
          timestamp: new Date().toISOString(),
        };

        this.emit(alert);
      }
    } catch (error) {
      logger.error('Failed to check queue backlog', {
        error: (error as Error).message,
      });
    }
  }

  async runChecks(): Promise<void> {
    await this.checkStuckBookings();
    await this.checkQueueBacklog();
  }

  startPeriodicChecks(): void {
    if (this.intervalHandle) {
      return; // Already running
    }

    logger.info('Starting periodic alert checks', {
      intervalMs: this.config.checkIntervalMs,
    });

    this.intervalHandle = setInterval(() => {
      this.runChecks().catch((error) => {
        logger.error('Periodic alert check failed', {
          error: (error as Error).message,
        });
      });
    }, this.config.checkIntervalMs);
  }

  stopPeriodicChecks(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('Stopped periodic alert checks');
    }
  }

  registerHandler(handler: AlertHandler): void {
    this.handlers.push(handler);
  }

  getConfig(): AlertConfig {
    return { ...this.config };
  }

  private emit(alert: Alert): void {
    // Always emit as structured log
    const logMethod = alert.severity === 'critical' ? 'error' : 'warn';
    logger[logMethod](alert.message, {
      alert_type: alert.type,
      alert_severity: alert.severity,
      ...alert.metadata,
    });

    // Notify registered external handlers
    for (const handler of this.handlers) {
      try {
        const result = handler(alert);
        if (result instanceof Promise) {
          result.catch((err) => {
            logger.error('Alert handler failed', {
              error: (err as Error).message,
              alert_type: alert.type,
            });
          });
        }
      } catch (err) {
        logger.error('Alert handler threw synchronously', {
          error: (err as Error).message,
          alert_type: alert.type,
        });
      }
    }
  }
}


let instance: AlertingService | null = null;

/**
 * Get the singleton AlertingService instance.
 */
export function getAlertingService(): AlertingService {
  if (!instance) {
    instance = new AlertingServiceImpl();
  }
  return instance;
}

/**
 * Create a fresh AlertingService with custom config (useful for testing).
 */
export function createAlertingService(config: Partial<AlertConfig> = {}): AlertingService {
  return new AlertingServiceImpl(config);
}
