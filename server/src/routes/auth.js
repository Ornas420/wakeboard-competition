import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-to-a-random-secret';

// POST /auth/register — public (creates ATHLETE by default)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 10);
    const role = 'ATHLETE';

    db.prepare(
      'INSERT INTO user (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
    ).run(id, email, password_hash, name, role);

    const token = jwt.sign({ id, email, name, role }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ token, user: { id, name, role } });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM user WHERE email = ?').get(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /auth/me — returns current user
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role FROM user WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// GET /auth/athletes — ADMIN only, lists all ATHLETE users
router.get('/athletes', authenticate, authorize('ADMIN'), (req, res) => {
  const athletes = db.prepare(
    "SELECT id, name, email FROM user WHERE role = 'ATHLETE' ORDER BY name"
  ).all();
  res.json(athletes);
});

// GET /auth/judges — ADMIN only, lists all JUDGE and HEAD_JUDGE users
router.get('/judges', authenticate, authorize('ADMIN'), (req, res) => {
  const judges = db.prepare(
    "SELECT id, name, email, role FROM user WHERE role IN ('JUDGE', 'HEAD_JUDGE') ORDER BY role, name"
  ).all();
  res.json(judges);
});

// POST /auth/create-staff — ADMIN only, creates JUDGE or HEAD_JUDGE accounts
router.post('/create-staff', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    if (!['HEAD_JUDGE', 'JUDGE'].includes(role)) {
      return res.status(400).json({ error: 'Role must be HEAD_JUDGE or JUDGE' });
    }

    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 10);

    db.prepare(
      'INSERT INTO user (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
    ).run(id, email, password_hash, name, role);

    res.status(201).json({ id, name, email, role });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
