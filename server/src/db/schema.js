import Database from 'better-sqlite3';

const dbPath = process.env.DB_PATH || './wakeboard.db';
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'HEAD_JUDGE', 'JUDGE', 'ATHLETE')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS competition (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      description TEXT,
      timetable TEXT,
      video_url TEXT,
      judge_count INTEGER NOT NULL DEFAULT 3 CHECK(judge_count >= 3 AND judge_count <= 5),
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'ACTIVE', 'COMPLETED')),
      created_by TEXT NOT NULL REFERENCES user(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS division (
      id TEXT PRIMARY KEY,
      competition_id TEXT NOT NULL REFERENCES competition(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(competition_id, name)
    );

    CREATE TABLE IF NOT EXISTS competition_staff (
      id TEXT PRIMARY KEY,
      competition_id TEXT NOT NULL REFERENCES competition(id),
      user_id TEXT NOT NULL REFERENCES user(id),
      staff_role TEXT NOT NULL CHECK(staff_role IN ('HEAD_JUDGE', 'JUDGE')),
      UNIQUE(competition_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS registration (
      id TEXT PRIMARY KEY,
      competition_id TEXT NOT NULL REFERENCES competition(id),
      division_id TEXT NOT NULL REFERENCES division(id),
      athlete_id TEXT NOT NULL REFERENCES user(id),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'CONFIRMED', 'WITHDRAWN')),
      seed INTEGER,
      registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(division_id, athlete_id)
    );

    CREATE TABLE IF NOT EXISTS stage (
      id TEXT PRIMARY KEY,
      competition_id TEXT NOT NULL REFERENCES competition(id),
      division_id TEXT NOT NULL REFERENCES division(id),
      stage_type TEXT NOT NULL CHECK(stage_type IN ('QUALIFICATION', 'LCQ', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL')),
      stage_order INTEGER NOT NULL,
      runs_per_athlete INTEGER NOT NULL DEFAULT 2,
      athletes_advance INTEGER,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACTIVE', 'COMPLETED')),
      distribution TEXT NOT NULL CHECK(distribution IN ('SNAKE', 'LADDER', 'STEPLADDER')),
      reversed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS heat (
      id TEXT PRIMARY KEY,
      stage_id TEXT NOT NULL REFERENCES stage(id),
      heat_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'OPEN', 'HEAD_REVIEW', 'APPROVED', 'CLOSED')),
      published INTEGER NOT NULL DEFAULT 0,
      manually_adjusted INTEGER NOT NULL DEFAULT 0,
      run2_reorder INTEGER NOT NULL DEFAULT 0,
      scheduled_time TEXT,
      schedule_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS heat_athlete (
      id TEXT PRIMARY KEY,
      heat_id TEXT NOT NULL REFERENCES heat(id),
      athlete_id TEXT NOT NULL REFERENCES user(id),
      run_order INTEGER NOT NULL,
      advanced INTEGER NOT NULL DEFAULT 0,
      UNIQUE(heat_id, athlete_id)
    );

    CREATE TABLE IF NOT EXISTS athlete_run (
      id TEXT PRIMARY KEY,
      heat_id TEXT NOT NULL REFERENCES heat(id),
      athlete_id TEXT NOT NULL REFERENCES user(id),
      run_number INTEGER NOT NULL CHECK(run_number IN (1, 2)),
      scores_submitted INTEGER NOT NULL DEFAULT 0,
      computed_score REAL,
      UNIQUE(heat_id, athlete_id, run_number)
    );

    CREATE TABLE IF NOT EXISTS judge_score (
      id TEXT PRIMARY KEY,
      athlete_run_id TEXT NOT NULL REFERENCES athlete_run(id),
      judge_id TEXT NOT NULL REFERENCES user(id),
      score REAL NOT NULL CHECK(score >= 0.0 AND score <= 100.0),
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      correction_requested INTEGER NOT NULL DEFAULT 0,
      correction_note TEXT,
      UNIQUE(athlete_run_id, judge_id)
    );

    CREATE TABLE IF NOT EXISTS heat_result (
      id TEXT PRIMARY KEY,
      heat_id TEXT NOT NULL REFERENCES heat(id),
      athlete_id TEXT NOT NULL REFERENCES user(id),
      best_score REAL NOT NULL,
      second_score REAL,
      final_rank INTEGER NOT NULL,
      UNIQUE(heat_id, athlete_id)
    );

    CREATE TABLE IF NOT EXISTS stage_ranking (
      id TEXT PRIMARY KEY,
      stage_id TEXT NOT NULL REFERENCES stage(id),
      athlete_id TEXT NOT NULL REFERENCES user(id),
      best_score REAL NOT NULL,
      rank INTEGER NOT NULL,
      advanced INTEGER NOT NULL DEFAULT 0,
      UNIQUE(stage_id, athlete_id)
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_division_competition ON division(competition_id);
    CREATE INDEX IF NOT EXISTS idx_registration_division ON registration(division_id);
    CREATE INDEX IF NOT EXISTS idx_stage_division ON stage(division_id);
    CREATE INDEX IF NOT EXISTS idx_heat_athlete_heat_id ON heat_athlete(heat_id);
    CREATE INDEX IF NOT EXISTS idx_athlete_run_heat_athlete ON athlete_run(heat_id, athlete_id);
    CREATE INDEX IF NOT EXISTS idx_judge_score_run_id ON judge_score(athlete_run_id);
    CREATE INDEX IF NOT EXISTS idx_heat_result_heat_id ON heat_result(heat_id);
    CREATE INDEX IF NOT EXISTS idx_stage_ranking_stage_rank ON stage_ranking(stage_id, rank);
  `);

  console.log('Database initialized');
}

export default db;
