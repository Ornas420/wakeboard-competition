import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { calculateTotal, getLeaderboard } from '../services/scoringEngine.js';

const router = Router();

// Get scores for a heat
router.get('/heat/:heatId', (req, res) => {
  const scores = db.prepare(`
    SELECT s.*, u.name as athlete_name, j.name as judge_name
    FROM scores s
    JOIN users u ON s.user_id = u.id
    JOIN users j ON s.judge_id = j.id
    WHERE s.heat_id = ?
  `).all(req.params.heatId);
  res.json(scores);
});

// Submit a score (judge only)
router.post('/', authenticate, authorize('judge', 'admin'), (req, res) => {
  const { heat_id, user_id, execution, difficulty, intensity, composition } = req.body;
  const id = uuidv4();
  const total = calculateTotal({ execution, difficulty, intensity, composition });

  db.prepare(`
    INSERT INTO scores (id, heat_id, user_id, judge_id, execution, difficulty, intensity, composition, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, heat_id, user_id, req.user.id, execution, difficulty, intensity, composition, total);

  const io = req.app.get('io');
  io.emit('score:new', { heat_id, user_id, total });

  res.status(201).json({ id, heat_id, user_id, total });
});

// Get leaderboard for a competition category
router.get('/leaderboard/:competitionId/:categoryId', (req, res) => {
  const leaderboard = getLeaderboard(req.params.competitionId, req.params.categoryId);
  res.json(leaderboard);
});

export default router;
