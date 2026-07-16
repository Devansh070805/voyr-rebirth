import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS travel_visa_requirements (
      id SERIAL PRIMARY KEY,
      passport_country CHAR(2) NOT NULL,
      destination_country CHAR(2) NOT NULL,
      visa_status VARCHAR(50) NOT NULL,
      visa_type VARCHAR(100),
      max_stay_days INTEGER,
      notes TEXT,
      official_source_url TEXT,
      last_verified DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(passport_country, destination_country)
    );
  `);

  pgm.sql('CREATE INDEX IF NOT EXISTS idx_visa_passport ON travel_visa_requirements(passport_country);');
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_visa_destination ON travel_visa_requirements(destination_country);');

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS travel_countries (
      iso_code CHAR(2) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      flag_emoji VARCHAR(10),
      region VARCHAR(50),
      subregion VARCHAR(50),
      is_popular_destination BOOLEAN DEFAULT FALSE,
      requires_eta BOOLEAN DEFAULT FALSE,
      eta_url TEXT,
      official_visa_url TEXT,
      currency VARCHAR(10),
      languages JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS visa_documents (
      id SERIAL PRIMARY KEY,
      destination_country CHAR(2) NOT NULL,
      visa_type VARCHAR(100) NOT NULL,
      document_type VARCHAR(100) NOT NULL,
      is_required BOOLEAN DEFAULT TRUE,
      description TEXT,
      notes TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  pgm.sql('CREATE INDEX IF NOT EXISTS idx_visa_docs_destination ON visa_documents(destination_country);');

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS visa_fees (
      id SERIAL PRIMARY KEY,
      destination_country CHAR(2) NOT NULL,
      visa_type VARCHAR(100) NOT NULL,
      fee_amount DECIMAL(10, 2),
      fee_currency VARCHAR(10) DEFAULT 'USD',
      processing_time_days_min INTEGER,
      processing_time_days_max INTEGER,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(destination_country, visa_type)
    );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS visa_fees;');
  pgm.sql('DROP TABLE IF EXISTS visa_documents;');
  pgm.sql('DROP TABLE IF EXISTS travel_countries;');
  pgm.sql('DROP TABLE IF EXISTS travel_visa_requirements;');
}
