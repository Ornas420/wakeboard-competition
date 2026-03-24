import 'dotenv/config';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import db, { initDb } from './schema.js';

async function seed() {
  // Drop all tables and recreate
  db.exec(`
    DROP TABLE IF EXISTS stage_ranking;
    DROP TABLE IF EXISTS heat_result;
    DROP TABLE IF EXISTS judge_score;
    DROP TABLE IF EXISTS athlete_run;
    DROP TABLE IF EXISTS heat_athlete;
    DROP TABLE IF EXISTS heat;
    DROP TABLE IF EXISTS stage;
    DROP TABLE IF EXISTS registration;
    DROP TABLE IF EXISTS competition_staff;
    DROP TABLE IF EXISTS competition;
    DROP TABLE IF EXISTS user;
  `);

  // Also drop indexes (they'll be recreated by initDb)
  db.exec(`
    DROP INDEX IF EXISTS idx_heat_athlete_heat_id;
    DROP INDEX IF EXISTS idx_athlete_run_heat_athlete;
    DROP INDEX IF EXISTS idx_judge_score_run_id;
    DROP INDEX IF EXISTS idx_heat_result_heat_id;
    DROP INDEX IF EXISTS idx_stage_ranking_stage_rank;
  `);

  initDb();

  const hash = await bcrypt.hash('password123', 10);

  // --- Users ---
  const adminId = uuidv4();
  const headJudgeId = uuidv4();
  const judge1Id = uuidv4();
  const judge2Id = uuidv4();
  const judge3Id = uuidv4();

  const athleteIds = [];
  for (let i = 0; i < 10; i++) {
    athleteIds.push(uuidv4());
  }

  const insertUser = db.prepare(
    'INSERT INTO user (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
  );

  insertUser.run(adminId, 'admin@wakeboard.lt', hash, 'Admin Vaitkus', 'ADMIN');
  insertUser.run(headJudgeId, 'headjudge@wakeboard.lt', hash, 'Rimas Kazlauskas', 'HEAD_JUDGE');
  insertUser.run(judge1Id, 'judge1@wakeboard.lt', hash, 'Tomas Jurkus', 'JUDGE');
  insertUser.run(judge2Id, 'judge2@wakeboard.lt', hash, 'Andrius Baltas', 'JUDGE');
  insertUser.run(judge3Id, 'judge3@wakeboard.lt', hash, 'Dainius Giedrius', 'JUDGE');

  const athleteNames = [
    'Jonas Jonaitis', 'Petras Petraitis', 'Lukas Lukauskas',
    'Matas Matauskas', 'Karolis Karolaitis', 'Giedrius Giedraitis',
    'Tautvydas Tautvilas', 'Rokas Rokaitis', 'Domas Domaitis',
    'Paulius Paulauskas'
  ];

  athleteIds.forEach((id, i) => {
    insertUser.run(id, `athlete${i + 1}@wakeboard.lt`, hash, athleteNames[i], 'ATHLETE');
  });

  // --- Competition ---
  const compId = uuidv4();
  db.prepare(`
    INSERT INTO competition (id, name, date, location, division, description, judge_count, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    compId,
    'Lithuanian Wakeboard Open 2026',
    '2026-07-15',
    'Vilnius Wake Park',
    'Open',
    'Annual Lithuanian wakeboard competition featuring top national riders.',
    3,
    'DRAFT',
    adminId
  );

  // --- Staff ---
  const insertStaff = db.prepare(
    'INSERT INTO competition_staff (id, competition_id, user_id, staff_role) VALUES (?, ?, ?, ?)'
  );
  insertStaff.run(uuidv4(), compId, headJudgeId, 'HEAD_JUDGE');
  insertStaff.run(uuidv4(), compId, judge1Id, 'JUDGE');
  insertStaff.run(uuidv4(), compId, judge2Id, 'JUDGE');
  insertStaff.run(uuidv4(), compId, judge3Id, 'JUDGE');

  // --- Registrations (all 10 athletes confirmed) ---
  const insertReg = db.prepare(
    'INSERT INTO registration (id, competition_id, athlete_id, status) VALUES (?, ?, ?, ?)'
  );
  athleteIds.forEach((athleteId) => {
    insertReg.run(uuidv4(), compId, athleteId, 'CONFIRMED');
  });

  console.log('Database seeded successfully');
  console.log(`  Admin:      admin@wakeboard.lt / password123`);
  console.log(`  Head Judge: headjudge@wakeboard.lt / password123`);
  console.log(`  Judges:     judge1@wakeboard.lt, judge2@wakeboard.lt, judge3@wakeboard.lt / password123`);
  console.log(`  Athletes:   athlete1@wakeboard.lt ... athlete10@wakeboard.lt / password123`);
  console.log(`  Competition: ${compId} (DRAFT)`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
