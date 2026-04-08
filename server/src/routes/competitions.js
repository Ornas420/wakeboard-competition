import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /competitions — public list
router.get('/', (req, res) => {
  const competitions = db.prepare(`
    SELECT c.id, c.name, c.date, c.location, c.status, c.video_url,
      (SELECT COUNT(DISTINCT r.athlete_id) FROM registration r WHERE r.competition_id = c.id AND r.status = 'CONFIRMED') as athlete_count,
      (SELECT GROUP_CONCAT(d.name, ', ') FROM division d WHERE d.competition_id = c.id ORDER BY d.display_order) as divisions
    FROM competition c
    ORDER BY c.date ASC
  `).all();

  res.json({ competitions });
});

// GET /competitions/my-assignments — JUDGE, HEAD_JUDGE
router.get('/my-assignments', authenticate, authorize('JUDGE', 'HEAD_JUDGE'), (req, res) => {
  const competitions = db.prepare(`
    SELECT c.id, c.name, c.date, c.location, c.status, cs.staff_role,
      (SELECT COUNT(DISTINCT r.athlete_id) FROM registration r
       JOIN division d ON r.division_id = d.id
       WHERE d.competition_id = c.id AND r.status = 'CONFIRMED') as athlete_count,
      (SELECT GROUP_CONCAT(d.name, ', ') FROM division d WHERE d.competition_id = c.id ORDER BY d.display_order) as divisions
    FROM competition_staff cs
    JOIN competition c ON cs.competition_id = c.id
    WHERE cs.user_id = ?
    ORDER BY c.date DESC
  `).all(req.user.id);

  res.json({ competitions });
});

// GET /competitions/:id/live-data — public (no auth)
router.get('/:id/live-data', (req, res) => {
  const competition = db.prepare(`
    SELECT c.id, c.name, c.date, c.location, c.status, c.video_url, c.judge_count
    FROM competition c WHERE c.id = ?
  `).get(req.params.id);

  if (!competition) return res.status(404).json({ error: 'Competition not found' });

  const divisions = db.prepare(`
    SELECT d.id, d.name, d.display_order
    FROM division d WHERE d.competition_id = ?
    ORDER BY d.display_order, d.name
  `).all(req.params.id);

  const result = divisions.map(div => {
    const stages = db.prepare(`
      SELECT s.id, s.stage_type, s.stage_order, s.status, s.runs_per_athlete, s.athletes_advance
      FROM stage s WHERE s.division_id = ?
      ORDER BY s.stage_order
    `).all(div.id);

    const stagesWithHeats = stages.map(stage => {
      const heats = db.prepare(`
        SELECT h.id, h.heat_number, h.status, h.run2_reorder
        FROM heat h WHERE h.stage_id = ? AND h.published = 1
        ORDER BY h.heat_number
      `).all(stage.id);

      const heatsWithData = heats.map(heat => {
        const athletes = db.prepare(`
          SELECT ha.athlete_id, u.name, ha.run_order
          FROM heat_athlete ha
          JOIN user u ON ha.athlete_id = u.id
          WHERE ha.heat_id = ?
          ORDER BY ha.run_order
        `).all(heat.id);

        const athletesWithScores = athletes.map(athlete => {
          const runs = db.prepare(`
            SELECT ar.id as athlete_run_id, ar.run_number, ar.computed_score, ar.scores_submitted
            FROM athlete_run ar
            WHERE ar.heat_id = ? AND ar.athlete_id = ?
            ORDER BY ar.run_number
          `).all(heat.id, athlete.athlete_id);

          // Get heat_result if heat is APPROVED or CLOSED
          let heatResult = null;
          if (heat.status === 'APPROVED' || heat.status === 'CLOSED') {
            heatResult = db.prepare(`
              SELECT best_score, second_score, final_rank
              FROM heat_result WHERE heat_id = ? AND athlete_id = ?
            `).get(heat.id, athlete.athlete_id);
          }

          return { ...athlete, runs, heat_result: heatResult };
        });

        return { ...heat, athletes: athletesWithScores };
      });

      // Stage ranking
      const rankings = db.prepare(`
        SELECT sr.athlete_id, u.name, sr.best_score, sr.rank, sr.advanced
        FROM stage_ranking sr
        JOIN user u ON sr.athlete_id = u.id
        WHERE sr.stage_id = ?
        ORDER BY sr.rank
      `).all(stage.id);

      return { ...stage, heats: heatsWithData, rankings };
    });

    return { ...div, stages: stagesWithHeats };
  });

  res.json({ competition, divisions: result });
});

