import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generateHeatsForDivision, deleteHeatsForDivision } from '../services/heatGeneration.js';
import {
  submitForReview,
  manualReorder,
  approveHeat,
  closeHeat,
  reopenHeat,
} from '../services/scoringEngine.js';

const router = Router();

// GET /heats/competition/:id — list heats grouped by stage
router.get('/competition/:competitionId', authenticate, (req, res) => {
  let stageQuery = `
    SELECT s.id, s.stage_type, s.stage_order, s.status, s.division_id, d.name as division_name,
           s.runs_per_athlete, s.athletes_advance, s.distribution, s.reversed
    FROM stage s
    JOIN division d ON s.division_id = d.id
    WHERE s.competition_id = ?
  `;
  const params = [req.params.competitionId];

  if (req.query.division_id) {
    stageQuery += ' AND s.division_id = ?';
    params.push(req.query.division_id);
  }

  stageQuery += ' ORDER BY d.display_order, s.stage_order';
  const stages = db.prepare(stageQuery).all(...params);

  const result = stages.map((stage) => {
    const heats = db.prepare(`
      SELECT id, heat_number, status, published, run2_reorder, manually_adjusted, schedule_order
      FROM heat WHERE stage_id = ?
      ORDER BY heat_number
    `).all(stage.id);

    const heatsWithAthletes = heats.map((heat) => {
      const athletes = db.prepare(`
        SELECT ha.athlete_id, u.name, ha.run_order, ha.advanced
        FROM heat_athlete ha
        JOIN user u ON ha.athlete_id = u.id
        WHERE ha.heat_id = ?
        ORDER BY ha.run_order
      `).all(heat.id);

      return { ...heat, athletes };
    });

    return { ...stage, heats: heatsWithAthletes };
  });

  res.json({ stages: result });
});

