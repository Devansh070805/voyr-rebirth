/**
 * Seed demo inventory (supplier, hotel service, pricing, availability) for ops demos.
 */
import type pg from 'pg';

export async function seedInventoryData(pool: pg.Pool): Promise<void> {
  const existing = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM suppliers`,
  );
  if (Number(existing.rows[0]?.count || 0) > 0) {
    console.log('Inventory already seeded — skipping');
    return;
  }

  const location = await pool.query<{ id: string }>(
    `INSERT INTO locations (city, country, lat, lng)
     VALUES ('Bali', 'Indonesia', -8.4095, 115.1889)
     RETURNING id`,
  );
  const locationId = location.rows[0].id;

  const supplier = await pool.query<{ id: string }>(
    `INSERT INTO suppliers (name, type, metadata)
     VALUES ('Voyr Demo Hotels', 'hotel', '{"tier":"demo"}'::jsonb)
     RETURNING id`,
  );
  const supplierId = supplier.rows[0].id;

  const service = await pool.query<{ id: string }>(
    `INSERT INTO services (supplier_id, location_id, type, name, metadata)
     VALUES ($1, $2, 'hotel', 'Ubud Garden Resort', '{"stars":4}'::jsonb)
     RETURNING id`,
    [supplierId, locationId],
  );
  const serviceId = service.rows[0].id;

  const option = await pool.query<{ id: string }>(
    `INSERT INTO service_options (service_id, name, capacity, metadata)
     VALUES ($1, 'Deluxe Room', 2, '{}'::jsonb)
     RETURNING id`,
    [serviceId],
  );
  const optionId = option.rows[0].id;

  const today = new Date();
  const validFrom = today.toISOString().slice(0, 10);
  const validToDate = new Date(today);
  validToDate.setFullYear(validToDate.getFullYear() + 1);
  const validTo = validToDate.toISOString().slice(0, 10);

  await pool.query(
    `INSERT INTO service_prices (option_id, price, currency, valid_from, valid_to)
     VALUES ($1, 12000, 'INR', $2, $3)`,
    [optionId, validFrom, validTo],
  );

  await pool.query(
    `INSERT INTO service_policies (service_id, cancellation_policy, refund_rules)
     VALUES ($1, 'Free cancellation up to 7 days before check-in.', 'Full refund if cancelled within policy window.')`,
    [serviceId],
  );

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO service_availability (option_id, date, available)
       VALUES ($1, $2, true)
       ON CONFLICT (option_id, date) DO NOTHING`,
      [optionId, dateStr],
    );
  }

  console.log('Inventory demo seed complete');
}
