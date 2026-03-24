import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /registrations/competition/:id — ADMIN, HEAD_JUDGE
router.get('/competition/:competitionId', authenticate, authorize('ADMIN', 'HEAD_JUDGE'), (req, res) => {
  const registrations = db.prepare(`
    SELECT r.id, r.athlete_id, u.name, r.status, r.seed, r.registered_at
    FROM registration r
    JOIN user u ON r.athlete_id = u.id
    WHERE r.competition_id = ?
    ORDER BY r.registered_at
  `).all(req.params.competitionId);

  res.json(registrations);
});

// POST /registrations — ATHLETE only
router.post('/', authenticate, authorize('ATHLETE'), (req, res) => {
  const { competition_id } = req.body;

  if (!competition_id) {
    return res.status(400).json({ error: 'competition_id is required' });
  }

  // Check competition exists and is DRAFT
  const competition = db.prepare('SELECT status FROM competition WHERE id = ?').get(competition_id);
  if (!competition) return res.status(404).json({ error: 'Competition not found' });
  if (competition.status !== 'DRAFT') {
    return res.status(400).json({ error: 'Registration is closed' });
  }

  // Check duplicate
  const existing = db.prepare(
    'SELECT id FROM registration WHERE competition_id = ? AND athlete_id = ?'
  ).get(competition_id, req.user.id);
  if (existing) return res.status(409).json({ error: 'Athlete already registered' });

  const id = uuidv4();
  db.prepare(
    'INSERT INTO registration (id, competition_id, athlete_id, status) VALUES (?, ?, ?, ?)'
  ).run(id, competition_id, req.user.id, 'CONFIRMED');

  res.status(201).json({
    id,
    competition_id,
    athlete_id: req.user.id,
    status: 'CONFIRMED',
    registered_at: new Date().toISOString()
  });
});

// PATCH /registrations/:id — ADMIN only
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

export default router;
