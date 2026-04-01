import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generateHeatsForDivision, deleteHeatsForDivision } from '../services/heatGeneration.js';

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
      SELECT id, heat_number, status, published, run2_reorder, manually_adjusted
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

  // Check target heat capacity
  const targetCount = db.prepare('SELECT COUNT(*) as cnt FROM heat_athlete WHERE heat_id = ?').get(target_heat_id).cnt;
  if (targetCount >= 6) return res.status(400).json({ error: 'Target heat is full (max 6 athletes)' });

  // Get the stage to know runs_per_athlete
  const stage = db.prepare('SELECT runs_per_athlete FROM stage WHERE id = ?').get(sourceHeat.stage_id);

  const swap = db.transaction(() => {
    // Get athlete's current entry
    const ha = db.prepare('SELECT * FROM heat_athlete WHERE heat_id = ? AND athlete_id = ?').get(req.params.id, athlete_id);
    if (!ha) throw Object.assign(new Error('Athlete not in source heat'), { status: 404 });

    // Move heat_athlete
    const newOrder = targetCount + 1;
    db.prepare('UPDATE heat_athlete SET heat_id = ?, run_order = ? WHERE id = ?').run(target_heat_id, newOrder, ha.id);

    // Move athlete_run rows
    db.prepare('UPDATE athlete_run SET heat_id = ? WHERE heat_id = ? AND athlete_id = ?').run(target_heat_id, req.params.id, athlete_id);

    // Mark both heats as manually adjusted
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

// PATCH /heats/:id/status — ADMIN or HEAD_JUDGE
router.patch('/:id/status', authenticate, authorize('ADMIN', 'HEAD_JUDGE'), (req, res) => {
  const { status } = req.body;
  const heat = db.prepare('SELECT * FROM heat WHERE id = ?').get(req.params.id);
  if (!heat) return res.status(404).json({ error: 'Heat not found' });

  const validTransitions = {
    'PENDING': ['OPEN'],
    'OPEN': ['HEAD_REVIEW'],
    'HEAD_REVIEW': ['APPROVED'],
    'APPROVED': ['CLOSED', 'HEAD_REVIEW'],
    'CLOSED': []
  };

  if (!validTransitions[heat.status]?.includes(status)) {
    return res.status(400).json({ error: `Invalid status transition: ${heat.status} → ${status}` });
  }

  db.prepare('UPDATE heat SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ id: req.params.id, status });
});

export default router;
