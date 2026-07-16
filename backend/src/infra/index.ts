// Infrastructure — Idempotency, state machine, audit, retry, logging, metrics, alerting
export { createIdempotencyService } from './idempotency.service.js';
export type { IdempotencyService, IdempotencyRecord } from './idempotency.service.js';

export { createStateMachineEngine, createStateMachine, TRANSITION_TABLE } from './state-machine.engine.js';
export type { StateMachineEngine, BookingState } from './state-machine.engine.js';
export { iterSSEDataLines } from './sse-utils.js';

export { logAudit } from './audit.service.js';

export { createLogger } from './logger.js';
export type { Logger, LogLevel } from './logger.js';

export {
  withRetry,
  withRetryOrThrow,
  createDeadLetterQueueConsumer,
  isHttpRetryable,
  RETRY_PAYMENT_WEBHOOK,
  RETRY_EXTERNAL_API,
  RETRY_QUEUE_CONSUMER,
  RETRY_PAYMENT_PROVIDER,
} from './retry.js';
export type { RetryOptions, RetryResult, DeadLetterMessage, DeadLetterQueueConsumer } from './retry.js';

export {
  errorHandler,
  AppError,
  ConflictError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  InvalidTransitionError,
} from './error-handler.js';

export { getMetricsService, createMetricsService } from './metrics.service.js';
export type { MetricsService, MetricsSummary, LatencyMetric } from './metrics.service.js';

export { requestLatencyMiddleware } from './metrics.middleware.js';

export { getAlertingService, createAlertingService } from './alerting.service.js';
export type { AlertingService, AlertConfig, Alert, AlertType, AlertHandler } from './alerting.service.js';

export * from './admin.middleware.js';
export * from './auth.middleware.js';
export * from './metrics.middleware.js';
export * from './request-context.middleware.js';
export * from './cache.middleware.js';
export * from './redis.js';
export * from './rate-limit.middleware.js';

export {
  requireString,
  requireNumber,
  requirePositiveNumber,
  requirePositiveInt,
  requireDate,
  requireBoolean,
  requireIdempotencyKey,
} from './validation.js';
