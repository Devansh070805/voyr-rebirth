import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 005: Fix quote immutability trigger.
 *
 * The original trigger (migration 001) prevents ALL updates on the quotes table,
 * including status transitions (ACTIVE → EXPIRED). This migration replaces the
 * trigger to allow status-only transitions while still preventing changes to
 * financial fields (amounts, currency, valid_until, package_id).
 *
 * Fixes: Quote expiry (checkExpiry) was blocked by the blanket UPDATE prevention.
 */

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Drop the old blanket trigger and function
  pgm.sql('DROP TRIGGER IF EXISTS quotes_immutability_trigger ON quotes;');
  pgm.sql('DROP FUNCTION IF EXISTS prevent_quote_update();');

  // Create a new trigger that allows status transitions but prevents financial field changes
  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_quote_financial_update()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Allow status-only transitions (e.g., ACTIVE → EXPIRED)
      IF NEW.status IS DISTINCT FROM OLD.status
         AND NEW.package_id = OLD.package_id
         AND NEW.currency = OLD.currency
         AND NEW.base_amount = OLD.base_amount
         AND NEW.tax_amount = OLD.tax_amount
         AND NEW.markup_amount = OLD.markup_amount
         AND NEW.fee_amount = OLD.fee_amount
         AND NEW.discount_amount = OLD.discount_amount
         AND NEW.final_amount = OLD.final_amount
         AND NEW.valid_until = OLD.valid_until
         AND NEW.created_at = OLD.created_at
      THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'Only status transitions are allowed on the quotes table. Financial fields are immutable.';
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER quotes_immutability_trigger
    BEFORE UPDATE ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION prevent_quote_financial_update();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Revert to the original blanket trigger
  pgm.sql('DROP TRIGGER IF EXISTS quotes_immutability_trigger ON quotes;');
  pgm.sql('DROP FUNCTION IF EXISTS prevent_quote_financial_update();');

  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_quote_update()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'UPDATE operations are not allowed on the quotes table. Quotes are immutable.';
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER quotes_immutability_trigger
    BEFORE UPDATE ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION prevent_quote_update();
  `);
}
