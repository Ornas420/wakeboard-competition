/**
 * Unit Tests — Pure Logic Functions
 * Tests individual functions in isolation without HTTP server or database.
 *
 * Usage: node test.unit.js
 */

import { getFormatConfig, snakeDistribute, ladderDistribute, stepladderDistribute } from './src/services/heatGeneration.js';
import { EVENTS } from './src/utils/events.js';

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
  // Count only top-level test suites (TS-U...), not sub-scenarios
  if (s.startsWith('TS-')) suites++;
  console.log(`\n  ${s}`);
}

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
const duration = ((Date.now() - startTime) / 1000).toFixed(3);
console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║  Unit Test Results                                    ║');
console.log('╠═══════════════════════════════════════════════════════╣');
console.log(`║  Test suites: ${suites}${' '.repeat(40 - String(suites).length)}║`);
console.log(`║  Tests:       ${passed + failed} (${passed} passed, ${failed} failed)${' '.repeat(Math.max(0, 26 - String(passed + failed).length - String(passed).length - String(failed).length))}║`);
console.log(`║  Duration:    ${duration}s${' '.repeat(Math.max(0, 39 - duration.length))}║`);
console.log('╚═══════════════════════════════════════════════════════╝');
process.exit(failed > 0 ? 1 : 0);
