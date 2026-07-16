import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Add unique constraints needed for inventory upsert operations:
 * - service_availability(option_id, date) — for availability upsert
 * - service_policies(service_id) — for policy upsert (one policy per service)
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addConstraint('service_availability', 'service_availability_option_date_unique', {
    unique: ['option_id', 'date'],
  });

  pgm.addConstraint('service_policies', 'service_policies_service_id_unique', {
    unique: ['service_id'],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint('service_policies', 'service_policies_service_id_unique');
  pgm.dropConstraint('service_availability', 'service_availability_option_date_unique');
}