// GET /competitions/:id — public detail
router.get('/:id', (req, res) => {
  const competition = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(DISTINCT r.athlete_id) FROM registration r WHERE r.competition_id = c.id AND r.status = 'CONFIRMED') as athlete_count
    FROM competition c WHERE c.id = ?
  `).get(req.params.id);

  if (!competition) return res.status(404).json({ error: 'Competition not found' });

  const divisions = db.prepare(`
    SELECT d.id, d.name, d.display_order,
      (SELECT COUNT(*) FROM registration r WHERE r.division_id = d.id AND r.status = 'CONFIRMED') as athlete_count
    FROM division d WHERE d.competition_id = ?
    ORDER BY d.display_order, d.name
  `).all(req.params.id);

  const stages = db.prepare(`
    SELECT s.id, s.stage_type, s.stage_order, s.status, s.division_id, d.name as division_name,
      (SELECT COUNT(*) FROM heat h WHERE h.stage_id = s.id) as heat_count
    FROM stage s
    JOIN division d ON s.division_id = d.id
    WHERE s.competition_id = ?
    ORDER BY d.display_order, s.stage_order
  `).all(req.params.id);

  res.json({ ...competition, divisions, stages });
});

// POST /competitions — ADMIN only
router.post('/', authenticate, authorize('ADMIN'), (req, res) => {
  const { name, date, location, description, timetable, video_url, judge_count } = req.body;

  if (!name || !date) {
    return res.status(400).json({ error: 'Name and date are required' });
  }

  if (judge_count !== undefined && (judge_count < 3 || judge_count > 5)) {
    return res.status(400).json({ error: 'Judge count must be between 3 and 5' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO competition (id, name, date, location, description, timetable, video_url, judge_count, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, date, location || null, description || null, timetable || null, video_url || null, judge_count || 3, req.user.id);

  res.status(201).json({ id, name, status: 'DRAFT' });
});

// PATCH /competitions/:id — ADMIN only (edit fields, not status)
router.patch('/:id', authenticate, authorize('ADMIN'), (req, res) => {
  const competition = db.prepare('SELECT * FROM competition WHERE id = ?').get(req.params.id);
  if (!competition) return res.status(404).json({ error: 'Competition not found' });

  const allowedFields = ['name', 'date', 'location', 'description', 'timetable', 'video_url', 'judge_count'];
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
        if (req.body[field] < 3 || req.body[field] > 5) {
          return res.status(400).json({ error: 'Judge count must be between 3 and 5' });
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

// PATCH /competitions/:id/status — ADMIN only
router.patch('/:id/status', authenticate, authorize('ADMIN'), (req, res) => {
  const competition = db.prepare('SELECT * FROM competition WHERE id = ?').get(req.params.id);
  if (!competition) return res.status(404).json({ error: 'Competition not found' });

  const { status } = req.body;

  // Validate transitions
  const validTransitions = {
    'DRAFT': ['ACTIVE'],
    'ACTIVE': ['COMPLETED'],
    'COMPLETED': []
  };

  if (!validTransitions[competition.status]?.includes(status)) {
    return res.status(400).json({ error: `Invalid status transition: ${competition.status} → ${status}` });
  }

  // COMPLETED requires all heats CLOSED
  if (status === 'COMPLETED') {
    const openHeats = db.prepare(`
      SELECT h.id, h.heat_number, h.status FROM heat h
      JOIN stage s ON h.stage_id = s.id
      WHERE s.competition_id = ? AND h.status != 'CLOSED'
    `).all(req.params.id);

    if (openHeats.length > 0) {
      return res.status(409).json({
        error: 'Open heats remain: ' + openHeats.map(h => `Heat ${h.heat_number} (${h.status})`).join(', '),
        open_heats: openHeats
      });
    }
  }

  db.prepare('UPDATE competition SET status = ? WHERE id = ?').run(status, req.params.id);

  const updated = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(DISTINCT r.athlete_id) FROM registration r WHERE r.competition_id = c.id AND r.status = 'CONFIRMED') as athlete_count
    FROM competition c WHERE c.id = ?
  `).get(req.params.id);
  res.json(updated);
});

