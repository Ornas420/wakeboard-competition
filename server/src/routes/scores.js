import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /scores/heat/:id — JUDGE, HEAD_JUDGE, ADMIN
router.get('/heat/:heatId', authenticate, authorize('JUDGE', 'HEAD_JUDGE', 'ADMIN'), (req, res) => {
  const runs = db.prepare(`
    SELECT ar.id as athlete_run_id, ar.athlete_id, u.name, ar.run_number,
           ar.computed_score, ar.scores_submitted
    FROM athlete_run ar
    JOIN user u ON ar.athlete_id = u.id
    WHERE ar.heat_id = ?
    ORDER BY ar.athlete_id, ar.run_number
  `).all(req.params.heatId);

  const result = runs.map((run) => {
    const scores = db.prepare(`
      SELECT js.judge_id, js.score, js.correction_requested, js.correction_note
      FROM judge_score js
      WHERE js.athlete_run_id = ?
    `).all(run.athlete_run_id);

    return { ...run, scores };
  });

  res.json(result);
});

// POST /scores — JUDGE or HEAD_JUDGE (stub — full logic in Sprint 4)
router.post('/', authenticate, authorize('JUDGE', 'HEAD_JUDGE'), (req, res) => {
  res.status(501).json({ error: 'Score submission not yet implemented — Sprint 4' });
});

// GET /scores/leaderboard/:competitionId — public
router.get('/leaderboard/:competitionId', (req, res) => {
  // Get the latest active/completed stage
  const stage = db.prepare(`
    SELECT s.id, s.stage_type FROM stage s
    WHERE s.competition_id = ? AND s.status IN ('ACTIVE', 'COMPLETED')
    ORDER BY s.stage_order DESC LIMIT 1
  `).get(req.params.competitionId);

  if (!stage) return res.json({ stage: null, rankings: [] });

  const rankings = db.prepare(`
    SELECT sr.athlete_id, u.name, sr.best_score as score, sr.rank
    FROM stage_ranking sr
    JOIN user u ON sr.athlete_id = u.id
    WHERE sr.stage_id = ?
    ORDER BY sr.rank
  `).all(stage.id);

  res.json({ stage, rankings });
});

export default router;
