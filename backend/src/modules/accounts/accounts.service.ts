import { query } from '../../db/index.js';

export interface AccountsService {
  getClients(agentAccountId: string): Promise<any[]>;
  createClient(agentAccountId: string, data: any): Promise<any>;
  getEmployees(corporateAccountId: string): Promise<any[]>;
  createEmployee(corporateAccountId: string, data: any): Promise<any>;
  getAccountWallet(accountId: string): Promise<any>;
  getAccountInvoices(accountId: string): Promise<any[]>;
}

export function createAccountsService(): AccountsService {
  return {
    async getClients(agentAccountId: string) {
      const res = await query(
        `SELECT id, name, email, phone, travel_preference, passport_details, notes, created_at 
         FROM clients WHERE agent_account_id = $1 ORDER BY created_at DESC`,
        [agentAccountId]
      );
      return res.rows;
    },

    async createClient(agentAccountId: string, data: any) {
      const res = await query(
        `INSERT INTO clients (agent_account_id, name, email, phone, travel_preference, passport_details, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [agentAccountId, data.name, data.email, data.phone, data.travel_preference, data.passport_details, data.notes]
      );
      return res.rows[0];
    },

    async getEmployees(corporateAccountId: string) {
      const res = await query(
        `SELECT id, name, email, department, role, created_at 
         FROM employees WHERE corporate_account_id = $1 ORDER BY created_at DESC`,
        [corporateAccountId]
      );
      return res.rows;
    },

    async createEmployee(corporateAccountId: string, data: any) {
      const res = await query(
        `INSERT INTO employees (corporate_account_id, name, email, department, role)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [corporateAccountId, data.name, data.email, data.department, data.role]
      );
      return res.rows[0];
    },

    async getAccountWallet(accountId: string) {
      const res = await query(
        `SELECT balance, currency FROM wallets WHERE account_id = $1`,
        [accountId]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0];
    },

    async getAccountInvoices(accountId: string) {
      // Find bookings associated with this account, then their invoices
      const res = await query(
        `SELECT i.*, b.destination, b.status as booking_status 
         FROM invoices i 
         JOIN bookings b ON i.booking_id = b.id 
         WHERE b.parent_account_ref = $1 
         ORDER BY i.created_at DESC`,
        [accountId]
      );
      return res.rows;
    }
  };
}
