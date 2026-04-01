import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /registrations/competition/:competitionId — ADMIN only
router.get('/competition/:competitionId', authenticate, authorize('ADMIN'), (req, res) => {
  const competition = db.prepare('SELECT id FROM competition WHERE id = ?').get(req.params.competitionId);
  if (!competition) return res.status(404).json({ error: 'Competition not found' });

  let query = `
    SELECT r.id, r.athlete_id, u.name, u.email, r.status, r.seed, r.registered_at,
           r.division_id, d.name as division_name
    FROM registration r
    JOIN user u ON r.athlete_id = u.id
    JOIN division d ON r.division_id = d.id
    WHERE r.competition_id = ?
  `;
  const params = [req.params.competitionId];

  if (req.query.division_id) {
    query += ' AND r.division_id = ?';
    params.push(req.query.division_id);
  }

  query += ' ORDER BY d.display_order, r.registered_at';
  const registrations = db.prepare(query).all(...params);

  res.json(registrations);
});

// POST /registrations — ATHLETE only
router.post('/', authenticate, authorize('ATHLETE'), (req, res) => {
  const { division_id } = req.body;

  if (!division_id) {
    return res.status(400).json({ error: 'division_id is required' });
  }

  // Look up division and its competition
  const division = db.prepare(`
    SELECT d.id, d.competition_id, c.status
    FROM division d
    JOIN competition c ON d.competition_id = c.id
    WHERE d.id = ?
  `).get(division_id);
  if (!division) return res.status(404).json({ error: 'Division not found' });
  if (division.status !== 'DRAFT') {
    return res.status(400).json({ error: 'Registration is closed' });
  }

  // Check duplicate within division
  const existing = db.prepare(
    'SELECT id FROM registration WHERE division_id = ? AND athlete_id = ?'
  ).get(division_id, req.user.id);
  if (existing) return res.status(409).json({ error: 'Already registered for this division' });

  const id = uuidv4();
  db.prepare(
    'INSERT INTO registration (id, competition_id, division_id, athlete_id, status) VALUES (?, ?, ?, ?, ?)'
  ).run(id, division.competition_id, division_id, req.user.id, 'CONFIRMED');

  res.status(201).json({
    id,
    competition_id: division.competition_id,
    division_id,
    athlete_id: req.user.id,
    status: 'CONFIRMED',
    registered_at: new Date().toISOString()
  });
});

// PATCH /registrations/:id — ADMIN only (change status)
router.patch('/:id', authenticate, authorize('ADMIN'), (req, res) => {
  const { status } = req.body;

  if (!status || !['PENDING', 'CONFIRMED', 'WITHDRAWN'].includes(status)) {
    return res.status(400).json({ error: 'Status must be PENDING, CONFIRMED, or WITHDRAWN' });
  }

  const reg = db.prepare('SELECT * FROM registration WHERE id = ?').get(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Registration not found' });

  db.prepare('UPDATE registration SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ id: req.params.id, status });
});

// PATCH /registrations/:id/seed — ADMIN only
router.patch('/:id/seed', authenticate, authorize('ADMIN'), (req, res) => {
  const { seed } = req.body;

  if (seed === undefined || seed === null) {
    return res.status(400).json({ error: 'seed is required' });
  }

  if (!Number.isInteger(seed) || seed < 0) {
    return res.status(400).json({ error: 'seed must be a non-negative integer' });
  }

  const reg = db.prepare('SELECT * FROM registration WHERE id = ?').get(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Registration not found' });

  db.prepare('UPDATE registration SET seed = ? WHERE id = ?').run(seed, req.params.id);
  res.json({ id: req.params.id, seed });
});

// DELETE /registrations/:id — ADMIN only
router.delete('/:id', authenticate, authorize('ADMIN'), (req, res) => {
  const reg = db.prepare('SELECT * FROM registration WHERE id = ?').get(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Registration not found' });

  // Block if athlete is assigned to any heat in this division
  const inHeat = db.prepare(`
    SELECT ha.id FROM heat_athlete ha
    JOIN heat h ON ha.heat_id = h.id
    JOIN stage s ON h.stage_id = s.id
    WHERE s.division_id = ? AND ha.athlete_id = ?
    LIMIT 1
  `).get(reg.division_id, reg.athlete_id);

  if (inHeat) {
    return res.status(409).json({ error: 'Cannot remove — athlete is assigned to a heat' });
  }

  db.prepare('DELETE FROM registration WHERE id = ?').run(req.params.id);
  res.json({ message: 'Registration removed' });
});

export default router;