// --- Staff Management ---

// POST /competitions/:id/staff — ADMIN only
router.post('/:id/staff', authenticate, authorize('ADMIN'), (req, res) => {
  const competition = db.prepare('SELECT id FROM competition WHERE id = ?').get(req.params.id);
  if (!competition) return res.status(404).json({ error: 'Competition not found' });

  const { user_id, staff_role } = req.body;

  if (!user_id || !staff_role) {
    return res.status(400).json({ error: 'user_id and staff_role are required' });
  }

  if (!['HEAD_JUDGE', 'JUDGE'].includes(staff_role)) {
    return res.status(400).json({ error: 'staff_role must be HEAD_JUDGE or JUDGE' });
  }

  // Validate user exists and has correct role
  const user = db.prepare('SELECT id, name, role FROM user WHERE id = ?').get(user_id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!['HEAD_JUDGE', 'JUDGE'].includes(user.role)) {
    return res.status(400).json({ error: 'User must have role JUDGE or HEAD_JUDGE' });
  }

  // Only one HEAD_JUDGE per competition
  if (staff_role === 'HEAD_JUDGE') {
    const existingHJ = db.prepare(
      "SELECT id FROM competition_staff WHERE competition_id = ? AND staff_role = 'HEAD_JUDGE'"
    ).get(req.params.id);
    if (existingHJ) {
      return res.status(409).json({ error: 'Head Judge already assigned' });
    }
  }

  // Check if user already assigned
  const existing = db.prepare(
    'SELECT id FROM competition_staff WHERE competition_id = ? AND user_id = ?'
  ).get(req.params.id, user_id);
  if (existing) {
    return res.status(409).json({ error: 'User already assigned to this competition' });
  }

  const id = uuidv4();
  db.prepare(
    'INSERT INTO competition_staff (id, competition_id, user_id, staff_role) VALUES (?, ?, ?, ?)'
  ).run(id, req.params.id, user_id, staff_role);

  res.status(201).json({ id, competition_id: req.params.id, user_id, staff_role });
});

// GET /competitions/:id/staff — ADMIN only
router.get('/:id/staff', authenticate, authorize('ADMIN'), (req, res) => {
  const competition = db.prepare('SELECT id FROM competition WHERE id = ?').get(req.params.id);
  if (!competition) return res.status(404).json({ error: 'Competition not found' });

  const staff = db.prepare(`
    SELECT cs.id, cs.user_id, u.name, u.email, cs.staff_role
    FROM competition_staff cs
    JOIN user u ON cs.user_id = u.id
    WHERE cs.competition_id = ?
    ORDER BY cs.staff_role, u.name
  `).all(req.params.id);

  res.json(staff);
});

// DELETE /competitions/:id/staff/:userId — ADMIN only
router.delete('/:id/staff/:userId', authenticate, authorize('ADMIN'), (req, res) => {
  const competition = db.prepare('SELECT id FROM competition WHERE id = ?').get(req.params.id);
  if (!competition) return res.status(404).json({ error: 'Competition not found' });

  const staffRow = db.prepare(
    'SELECT id FROM competition_staff WHERE competition_id = ? AND user_id = ?'
  ).get(req.params.id, req.params.userId);
  if (!staffRow) return res.status(404).json({ error: 'Staff member not found' });

  // Block if any heat in competition is OPEN or higher
  const activeHeats = db.prepare(`
    SELECT h.id FROM heat h
    JOIN stage s ON h.stage_id = s.id
    WHERE s.competition_id = ? AND h.status IN ('OPEN', 'HEAD_REVIEW', 'APPROVED', 'CLOSED')
  `).all(req.params.id);

  if (activeHeats.length > 0) {
    return res.status(409).json({ error: 'Cannot remove staff — active heats exist' });
  }

  db.prepare(
    'DELETE FROM competition_staff WHERE competition_id = ? AND user_id = ?'
  ).run(req.params.id, req.params.userId);

  res.json({ message: 'Staff member removed' });
});

export default router;