// POST /heats/generate — ADMIN only
router.post('/generate', authenticate, authorize('ADMIN'), (req, res) => {
  const { division_id } = req.body;
  if (!division_id) return res.status(400).json({ error: 'division_id is required' });

  try {
    const result = generateHeatsForDivision(division_id);
    res.status(201).json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// DELETE /heats/division/:divisionId — ADMIN only
router.delete('/division/:divisionId', authenticate, authorize('ADMIN'), (req, res) => {
  try {
    deleteHeatsForDivision(req.params.divisionId);
    res.json({ message: 'Heats deleted for division' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// PATCH /heats/schedule — ADMIN only (set global heat order)
router.patch('/schedule', authenticate, authorize('ADMIN'), (req, res) => {
  const { schedule } = req.body;
  if (!Array.isArray(schedule)) {
    return res.status(400).json({ error: 'schedule must be an array of { heat_id, schedule_order }' });
  }

  const update = db.prepare('UPDATE heat SET schedule_order = ? WHERE id = ?');
  const applySchedule = db.transaction(() => {
    for (const entry of schedule) {
      update.run(entry.schedule_order, entry.heat_id);
    }
  });

  try {
    applySchedule();
    res.json({ updated: schedule.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /heats/publish-stage/:stageId — ADMIN only
router.patch('/publish-stage/:stageId', authenticate, authorize('ADMIN'), (req, res) => {
  const stage = db.prepare('SELECT id FROM stage WHERE id = ?').get(req.params.stageId);
  if (!stage) return res.status(404).json({ error: 'Stage not found' });

  const result = db.prepare('UPDATE heat SET published = 1 WHERE stage_id = ?').run(req.params.stageId);
  res.json({ published: result.changes });
});

// PATCH /heats/:id/athletes — ADMIN only (swap athlete between heats)
router.patch('/:id/athletes', authenticate, authorize('ADMIN'), (req, res) => {
  const { athlete_id, target_heat_id } = req.body;
  if (!athlete_id || !target_heat_id) {
    return res.status(400).json({ error: 'athlete_id and target_heat_id are required' });
  }

  const sourceHeat = db.prepare('SELECT * FROM heat WHERE id = ?').get(req.params.id);
  const targetHeat = db.prepare('SELECT * FROM heat WHERE id = ?').get(target_heat_id);

  if (!sourceHeat || !targetHeat) return res.status(404).json({ error: 'Heat not found' });
  if (sourceHeat.status !== 'PENDING' || targetHeat.status !== 'PENDING') {
    return res.status(400).json({ error: 'Both heats must be PENDING' });
  }
  if (sourceHeat.stage_id !== targetHeat.stage_id) {
    return res.status(400).json({ error: 'Both heats must be in the same stage' });
  }

  const targetCount = db.prepare('SELECT COUNT(*) as cnt FROM heat_athlete WHERE heat_id = ?').get(target_heat_id).cnt;
  if (targetCount >= 6) return res.status(400).json({ error: 'Target heat is full (max 6 athletes)' });

  const swap = db.transaction(() => {
    const ha = db.prepare('SELECT * FROM heat_athlete WHERE heat_id = ? AND athlete_id = ?').get(req.params.id, athlete_id);
    if (!ha) throw Object.assign(new Error('Athlete not in source heat'), { status: 404 });

    const newOrder = targetCount + 1;
    db.prepare('UPDATE heat_athlete SET heat_id = ?, run_order = ? WHERE id = ?').run(target_heat_id, newOrder, ha.id);
    db.prepare('UPDATE athlete_run SET heat_id = ? WHERE heat_id = ? AND athlete_id = ?').run(target_heat_id, req.params.id, athlete_id);
    db.prepare('UPDATE heat SET manually_adjusted = 1 WHERE id IN (?, ?)').run(req.params.id, target_heat_id);
  });

  try {
    swap();
    res.json({ message: 'Athlete moved successfully' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// PATCH /heats/:id/status — ADMIN or HEAD_JUDGE (restricted to PENDING→OPEN and rollback)
router.patch('/:id/status', authenticate, authorize('ADMIN', 'HEAD_JUDGE'), (req, res) => {
  const { status } = req.body;
  const heat = db.prepare('SELECT * FROM heat WHERE id = ?').get(req.params.id);
  if (!heat) return res.status(404).json({ error: 'Heat not found' });

  // PENDING → OPEN: Admin or Head Judge opens a heat
  if (heat.status === 'PENDING' && status === 'OPEN') {
    db.prepare('UPDATE heat SET status = ? WHERE id = ?').run('OPEN', req.params.id);

    // Get competition_id for socket emission
    const stage = db.prepare('SELECT competition_id FROM stage WHERE id = ?').get(heat.stage_id);
    if (stage) {
      const io = req.app.get('io');
      io.to(stage.competition_id).emit('heat:opened', { heat_id: req.params.id });
    }

    return res.json({ id: req.params.id, status: 'OPEN' });
  }

  // OPEN → PENDING: Undo accidental open (only if no scores submitted)
  if (heat.status === 'OPEN' && status === 'PENDING') {
    const hasScores = db.prepare(`
      SELECT 1 FROM athlete_run ar
      WHERE ar.heat_id = ? AND ar.scores_submitted > 0
      LIMIT 1
    `).get(req.params.id);

    if (hasScores) {
      return res.status(400).json({ error: 'Cannot revert — scores have been submitted' });
    }

    db.prepare('UPDATE heat SET status = ? WHERE id = ?').run('PENDING', req.params.id);

    const stage = db.prepare('SELECT competition_id FROM stage WHERE id = ?').get(heat.stage_id);
    if (stage) {
      const io = req.app.get('io');
      io.to(stage.competition_id).emit('heat:closed', { heat_id: req.params.id, stage_id: heat.stage_id });
    }

    return res.json({ id: req.params.id, status: 'PENDING' });
  }

  // APPROVED → HEAD_REVIEW: Rollback (Head Judge reopens)
  if (heat.status === 'APPROVED' && status === 'HEAD_REVIEW') {
    try {
      const result = reopenHeat(req.params.id, req.user.id, req.app.get('io'));
      return res.json(result);
    } catch (err) {
      const s = err.status || 500;
      return res.status(s).json({ error: err.message });
    }
  }

  return res.status(400).json({
    error: `Invalid status transition: ${heat.status} → ${status}. Use dedicated endpoints for review/approve/close.`,
  });
});

// POST /heats/:id/review — HEAD_JUDGE (OPEN → HEAD_REVIEW)
router.post('/:id/review', authenticate, authorize('HEAD_JUDGE'), (req, res) => {
  try {
    const result = submitForReview(req.params.id, req.user.id);

    // Emit so judges instantly see waiting screen
    const heat = db.prepare('SELECT stage_id FROM heat WHERE id = ?').get(req.params.id);
    const stage = db.prepare('SELECT competition_id FROM stage WHERE id = ?').get(heat.stage_id);
    if (stage) {
      req.app.get('io').to(stage.competition_id).emit('heat:status_changed', { heat_id: req.params.id, status: 'HEAD_REVIEW' });
    }

    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    const response = { error: err.message };
    if (err.missing) response.missing = err.missing;
    res.status(status).json(response);
  }
});

// PATCH /heats/:id/ranking — HEAD_JUDGE (manual reorder)
router.patch('/:id/ranking', authenticate, authorize('HEAD_JUDGE'), (req, res) => {
  const { ranking } = req.body;
  if (!Array.isArray(ranking)) {
    return res.status(400).json({ error: 'ranking must be an array' });
  }

  try {
    const result = manualReorder(req.params.id, ranking, req.user.id);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /heats/:id/approve — HEAD_JUDGE
router.post('/:id/approve', authenticate, authorize('HEAD_JUDGE'), (req, res) => {
  try {
    const result = approveHeat(req.params.id, req.user.id, req.app.get('io'));
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    const response = { error: err.message };
    if (err.missing) response.missing = err.missing;
    res.status(status).json(response);
  }
});

// POST /heats/:id/close — HEAD_JUDGE
router.post('/:id/close', authenticate, authorize('HEAD_JUDGE'), (req, res) => {
  try {
    const result = closeHeat(req.params.id, req.user.id, req.app.get('io'));
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
