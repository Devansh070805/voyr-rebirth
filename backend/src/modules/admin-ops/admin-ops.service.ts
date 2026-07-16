/**
 * Admin Ops Service — Dashboard queries for operational management.
 *
 * Implements the AdminOpsService interface from the design document.
 *
 * Provides filtered views of:
 * - Active bookings (confirmed, in document pipeline)
 * - Failed payments
 * - Expired quotes
 * - Supplier-pending bookings
 * - Document generation failures
 * - Refund requests
 */

import { queryRows } from '../../db/index.js';
import { createLogger } from '../../infra/index.js';

const logger = createLogger('admin-ops-service');


export interface Booking {
  id: string;
  quote_id: string;
  status: string;
  created_at: string;
}

export interface Payment {
  id: string;
  quote_id: string;
  provider: string;
  provider_ref: string | null;
  amount: number;
  status: string;
  created_at: string;
}

export interface Quote {
  id: string;
  package_id: string;
  currency: string;
  final_amount: number;
  valid_until: string;
  status: string;
  created_at: string;
}

export interface DocumentJob {
  id: string;
  booking_id: string;
  status: string;
}

export interface BookingFulfillmentRow {
  id: string;
  booking_id: string;
  supply_source: string;
  supply_product: string;
  fulfillment_status: string;
  settlement_status: string;
  sell_amount: number;
  cost_amount: number;
  currency: string;
  created_at: string;
}

export interface AdminOpsService {
  getActiveBookings(): Promise<Booking[]>;
  getFailedPayments(): Promise<Payment[]>;
  getExpiredQuotes(): Promise<Quote[]>;
  getSupplierPending(): Promise<Booking[]>;
  getDocumentFailures(): Promise<DocumentJob[]>;
  getRefundRequests(): Promise<Booking[]>;
  getPendingFulfillments(): Promise<BookingFulfillmentRow[]>;
  updateFulfillmentStatus(id: string, status: string, settlementStatus?: string): Promise<void>;
}


export function createAdminOpsService(): AdminOpsService {
  return {
    /**
     * Bookings confirmed after payment (document pipeline in progress or complete).
     */
    async getActiveBookings(): Promise<Booking[]> {
      logger.info('Fetching active bookings');
      const bookings = await queryRows<Booking>(
        `SELECT id, quote_id, status, created_at
         FROM bookings
         WHERE status = ANY($1::text[])
         ORDER BY created_at DESC
         LIMIT 100`,
        [['BOOKING_CONFIRMED', 'DOCUMENTS_GENERATING', 'DOCUMENTS_GENERATED', 'CUSTOMER_NOTIFIED']],
      );
      logger.info('Active bookings fetched', { count: bookings.length });
      return bookings;
    },

    /**
     * Get all payments with FAILED status.
     */
    async getFailedPayments(): Promise<Payment[]> {
      logger.info('Fetching failed payments');
      const payments = await queryRows<Payment>(
        `SELECT id, quote_id, provider, provider_ref, amount, status, created_at
         FROM payments
         WHERE status = $1
         ORDER BY created_at DESC`,
        ['FAILED'],
      );
      logger.info('Failed payments fetched', { count: payments.length });
      return payments;
    },

    /**
     * Get all quotes with EXPIRED status.
     */
    async getExpiredQuotes(): Promise<Quote[]> {
      logger.info('Fetching expired quotes');
      const quotes = await queryRows<Quote>(
        `SELECT id, package_id, currency, final_amount, valid_until, status, created_at
         FROM quotes
         WHERE status = $1
         ORDER BY valid_until DESC`,
        ['EXPIRED'],
      );
      logger.info('Expired quotes fetched', { count: quotes.length });
      return quotes;
    },

    /**
     * Get all bookings awaiting supplier confirmation.
     */
    async getSupplierPending(): Promise<Booking[]> {
      logger.info('Fetching supplier-pending bookings');
      const bookings = await queryRows<Booking>(
        `SELECT id, quote_id, status, created_at
         FROM bookings
         WHERE status = $1
         ORDER BY created_at ASC`,
        ['SUPPLIER_CONFIRMATION_PENDING'],
      );
      logger.info('Supplier-pending bookings fetched', { count: bookings.length });
      return bookings;
    },

    /**
     * Get all document generation jobs that have failed.
     */
    async getDocumentFailures(): Promise<DocumentJob[]> {
      logger.info('Fetching document failures');
      const jobs = await queryRows<DocumentJob>(
        `SELECT id, booking_id, status
         FROM document_jobs
         WHERE status = $1
         ORDER BY booking_id`,
        ['FAILED'],
      );
      logger.info('Document failures fetched', { count: jobs.length });
      return jobs;
    },

    /**
     * Get all bookings with a pending refund.
     */
    async getRefundRequests(): Promise<Booking[]> {
      logger.info('Fetching refund requests');
      const bookings = await queryRows<Booking>(
        `SELECT id, quote_id, status, created_at
         FROM bookings
         WHERE status = $1
         ORDER BY created_at ASC`,
        ['REFUND_PENDING'],
      );
      logger.info('Refund requests fetched', { count: bookings.length });
      return bookings;
    },

    async getPendingFulfillments(): Promise<BookingFulfillmentRow[]> {
      return queryRows<BookingFulfillmentRow>(
        `SELECT id, booking_id, supply_source, supply_product, fulfillment_status,
                settlement_status, sell_amount, cost_amount, currency, created_at
         FROM booking_fulfillments
         WHERE fulfillment_status NOT IN ('confirmed', 'cancelled')
         ORDER BY created_at DESC
         LIMIT 100`,
      );
    },

    async updateFulfillmentStatus(id: string, status: string, settlementStatus?: string): Promise<void> {
      const { createFulfillmentService } = await import('../fulfillment/fulfillment.service.js');
      await createFulfillmentService().updateStatus(id, {
        fulfillment_status: status,
        settlement_status: settlementStatus,
      });
    },
  };
}
