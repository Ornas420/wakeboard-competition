/**
 * Unit Tests — Frontend Format Utilities
 * Tests formatDateRange, getHeatStatusColor, constants.
 *
 * Usage: node client/src/utils/format.test.js
 */

import { formatDateRange, getHeatStatusColor, STAGE_LABELS, GRADIENTS } from './format.js';

let passed = 0, failed = 0;

function check(tc, actual, expected) {
  if (actual === expected) { console.log(`    ✓ ${tc}`); passed++; }
  else { console.log(`    ✗ ${tc} — expected "${expected}", got "${actual}"`); failed++; }
}

function assert(tc, condition) {
  if (condition) { console.log(`    ✓ ${tc}`); passed++; }
  else { console.log(`    ✗ ${tc}`); failed++; }
}

function log(s) { console.log(`\n  ${s}`); }

console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║  WakeScore — Frontend Unit Tests                      ║');
console.log('╚═══════════════════════════════════════════════════════╝');

// ═══════════════════════════════════════════════════════════════════════════
log('TS-F01: formatDateRange');

log('  Scenario: Single date');
check('F01.01: No end date', formatDateRange('2026-07-15'), 'July 15, 2026');
check('F01.02: End same as start', formatDateRange('2026-07-15', '2026-07-15'), 'July 15, 2026');
check('F01.03: Null end date', formatDateRange('2026-07-15', null), 'July 15, 2026');
check('F01.04: Undefined end date', formatDateRange('2026-07-15', undefined), 'July 15, 2026');

log('  Scenario: Same month range');
check('F01.05: Jul 15–17', formatDateRange('2026-07-15', '2026-07-17'), 'July 15–17, 2026');
check('F01.06: Aug 1–5', formatDateRange('2026-08-01', '2026-08-05'), 'August 1–5, 2026');
check('F01.07: Jan 20–21', formatDateRange('2026-01-20', '2026-01-21'), 'January 20–21, 2026');

log('  Scenario: Different month range');
assert('F01.08: Jul–Aug spans months', formatDateRange('2026-07-30', '2026-08-02').includes('–') || formatDateRange('2026-07-30', '2026-08-02').includes('–'));

log('  Scenario: Various dates');
assert('F01.09: Start of year', formatDateRange('2026-01-01').includes('January'));
assert('F01.10: End of year', formatDateRange('2026-12-31').includes('December'));

// ═══════════════════════════════════════════════════════════════════════════
log('TS-F02: getHeatStatusColor');

check('F02.01: OPEN → green pulse', getHeatStatusColor('OPEN'), 'animate-pulse bg-green-400');
check('F02.02: APPROVED → blue', getHeatStatusColor('APPROVED'), 'bg-blue-400');
check('F02.03: CLOSED → blue', getHeatStatusColor('CLOSED'), 'bg-blue-400');
check('F02.04: HEAD_REVIEW → orange', getHeatStatusColor('HEAD_REVIEW'), 'bg-orange-400');
check('F02.05: PENDING → gray', getHeatStatusColor('PENDING'), 'bg-gray-300');
check('F02.06: Unknown → gray', getHeatStatusColor('UNKNOWN'), 'bg-gray-300');
check('F02.07: Empty string → gray', getHeatStatusColor(''), 'bg-gray-300');

// ═══════════════════════════════════════════════════════════════════════════
log('TS-F03: STAGE_LABELS constant');

check('F03.01: QUALIFICATION', STAGE_LABELS.QUALIFICATION, 'Qualification');
check('F03.02: LCQ', STAGE_LABELS.LCQ, 'LCQ');
check('F03.03: QUARTERFINAL', STAGE_LABELS.QUARTERFINAL, 'Quarter-finals');
check('F03.04: SEMIFINAL', STAGE_LABELS.SEMIFINAL, 'Semi-finals');
check('F03.05: FINAL', STAGE_LABELS.FINAL, 'Final');
assert('F03.06: 5 stage types', Object.keys(STAGE_LABELS).length === 5);

// ═══════════════════════════════════════════════════════════════════════════
log('TS-F04: GRADIENTS constant');

assert('F04.01: 4 gradients defined', GRADIENTS.length === 4);
assert('F04.02: All start with "from-"', GRADIENTS.every(g => g.startsWith('from-')));
assert('F04.03: All contain "to-"', GRADIENTS.every(g => g.includes('to-')));

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log(`║  Frontend Unit Test Results: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0, 18 - String(passed).length - String(failed).length))}║`);
console.log('╚═══════════════════════════════════════════════════════╝');
process.exit(failed > 0 ? 1 : 0);
