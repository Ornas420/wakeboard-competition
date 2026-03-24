import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DB_PATH || './wakeboard.db';
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'athlete',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS competitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      competition_id TEXT NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      competition_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS heats (
      id TEXT PRIMARY KEY,
      competition_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      round INTEGER NOT NULL DEFAULT 1,
      heat_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS heat_athletes (
      id TEXT PRIMARY KEY,
      heat_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      ride_order INTEGER NOT NULL,
      FOREIGN KEY (heat_id) REFERENCES heats(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      heat_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      judge_id TEXT NOT NULL,
      execution REAL NOT NULL DEFAULT 0,
      difficulty REAL NOT NULL DEFAULT 0,
      intensity REAL NOT NULL DEFAULT 0,
      composition REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (heat_id) REFERENCES heats(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (judge_id) REFERENCES users(id)
    );
  `);

  console.log('Database initialized');
}

export default db;
