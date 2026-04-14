/**
 * Unit & Integration Tests — Pure Logic + Service Functions with DB
 * Unit tests: individual functions in isolation (no DB)
 * Integration tests: service functions with real SQLite database (same process for c8 coverage)
 *
 * Usage: node test.unit.js
 * Coverage: npx c8 --include="src/**" node test.unit.js
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { getFormatConfig, snakeDistribute, ladderDistribute, stepladderDistribute, generateHeatsForDivision } from './src/services/heatGeneration.js';
import { submitScore, submitForReview, approveHeat, closeHeat, manualReorder, requestCorrection, reopenHeat } from './src/services/scoringEngine.js';
import { EVENTS } from './src/utils/events.js';
import db, { initDb } from './src/db/schema.js';
import { execSync } from 'node:child_process';

let passed = 0, failed = 0;

function check(tc, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`    ✓ ${tc}`); passed++; }
  else { console.log(`    ✗ ${tc} — expected ${e}, got ${a}`); failed++; }
}

function assert(tc, condition) {
  if (condition) { console.log(`    ✓ ${tc}`); passed++; }
  else { console.log(`    ✗ ${tc}`); failed++; }
}

function log(s) { console.log(`\n  ${s}`); }

// Helper: create athlete array
function athletes(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `a${i + 1}`, name: `Athlete ${i + 1}`, seed: i + 1 }));
}

console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║  WakeScore — Unit Tests (Pure Logic)                  ║');
console.log('╚═══════════════════════════════════════════════════════╝');

// ═══════════════════════════════════════════════════════════════════════════
// TS-U01: getFormatConfig — IWWF Format Lookup
// ═══════════════════════════════════════════════════════════════════════════
log('TS-U01: getFormatConfig — IWWF Format Lookup');

log('  Scenario: Error handling');
try { getFormatConfig(2); assert('U01.01: <3 athletes throws', false); }
catch (e) { check('U01.01: <3 athletes throws 400', e.status, 400); }

try { getFormatConfig(0); assert('U01.02: 0 athletes throws', false); }
catch (e) { check('U01.02: 0 athletes throws 400', e.status, 400); }

try { getFormatConfig(-1); assert('U01.03: negative throws', false); }
catch (e) { check('U01.03: negative throws 400', e.status, 400); }

log('  Scenario: 3–6 athletes (QUAL + FINAL)');
{
  const cfg = getFormatConfig(3);
  check('U01.04: 3 athletes → 2 stages', cfg.length, 2);
  check('U01.05: Stage 1 = QUALIFICATION', cfg[0].type, 'QUALIFICATION');
  check('U01.06: Stage 2 = FINAL', cfg[1].type, 'FINAL');
  check('U01.07: QUAL 1 heat', cfg[0].heatCount, 1);
  check('U01.08: QUAL distribution = SNAKE', cfg[0].distribution, 'SNAKE');
}
{
  const cfg = getFormatConfig(6);
  check('U01.09: 6 athletes → 2 stages', cfg.length, 2);
  check('U01.10: QUAL 1 heat, all advance', cfg[0].heatCount, 1);
  check('U01.11: QUAL qualifyTotal = 6', cfg[0].qualifyTotal, 6);
}

log('  Scenario: 7–10 athletes (QUAL + LCQ + FINAL)');
{
  const cfg = getFormatConfig(7);
  check('U01.12: 7 athletes → 3 stages', cfg.length, 3);
  check('U01.13: QUAL 2 heats', cfg[0].heatCount, 2);
  check('U01.14: QUAL advance 4', cfg[0].qualifyTotal, 4);
  check('U01.15: LCQ 1 heat', cfg[1].heatCount, 1);
  check('U01.16: LCQ distribution = STEPLADDER', cfg[1].distribution, 'STEPLADDER');
  check('U01.17: LCQ 1 run', cfg[1].runsPerAthlete, 1);
  check('U01.18: FINAL 1 heat', cfg[2].heatCount, 1);
  check('U01.19: FINAL distribution = LADDER', cfg[2].distribution, 'LADDER');
}
{
  const cfg = getFormatConfig(10);
  check('U01.20: 10 athletes → 3 stages', cfg.length, 3);
}

log('  Scenario: 11–12 athletes (QUAL + LCQ(STEPLADDER) + FINAL)');
{
  const cfg = getFormatConfig(11);
  check('U01.21: 11 athletes → 3 stages', cfg.length, 3);
  check('U01.22: LCQ 2 heats', cfg[1].heatCount, 2);
  check('U01.23: LCQ distribution = STEPLADDER', cfg[1].distribution, 'STEPLADDER');
  check('U01.24: LCQ advance 2', cfg[1].qualifyTotal, 2);
}

log('  Scenario: 13–18 athletes');
{
  const cfg = getFormatConfig(13);
  check('U01.25: 13 athletes → 3 stages', cfg.length, 3);
  check('U01.26: QUAL 3 heats', cfg[0].heatCount, 3);
  check('U01.27: QUAL advance 3', cfg[0].qualifyTotal, 3);
}
{
  const cfg = getFormatConfig(18);
  check('U01.28: 18 athletes → 3 stages', cfg.length, 3);
}

log('  Scenario: 19–20 athletes (QUAL + LCQ + SEMI + FINAL)');
{
  const cfg = getFormatConfig(19);
  check('U01.29: 19 athletes → 4 stages', cfg.length, 4);
  check('U01.30: QUAL 4 heats', cfg[0].heatCount, 4);
  check('U01.31: QUAL advance 8', cfg[0].qualifyTotal, 8);
  check('U01.32: LCQ 2 heats', cfg[1].heatCount, 2);
  check('U01.33: SEMI 2 heats', cfg[2].heatCount, 2);
  check('U01.34: SEMI distribution = STEPLADDER', cfg[2].distribution, 'STEPLADDER');
  check('U01.35: FINAL 1 heat', cfg[3].heatCount, 1);
}

log('  Scenario: 21–24 athletes');
{
  const cfg = getFormatConfig(24);
  check('U01.36: 24 athletes → 4 stages', cfg.length, 4);
  check('U01.37: LCQ 4 heats', cfg[1].heatCount, 4);
}

log('  Scenario: 25–36 athletes');
{
  const cfg = getFormatConfig(25);
  check('U01.38: 25 athletes → 4 stages', cfg.length, 4);
  check('U01.39: QUAL 6 heats', cfg[0].heatCount, 6);
}

log('  Scenario: 37–40 athletes (QUAL + LCQ + QF + SEMI + FINAL)');
{
  const cfg = getFormatConfig(37);
  check('U01.40: 37 athletes → 5 stages', cfg.length, 5);
  check('U01.41: Stage 3 = QUARTERFINAL', cfg[2].type, 'QUARTERFINAL');
  check('U01.42: QF 4 heats', cfg[2].heatCount, 4);
  check('U01.43: QF distribution = STEPLADDER', cfg[2].distribution, 'STEPLADDER');
}

log('  Scenario: 41–48 athletes');
{
  const cfg = getFormatConfig(48);
  check('U01.44: 48 athletes → 5 stages', cfg.length, 5);
  check('U01.45: LCQ 8 heats', cfg[1].heatCount, 8);
}

log('  Scenario: 49–54 athletes');
{
  const cfg = getFormatConfig(54);
  check('U01.46: 54 athletes → 5 stages', cfg.length, 5);
  check('U01.47: QUAL 9 heats', cfg[0].heatCount, 9);
}

log('  Scenario: 55+ athletes (extended)');
{
  const cfg = getFormatConfig(55);
  check('U01.48: 55 athletes → 5 stages', cfg.length, 5);
  assert('U01.49: QUAL heats ≥ 10', cfg[0].heatCount >= 10);
}
{
  const cfg = getFormatConfig(100);
  check('U01.50: 100 athletes → 5 stages', cfg.length, 5);
  assert('U01.51: QUAL heats ≥ 17', cfg[0].heatCount >= 17);
}

// ═══════════════════════════════════════════════════════════════════════════
// TS-U02: snakeDistribute
// ═══════════════════════════════════════════════════════════════════════════
log('TS-U02: snakeDistribute — Zigzag Seeding');

{
  const result = snakeDistribute(athletes(6), 2);
  check('U02.01: 6 athletes / 2 heats → 2 groups', result.length, 2);
  check('U02.02: Heat 1 has 3', result[0].length, 3);
  check('U02.03: Heat 2 has 3', result[1].length, 3);
  // Snake: 1→H1, 2→H2, 3→H2, 4→H1, 5→H1, 6→H2
  check('U02.04: H1 gets seeds 1,4,5', result[0].map(a => a.seed).sort((a,b) => a-b), [1, 4, 5]);
  check('U02.05: H2 gets seeds 2,3,6', result[1].map(a => a.seed).sort((a,b) => a-b), [2, 3, 6]);
}

{
  const result = snakeDistribute(athletes(7), 2);
  check('U02.06: 7/2 → sizes 4+3', [result[0].length, result[1].length].sort().join(','), '3,4');
}

{
  const result = snakeDistribute(athletes(1), 1);
  check('U02.07: 1 athlete / 1 heat', result[0].length, 1);
}

{
  const result = snakeDistribute([], 2);
  check('U02.08: Empty array → 2 empty heats', result.length, 2);
  check('U02.09: Both empty', result[0].length + result[1].length, 0);
}

{
  const result = snakeDistribute(athletes(3), 3);
  check('U02.10: 3/3 → 1 each', result.every(h => h.length === 1), true);
}

// ═══════════════════════════════════════════════════════════════════════════
// TS-U03: ladderDistribute
// ═══════════════════════════════════════════════════════════════════════════
log('TS-U03: ladderDistribute — Best Rides Last');

{
  const result = ladderDistribute(athletes(6), 1);
  check('U03.01: 6/1 → 1 heat with 6', result[0].length, 6);
  // Ladder reverses: best-ranked (seed 1) rides LAST
  check('U03.02: Last athlete is seed 1 (best)', result[0][5].seed, 1);
  check('U03.03: First athlete is seed 6 (weakest)', result[0][0].seed, 6);
}

{
  const result = ladderDistribute(athletes(4), 2);
  check('U03.04: 4/2 → 2 heats of 2', result[0].length, 2);
  check('U03.05: 2nd heat also 2', result[1].length, 2);
  // Sequential: 1→H1, 2→H2, 3→H1, 4→H2 → reversed within each
  check('U03.06: H1 reversed (3,1)', result[0].map(a => a.seed), [3, 1]);
  check('U03.07: H2 reversed (4,2)', result[1].map(a => a.seed), [4, 2]);
}

{
  const result = ladderDistribute([], 1);
  check('U03.08: Empty → 1 empty heat', result[0].length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// TS-U04: stepladderDistribute
// ═══════════════════════════════════════════════════════════════════════════
log('TS-U04: stepladderDistribute — Weakest First, Strongest Last');

{
  const result = stepladderDistribute(athletes(6), 2);
  check('U04.01: 6/2 → 2 heats', result.length, 2);
  // Stepladder per IWWF: even sequential distribution (like ladder), reversed so weakest first
  // Input: [1,2,3,4,5,6] → distribute: H1=[1,3,5], H2=[2,4,6] → reverse each: H1=[5,3,1], H2=[6,4,2]
  check('U04.02: H1 even distribution, weakest first', result[0][0].seed, 5);
  check('U04.03: H1 strongest rides last', result[0][result[0].length - 1].seed, 1);
  check('U04.04: H2 even distribution, weakest first', result[1][0].seed, 6);
  check('U04.05: H2 strongest rides last', result[1][result[1].length - 1].seed, 2);
}

{
  const result = stepladderDistribute(athletes(3), 1);
  check('U04.06: 3/1 → 1 heat with 3', result[0].length, 3);
  // Single heat: [1,2,3] → reversed: [3,2,1] — weakest (3) first, strongest (1) last
  check('U04.07: Weakest first, strongest last', result[0][0].seed, 3);
  check('U04.08: Strongest rides last', result[0][2].seed, 1);
}

{
  const result = stepladderDistribute([], 2);
  check('U04.09: Empty → 2 empty heats', result[0].length + result[1].length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// TS-U05: EVENTS Constants
// ═══════════════════════════════════════════════════════════════════════════
log('TS-U05: EVENTS Constants');

check('U05.01: SCORE_COMPUTED', EVENTS.SCORE_COMPUTED, 'score:computed');
check('U05.02: SCORE_SUBMITTED', EVENTS.SCORE_SUBMITTED, 'score:submitted');
check('U05.03: HEAT_APPROVED', EVENTS.HEAT_APPROVED, 'heat:approved');
check('U05.04: HEAT_CLOSED', EVENTS.HEAT_CLOSED, 'heat:closed');
check('U05.05: HEAT_OPENED', EVENTS.HEAT_OPENED, 'heat:opened');
check('U05.06: HEAT_STATUS_CHANGED', EVENTS.HEAT_STATUS_CHANGED, 'heat:status_changed');
check('U05.07: LEADERBOARD_UPDATED', EVENTS.LEADERBOARD_UPDATED, 'leaderboard:updated');
check('U05.08: CORRECTION_REQUESTED', EVENTS.CORRECTION_REQUESTED, 'correction:requested');
assert('U05.09: 8 event types defined', Object.keys(EVENTS).length === 8);

// ═══════════════════════════════════════════════════════════════════════════
// TS-U06: Format Config Consistency (meaningful validations across all brackets)
// ═══════════════════════════════════════════════════════════════════════════
log('TS-U06: Format Config Consistency Checks');

{
  const counts = [3, 6, 7, 10, 11, 12, 13, 18, 19, 20, 21, 24, 25, 36, 37, 40, 41, 48, 49, 54, 55, 60];
  const validOrder = ['QUALIFICATION', 'LCQ', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL'];

  // 1. Capacity: QUAL heats can hold all athletes (max 6 per heat)
  const capacityOk = counts.every(n => {
    const cfg = getFormatConfig(n);
    return cfg[0].heatCount * 6 >= n;
  });
  assert('U06.01: QUAL capacity holds all athletes (≤6 per heat) for all brackets', capacityOk);

  // 2. Qualify chain: qualifyTotal never exceeds stage capacity
  const qualifyOk = counts.every(n => {
    const cfg = getFormatConfig(n);
    return cfg.every(s => s.qualifyTotal === null || s.qualifyTotal <= s.heatCount * 6);
  });
  assert('U06.02: qualifyTotal never exceeds stage capacity for all brackets', qualifyOk);

  // 3. Stage sequence follows valid order (no wrong ordering)
  const sequenceOk = counts.every(n => {
    const cfg = getFormatConfig(n);
    const types = cfg.map(s => s.type);
    const indices = types.map(t => validOrder.indexOf(t));
    return indices.every((idx, i) => i === 0 || idx > indices[i - 1]);
  });
  assert('U06.03: Stage sequence follows QUAL→LCQ→QF→SEMI→FINAL order for all brackets', sequenceOk);

  // 4. LCQ always has 1 run per athlete
  const lcqRunsOk = counts.every(n => {
    const cfg = getFormatConfig(n);
    return cfg.filter(s => s.type === 'LCQ').every(s => s.runsPerAthlete === 1);
  });
  assert('U06.04: LCQ stages always have 1 run per athlete', lcqRunsOk);

  // 5. Non-LCQ stages always have 2 runs per athlete
  const nonLcqRunsOk = counts.every(n => {
    const cfg = getFormatConfig(n);
    return cfg.filter(s => s.type !== 'LCQ').every(s => s.runsPerAthlete === 2);
  });
  assert('U06.05: Non-LCQ stages always have 2 runs per athlete', nonLcqRunsOk);

  // 6. Distribution matches stage type (QUAL=SNAKE, FINAL=LADDER, others=STEPLADDER)
  const distOk = counts.every(n => {
    const cfg = getFormatConfig(n);
    return cfg.every(s => {
      if (s.type === 'QUALIFICATION') return s.distribution === 'SNAKE';
      if (s.type === 'FINAL') return s.distribution === 'LADDER';
      return s.distribution === 'STEPLADDER';
    });
  });
  assert('U06.06: Distribution type matches stage (QUAL=SNAKE, FINAL=LADDER, others=STEPLADDER)', distOk);

  // 7. Reversed flag correct (QUAL/LCQ not reversed, SEMI/QF/FINAL reversed)
  const reversedOk = counts.every(n => {
    const cfg = getFormatConfig(n);
    return cfg.every(s => {
      if (s.type === 'QUALIFICATION' || s.type === 'LCQ') return s.reversed === false;
      return s.reversed === true;
    });
  });
  assert('U06.07: Reversed flag correct (QUAL/LCQ=false, SEMI/QF/FINAL=true)', reversedOk);

  // 8. FINAL always has exactly 1 heat and null qualifyTotal
  const finalOk = counts.every(n => {
    const cfg = getFormatConfig(n);
    const fin = cfg[cfg.length - 1];
    return fin.type === 'FINAL' && fin.heatCount === 1 && fin.qualifyTotal === null;
  });
  assert('U06.08: FINAL always 1 heat with null qualifyTotal for all brackets', finalOk);
}

// ═══════════════════════════════════════════════════════════════════════════
// TS-U07: Distribution Edge Cases
// ═══════════════════════════════════════════════════════════════════════════
log('TS-U07: Distribution Edge Cases');

{
  // Large distribution
  const result = snakeDistribute(athletes(20), 4);
  check('U07.01: 20/4 → 4 heats of 5', result.every(h => h.length === 5), true);
  // Total athletes preserved
  check('U07.02: Total preserved', result.flat().length, 20);
}

{
  // Uneven distribution
  const result = snakeDistribute(athletes(11), 2);
  check('U07.03: 11/2 → 6+5 or 5+6', result[0].length + result[1].length, 11);
  assert('U07.04: Max difference 1', Math.abs(result[0].length - result[1].length) <= 1);
}

{
  // Ladder preserves all athletes
  const result = ladderDistribute(athletes(7), 3);
  check('U07.05: 7/3 ladder total preserved', result.flat().length, 7);
}

{
  // Stepladder preserves all athletes
  const result = stepladderDistribute(athletes(9), 3);
  check('U07.06: 9/3 stepladder total preserved', result.flat().length, 9);
  check('U07.07: 3 heats of 3', result.every(h => h.length === 3), true);
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS — Service functions with real DB (same process for coverage)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║  Integration Tests (DB)                               ║');
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
// TS-U08: generateHeatsForDivision
// ═══════════════════════════════════════════════════════════════════════════
log('TS-U08: generateHeatsForDivision — Integration');

{
  const result = generateHeatsForDivision(divId);
  check('U08.01: stages_created = 2 (QUAL + FINAL)', result.stages_created, 2);
  check('U08.02: heats_created = 2', result.heats_created, 2);
  assert('U08.03: format string contains "6 athletes"', result.format.includes('6 athletes'));

  const stages = db.prepare('SELECT * FROM stage WHERE division_id = ? ORDER BY stage_order').all(divId);
  check('U08.04: First stage = QUALIFICATION', stages[0].stage_type, 'QUALIFICATION');
  check('U08.05: Second stage = FINAL', stages[1].stage_type, 'FINAL');

  const qualHeatAthletes = db.prepare(`
    SELECT COUNT(*) as cnt FROM heat_athlete ha
    JOIN heat h ON ha.heat_id = h.id WHERE h.stage_id = ?
  `).get(stages[0].id).cnt;
  check('U08.06: QUAL heat has 6 athletes', qualHeatAthletes, 6);

  const finalHeatAthletes = db.prepare(`
    SELECT COUNT(*) as cnt FROM heat_athlete ha
    JOIN heat h ON ha.heat_id = h.id WHERE h.stage_id = ?
  `).get(stages[1].id).cnt;
  check('U08.07: FINAL heat empty (0 athletes)', finalHeatAthletes, 0);

  const runs = db.prepare(`
    SELECT COUNT(*) as cnt FROM athlete_run ar
    JOIN heat h ON ar.heat_id = h.id WHERE h.stage_id = ?
  `).get(stages[0].id).cnt;
  check('U08.08: QUAL has 12 athlete_runs (6×2)', runs, 12);
}

// Error cases
{
  // Create a division with only 2 athletes
  const smallDivId = uuidv4();
  db.prepare('INSERT INTO division (id, competition_id, name, display_order) VALUES (?, ?, ?, ?)').run(smallDivId, compId, 'Small Div', 2);
  athleteIds.slice(0, 2).forEach((id, i) => {
    db.prepare('INSERT INTO registration (id, competition_id, division_id, athlete_id, status, seed) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), compId, smallDivId, id, 'CONFIRMED', i + 1);
  });
  try { generateHeatsForDivision(smallDivId); assert('U08.09: <3 athletes throws', false); }
  catch (e) { check('U08.09: <3 athletes → 400', e.status, 400); }

  // No HEAD_JUDGE division
  const noHjCompId = uuidv4();
  db.prepare(`INSERT INTO competition (id, name, start_date, location, judge_count, status, created_by)
    VALUES (?, 'No HJ Comp', '2026-12-01', 'Test', 2, 'ACTIVE', ?)`).run(noHjCompId, adminId);
  const noHjDivId = uuidv4();
  db.prepare('INSERT INTO division (id, competition_id, name, display_order) VALUES (?, ?, ?, ?)').run(noHjDivId, noHjCompId, 'Div', 1);
  athleteIds.slice(0, 3).forEach((id, i) => {
    db.prepare('INSERT INTO registration (id, competition_id, division_id, athlete_id, status, seed) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), noHjCompId, noHjDivId, id, 'CONFIRMED', i + 1);
  });
  try { generateHeatsForDivision(noHjDivId); assert('U08.10: no HJ throws', false); }
  catch (e) { check('U08.10: no HEAD_JUDGE → 400', e.status, 400); }
}

// ═══════════════════════════════════════════════════════════════════════════
// TS-U09: submitScore
// ═══════════════════════════════════════════════════════════════════════════
log('TS-U09: submitScore — Integration');

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
  check('U09.01: Valid score 75.5 → returns score', r1.score, 75.5);
  check('U09.02: scores_submitted = 1', r1.scores_submitted, 1);
  assert('U09.03: computed_score null (1 of 2 judges)', r1.computed_score === null);

  const r2 = submitScore(firstRun.id, judgeId, 80, null);
  check('U09.04: 2nd judge → scores_submitted = 2', r2.scores_submitted, 2);
  assert('U09.05: computed_score set after all judges', r2.computed_score !== null);
  check('U09.06: AVG(75.5, 80) = 77.75', r2.computed_score, 77.75);

  // Score 0 valid
  const secondRun = allRuns[1];
  const r3 = submitScore(secondRun.id, hjId, 0, null);
  check('U09.07: Score 0 valid', r3.score, 0);

  // Score 100 valid
  const r4 = submitScore(secondRun.id, judgeId, 100, null);
  check('U09.08: Score 100 valid', r4.score, 100);
  check('U09.09: AVG(0, 100) = 50', r4.computed_score, 50);

  // Invalid scores
  try { submitScore(firstRun.id, hjId, -1, null); assert('U09.10', false); }
  catch (e) { check('U09.10: Score -1 → 400', e.status, 400); }

  try { submitScore(firstRun.id, hjId, 101, null); assert('U09.11', false); }
  catch (e) { check('U09.11: Score 101 → 400', e.status, 400); }

  // Upsert: same judge re-scores
  const r5 = submitScore(firstRun.id, hjId, 90, null);
  check('U09.12: Upsert → new score 90', r5.score, 90);
  check('U09.13: AVG(90, 80) = 85', r5.computed_score, 85);

  // Score on PENDING heat
  const finalStage = db.prepare("SELECT id FROM stage WHERE division_id = ? AND stage_type = 'FINAL'").get(divId);
  const finalHeat = db.prepare('SELECT id FROM heat WHERE stage_id = ?').get(finalStage.id);
  // Final heat has no athlete_runs yet (empty), so use a fake ID
  try { submitScore(uuidv4(), hjId, 50, null); assert('U09.14', false); }
  catch (e) { check('U09.14: Non-existent run → 404', e.status, 404); }

  // Score remaining runs so we can test review/approve
  for (const run of allRuns.slice(2)) {
    submitScore(run.id, hjId, 60 + Math.random() * 20, null);
    submitScore(run.id, judgeId, 60 + Math.random() * 20, null);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TS-U10: Heat Lifecycle (submitForReview, approveHeat, closeHeat)
// ═══════════════════════════════════════════════════════════════════════════
log('TS-U10: Heat Lifecycle — Integration');

{
  const qualStage = db.prepare("SELECT id FROM stage WHERE division_id = ? AND stage_type = 'QUALIFICATION'").get(divId);
  const qualHeat = db.prepare('SELECT id FROM heat WHERE stage_id = ?').get(qualStage.id);

  // submitForReview: OPEN → HEAD_REVIEW
  const rev = submitForReview(qualHeat.id, hjId);
  check('U10.01: submitForReview → HEAD_REVIEW', rev.status, 'HEAD_REVIEW');

  const heatStatus = db.prepare('SELECT status FROM heat WHERE id = ?').get(qualHeat.id).status;
  check('U10.02: DB status = HEAD_REVIEW', heatStatus, 'HEAD_REVIEW');

  // approveHeat: HEAD_REVIEW → APPROVED
  const appr = approveHeat(qualHeat.id, hjId, null);
  check('U10.03: approveHeat → APPROVED', appr.status, 'APPROVED');
  assert('U10.04: results array has entries', appr.results.length > 0);
  assert('U10.05: results have best_score', appr.results[0].best_score !== undefined);
  assert('U10.06: results have final_rank', appr.results[0].final_rank !== undefined);

  // stage_ranking created
  const rankings = db.prepare('SELECT * FROM stage_ranking WHERE stage_id = ?').all(qualStage.id);
  assert('U10.07: stage_ranking entries created', rankings.length > 0);

  // closeHeat: not approved → should fail (heat is now APPROVED, so this should work)
  const cl = closeHeat(qualHeat.id, hjId, null);
  check('U10.08: closeHeat → CLOSED', cl.status, 'CLOSED');
  // With only 1 QUAL heat and 6 athletes → QUAL+FINAL, closing triggers stage completion
  check('U10.09: stage_complete = true', cl.stage_complete, true);
}

// ═══════════════════════════════════════════════════════════════════════════
// TS-U11: manualReorder + requestCorrection + reopenHeat
// ═══════════════════════════════════════════════════════════════════════════
log('TS-U11: manualReorder, requestCorrection, reopenHeat — Integration');

{
  // Use FINAL heat (which should now be populated after QUAL stage completed)
  const finalStage = db.prepare("SELECT id FROM stage WHERE division_id = ? AND stage_type = 'FINAL'").get(divId);
  const finalHeat = db.prepare('SELECT id FROM heat WHERE stage_id = ?').get(finalStage.id);
  const finalAthletes = db.prepare('SELECT athlete_id FROM heat_athlete WHERE heat_id = ?').all(finalHeat.id);

  assert('U11.01: FINAL populated with athletes', finalAthletes.length > 0);

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
  check('U11.02: requestCorrection → correction_requested true', corr.correction_requested, true);

  const flagged = db.prepare('SELECT correction_requested, correction_note FROM judge_score WHERE id = ?').get(aJudgeScore.id);
  check('U11.03: DB correction_requested = 1', flagged.correction_requested, 1);
  assert('U11.04: correction_note saved', flagged.correction_note.includes('fix'));

  // manualReorder
  const ranking = finalAthletes.map((a, i) => ({ athlete_id: a.athlete_id, final_rank: i + 1 }));
  const reorder = manualReorder(finalHeat.id, ranking, hjId);
  check('U11.05: manualReorder → ranking_updated true', reorder.ranking_updated, true);

  // Approve
  const appr2 = approveHeat(finalHeat.id, hjId, null);
  check('U11.06: approve after reorder → APPROVED', appr2.status, 'APPROVED');
  check('U11.07: manual rank preserved (rank 1)', appr2.results[0].final_rank, 1);

  // reopenHeat: APPROVED → HEAD_REVIEW
  const reopen = reopenHeat(finalHeat.id, hjId, null);
  check('U11.08: reopenHeat → HEAD_REVIEW', reopen.status, 'HEAD_REVIEW');

  // Verify scores deleted
  const scoresAfter = db.prepare(`
    SELECT COUNT(*) as cnt FROM judge_score js
    JOIN athlete_run ar ON js.athlete_run_id = ar.id WHERE ar.heat_id = ?
  `).get(finalHeat.id).cnt;
  check('U11.09: scores deleted after reopen', scoresAfter, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// TS-U12: Stage Progression (11 athletes → QUAL + LCQ + FINAL)
// ═══════════════════════════════════════════════════════════════════════════
log('TS-U12: Stage Progression — Integration');

{
  // Create a new division with 11 athletes for full progression
  const progDivId = uuidv4();
  db.prepare('INSERT INTO division (id, competition_id, name, display_order) VALUES (?, ?, ?, ?)').run(progDivId, compId, 'Progression Test', 3);
  athleteIds.forEach((id, i) => {
    db.prepare('INSERT INTO registration (id, competition_id, division_id, athlete_id, status, seed) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), compId, progDivId, id, 'CONFIRMED', i + 1);
  });

  const gen = generateHeatsForDivision(progDivId);
  check('U12.01: 11 athletes → 3 stages', gen.stages_created, 3);

  const stages = db.prepare('SELECT * FROM stage WHERE division_id = ? ORDER BY stage_order').all(progDivId);
  check('U12.02: QUAL stage', stages[0].stage_type, 'QUALIFICATION');
  check('U12.03: LCQ stage', stages[1].stage_type, 'LCQ');
  check('U12.04: FINAL stage', stages[2].stage_type, 'FINAL');

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
  check('U12.05: LCQ stage ACTIVE after QUAL complete', lcqStatus, 'ACTIVE');

  // Check LCQ has non-qualifiers
  const lcqAthletes = db.prepare(`
    SELECT COUNT(*) as cnt FROM heat_athlete ha
    JOIN heat h ON ha.heat_id = h.id WHERE h.stage_id = ?
  `).get(stages[1].id).cnt;
  assert('U12.06: LCQ has non-qualifiers', lcqAthletes > 0);

  // Check QUAL advancers marked
  const qualAdvanced = db.prepare(`
    SELECT COUNT(*) as cnt FROM heat_athlete ha
    JOIN heat h ON ha.heat_id = h.id WHERE h.stage_id = ? AND ha.advanced = 1
  `).get(stages[0].id).cnt;
  assert('U12.07: QUAL has advanced athletes', qualAdvanced > 0);

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
  check('U12.08: FINAL stage ACTIVE after LCQ complete', finalStatus, 'ACTIVE');

  // Check FINAL has athletes (QUAL qualifiers + LCQ winners)
  const finalAthletes = db.prepare(`
    SELECT COUNT(*) as cnt FROM heat_athlete ha
    JOIN heat h ON ha.heat_id = h.id WHERE h.stage_id = ?
  `).get(stages[2].id).cnt;
  check('U12.09: FINAL has 6 athletes', finalAthletes, 6);
}

// ═══════════════════════════════════════════════════════════════════════════
// Cleanup: restore DB to clean seeded state
console.log('\n  Restoring database...');
execSync('node src/db/seed.js', { stdio: 'ignore', cwd: import.meta.dirname });
console.log('  Database restored.');

console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log(`║  Test Results: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0, 32 - String(passed).length - String(failed).length))}║`);
console.log('╚═══════════════════════════════════════════════════════╝');
process.exit(failed > 0 ? 1 : 0);
