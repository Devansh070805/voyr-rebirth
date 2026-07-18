import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // 1. Accounts Table
  pgm.createTable('accounts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    type: { type: 'text', notNull: true }, // 'Individual', 'TravelAgent', 'Corporate', 'Admin'
    name: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: "'ACTIVE'" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // 2. User Accounts Mapping (to support multi-account or roles)
  pgm.createTable('user_accounts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    account_id: { type: 'uuid', notNull: true, references: 'accounts(id)', onDelete: 'CASCADE' },
    role: { type: 'text', notNull: true, default: "'OWNER'" }, // 'OWNER', 'EMPLOYEE', 'ADMIN'
    is_primary: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // 3. Travel Agent Profiles
  pgm.createTable('travel_agent_profiles', {
    account_id: { type: 'uuid', primaryKey: true, references: 'accounts(id)', onDelete: 'CASCADE' },
    agency_name: { type: 'text', notNull: true },
    contact_email: { type: 'text' },
    phone: { type: 'text' },
    commission_rate: { type: 'numeric' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // 4. Corporate Profiles
  pgm.createTable('corporate_profiles', {
    account_id: { type: 'uuid', primaryKey: true, references: 'accounts(id)', onDelete: 'CASCADE' },
    company_name: { type: 'text', notNull: true },
    contact_email: { type: 'text' },
    tax_id: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // 5. Clients (For Travel Agents)
  pgm.createTable('clients', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    agent_account_id: { type: 'uuid', notNull: true, references: 'accounts(id)', onDelete: 'CASCADE' },
    name: { type: 'text', notNull: true },
    email: { type: 'text' },
    phone: { type: 'text' },
    travel_preference: { type: 'text' },
    passport_details: { type: 'text' },
    notes: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // 6. Employees (For Corporates)
  pgm.createTable('employees', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    corporate_account_id: { type: 'uuid', notNull: true, references: 'accounts(id)', onDelete: 'CASCADE' },
    user_id: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' }, // Nullable if they don't have their own login yet
    name: { type: 'text', notNull: true },
    email: { type: 'text' },
    department: { type: 'text' },
    role: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // 7. Wallets & Wallet Transactions (For Accounting)
  pgm.createTable('wallets', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    account_id: { type: 'uuid', notNull: true, unique: true, references: 'accounts(id)', onDelete: 'CASCADE' },
    balance: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'text', notNull: true, default: "'USD'" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('wallet_transactions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    wallet_id: { type: 'uuid', notNull: true, references: 'wallets(id)', onDelete: 'CASCADE' },
    amount: { type: 'numeric', notNull: true },
    type: { type: 'text', notNull: true }, // 'CREDIT', 'DEBIT'
    description: { type: 'text' },
    booking_id: { type: 'uuid', references: 'bookings(id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('wallet_transactions');
  pgm.dropTable('wallets');
  pgm.dropTable('employees');
  pgm.dropTable('clients');
  pgm.dropTable('corporate_profiles');
  pgm.dropTable('travel_agent_profiles');
  pgm.dropTable('user_accounts');
  pgm.dropTable('accounts');
}
