import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generateHeats } from '../services/heatGeneration.js';

const router = Router();

// Get heats for a competition/category
router.get('/competition/:competitionId', (req, res) => {
  const { category_id } = req.query;
  let query = `
    SELECT h.*, json_group_array(json_object(
      'id', ha.id, 'user_id', ha.user_id, 'ride_order', ha.ride_order
    )) as athletes
    FROM heats h
    LEFT JOIN heat_athletes ha ON h.id = ha.heat_id
    WHERE h.competition_id = ?
  `;
  const params = [req.params.competitionId];

  if (category_id) {
    query += ' AND h.category_id = ?';
    params.push(category_id);
  }

  query += ' GROUP BY h.id ORDER BY h.round, h.heat_number';
  const heats = db.prepare(query).all(...params);

  res.json(heats.map((h) => ({
    ...h,
    athletes: JSON.parse(h.athletes).filter((a) => a.id !== null),
  })));
});

// Generate heats (admin only)
router.post('/generate', authenticate, authorize('admin'), (req, res) => {
  const { competition_id, category_id, athletes_per_heat } = req.body;
  const heats = generateHeats(competition_id, category_id, athletes_per_heat || 4);
  res.status(201).json(heats);
});

// Update heat status
router.patch('/:id/status', authenticate, authorize('admin', 'judge'), (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE heats SET status = ? WHERE id = ?').run(status, req.params.id);

  const io = req.app.get('io');
  io.emit('heat:status', { id: req.params.id, status });

  res.json({ id: req.params.id, status });
});

export default router;
