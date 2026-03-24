import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// List registrations for a competition
router.get('/competition/:competitionId', (req, res) => {
  const registrations = db.prepare(`
    SELECT r.*, u.name as athlete_name, c.name as category_name
    FROM registrations r
    JOIN users u ON r.user_id = u.id
    JOIN categories c ON r.category_id = c.id
    WHERE r.competition_id = ?
  `).all(req.params.competitionId);
  res.json(registrations);
});

// Register for a competition
router.post('/', authenticate, (req, res) => {
  const { competition_id, category_id } = req.body;
  const id = uuidv4();

  const existing = db.prepare(
    'SELECT id FROM registrations WHERE competition_id = ? AND category_id = ? AND user_id = ?'
  ).get(competition_id, category_id, req.user.id);

  if (existing) return res.status(409).json({ error: 'Already registered' });

  db.prepare('INSERT INTO registrations (id, competition_id, category_id, user_id) VALUES (?, ?, ?, ?)')
    .run(id, competition_id, category_id, req.user.id);

  res.status(201).json({ id, competition_id, category_id, user_id: req.user.id, status: 'pending' });
});

// Update registration status (admin only)
router.patch('/:id/status', authenticate, authorize('admin'), (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE registrations SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ id: req.params.id, status });
});

export default router;
