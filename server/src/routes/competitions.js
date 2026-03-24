import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /competitions — public list
router.get('/', (req, res) => {
  const competitions = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM registration r WHERE r.competition_id = c.id AND r.status = 'CONFIRMED') as athlete_count
    FROM competition c
    ORDER BY c.date DESC
  `).all();

  res.json({ competitions });
});

// GET /competitions/:id — public detail
router.get('/:id', (req, res) => {
  const competition = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM registration r WHERE r.competition_id = c.id AND r.status = 'CONFIRMED') as athlete_count
    FROM competition c WHERE c.id = ?
  `).get(req.params.id);

  if (!competition) return res.status(404).json({ error: 'Competition not found' });

  const stages = db.prepare(`
    SELECT s.id, s.stage_type, s.stage_order, s.status,
      (SELECT COUNT(*) FROM heat h WHERE h.stage_id = s.id) as heat_count
    FROM stage s WHERE s.competition_id = ?
    ORDER BY s.stage_order
  `).all(req.params.id);

  res.json({ ...competition, stages });
});

// POST /competitions — ADMIN only
router.post('/', authenticate, authorize('ADMIN'), (req, res) => {
  const { name, date, location, division, description, timetable, judge_count } = req.body;

  if (!name || !date || !location) {
    return res.status(400).json({ error: 'Name, date, and location are required' });
  }

  if (judge_count !== undefined && (judge_count < 3 || judge_count > 5)) {
    return res.status(400).json({ error: 'Judge count must be between 3 and 5' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO competition (id, name, date, location, division, description, timetable, judge_count, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, date, location, division || null, description || null, timetable || null, judge_count || 3, req.user.id);

  res.status(201).json({ id, name, status: 'DRAFT' });
});

// PATCH /competitions/:id — ADMIN only
router.patch('/:id', authenticate, authorize('ADMIN'), (req, res) => {
  const competition = db.prepare('SELECT * FROM competition WHERE id = ?').get(req.params.id);
  if (!competition) return res.status(404).json({ error: 'Competition not found' });

  const allowedFields = ['name', 'date', 'location', 'division', 'description', 'timetable', 'video_url', 'status', 'judge_count'];
  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      // judge_count locked once heats generated
      if (field === 'judge_count') {
        const hasHeats = db.prepare(
          'SELECT 1 FROM stage s JOIN heat h ON h.stage_id = s.id WHERE s.competition_id = ? LIMIT 1'
        ).get(req.params.id);
        if (hasHeats) {
          return res.status(400).json({ error: 'judge_count is locked once heats are generated' });
        }
      }
      // date locked once ACTIVE
      if (field === 'date' && competition.status === 'ACTIVE') {
        return res.status(400).json({ error: 'Date is locked once competition is ACTIVE' });
      }
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  values.push(req.params.id);
  db.prepare(`UPDATE competition SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM competition WHERE id = ?').get(req.params.id);
  res.json(updated);
});

export default router;
