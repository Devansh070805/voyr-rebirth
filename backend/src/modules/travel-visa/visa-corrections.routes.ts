import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { pool } from '../../db/index.js';
import { requireAdmin } from '../../infra/admin.middleware.js';

const router = Router();

router.post('/corrections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { passport_country, destination_country, field, current_value, suggested_value, notes } = req.body;

    if (!passport_country || !destination_country || !field || !suggested_value) {
      res.status(400).json({ error: { message: 'passport_country, destination_country, field, and suggested_value are required', statusCode: 400 } });
      return;
    }

    const result = await pool.query(
      `INSERT INTO visa_corrections (passport_country, destination_country, field, current_value, suggested_value, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status, created_at`,
      [passport_country.toUpperCase(), destination_country.toUpperCase(), field, current_value || null, suggested_value, notes || null]
    );

    res.status(201).json({ correction: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get('/corrections', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      `SELECT id, passport_country, destination_country, field, current_value, suggested_value, notes, status, admin_notes, reviewed_by, reviewed_at, created_at
       FROM visa_corrections
       ORDER BY created_at DESC
       LIMIT 100`
    );
    res.json({ corrections: result.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/corrections/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, admin_notes, reviewed_by } = req.body;

    if (!status) {
      res.status(400).json({ error: { message: 'status is required', statusCode: 400 } });
      return;
    }

    const result = await pool.query(
      `UPDATE visa_corrections
       SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $4
       RETURNING id, status, admin_notes, reviewed_at`,
      [status, admin_notes || null, reviewed_by || null, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: { message: 'Correction not found', statusCode: 404 } });
      return;
    }

    res.json({ correction: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export { router as visaCorrectionsRoutes };
