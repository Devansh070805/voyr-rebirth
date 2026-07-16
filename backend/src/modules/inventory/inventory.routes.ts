/**
 * Inventory Routes — Express router for inventory management endpoints.
 *
 * POST /suppliers         — Create a supplier
 * GET  /suppliers         — List suppliers (optional ?type= filter)
 * POST /services          — Create a service
 * GET  /services          — List services (optional ?supplier_id=, ?location_id=, ?type= filters)
 * POST /options           — Create a service option
 * GET  /options           — List options for a service (?service_id= required)
 * POST /prices            — Set a price for an option
 * POST /availability      — Set availability for an option
 * POST /policies          — Set a policy for a service
 * POST /locations         — Create a location
 * GET  /locations         — List locations (optional ?country=, ?city= filters)
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createInventoryService } from './inventory.service.js';
import { ValidationError } from '../../infra/error-handler.js';
import {
  requireBoolean,
  requireDate,
  requireNumber,
  requirePositiveInt,
  requirePositiveNumber,
  requireString,
} from '../../infra/index.js';

const router = Router();
const inventoryService = createInventoryService();

/**
 * POST /suppliers
 * Body: { name: string, type: string, metadata?: object }
 */
router.post('/suppliers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const name = requireString(req.body.name, 'name');
    const type = requireString(req.body.type, 'type');
    const metadata = req.body.metadata || {};

    const supplier = await inventoryService.createSupplier({ name, type, metadata });
    res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /suppliers
 * Query: ?type=
 */
router.get('/suppliers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = req.query.type as string | undefined;
    const suppliers = await inventoryService.listSuppliers({ type });
    res.status(200).json(suppliers);
  } catch (err) {
    next(err);
  }
});


/**
 * POST /services
 * Body: { supplier_id: string, location_id: string, type: string, name: string, metadata?: object }
 */
router.post('/services', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier_id = requireString(req.body.supplier_id, 'supplier_id');
    const location_id = requireString(req.body.location_id, 'location_id');
    const type = requireString(req.body.type, 'type');
    const name = requireString(req.body.name, 'name');
    const metadata = req.body.metadata || {};

    const service = await inventoryService.createService({ supplier_id, location_id, type, name, metadata });
    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /services
 * Query: ?supplier_id=, ?location_id=, ?type=
 */
router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier_id = req.query.supplier_id as string | undefined;
    const location_id = req.query.location_id as string | undefined;
    const type = req.query.type as string | undefined;
    const services = await inventoryService.listServices({ supplier_id, location_id, type });
    res.status(200).json(services);
  } catch (err) {
    next(err);
  }
});


/**
 * POST /options
 * Body: { service_id: string, name: string, capacity: number, metadata?: object }
 */
router.post('/options', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service_id = requireString(req.body.service_id, 'service_id');
    const name = requireString(req.body.name, 'name');
    const capacity = requirePositiveInt(req.body.capacity, 'capacity');
    const metadata = req.body.metadata || {};

    const option = await inventoryService.createOption({ service_id, name, capacity, metadata });
    res.status(201).json(option);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /options
 * Query: ?service_id= (required)
 */
router.get('/options', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service_id = req.query.service_id as string | undefined;
    if (!service_id) {
      throw new ValidationError('service_id query parameter is required');
    }
    const options = await inventoryService.listOptions(service_id);
    res.status(200).json(options);
  } catch (err) {
    next(err);
  }
});


/**
 * POST /prices
 * Body: { option_id: string, price: number, currency: string, valid_from: string, valid_to: string }
 */
router.post('/prices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const option_id = requireString(req.body.option_id, 'option_id');
    const price = requirePositiveNumber(req.body.price, 'price');
    const currency = requireString(req.body.currency, 'currency');
    const valid_from = requireDate(req.body.valid_from, 'valid_from');
    const valid_to = requireDate(req.body.valid_to, 'valid_to');

    if (valid_from > valid_to) {
      throw new ValidationError('valid_from must be before or equal to valid_to');
    }

    const priceRecord = await inventoryService.setPrice({ option_id, price, currency, valid_from, valid_to });
    res.status(201).json(priceRecord);
  } catch (err) {
    next(err);
  }
});


/**
 * POST /availability
 * Body: { option_id: string, date: string, available: boolean }
 */
router.post('/availability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const option_id = requireString(req.body.option_id, 'option_id');
    const date = requireDate(req.body.date, 'date');
    const available = requireBoolean(req.body.available, 'available');

    const availability = await inventoryService.setAvailability({ option_id, date, available });
    res.status(201).json(availability);
  } catch (err) {
    next(err);
  }
});


/**
 * POST /policies
 * Body: { service_id: string, cancellation_policy: string, refund_rules: string }
 */
router.post('/policies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service_id = requireString(req.body.service_id, 'service_id');
    const cancellation_policy = requireString(req.body.cancellation_policy, 'cancellation_policy');
    const refund_rules = requireString(req.body.refund_rules, 'refund_rules');

    const policy = await inventoryService.setPolicy({ service_id, cancellation_policy, refund_rules });
    res.status(201).json(policy);
  } catch (err) {
    next(err);
  }
});


/**
 * POST /locations
 * Body: { city: string, country: string, lat: number, lng: number }
 */
router.post('/locations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const city = requireString(req.body.city, 'city');
    const country = requireString(req.body.country, 'country');
    const lat = requireNumber(req.body.lat, 'lat');
    const lng = requireNumber(req.body.lng, 'lng');

    const location = await inventoryService.createLocation({ city, country, lat, lng });
    res.status(201).json(location);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /locations
 * Query: ?country=, ?city=
 */
router.get('/locations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const country = req.query.country as string | undefined;
    const city = req.query.city as string | undefined;
    const locations = await inventoryService.listLocations({ country, city });
    res.status(200).json(locations);
  } catch (err) {
    next(err);
  }
});

export { router as inventoryRoutes };
