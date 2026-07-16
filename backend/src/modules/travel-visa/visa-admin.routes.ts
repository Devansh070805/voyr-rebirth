import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { pool } from '../../db/index.js';
import { requireAdmin } from '../../infra/admin.middleware.js';

const router = Router();

router.use(requireAdmin);


router.get('/visa/admin/countries', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(`SELECT * FROM travel_countries ORDER BY name ASC`);
    res.json({ countries: result.rows });
  } catch (err) { next(err); }
});

router.put('/visa/admin/countries/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const { name, flag_emoji, region, subregion, is_popular_destination, requires_eta, eta_url, official_visa_url, currency, languages } = req.body;
    const result = await pool.query(
      `UPDATE travel_countries SET name=$1, flag_emoji=$2, region=$3, subregion=$4, is_popular_destination=$5, requires_eta=$6, eta_url=$7, official_visa_url=$8, currency=$9, languages=$10 WHERE iso_code=$11 RETURNING *`,
      [name, flag_emoji, region, subregion, is_popular_destination, requires_eta, eta_url, official_visa_url, currency, JSON.stringify(languages || []), (code as string).toUpperCase()]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ country: result.rows[0] });
  } catch (err) { next(err); }
});


router.get('/visa/admin/requirements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const passport = req.query.passport as string;
    const query = passport
      ? `SELECT * FROM travel_visa_requirements WHERE passport_country = $1 ORDER BY destination_country ASC`
      : `SELECT * FROM travel_visa_requirements ORDER BY passport_country, destination_country ASC LIMIT 200`;
    const result = await pool.query(query, passport ? [passport.toUpperCase()] : []);
    res.json({ requirements: result.rows });
  } catch (err) { next(err); }
});

router.put('/visa/admin/requirements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { passport_country, destination_country, visa_status, visa_type, max_stay_days, notes, official_source_url } = req.body;
    const result = await pool.query(
      `INSERT INTO travel_visa_requirements (passport_country, destination_country, visa_status, visa_type, max_stay_days, notes, official_source_url, last_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)
       ON CONFLICT (passport_country, destination_country) DO UPDATE SET
         visa_status=$3, visa_type=$4, max_stay_days=$5, notes=$6, official_source_url=$7, last_verified=CURRENT_DATE, updated_at=NOW()
       RETURNING *`,
      [passport_country.toUpperCase(), destination_country.toUpperCase(), visa_status, visa_type || null, max_stay_days || null, notes || null, official_source_url || null]
    );
    res.json({ requirement: result.rows[0] });
  } catch (err) { next(err); }
});

router.delete('/visa/admin/requirements/:passport/:destination', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { passport, destination } = req.params;
    const result = await pool.query(
      `DELETE FROM travel_visa_requirements WHERE passport_country=$1 AND destination_country=$2 RETURNING id`,
      [(passport as string).toUpperCase(), (destination as string).toUpperCase()]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ deleted: true });
  } catch (err) { next(err); }
});


router.get('/visa/admin/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dest = req.query.destination as string;
    const query = dest
      ? `SELECT * FROM visa_documents WHERE destination_country=$1 ORDER BY sort_order ASC`
      : `SELECT * FROM visa_documents ORDER BY destination_country, sort_order ASC LIMIT 200`;
    const result = await pool.query(query, dest ? [dest.toUpperCase()] : []);
    res.json({ documents: result.rows });
  } catch (err) { next(err); }
});

router.put('/visa/admin/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, destination_country, visa_type, document_type, is_required, description, notes, sort_order } = req.body;
    if (id) {
      const result = await pool.query(
        `UPDATE visa_documents SET destination_country=$1, visa_type=$2, document_type=$3, is_required=$4, description=$5, notes=$6, sort_order=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
        [destination_country.toUpperCase(), visa_type, document_type, is_required, description || null, notes || null, sort_order || 0, id]
      );
      res.json({ document: result.rows[0] });
    } else {
      const result = await pool.query(
        `INSERT INTO visa_documents (destination_country, visa_type, document_type, is_required, description, notes, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [destination_country.toUpperCase(), visa_type, document_type, is_required, description || null, notes || null, sort_order || 0]
      );
      res.status(201).json({ document: result.rows[0] });
    }
  } catch (err) { next(err); }
});


router.get('/visa/admin/fees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dest = req.query.destination as string;
    const query = dest
      ? `SELECT * FROM visa_fees WHERE destination_country=$1`
      : `SELECT * FROM visa_fees ORDER BY destination_country ASC`;
    const result = await pool.query(query, dest ? [dest.toUpperCase()] : []);
    res.json({ fees: result.rows });
  } catch (err) { next(err); }
});

router.put('/visa/admin/fees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { destination_country, visa_type, fee_amount, fee_currency, processing_time_days_min, processing_time_days_max, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO visa_fees (destination_country, visa_type, fee_amount, fee_currency, processing_time_days_min, processing_time_days_max, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (destination_country, visa_type) DO UPDATE SET
         fee_amount=$3, fee_currency=$4, processing_time_days_min=$5, processing_time_days_max=$6, notes=$7, updated_at=NOW()
       RETURNING *`,
      [destination_country.toUpperCase(), visa_type, fee_amount || null, fee_currency || 'USD', processing_time_days_min || null, processing_time_days_max || null, notes || null]
    );
    res.json({ fee: result.rows[0] });
  } catch (err) { next(err); }
});

export { router as visaAdminRoutes };
