/**
 * Automated data refresh from the passport-index-dataset CSV.
 *
 * Usage:  $env:DATABASE_URL='...'; npx tsx src/db/refresh-from-passport-index.ts
 *
 * Fetches the latest passport-index-tidy-iso2.csv from GitHub,
 * parses it, and upserts visa requirements into travel_visa_requirements.
 */

import pg from 'pg';

const CSV_URL = 'https://raw.githubusercontent.com/ilyankou/passport-index-dataset/master/passport-index-tidy-iso2.csv';

// Map raw CSV requirement strings to our visa_status values
function mapStatus(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v === 'visa free') return 'visa_free';
  if (v === 'visa required') return 'visa_required';
  if (v === 'e-visa' || v === 'eVisa') return 'evisa_available';
  if (v === 'visa on arrival' || v === 'voa') return 'visa_on_arrival';
  if (v === 'no admission' || v === 'admission refused') return 'admission_refused';
  if (v === 'covid ban') return 'covid_ban';
  if (v === 'eta' || v === 'eta required') return 'eta_required';
  // Numeric = visa-free days
  const num = parseInt(v, 10);
  if (!isNaN(num)) return 'visa_free';
  return 'unknown';
}

interface CsvRow {
  passport: string;
  destination: string;
  requirement: string;
}

async function fetchCSV(): Promise<CsvRow[]> {
  console.log(`Fetching ${CSV_URL}...`);
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();

  const rows: CsvRow[] = [];
  const lines = body.split('\n');
  console.log(`Downloaded ${lines.length.toLocaleString()} lines`);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    if (cols.length < 3) continue;
    // Col 0 = passport ISO, Col 1 = destination ISO, Col 2 = requirement
    const passport = cols[0].replace(/"/g, '').trim().toUpperCase();
    const destination = cols[1].replace(/"/g, '').trim().toUpperCase();
    const requirement = cols.slice(2).join(',').replace(/"/g, '').trim();
    if (passport.length === 2 && destination.length === 2) {
      rows.push({ passport, destination, requirement });
    }
  }

  console.log(`Parsed ${rows.length.toLocaleString()} valid rows`);
  return rows;
}

async function upsertBatch(pool: pg.Pool, rows: CsvRow[], batchSize = 500) {
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const row of batch) {
      const status = mapStatus(row.requirement);
      values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2})`);
      params.push(row.passport, row.destination, status);
      paramIdx += 3;
    }

    const query = `
      INSERT INTO travel_visa_requirements (passport_country, destination_country, visa_status, last_verified)
      VALUES ${values.join(', ')}
      ON CONFLICT (passport_country, destination_country) DO UPDATE SET
        visa_status = EXCLUDED.visa_status,
        last_verified = CURRENT_DATE,
        updated_at = NOW()
    `;

    try {
      await pool.query(query, params);
      inserted += batch.length;
    } catch (err) {
      console.error(`  Batch ${i / batchSize + 1} failed:`, (err as Error).message);
    }

    if ((i / batchSize) % 10 === 0) {
      console.log(`  Progress: ${Math.min(i + batchSize, rows.length).toLocaleString()} / ${rows.length.toLocaleString()}`);
    }
  }

  return { inserted, updated };
}

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/voyr',
    max: 5,
  });

  try {
    // Load our 40 destination countries
    const destRes = await pool.query(`SELECT iso_code FROM travel_countries`);
    const ourDests = new Set(destRes.rows.map((r: { iso_code: string }) => r.iso_code));
    console.log(`Loaded ${ourDests.size} destination countries from our database`);

    const allRows = await fetchCSV();

    // Filter to only rows where destination is in our database
    const filtered = allRows.filter(r => ourDests.has(r.destination));
    console.log(`Filtered to ${filtered.length.toLocaleString()} rows (matching our ${ourDests.size} destinations)`);

    console.log('Upserting into database...');
    const result = await upsertBatch(pool, filtered);
    console.log(`Done! ${result.inserted.toLocaleString()} records processed`);
  } catch (err) {
    console.error('Refresh failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
