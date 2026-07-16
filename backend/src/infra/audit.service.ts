/**
 * Audit Logging Service.
 * Cross-cutting concern that inserts audit trail entries into the audit_logs table.
 */

import { query } from '../db/index.js';
import { createLogger } from './logger.js';

const logger = createLogger('audit');

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

/**
 * Log an audit event.
 *
 * @param actor - Who performed the action (user ID, 'system', admin ID)
 * @param action - What was done (e.g., 'booking.confirmed', 'payment.created')
 * @param entity - Entity type (e.g., 'booking', 'payment', 'quote')
 * @param entityId - UUID of the affected entity (nullable for system-wide actions)
 * @param metadata - Additional context as JSON
 */
export async function logAudit(
  actor: string,
  action: string,
  entity: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (actor, action, entity, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [actor, action, entity, entityId, JSON.stringify(metadata)],
    );
  } catch (error) {
    // Audit logging should never break the main operation.
    // Log the failure and continue.
    logger.error('Failed to write audit log', {
      actor,
      action,
      entity,
      entityId,
      error: (error as Error).message,
    });
  }
}
