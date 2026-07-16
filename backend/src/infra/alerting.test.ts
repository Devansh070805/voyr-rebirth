/**
 * Tests for Alerting Service.
 *
 * Validates:
 * - Webhook failure alerts are emitted
 * - Alert handlers are called correctly
 * - Configuration is applied
 * - Periodic checks can be started and stopped
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAlertingService } from './alerting.service.js';
import type { AlertingService, Alert } from './alerting.service.js';

// Mock the database module
vi.mock('../db/index.js', () => ({
  queryRows: vi.fn().mockResolvedValue([]),
}));

describe('AlertingService', () => {
  let alerting: AlertingService;

  beforeEach(() => {
    alerting = createAlertingService({
      bookingPendingThresholdMs: 3600000, // 1 hour
      queueBacklogThreshold: 100,
      checkIntervalMs: 60000,
    });
  });

  describe('alertWebhookFailure', () => {
    it('should emit a webhook failure alert', () => {
      const alerts: Alert[] = [];
      alerting.registerHandler((alert) => {
        alerts.push(alert);
      });

      alerting.alertWebhookFailure('payment-123', 'Invalid signature');

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('webhook_processing_failure');
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].metadata.paymentId).toBe('payment-123');
      expect(alerts[0].metadata.error).toBe('Invalid signature');
    });

    it('should include timestamp in alert', () => {
      const alerts: Alert[] = [];
      alerting.registerHandler((alert) => {
        alerts.push(alert);
      });

      const before = new Date().toISOString();
      alerting.alertWebhookFailure('pay-1', 'timeout');
      const after = new Date().toISOString();

      expect(alerts[0].timestamp >= before).toBe(true);
      expect(alerts[0].timestamp <= after).toBe(true);
    });
  });

  describe('registerHandler', () => {
    it('should call all registered handlers on alert', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      alerting.registerHandler(handler1);
      alerting.registerHandler(handler2);

      alerting.alertWebhookFailure('pay-1', 'error');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should not fail if a handler throws', () => {
      const failingHandler = vi.fn(() => {
        throw new Error('handler error');
      });
      const successHandler = vi.fn();

      alerting.registerHandler(failingHandler);
      alerting.registerHandler(successHandler);

      // Should not throw
      expect(() => {
        alerting.alertWebhookFailure('pay-1', 'error');
      }).not.toThrow();

      // Second handler should still be called
      expect(successHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle async handlers gracefully', () => {
      const asyncHandler = vi.fn(async () => {
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 1));
      });

      alerting.registerHandler(asyncHandler);

      // Should not throw
      expect(() => {
        alerting.alertWebhookFailure('pay-1', 'error');
      }).not.toThrow();

      expect(asyncHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkStuckBookings', () => {
    it('should not emit alert when no stuck bookings', async () => {
      const alerts: Alert[] = [];
      alerting.registerHandler((alert) => {
        alerts.push(alert);
      });

      await alerting.checkStuckBookings();

      expect(alerts).toHaveLength(0);
    });

    it('should emit alert when stuck bookings exist', async () => {
      const { queryRows } = await import('../db/index.js');
      (queryRows as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: 'booking-1', created_at: '2024-01-01T00:00:00Z' },
        { id: 'booking-2', created_at: '2024-01-01T01:00:00Z' },
      ]);

      const alerts: Alert[] = [];
      alerting.registerHandler((alert) => {
        alerts.push(alert);
      });

      await alerting.checkStuckBookings();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('booking_stuck_documents');
      expect(alerts[0].severity).toBe('warning');
      expect(alerts[0].metadata.count).toBe(2);
      expect(alerts[0].metadata.bookingIds).toEqual(['booking-1', 'booking-2']);
    });
  });

  describe('checkQueueBacklog', () => {
    it('should not emit alert when backlog is within threshold', async () => {
      const { queryRows } = await import('../db/index.js');
      (queryRows as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ count: '50' }]);

      const alerts: Alert[] = [];
      alerting.registerHandler((alert) => {
        alerts.push(alert);
      });

      await alerting.checkQueueBacklog();

      expect(alerts).toHaveLength(0);
    });

    it('should emit alert when backlog exceeds threshold', async () => {
      const { queryRows } = await import('../db/index.js');
      (queryRows as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ count: '150' }]);

      const alerts: Alert[] = [];
      alerting.registerHandler((alert) => {
        alerts.push(alert);
      });

      await alerting.checkQueueBacklog();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('queue_backlog_exceeded');
      expect(alerts[0].severity).toBe('warning');
      expect(alerts[0].metadata.currentBacklog).toBe(150);
      expect(alerts[0].metadata.threshold).toBe(100);
    });
  });

  describe('periodic checks', () => {
    it('should start and stop periodic checks', () => {
      alerting.startPeriodicChecks();
      // Starting again should be a no-op
      alerting.startPeriodicChecks();

      alerting.stopPeriodicChecks();
      // Stopping again should be a no-op
      alerting.stopPeriodicChecks();
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = alerting.getConfig();

      expect(config.bookingPendingThresholdMs).toBe(3600000);
      expect(config.queueBacklogThreshold).toBe(100);
      expect(config.checkIntervalMs).toBe(60000);
    });

    it('should return a copy (not mutable reference)', () => {
      const config = alerting.getConfig();
      config.queueBacklogThreshold = 999;

      const config2 = alerting.getConfig();
      expect(config2.queueBacklogThreshold).toBe(100);
    });
  });
});
