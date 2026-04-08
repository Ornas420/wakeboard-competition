import 'dotenv/config';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import db, { initDb } from './schema.js';
import { generateHeatsForDivision } from '../services/heatGeneration.js';

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
    DROP TABLE IF EXISTS division;
    DROP TABLE IF EXISTS competition;
    DROP TABLE IF EXISTS user;
  `);

  // Also drop indexes (they'll be recreated by initDb)
  db.exec(`
    DROP INDEX IF EXISTS idx_division_competition;
    DROP INDEX IF EXISTS idx_registration_division;
    DROP INDEX IF EXISTS idx_stage_division;
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

  const insertUser = db.prepare(
    'INSERT INTO user (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
  );

  insertUser.run(adminId, 'admin@wakeboard.lt', hash, 'Admin Vaitkus', 'ADMIN');
  insertUser.run(headJudgeId, 'headjudge@wakeboard.lt', hash, 'Rimas Kazlauskas', 'HEAD_JUDGE');
  insertUser.run(judge1Id, 'judge1@wakeboard.lt', hash, 'Tomas Jurkus', 'JUDGE');
  insertUser.run(judge2Id, 'judge2@wakeboard.lt', hash, 'Andrius Baltas', 'JUDGE');
  insertUser.run(judge3Id, 'judge3@wakeboard.lt', hash, 'Dainius Giedrius', 'JUDGE');

  // 11 Men athletes
  const menNames = [
    'Jonas Jonaitis', 'Petras Petraitis', 'Lukas Lukauskas',
    'Matas Matauskas', 'Karolis Karolaitis', 'Giedrius Giedraitis',
    'Tautvydas Tautvilas', 'Rokas Rokaitis', 'Domas Domaitis',
    'Paulius Paulauskas', 'Mantas Mantauskas'
  ];
  const menIds = menNames.map((name, i) => {
    const id = uuidv4();
    insertUser.run(id, `athlete${i + 1}@wakeboard.lt`, hash, name, 'ATHLETE');
    return id;
  });

  // 6 Women athletes
  const womenNames = [
    'Gabija Gabijaitė', 'Austėja Austėjaitė', 'Ieva Ievaitė',
    'Emilija Emilijaitė', 'Kotryna Kotrynaitė', 'Ugnė Ugnaitė'
  ];
  const womenIds = womenNames.map((name, i) => {
    const id = uuidv4();
    insertUser.run(id, `wathlete${i + 1}@wakeboard.lt`, hash, name, 'ATHLETE');
    return id;
  });

  // --- Competition ---
  const compId = uuidv4();
  db.prepare(`
    INSERT INTO competition (id, name, date, location, description, judge_count, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    compId,
    'Lithuanian Wakeboard Open 2026',
    '2026-07-15',
    'Vilnius Wake Park',
    'Annual Lithuanian wakeboard competition featuring top national riders.',
    3,
    'ACTIVE',
    adminId
  );

  // --- Divisions ---
  const divMenId = uuidv4();
  const divWomenId = uuidv4();
  const insertDiv = db.prepare(
    'INSERT INTO division (id, competition_id, name, display_order) VALUES (?, ?, ?, ?)'
  );
  insertDiv.run(divMenId, compId, 'Open Men', 1);
  insertDiv.run(divWomenId, compId, 'Open Women', 2);

  // --- Staff ---
  const insertStaff = db.prepare(
    'INSERT INTO competition_staff (id, competition_id, user_id, staff_role) VALUES (?, ?, ?, ?)'
  );
  insertStaff.run(uuidv4(), compId, headJudgeId, 'HEAD_JUDGE');
  insertStaff.run(uuidv4(), compId, judge1Id, 'JUDGE');
  insertStaff.run(uuidv4(), compId, judge2Id, 'JUDGE');
  insertStaff.run(uuidv4(), compId, judge3Id, 'JUDGE');

  // --- Registrations ---
  const insertReg = db.prepare(
    'INSERT INTO registration (id, competition_id, division_id, athlete_id, status, seed) VALUES (?, ?, ?, ?, ?, ?)'
  );

  // 11 Men athletes with seeds
  menIds.forEach((athleteId, i) => {
    insertReg.run(uuidv4(), compId, divMenId, athleteId, 'CONFIRMED', i + 1);
  });

  // 6 Women athletes with seeds
  womenIds.forEach((athleteId, i) => {
    insertReg.run(uuidv4(), compId, divWomenId, athleteId, 'CONFIRMED', i + 1);
  });

  // --- Generate heats for both divisions ---
  let menHeats, womenHeats;
  try {
    menHeats = generateHeatsForDivision(divMenId);
    console.log(`  Men heat generation: ${menHeats.format}`);
    console.log(`    ${menHeats.stages_created} stages, ${menHeats.heats_created} heats created`);
  } catch (err) {
    console.error('  Men heat generation failed:', err.message);
  }

  try {
    womenHeats = generateHeatsForDivision(divWomenId);
    console.log(`  Women heat generation: ${womenHeats.format}`);
    console.log(`    ${womenHeats.stages_created} stages, ${womenHeats.heats_created} heats created`);
  } catch (err) {
    console.error('  Women heat generation failed:', err.message);
  }

  // --- Publish all heats ---
  db.prepare(`
    UPDATE heat SET published = 1
    WHERE id IN (SELECT h.id FROM heat h JOIN stage s ON h.stage_id = s.id WHERE s.competition_id = ?)
  `).run(compId);

  // --- Set schedule order (interleaved: Men Qual, Women Qual, Men LCQ, Women LCQ, etc.) ---
  const allStages = db.prepare(`
    SELECT s.id, s.stage_type, s.stage_order, s.division_id, d.name as division_name
    FROM stage s
    JOIN division d ON s.division_id = d.id
    WHERE s.competition_id = ?
    ORDER BY s.stage_order, d.display_order
  `).all(compId);

  let scheduleOrder = 1;
  for (const stage of allStages) {
    const heats = db.prepare(
      'SELECT id FROM heat WHERE stage_id = ? ORDER BY heat_number'
    ).all(stage.id);
    for (const heat of heats) {
      db.prepare('UPDATE heat SET schedule_order = ? WHERE id = ?').run(scheduleOrder, heat.id);
      scheduleOrder++;
    }
  }

  // --- Summary ---
  const totalHeats = db.prepare(`
    SELECT COUNT(*) as cnt FROM heat h JOIN stage s ON h.stage_id = s.id WHERE s.competition_id = ?
  `).get(compId).cnt;

  const scheduleList = db.prepare(`
    SELECT h.schedule_order, d.name as div, s.stage_type, h.heat_number
    FROM heat h
    JOIN stage s ON h.stage_id = s.id
    JOIN division d ON s.division_id = d.id
    WHERE s.competition_id = ?
    ORDER BY h.schedule_order
  `).all(compId);

  console.log('');
  console.log('Database seeded successfully');
  console.log('');
  console.log('=== Test Accounts ===');
  console.log('  Admin:       admin@wakeboard.lt / password123');
  console.log('  Head Judge:  headjudge@wakeboard.lt / password123');
  console.log('  Judges:      judge1@wakeboard.lt, judge2@wakeboard.lt, judge3@wakeboard.lt / password123');
  console.log(`  Men athletes:   athlete1@wakeboard.lt ... athlete11@wakeboard.lt / password123`);
  console.log(`  Women athletes: wathlete1@wakeboard.lt ... wathlete6@wakeboard.lt / password123`);
  console.log('');
  console.log('=== Competition ===');
  console.log(`  ${compId} — ACTIVE`);
  console.log(`  Open Men: 11 athletes → ${menHeats?.format || 'N/A'}`);
  console.log(`  Open Women: 6 athletes → ${womenHeats?.format || 'N/A'}`);
  console.log(`  Total heats: ${totalHeats} (all published)`);
  console.log('');
  console.log('=== Schedule Order ===');
  for (const h of scheduleList) {
    console.log(`  ${h.schedule_order}. ${h.div} — ${h.stage_type} Heat ${h.heat_number}`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
