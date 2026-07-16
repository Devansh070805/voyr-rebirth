/**
 * Request Latency Tracking Middleware
 *
 * Measures per-request duration and records it via the MetricsService.
 * Emits structured JSON logs with method, path, status code, and duration.
 *
 * Requirements: 19.2
 */

import type { Request, Response, NextFunction } from 'express';
import { getMetricsService } from './metrics.service.js';

export function requestLatencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationNs = Number(endTime - startTime);
    const durationMs = durationNs / 1_000_000;

    const metrics = getMetricsService();
    metrics.recordLatency({
      method: req.method,
      path: normalizePath(req.route?.path || req.path),
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      timestamp: new Date().toISOString(),
    });
  });

  next();
}

/**
 * Normalize path to avoid high-cardinality metric labels.
 */
function normalizePath(path: string): string {
  return path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id',
  );
}
