import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /competitions/:id/divisions — public
router.get('/:id/divisions', (req, res) => {
  const competition = db.prepare('SELECT id FROM competition WHERE id = ?').get(req.params.id);
  if (!competition) return res.status(404).json({ error: 'Competition not found' });

  const divisions = db.prepare(`
    SELECT d.id, d.name, d.display_order,
      (SELECT COUNT(*) FROM registration r WHERE r.division_id = d.id AND r.status = 'CONFIRMED') as athlete_count
    FROM division d
    WHERE d.competition_id = ?
    ORDER BY d.display_order, d.name
  `).all(req.params.id);

  res.json({ divisions });
});

// POST /competitions/:id/divisions — ADMIN only
router.post('/:id/divisions', authenticate, authorize('ADMIN'), (req, res) => {
  const competition = db.prepare('SELECT id, status FROM competition WHERE id = ?').get(req.params.id);
  if (!competition) return res.status(404).json({ error: 'Competition not found' });
  if (competition.status === 'COMPLETED') {
    return res.status(400).json({ error: 'Cannot add divisions to a completed competition' });
  }

  const { name, display_order } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Division name is required' });
  }

  // Check duplicate name
  const existing = db.prepare(
    'SELECT id FROM division WHERE competition_id = ? AND name = ?'
  ).get(req.params.id, name.trim());
  if (existing) return res.status(409).json({ error: 'Division name already exists in this competition' });

  const id = uuidv4();
  db.prepare(
    'INSERT INTO division (id, competition_id, name, display_order) VALUES (?, ?, ?, ?)'
  ).run(id, req.params.id, name.trim(), display_order ?? 0);

  res.status(201).json({ id, competition_id: req.params.id, name: name.trim(), display_order: display_order ?? 0 });
});

// PATCH /competitions/:id/divisions/:divisionId — ADMIN only
router.patch('/:id/divisions/:divisionId', authenticate, authorize('ADMIN'), (req, res) => {
  const division = db.prepare(
    'SELECT * FROM division WHERE id = ? AND competition_id = ?'
  ).get(req.params.divisionId, req.params.id);
  if (!division) return res.status(404).json({ error: 'Division not found' });

  const { name, display_order } = req.body;
  const updates = [];
  const values = [];

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Division name cannot be empty' });
    // Check duplicate name (excluding self)
    const dup = db.prepare(
      'SELECT id FROM division WHERE competition_id = ? AND name = ? AND id != ?'
    ).get(req.params.id, name.trim(), req.params.divisionId);
    if (dup) return res.status(409).json({ error: 'Division name already exists in this competition' });
    updates.push('name = ?');
    values.push(name.trim());
  }

  if (display_order !== undefined) {
    updates.push('display_order = ?');
    values.push(display_order);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  values.push(req.params.divisionId);
  db.prepare(`UPDATE division SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM division WHERE id = ?').get(req.params.divisionId);
  res.json(updated);
});

// DELETE /competitions/:id/divisions/:divisionId — ADMIN only
router.delete('/:id/divisions/:divisionId', authenticate, authorize('ADMIN'), (req, res) => {
  const division = db.prepare(
    'SELECT * FROM division WHERE id = ? AND competition_id = ?'
  ).get(req.params.divisionId, req.params.id);
  if (!division) return res.status(404).json({ error: 'Division not found' });

  // Block if stages exist
  const hasStages = db.prepare(
    'SELECT 1 FROM stage WHERE division_id = ? LIMIT 1'
  ).get(req.params.divisionId);
  if (hasStages) {
    return res.status(409).json({ error: 'Cannot remove division — stages/heats exist. Delete heats first.' });
  }

  // Block if registrations exist
  const hasRegs = db.prepare(
    'SELECT 1 FROM registration WHERE division_id = ? LIMIT 1'
  ).get(req.params.divisionId);
  if (hasRegs) {
    return res.status(409).json({ error: 'Cannot remove division — athletes are registered. Remove registrations first.' });
  }

  db.prepare('DELETE FROM division WHERE id = ?').run(req.params.divisionId);
  res.json({ message: 'Division removed' });
});

export default router;
