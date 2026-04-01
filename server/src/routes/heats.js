import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /heats/competition/:id — list heats grouped by stage
router.get('/competition/:competitionId', authenticate, (req, res) => {
  let stageQuery = `
    SELECT s.id, s.stage_type, s.stage_order, s.status, s.division_id, d.name as division_name
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
      SELECT id, heat_number, status, published
      FROM heat WHERE stage_id = ?
      ORDER BY heat_number
    `).all(stage.id);

    const heatsWithAthletes = heats.map((heat) => {
      const athletes = db.prepare(`
        SELECT ha.athlete_id, u.name, ha.run_order
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

// POST /heats/generate — ADMIN only (stub — full IWWF logic in Sprint 3)
// Body: { division_id } — generates stages and heats for a single division
// Uses CONFIRMED registrations from that division only
router.post('/generate', authenticate, authorize('ADMIN'), (req, res) => {
  res.status(501).json({ error: 'Heat generation not yet implemented — Sprint 3' });
});

// PATCH /heats/:id/status — ADMIN or HEAD_JUDGE
router.patch('/:id/status', authenticate, authorize('ADMIN', 'HEAD_JUDGE'), (req, res) => {
  const { status } = req.body;
  const heat = db.prepare('SELECT * FROM heat WHERE id = ?').get(req.params.id);
  if (!heat) return res.status(404).json({ error: 'Heat not found' });

  // Validate status transitions
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
