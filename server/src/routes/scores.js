import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { submitScore, requestCorrection } from '../services/scoringEngine.js';

const router = Router();

// GET /scores/heat/:id — JUDGE, HEAD_JUDGE, ADMIN
router.get('/heat/:heatId', authenticate, authorize('JUDGE', 'HEAD_JUDGE', 'ADMIN'), (req, res) => {
  const runs = db.prepare(`
    SELECT ar.id as athlete_run_id, ar.athlete_id, u.name, ar.run_number,
           ar.computed_score, ar.scores_submitted, ha.run_order
    FROM athlete_run ar
    JOIN user u ON ar.athlete_id = u.id
    JOIN heat_athlete ha ON ha.heat_id = ar.heat_id AND ha.athlete_id = ar.athlete_id
    WHERE ar.heat_id = ?
    ORDER BY ha.run_order, ar.run_number
  `).all(req.params.heatId);

  const result = runs.map((run) => {
    const scores = db.prepare(`
      SELECT js.id as judge_score_id, js.judge_id, u.name as judge_name, js.score, js.correction_requested, js.correction_note
      FROM judge_score js
      JOIN user u ON js.judge_id = u.id
      WHERE js.athlete_run_id = ?
    `).all(run.athlete_run_id);

    return { ...run, scores };
  });

  res.json(result);
});

// POST /scores — JUDGE or HEAD_JUDGE
router.post('/', authenticate, authorize('JUDGE', 'HEAD_JUDGE'), (req, res) => {
  const { athlete_run_id, score } = req.body;

  if (!athlete_run_id) {
    return res.status(400).json({ error: 'athlete_run_id is required' });
  }
  if (score === undefined || score === null) {
    return res.status(400).json({ error: 'score is required' });
  }

  try {
    const result = submitScore(athlete_run_id, req.user.id, Number(score), req.app.get('io'));
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /scores/correction-request — HEAD_JUDGE only
router.post('/correction-request', authenticate, authorize('HEAD_JUDGE'), (req, res) => {
  const { judge_score_id, note } = req.body;

  if (!judge_score_id) {
    return res.status(400).json({ error: 'judge_score_id is required' });
  }

  try {
    const result = requestCorrection(judge_score_id, note, req.user.id, req.app.get('io'));
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /scores/leaderboard/:competitionId?division_id= — public
router.get('/leaderboard/:competitionId', (req, res) => {
  const { division_id } = req.query;
  if (!division_id) {
    return res.status(400).json({ error: 'division_id query parameter is required' });
  }

  // Get the latest active/completed stage for this division
  const stage = db.prepare(`
    SELECT s.id, s.stage_type FROM stage s
    WHERE s.division_id = ? AND s.status IN ('ACTIVE', 'COMPLETED')
    ORDER BY s.stage_order DESC LIMIT 1
  `).get(division_id);

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
