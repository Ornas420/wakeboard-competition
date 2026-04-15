/**
 * Integration Tests — Service functions with real SQLite database
 * Tests service-layer functions directly (same process as DB, enables c8 coverage).
 *
 * Usage: node test.integration.js
 * Coverage: npx c8 --include="src/**" node test.integration.js
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { execSync } from 'node:child_process';
import { generateHeatsForDivision } from './src/services/heatGeneration.js';
import { submitScore, submitForReview, approveHeat, closeHeat, manualReorder, requestCorrection, reopenHeat } from './src/services/scoringEngine.js';
import db from './src/db/schema.js';

let passed = 0, failed = 0, suites = 0;
const startTime = Date.now();

function check(tc, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`    ✓ ${tc}`); passed++; }
  else { console.log(`    ✗ ${tc} — expected ${e}, got ${a}`); failed++; }
}

function assert(tc, condition) {
  if (condition) { console.log(`    ✓ ${tc}`); passed++; }
  else { console.log(`    ✗ ${tc}`); failed++; }
}

function log(s) {
  if (s.startsWith('TS-')) suites++;
  console.log(`\n  ${s}`);
}

console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║  WakeScore — Integration Tests (Service Layer + DB)   ║');
console.log('╚═══════════════════════════════════════════════════════╝');

// --- Setup: clean DB and mini seed ---
db.exec(`
  DELETE FROM stage_ranking; DELETE FROM heat_result; DELETE FROM judge_score;
  DELETE FROM athlete_run; DELETE FROM heat_athlete; DELETE FROM heat;
  DELETE FROM stage; DELETE FROM registration; DELETE FROM competition_staff;
  DELETE FROM division; DELETE FROM competition; DELETE FROM user;
`);
const hash = bcrypt.hashSync('password123', 10);
const adminId = uuidv4();
const hjId = uuidv4();
const judgeId = uuidv4();
const athleteIds = Array.from({ length: 11 }, () => uuidv4());

const insertUser = db.prepare('INSERT INTO user (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)');
insertUser.run(adminId, 'test-admin@test.lt', hash, 'Test Admin', 'ADMIN');
insertUser.run(hjId, 'test-hj@test.lt', hash, 'Test HJ', 'HEAD_JUDGE');
insertUser.run(judgeId, 'test-judge@test.lt', hash, 'Test Judge', 'JUDGE');
athleteIds.forEach((id, i) => insertUser.run(id, `test-ath${i + 1}@test.lt`, hash, `Test Athlete ${i + 1}`, 'ATHLETE'));

const compId = uuidv4();
db.prepare(`INSERT INTO competition (id, name, start_date, end_date, location, judge_count, status, created_by)
  VALUES (?, 'Integration Test Comp', '2026-12-01', '2026-12-02', 'Test', 2, 'ACTIVE', ?)`).run(compId, adminId);

const divId = uuidv4();
db.prepare('INSERT INTO division (id, competition_id, name, display_order) VALUES (?, ?, ?, ?)').run(divId, compId, 'Test Division', 1);

db.prepare('INSERT INTO competition_staff (id, competition_id, user_id, staff_role) VALUES (?, ?, ?, ?)').run(uuidv4(), compId, hjId, 'HEAD_JUDGE');
db.prepare('INSERT INTO competition_staff (id, competition_id, user_id, staff_role) VALUES (?, ?, ?, ?)').run(uuidv4(), compId, judgeId, 'JUDGE');

// Register 6 athletes for main tests
athleteIds.slice(0, 6).forEach((id, i) => {
  db.prepare('INSERT INTO registration (id, competition_id, division_id, athlete_id, status, seed) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), compId, divId, id, 'CONFIRMED', i + 1);
});

// ═══════════════════════════════════════════════════════════════════════════
// TS-I01: generateHeatsForDivision
// ═══════════════════════════════════════════════════════════════════════════
log('TS-I01: generateHeatsForDivision');

{
  const result = generateHeatsForDivision(divId);
  check('I01.01: stages_created = 2 (QUAL + FINAL)', result.stages_created, 2);
  check('I01.02: heats_created = 2', result.heats_created, 2);
  assert('I01.03: format string contains "6 athletes"', result.format.includes('6 athletes'));

  const stages = db.prepare('SELECT * FROM stage WHERE division_id = ? ORDER BY stage_order').all(divId);
  check('I01.04: First stage = QUALIFICATION', stages[0].stage_type, 'QUALIFICATION');
  check('I01.05: Second stage = FINAL', stages[1].stage_type, 'FINAL');

  const qualHeatAthletes = db.prepare(`
    SELECT COUNT(*) as cnt FROM heat_athlete ha
    JOIN heat h ON ha.heat_id = h.id WHERE h.stage_id = ?
  `).get(stages[0].id).cnt;
  check('I01.06: QUAL heat has 6 athletes', qualHeatAthletes, 6);

  const finalHeatAthletes = db.prepare(`
    SELECT COUNT(*) as cnt FROM heat_athlete ha
    JOIN heat h ON ha.heat_id = h.id WHERE h.stage_id = ?
  `).get(stages[1].id).cnt;
  check('I01.07: FINAL heat empty (0 athletes)', finalHeatAthletes, 0);

  const runs = db.prepare(`
    SELECT COUNT(*) as cnt FROM athlete_run ar
    JOIN heat h ON ar.heat_id = h.id WHERE h.stage_id = ?
  `).get(stages[0].id).cnt;
  check('I01.08: QUAL has 12 athlete_runs (6×2)', runs, 12);
}

// Error cases
{
  // Create a division with only 2 athletes
  const smallDivId = uuidv4();
  db.prepare('INSERT INTO division (id, competition_id, name, display_order) VALUES (?, ?, ?, ?)').run(smallDivId, compId, 'Small Div', 2);
  athleteIds.slice(0, 2).forEach((id, i) => {
    db.prepare('INSERT INTO registration (id, competition_id, division_id, athlete_id, status, seed) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), compId, smallDivId, id, 'CONFIRMED', i + 1);
  });
  try { generateHeatsForDivision(smallDivId); assert('I01.09: <3 athletes throws', false); }
  catch (e) { check('I01.09: <3 athletes → 400', e.status, 400); }

  // No HEAD_JUDGE division
  const noHjCompId = uuidv4();
  db.prepare(`INSERT INTO competition (id, name, start_date, location, judge_count, status, created_by)
    VALUES (?, 'No HJ Comp', '2026-12-01', 'Test', 2, 'ACTIVE', ?)`).run(noHjCompId, adminId);
  const noHjDivId = uuidv4();
  db.prepare('INSERT INTO division (id, competition_id, name, display_order) VALUES (?, ?, ?, ?)').run(noHjDivId, noHjCompId, 'Div', 1);
  athleteIds.slice(0, 3).forEach((id, i) => {
    db.prepare('INSERT INTO registration (id, competition_id, division_id, athlete_id, status, seed) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), noHjCompId, noHjDivId, id, 'CONFIRMED', i + 1);
  });
  try { generateHeatsForDivision(noHjDivId); assert('I01.10: no HJ throws', false); }
  catch (e) { check('I01.10: no HEAD_JUDGE → 400', e.status, 400); }
}

// ═══════════════════════════════════════════════════════════════════════════
// TS-I02: submitScore
// ═══════════════════════════════════════════════════════════════════════════
log('TS-I02: submitScore');

{
  // Get QUAL heat and its runs
  const qualStage = db.prepare("SELECT id FROM stage WHERE division_id = ? AND stage_type = 'QUALIFICATION'").get(divId);
  const qualHeat = db.prepare('SELECT id FROM heat WHERE stage_id = ?').get(qualStage.id);

  // Open heat for scoring
  db.prepare("UPDATE heat SET status = 'OPEN' WHERE id = ?").run(qualHeat.id);

  const allRuns = db.prepare('SELECT id, athlete_id, run_number FROM athlete_run WHERE heat_id = ? ORDER BY athlete_id, run_number').all(qualHeat.id);
  const firstRun = allRuns[0];

  // Valid scores
  const r1 = submitScore(firstRun.id, hjId, 75.5, null);
  check('I02.01: Valid score 75.5 → returns score', r1.score, 75.5);
  check('I02.02: scores_submitted = 1', r1.scores_submitted, 1);
  assert('I02.03: computed_score null (1 of 2 judges)', r1.computed_score === null);

  const r2 = submitScore(firstRun.id, judgeId, 80, null);
  check('I02.04: 2nd judge → scores_submitted = 2', r2.scores_submitted, 2);
  assert('I02.05: computed_score set after all judges', r2.computed_score !== null);
  check('I02.06: AVG(75.5, 80) = 77.75', r2.computed_score, 77.75);

  // Score 0 valid
  const secondRun = allRuns[1];
  const r3 = submitScore(secondRun.id, hjId, 0, null);
  check('I02.07: Score 0 valid', r3.score, 0);

  // Score 100 valid
  const r4 = submitScore(secondRun.id, judgeId, 100, null);
  check('I02.08: Score 100 valid', r4.score, 100);
  check('I02.09: AVG(0, 100) = 50', r4.computed_score, 50);

  // Invalid scores
  try { submitScore(firstRun.id, hjId, -1, null); assert('I02.10', false); }
  catch (e) { check('I02.10: Score -1 → 400', e.status, 400); }

  try { submitScore(firstRun.id, hjId, 101, null); assert('I02.11', false); }
  catch (e) { check('I02.11: Score 101 → 400', e.status, 400); }

  // Upsert: same judge re-scores
  const r5 = submitScore(firstRun.id, hjId, 90, null);
  check('I02.12: Upsert → new score 90', r5.score, 90);
  check('I02.13: AVG(90, 80) = 85', r5.computed_score, 85);

  // Non-existent run
  try { submitScore(uuidv4(), hjId, 50, null); assert('I02.14', false); }
  catch (e) { check('I02.14: Non-existent run → 404', e.status, 404); }

  // Score remaining runs so we can test review/approve
  for (const run of allRuns.slice(2)) {
    submitScore(run.id, hjId, 60 + Math.random() * 20, null);
    submitScore(run.id, judgeId, 60 + Math.random() * 20, null);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TS-I03: Heat Lifecycle (submitForReview, approveHeat, closeHeat)
// ═══════════════════════════════════════════════════════════════════════════
log('TS-I03: Heat Lifecycle');

{
  const qualStage = db.prepare("SELECT id FROM stage WHERE division_id = ? AND stage_type = 'QUALIFICATION'").get(divId);
  const qualHeat = db.prepare('SELECT id FROM heat WHERE stage_id = ?').get(qualStage.id);

  // submitForReview: OPEN → HEAD_REVIEW
  const rev = submitForReview(qualHeat.id, hjId);
  check('I03.01: submitForReview → HEAD_REVIEW', rev.status, 'HEAD_REVIEW');

  const heatStatus = db.prepare('SELECT status FROM heat WHERE id = ?').get(qualHeat.id).status;
  check('I03.02: DB status = HEAD_REVIEW', heatStatus, 'HEAD_REVIEW');

  // approveHeat: HEAD_REVIEW → APPROVED
  const appr = approveHeat(qualHeat.id, hjId, null);
  check('I03.03: approveHeat → APPROVED', appr.status, 'APPROVED');
  assert('I03.04: results array has entries', appr.results.length > 0);
  assert('I03.05: results have best_score', appr.results[0].best_score !== undefined);
  assert('I03.06: results have final_rank', appr.results[0].final_rank !== undefined);

  // stage_ranking created
  const rankings = db.prepare('SELECT * FROM stage_ranking WHERE stage_id = ?').all(qualStage.id);
  assert('I03.07: stage_ranking entries created', rankings.length > 0);

  // closeHeat: APPROVED → CLOSED
  const cl = closeHeat(qualHeat.id, hjId, null);
  check('I03.08: closeHeat → CLOSED', cl.status, 'CLOSED');
  // With only 1 QUAL heat and 6 athletes → QUAL+FINAL, closing triggers stage completion
  check('I03.09: stage_complete = true', cl.stage_complete, true);
}

// ═══════════════════════════════════════════════════════════════════════════
// TS-I04: manualReorder + requestCorrection + reopenHeat
// ═══════════════════════════════════════════════════════════════════════════
log('TS-I04: manualReorder, requestCorrection, reopenHeat');

{
  // Use FINAL heat (which should now be populated after QUAL stage completed)
  const finalStage = db.prepare("SELECT id FROM stage WHERE division_id = ? AND stage_type = 'FINAL'").get(divId);
  const finalHeat = db.prepare('SELECT id FROM heat WHERE stage_id = ?').get(finalStage.id);
  const finalAthletes = db.prepare('SELECT athlete_id FROM heat_athlete WHERE heat_id = ?').all(finalHeat.id);

  assert('I04.01: FINAL populated with athletes', finalAthletes.length > 0);

  // Open and score final heat
  db.prepare("UPDATE heat SET status = 'OPEN' WHERE id = ?").run(finalHeat.id);
  const finalRuns = db.prepare('SELECT id, athlete_id, run_number FROM athlete_run WHERE heat_id = ?').all(finalHeat.id);
  for (const run of finalRuns) {
    submitScore(run.id, hjId, 50 + Math.random() * 40, null);
    submitScore(run.id, judgeId, 50 + Math.random() * 40, null);
  }

  // Submit for review
  submitForReview(finalHeat.id, hjId);

  // requestCorrection
  const aJudgeScore = db.prepare(`
    SELECT js.id FROM judge_score js
    JOIN athlete_run ar ON js.athlete_run_id = ar.id
    WHERE ar.heat_id = ? LIMIT 1
  `).get(finalHeat.id);

  const corr = requestCorrection(aJudgeScore.id, 'Please fix this score', hjId, null);
  check('I04.02: requestCorrection → correction_requested true', corr.correction_requested, true);

  const flagged = db.prepare('SELECT correction_requested, correction_note FROM judge_score WHERE id = ?').get(aJudgeScore.id);
  check('I04.03: DB correction_requested = 1', flagged.correction_requested, 1);
  assert('I04.04: correction_note saved', flagged.correction_note.includes('fix'));

  // manualReorder
  const ranking = finalAthletes.map((a, i) => ({ athlete_id: a.athlete_id, final_rank: i + 1 }));
  const reorder = manualReorder(finalHeat.id, ranking, hjId);
  check('I04.05: manualReorder → ranking_updated true', reorder.ranking_updated, true);

  // Approve
  const appr2 = approveHeat(finalHeat.id, hjId, null);
  check('I04.06: approve after reorder → APPROVED', appr2.status, 'APPROVED');
  check('I04.07: manual rank preserved (rank 1)', appr2.results[0].final_rank, 1);

  // reopenHeat: APPROVED → HEAD_REVIEW
  const reopen = reopenHeat(finalHeat.id, hjId, null);
  check('I04.08: reopenHeat → HEAD_REVIEW', reopen.status, 'HEAD_REVIEW');

  // Verify scores deleted
  const scoresAfter = db.prepare(`
    SELECT COUNT(*) as cnt FROM judge_score js
    JOIN athlete_run ar ON js.athlete_run_id = ar.id WHERE ar.heat_id = ?
  `).get(finalHeat.id).cnt;
  check('I04.09: scores deleted after reopen', scoresAfter, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// TS-I05: Stage Progression (11 athletes → QUAL + LCQ + FINAL)
// ═══════════════════════════════════════════════════════════════════════════
log('TS-I05: Stage Progression');

{
  // Create a new division with 11 athletes for full progression
  const progDivId = uuidv4();
  db.prepare('INSERT INTO division (id, competition_id, name, display_order) VALUES (?, ?, ?, ?)').run(progDivId, compId, 'Progression Test', 3);
  athleteIds.forEach((id, i) => {
    db.prepare('INSERT INTO registration (id, competition_id, division_id, athlete_id, status, seed) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), compId, progDivId, id, 'CONFIRMED', i + 1);
  });

  const gen = generateHeatsForDivision(progDivId);
  check('I05.01: 11 athletes → 3 stages', gen.stages_created, 3);

  const stages = db.prepare('SELECT * FROM stage WHERE division_id = ? ORDER BY stage_order').all(progDivId);
  check('I05.02: QUAL stage', stages[0].stage_type, 'QUALIFICATION');
  check('I05.03: LCQ stage', stages[1].stage_type, 'LCQ');
  check('I05.04: FINAL stage', stages[2].stage_type, 'FINAL');

  // Activate QUAL, score and close both heats
  db.prepare("UPDATE stage SET status = 'ACTIVE' WHERE id = ?").run(stages[0].id);
  const qualHeats = db.prepare('SELECT id FROM heat WHERE stage_id = ? ORDER BY heat_number').all(stages[0].id);

  for (const heat of qualHeats) {
    db.prepare("UPDATE heat SET status = 'OPEN' WHERE id = ?").run(heat.id);
    const runs = db.prepare('SELECT id FROM athlete_run WHERE heat_id = ?').all(heat.id);
    for (const run of runs) {
      submitScore(run.id, hjId, 50 + Math.random() * 40, null);
      submitScore(run.id, judgeId, 50 + Math.random() * 40, null);
    }
    submitForReview(heat.id, hjId);
    approveHeat(heat.id, hjId, null);
    closeHeat(heat.id, hjId, null);
  }

  // Check LCQ activated
  const lcqStatus = db.prepare('SELECT status FROM stage WHERE id = ?').get(stages[1].id).status;
  check('I05.05: LCQ stage ACTIVE after QUAL complete', lcqStatus, 'ACTIVE');

  // Check LCQ has non-qualifiers
  const lcqAthletes = db.prepare(`
    SELECT COUNT(*) as cnt FROM heat_athlete ha
    JOIN heat h ON ha.heat_id = h.id WHERE h.stage_id = ?
  `).get(stages[1].id).cnt;
  assert('I05.06: LCQ has non-qualifiers', lcqAthletes > 0);

  // Check QUAL advancers marked
  const qualAdvanced = db.prepare(`
    SELECT COUNT(*) as cnt FROM heat_athlete ha
    JOIN heat h ON ha.heat_id = h.id WHERE h.stage_id = ? AND ha.advanced = 1
  `).get(stages[0].id).cnt;
  assert('I05.07: QUAL has advanced athletes', qualAdvanced > 0);

  // Score and close LCQ heats
  const lcqHeats = db.prepare('SELECT id FROM heat WHERE stage_id = ? ORDER BY heat_number').all(stages[1].id);
  for (const heat of lcqHeats) {
    const haAthletes = db.prepare('SELECT athlete_id FROM heat_athlete WHERE heat_id = ?').all(heat.id);
    if (haAthletes.length === 0) continue;
    db.prepare("UPDATE heat SET status = 'OPEN' WHERE id = ?").run(heat.id);
    const runs = db.prepare('SELECT id FROM athlete_run WHERE heat_id = ?').all(heat.id);
    for (const run of runs) {
      submitScore(run.id, hjId, 50 + Math.random() * 40, null);
      submitScore(run.id, judgeId, 50 + Math.random() * 40, null);
    }
    submitForReview(heat.id, hjId);
    approveHeat(heat.id, hjId, null);
    closeHeat(heat.id, hjId, null);
  }

  // Check FINAL activated
  const finalStatus = db.prepare('SELECT status FROM stage WHERE id = ?').get(stages[2].id).status;
  check('I05.08: FINAL stage ACTIVE after LCQ complete', finalStatus, 'ACTIVE');

  // Check FINAL has athletes (QUAL qualifiers + LCQ winners)
  const finalAthletes = db.prepare(`
    SELECT COUNT(*) as cnt FROM heat_athlete ha
    JOIN heat h ON ha.heat_id = h.id WHERE h.stage_id = ?
  `).get(stages[2].id).cnt;
  check('I05.09: FINAL has 6 athletes', finalAthletes, 6);
}

// ═══════════════════════════════════════════════════════════════════════════
// Cleanup: restore DB to clean seeded state
console.log('\n  Restoring database...');
execSync('node src/db/seed.js', { stdio: 'ignore', cwd: import.meta.dirname });
console.log('  Database restored.');

const duration = ((Date.now() - startTime) / 1000).toFixed(3);
console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║  Integration Test Results                             ║');
console.log('╠═══════════════════════════════════════════════════════╣');
console.log(`║  Test suites: ${suites}${' '.repeat(40 - String(suites).length)}║`);
console.log(`║  Tests:       ${passed + failed} (${passed} passed, ${failed} failed)${' '.repeat(Math.max(0, 26 - String(passed + failed).length - String(passed).length - String(failed).length))}║`);
console.log(`║  Duration:    ${duration}s${' '.repeat(Math.max(0, 39 - duration.length))}║`);
console.log('╚═══════════════════════════════════════════════════════╝');
process.exit(failed > 0 ? 1 : 0);
