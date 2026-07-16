/**
 * Admin Ops Routes — Express router for admin dashboard endpoints.
 *
 * GET /admin/active-bookings    — Confirmed bookings (document pipeline)
 * GET /admin/failed-payments    — Payments with FAILED status
 * GET /admin/expired-quotes     — Quotes with EXPIRED status
 * GET /admin/supplier-pending   — Bookings awaiting supplier confirmation
 * GET /admin/document-failures  — Document generation jobs that failed
 * GET /admin/refund-requests    — Bookings with REFUND_PENDING status
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createAdminOpsService } from './admin-ops.service.js';
import { isAdminRequest, requireAdmin } from '../../infra/admin.middleware.js';

const router = Router();
const adminOpsService = createAdminOpsService();

/**
 * GET /admin/access — whether the current user may use admin dashboards.
 */
router.get('/access', (req: Request, res: Response) => {
  res.status(200).json({ admin: isAdminRequest(req) });
});

// All other admin routes require admin authorization
router.use(requireAdmin);


/**
 * GET /admin/active-bookings
 * Returns recently confirmed bookings in the document/customer pipeline.
 */
router.get('/active-bookings', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await adminOpsService.getActiveBookings();
    res.status(200).json(bookings);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/failed-payments
 * Returns all payments in FAILED status.
 */
router.get('/failed-payments', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const payments = await adminOpsService.getFailedPayments();
    res.status(200).json(payments);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/expired-quotes
 * Returns all quotes in EXPIRED status.
 */
router.get('/expired-quotes', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const quotes = await adminOpsService.getExpiredQuotes();
    res.status(200).json(quotes);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/supplier-pending
 * Returns all bookings in SUPPLIER_CONFIRMATION_PENDING status.
 */
router.get('/supplier-pending', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await adminOpsService.getSupplierPending();
    res.status(200).json(bookings);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/document-failures
 * Returns all document generation jobs in FAILED status.
 */
router.get('/document-failures', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await adminOpsService.getDocumentFailures();
    res.status(200).json(jobs);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/refund-requests
 * Returns all bookings in REFUND_PENDING status.
 */
router.get('/refund-requests', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await adminOpsService.getRefundRequests();
    res.status(200).json(bookings);
  } catch (err) {
    next(err);
  }
});

router.get('/fulfillments', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await adminOpsService.getPendingFulfillments();
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

router.patch('/fulfillments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fulfillment_status, settlement_status } = req.body;
    const fulfillmentId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    await adminOpsService.updateFulfillmentStatus(
      fulfillmentId,
      fulfillment_status,
      settlement_status,
    );
    res.status(200).json({ updated: true });
  } catch (err) {
    next(err);
  }
});

export { router as adminOpsRoutes };
