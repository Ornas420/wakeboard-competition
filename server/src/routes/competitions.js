import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// List all competitions
router.get('/', (req, res) => {
  const competitions = db.prepare('SELECT * FROM competitions ORDER BY date DESC').all();
  res.json(competitions);
});

// Get single competition with categories
router.get('/:id', (req, res) => {
  const competition = db.prepare('SELECT * FROM competitions WHERE id = ?').get(req.params.id);
  if (!competition) return res.status(404).json({ error: 'Competition not found' });

  const categories = db.prepare('SELECT * FROM categories WHERE competition_id = ?').all(req.params.id);
  res.json({ ...competition, categories });
});

// Create competition (admin only)
router.post('/', authenticate, authorize('admin'), (req, res) => {
  const { name, date, location, categories } = req.body;
  const id = uuidv4();

  db.prepare('INSERT INTO competitions (id, name, date, location, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, date, location, req.user.id);

  if (categories?.length) {
    const insertCat = db.prepare('INSERT INTO categories (id, competition_id, name) VALUES (?, ?, ?)');
    for (const cat of categories) {
      insertCat.run(uuidv4(), id, cat);
    }
  }

  res.status(201).json({ id, name, date, location, status: 'draft' });
});

// Update competition status
router.patch('/:id/status', authenticate, authorize('admin'), (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE competitions SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ id: req.params.id, status });
});

export default router;
