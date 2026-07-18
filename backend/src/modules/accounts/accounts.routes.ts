import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createAccountsService } from './accounts.service.js';

const router = Router();
const accountsService = createAccountsService();

function requireAccountId(req: Request) {
  const accountId = req.headers['x-account-id'] as string;
  if (!accountId) throw new Error('Account ID is required');
  return accountId;
}

// Client routes (for Travel Agents)
router.get('/clients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = requireAccountId(req);
    const clients = await accountsService.getClients(accountId);
    res.json({ clients });
  } catch (err) {
    next(err);
  }
});

router.post('/clients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = requireAccountId(req);
    const client = await accountsService.createClient(accountId, req.body);
    res.json({ client });
  } catch (err) {
    next(err);
  }
});

// Employee routes (for Corporates)
router.get('/employees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = requireAccountId(req);
    const employees = await accountsService.getEmployees(accountId);
    res.json({ employees });
  } catch (err) {
    next(err);
  }
});

router.post('/employees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = requireAccountId(req);
    const employee = await accountsService.createEmployee(accountId, req.body);
    res.json({ employee });
  } catch (err) {
    next(err);
  }
});

// Financials
router.get('/wallet', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = requireAccountId(req);
    const wallet = await accountsService.getAccountWallet(accountId);
    res.json({ wallet });
  } catch (err) {
    next(err);
  }
});

router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = requireAccountId(req);
    const invoices = await accountsService.getAccountInvoices(accountId);
    res.json({ invoices });
  } catch (err) {
    next(err);
  }
});

export const accountsRoutes = router;
