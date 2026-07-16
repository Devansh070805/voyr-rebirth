/**
 * Package Routes — Express router for package management endpoints.
 *
 * POST   /package              — Create a new draft package
 * GET    /package/:id          — Get a package by ID
 * GET    /package/:id/items    — List items in a package
 * POST   /package/:id/items    — Add an item to a draft package
 * DELETE /package/:id/items/:itemId — Remove an item from a draft package
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createPackageService } from './package.service.js';
import { requireDate, requirePositiveInt, requireString } from '../../infra/index.js';

const router = Router();
const packageService = createPackageService();

/**
 * POST /package
 * Body: { destination: string, nights: number, people: number }
 * Header: x-user-id (set by gateway after JWT validation)
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireString(req.headers['x-user-id'] as string, 'x-user-id header');
    const destination = requireString(req.body.destination, 'destination');
    const nights = requirePositiveInt(req.body.nights, 'nights');
    const people = requirePositiveInt(req.body.people, 'people');

    const result = await packageService.createPackage(userId, { destination, nights, people });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /package/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const packageId = requireString(req.params.id, 'id');
    const pkg = await packageService.getPackage(packageId);
    res.status(200).json(pkg);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /package/:id/items
 */
router.get('/:id/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const packageId = requireString(req.params.id, 'id');
    const items = await packageService.getPackageItems(packageId);
    res.status(200).json(items);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /package/:id/items
 * Body: { option_id: string, quantity: number, selected_date: string }
 */
router.post('/:id/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const packageId = requireString(req.params.id, 'id');
    const option_id = requireString(req.body.option_id, 'option_id');
    const quantity = requirePositiveInt(req.body.quantity, 'quantity');
    const selected_date = requireDate(req.body.selected_date, 'selected_date');

    const item = await packageService.addItem(packageId, { option_id, quantity, selected_date });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /package/:id/items/:itemId
 */
router.delete('/:id/items/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const packageId = requireString(req.params.id, 'id');
    const itemId = requireString(req.params.itemId, 'itemId');

    await packageService.removeItem(packageId, itemId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as packageRoutes };
