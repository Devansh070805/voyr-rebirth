import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../infra/error-handler.js';
import { createTravelVisaService } from './travel-visa.service.js';
import type { VisaCheckRequest, MultiVisaCheckRequest } from './travel-visa.types.js';
import { pool } from '../../db/index.js';

const router = Router();
const service = createTravelVisaService(pool);

// Validate ISO country code
function validateCountryCode(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.length !== 2) {
    throw new ValidationError(`${fieldName} must be a 2-letter ISO country code`);
  }
  return value.toUpperCase();
}

// Validate array of country codes
function validateCountryCodes(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty array`);
  }
  if (value.length > 50) {
    throw new ValidationError(`${fieldName} cannot contain more than 50 countries`);
  }
  return value.map((code, index) => {
    if (typeof code !== 'string' || code.length !== 2) {
      throw new ValidationError(`${fieldName}[${index}] must be a 2-letter ISO country code`);
    }
    return code.toUpperCase();
  });
}

/**
 * GET /travel-visa/countries
 * Get all countries
 */
router.get('/countries', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const countries = await service.getAllCountries();
    res.json({ countries });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /travel-visa/countries/popular
 * Get popular tourist destinations
 */
router.get('/countries/popular', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const countries = await service.getPopularDestinations();
    res.json({ countries });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /travel-visa/countries/:code
 * Get country by ISO code
 */
router.get('/countries/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = validateCountryCode(req.params.code, 'code');
    const country = await service.getCountry(code);
    if (!country) {
      res.status(404).json({ error: 'Country not found' });
      return;
    }
    res.json({ country });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /travel-visa/check
 * Check visa requirement for a single destination
 * Body: { passport_country: string, destination_country: string, purpose?: string }
 */
router.post('/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
    
    const request: VisaCheckRequest = {
      passport_country: validateCountryCode(body.passport_country, 'passport_country'),
      destination_country: validateCountryCode(body.destination_country, 'destination_country'),
      purpose: (body.purpose as VisaCheckRequest['purpose']) || 'tourism',
    };

    const result = await service.checkVisa(request);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /travel-visa/check-multiple
 * Check visa requirements for multiple destinations
 * Body: { passport_country: string, destinations: string[], purpose?: string }
 */
router.post('/check-multiple', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
    
    const request: MultiVisaCheckRequest = {
      passport_country: validateCountryCode(body.passport_country, 'passport_country'),
      destinations: validateCountryCodes(body.destinations, 'destinations'),
      purpose: (body.purpose as MultiVisaCheckRequest['purpose']) || 'tourism',
    };

    const result = await service.checkMultipleVisas(request);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /travel-visa/destinations/:code/documents
 * Get required documents for a destination
 */
router.get('/destinations/:code/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = validateCountryCode(req.params.code, 'code');
    const visaType = typeof req.query.visa_type === 'string' ? req.query.visa_type : undefined;
    
    const documents = await service.getVisaDocuments(code, visaType);
    res.json({ destination: code, documents });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /travel-visa/destinations/:code/fees
 * Get visa fees for a destination
 */
router.get('/destinations/:code/fees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = validateCountryCode(req.params.code, 'code');
    const visaType = typeof req.query.visa_type === 'string' ? req.query.visa_type : undefined;
    
    const fees = await service.getVisaFees(code, visaType);
    res.json({ destination: code, fees });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /travel-visa/destinations/:code
 * Get complete visa information for a destination
 */
router.get('/destinations/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = validateCountryCode(req.params.code, 'code');
    
    const country = await service.getCountry(code);
    if (!country) {
      res.status(404).json({ error: 'Country not found' });
      return;
    }

    const [documents, fees] = await Promise.all([
      service.getVisaDocuments(code),
      service.getVisaFees(code),
    ]);

    res.json({
      country,
      documents,
      fees,
    });
  } catch (err) {
    next(err);
  }
});

export { router as travelVisaRoutes };
