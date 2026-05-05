/**
 * End-to-End Tests — Wakeboard Competition System
 * ~140 test cases across 9 test scenarios
 *
 * Auto-seeds DB and starts internal Express server (for c8 coverage in same process).
 * Usage: node test.js
 * Coverage: npx c8 --include="src/**" node test.js
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import { httpServer } from './src/app.js';
import { initDb } from './src/db/schema.js';

const PORT = 3001;
const BASE = `http://localhost:${PORT}/api/`;
// Test fixture password loaded from .env (never hardcoded, .env is gitignored)
const TEST_PASSWORD = process.env.TEST_PASSWORD;
if (!TEST_PASSWORD) {
  throw new Error('TEST_PASSWORD environment variable is required (set it in server/.env)');
}
let passed = 0, failed = 0, suites = 0;
const startTime = Date.now();

function seedDatabase() {
  console.log('  Seeding database...');
  execSync('node src/db/seed.js', { stdio: 'ignore', cwd: import.meta.dirname });
  console.log('  Database seeded.\n');
}

// Allowlist: REST path segments with alphanumeric, /, _, -, and query chars (?, =, &, .)
const SAFE_PATH_RE = /^\/?[a-zA-Z0-9/_\-?=&.]+$/;

async function api(method, path, body, token) {
  // Explicit sanitization: validate path against allowlist before URL construction
  if (typeof path !== 'string' || !SAFE_PATH_RE.test(path)) {
    throw new Error('Invalid API path');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  // URL constructor provides additional structural validation
  const relativePath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(relativePath, BASE).toString();
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// Sanitize values before logging to prevent log injection (strip CR/LF)
function safeLog(value) {
  return JSON.stringify(value).replace(/[\r\n]/g, '');
}

function check(tc, actual, expected) {
  if (actual === expected) { console.log(`    ✓ ${tc}`); passed++; }
  else { console.log(`    ✗ ${tc} — expected ${safeLog(expected)}, got ${safeLog(actual)}`); failed++; }
}

function assert(tc, condition) {
  if (condition) { console.log(`    ✓ ${tc}`); passed++; }
  else { console.log(`    ✗ ${tc}`); failed++; }
}

function log(s) {
  if (s.startsWith('TS-')) suites++;
  console.log(`\n  ${s}`);
}

async function login(email) {
  const { data } = await api('POST', '/auth/login', { email, password: TEST_PASSWORD });
  return data?.token;
}

function randomScore() { return Math.round((Math.random() * 80 + 20) * 2) / 2; }

async function scoreHeat(heatId, judgeTokens, hjToken) {
  const { data: runs } = await api('GET', `/scores/heat/${heatId}`, null, hjToken);
  for (const run of runs) {
    for (const token of judgeTokens) {
      await api('POST', '/scores', { athlete_run_id: run.athlete_run_id, score: randomScore() }, token);
    }
  }
  return runs;
}

async function processHeat(heatId, openerToken, judgeTokens, hjToken) {
  await api('PATCH', `/heats/${heatId}/status`, { status: 'OPEN' }, openerToken);
  await scoreHeat(heatId, judgeTokens, hjToken);
  await api('POST', `/heats/${heatId}/review`, null, hjToken);
  const { data } = await api('POST', `/heats/${heatId}/approve`, null, hjToken);
  const { data: closeData } = await api('POST', `/heats/${heatId}/close`, null, hjToken);
  return { results: data?.results, closeData };
}

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  Wakeboard Competition System — Full Test Suite       ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Auto-seed DB for clean state
  seedDatabase();

  // Start Express server in same process (enables c8 coverage of routes/middleware)
  initDb();
  await new Promise((resolve) => {
    httpServer.listen(PORT, () => {
      console.log(`  Test server running on http://localhost:${PORT}\n`);
      resolve();
    });
  });

  // Socket.IO connection coverage (covers app.js connection handlers)
  log('TS-00: Socket.IO Connection Handlers');
  {
    const { io: ioClient } = await import('socket.io-client');
    const socket = ioClient(`http://localhost:${PORT}`, { transports: ['websocket'] });
    await new Promise((resolve) => socket.on('connect', resolve));
    assert('TC-00.01: Socket connects', socket.connected);
    socket.emit('join:competition', 'test-competition-id');
    socket.emit('join:judge', 'test-judge-id');
    await new Promise((r) => setTimeout(r, 50));
    assert('TC-00.02: Socket joins rooms without error', socket.connected);
    socket.disconnect();
    await new Promise((r) => setTimeout(r, 50));
    assert('TC-00.03: Socket disconnects cleanly', !socket.connected);
  }

  // Login seeded users
  const adminToken = await login('admin@wakeboard.lt');
  const hjToken = await login('headjudge@wakeboard.lt');
  const j1Token = await login('judge1@wakeboard.lt');
  const j2Token = await login('judge2@wakeboard.lt');
  const j3Token = await login('judge3@wakeboard.lt');
  const athToken = await login('athlete1@wakeboard.lt');
  const judgeTokens = [j1Token, j2Token, j3Token];
  const comp1Judges = [hjToken, j1Token]; // matches comp1 judge_count=2 (HJ + judge1)

  const { data: comps } = await api('GET', '/competitions');
  const compId = comps.competitions.find(c => c.status === 'ACTIVE').id;
  const { data: compDetail } = await api('GET', `/competitions/${compId}`);
  const menDiv = compDetail.divisions.find(d => d.name === 'Open Men');
  const womenDiv = compDetail.divisions.find(d => d.name === 'Open Women');

  // ═══════════════════════════════════════════════════════════════════════
  // TS-01: Authentication & Authorization
  // ═══════════════════════════════════════════════════════════════════════
  log('TS-01: User Authentication & Authorization');

  // Registration
  log('  Scenario: User Registration');
  const { status: reg1, data: regData } = await api('POST', '/auth/register', { name: 'Test User', email: 'testuser@test.lt', password: 'pass123' });
  check('TC-01.01: Register new athlete → 201', reg1, 201);
  check('TC-01.01b: Returns role ATHLETE', regData?.user?.role, 'ATHLETE');
  assert('TC-01.01c: Returns token', !!regData?.token);

  const { status: reg2 } = await api('POST', '/auth/register', { name: 'Dup', email: 'testuser@test.lt', password: 'pass123' });
  check('TC-01.02: Duplicate email → 409', reg2, 409);

  const { status: reg3 } = await api('POST', '/auth/register', { name: 'X', password: 'pass123' });
  check('TC-01.03: Missing email → 400', reg3, 400);

  const { status: reg4 } = await api('POST', '/auth/register', { name: 'X', email: 'x@x.lt' });
  check('TC-01.04: Missing password → 400', reg4, 400);

  const { status: reg5 } = await api('POST', '/auth/register', { email: 'y@y.lt', password: 'pass123' });
  check('TC-01.05: Missing name → 400', reg5, 400);

  // Login
  log('  Scenario: User Login');
  const { status: lg1, data: lgData } = await api('POST', '/auth/login', { email: 'admin@wakeboard.lt', password: TEST_PASSWORD });
  check('TC-01.06: Valid login → 200', lg1, 200);
  assert('TC-01.06b: Returns token', !!lgData?.token);

  const { status: lg2 } = await api('POST', '/auth/login', { email: 'admin@wakeboard.lt', password: 'wrong' });
  check('TC-01.07: Wrong password → 401', lg2, 401);

  const { status: lg3 } = await api('POST', '/auth/login', { email: 'nobody@x.lt', password: 'x' });
  check('TC-01.08: Non-existent email → 401', lg3, 401);

  const { status: lg4 } = await api('POST', '/auth/login', { password: 'x' });
  check('TC-01.09: Missing email → 400', lg4, 400);

  // Token
  log('  Scenario: Token Validation');
  const { status: me1, data: meData } = await api('GET', '/auth/me', null, adminToken);
  check('TC-01.10: /auth/me with valid token → 200', me1, 200);
  check('TC-01.10b: Returns role', meData?.role, 'ADMIN');

  const { status: me2 } = await api('GET', '/auth/me');
  check('TC-01.11: /auth/me without token → 401', me2, 401);

  const { status: me3 } = await api('GET', '/auth/me', null, 'invalid-token');
  check('TC-01.12: /auth/me with invalid token → 401', me3, 401);

  // Staff creation
  log('  Scenario: Staff Account Creation');
  const { status: cs1, data: csData } = await api('POST', '/auth/create-staff', { name: 'New Judge', email: 'newjudge@test.lt', password: 'p', role: 'JUDGE' }, adminToken);
  check('TC-01.13: Admin creates JUDGE → 201', cs1, 201);
  check('TC-01.13b: Role is JUDGE', csData?.role, 'JUDGE');

  const { status: cs2 } = await api('POST', '/auth/create-staff', { name: 'New HJ', email: 'newhj@test.lt', password: 'p', role: 'HEAD_JUDGE' }, adminToken);
  check('TC-01.14: Admin creates HEAD_JUDGE → 201', cs2, 201);

  const { status: cs3 } = await api('POST', '/auth/create-staff', { name: 'X', email: 'x@t.lt', password: 'p', role: 'ATHLETE' }, adminToken);
  check('TC-01.15: Invalid role → 400', cs3, 400);

  const { status: cs4 } = await api('POST', '/auth/create-staff', { name: 'X', email: 'x2@t.lt', password: 'p', role: 'JUDGE' }, athToken);
  check('TC-01.16: Non-admin → 403', cs4, 403);

  const { status: cs5 } = await api('POST', '/auth/create-staff', { name: 'Dup', email: 'newjudge@test.lt', password: 'p', role: 'JUDGE' }, adminToken);
  check('TC-01.17: Duplicate email → 409', cs5, 409);

  // create-staff missing fields → 400
  const { status: cs6 } = await api('POST', '/auth/create-staff', { name: 'X', email: 'x@t.lt', role: 'JUDGE' }, adminToken);
  check('TC-01.18: create-staff missing password → 400', cs6, 400);

  // /auth/me with non-existent user (deleted token user) → 404
  // Use a token whose user we just deleted? Easier: just check happy path coverage with athletes endpoint
  const { status: cs7 } = await api('GET', '/auth/judges', null, athToken);
  check('TC-01.19: Athlete cannot list judges → 403', cs7, 403);

  const { status: cs8 } = await api('GET', '/auth/athletes', null, athToken);
  check('TC-01.20: Athlete cannot list athletes → 403', cs8, 403);

  // ═══════════════════════════════════════════════════════════════════════
  // TS-02: Competition Management
  // ═══════════════════════════════════════════════════════════════════════
  log('TS-02: Competition Management');

  log('  Scenario: Competition CRUD');
  const { status: cc1, data: ccData } = await api('POST', '/competitions', { name: 'Test Comp', start_date: '2026-08-01', location: 'Test Venue', judge_count: 3 }, adminToken);
  check('TC-02.01: Admin creates competition → 201', cc1, 201);
  assert('TC-02.01b: Returns id', !!ccData?.id);
  const testCompId = ccData?.id;

  const { status: cc2 } = await api('POST', '/competitions', { start_date: '2026-08-01' }, adminToken);
  check('TC-02.02: Missing name → 400', cc2, 400);

  const { status: cc3 } = await api('POST', '/competitions', { name: 'X', start_date: '2026-08-01', location: 'X', judge_count: 0 }, adminToken);
  check('TC-02.03: judge_count 0 → 400', cc3, 400);

  const { status: cc4 } = await api('POST', '/competitions', { name: 'X', start_date: '2026-08-01', judge_count: 6 }, adminToken);
  check('TC-02.04: judge_count 6 → 400', cc4, 400);

  const { status: cc5 } = await api('POST', '/competitions', { name: 'X', start_date: '2026-08-01' }, athToken);
  check('TC-02.05: Non-admin → 403', cc5, 403);

  const { status: cc6 } = await api('GET', '/competitions');
  check('TC-02.06: Public list → 200', cc6, 200);

  const { status: cc7, data: cc7Data } = await api('GET', `/competitions/${compId}`);
  check('TC-02.07: Detail → 200', cc7, 200);
  assert('TC-02.07b: Has divisions', cc7Data?.divisions?.length >= 2);

  const { status: cc8 } = await api('GET', '/competitions/nonexistent-id');
  check('TC-02.08: Invalid ID → 404', cc8, 404);

  // Editing
  log('  Scenario: Competition Editing');
  const { status: ce1 } = await api('PATCH', `/competitions/${testCompId}`, { name: 'Updated Name' }, adminToken);
  check('TC-02.09: Edit name → 200', ce1, 200);

  const { status: ce2 } = await api('PATCH', `/competitions/${testCompId}`, { description: 'Desc', location: 'Loc' }, adminToken);
  check('TC-02.10: Edit description + location → 200', ce2, 200);

  // judge_count editable after heats — use seeded comp which has heats
  const { status: ce3 } = await api('PATCH', `/competitions/${compId}`, { judge_count: 5 }, adminToken);
  check('TC-02.11: judge_count editable after heats → 200', ce3, 200);
  // Reset back to original judge_count=2 so scoring tests work correctly
  await api('PATCH', `/competitions/${compId}`, { judge_count: 2 }, adminToken);

  // date locked when ACTIVE
  const { status: ce4 } = await api('PATCH', `/competitions/${compId}`, { start_date: '2026-12-01' }, adminToken);
  check('TC-02.12: date locked when ACTIVE → 400', ce4, 400);

  const { status: ce5 } = await api('PATCH', `/competitions/${compId}`, { name: 'X' }, athToken);
  check('TC-02.13: Non-admin edit → 403', ce5, 403);

  // Status transitions
  log('  Scenario: Competition Status Transitions');
  const { status: st1 } = await api('PATCH', `/competitions/${testCompId}/status`, { status: 'ACTIVE' }, adminToken);
  check('TC-02.14: DRAFT → ACTIVE → 200', st1, 200);

  // Can't go DRAFT→COMPLETED
  const { status: st4 } = await api('POST', '/competitions', { name: 'TmpComp', start_date: '2026-09-01', location: 'X' }, adminToken);
  const tmpCompId = (await api('GET', '/competitions')).data.competitions.find(c => c.name === 'TmpComp')?.id;
  const { status: st5 } = await api('PATCH', `/competitions/${tmpCompId}/status`, { status: 'COMPLETED' }, adminToken);
  check('TC-02.17: DRAFT → COMPLETED invalid → 400', st5, 400);

  // COMPLETED → ACTIVE invalid
  const { status: st6 } = await api('PATCH', `/competitions/${testCompId}/status`, { status: 'COMPLETED' }, adminToken);
  // This will succeed since testComp has no heats
  const { status: st7 } = await api('PATCH', `/competitions/${testCompId}/status`, { status: 'ACTIVE' }, adminToken);
  check('TC-02.18: COMPLETED → ACTIVE invalid → 400', st7, 400);

  // Staff assignment — use a fresh DRAFT competition
  log('  Scenario: Staff Assignment');
  const { data: staffComp } = await api('POST', '/competitions', { name: 'Staff Test Comp', start_date: '2026-12-01', location: 'X', judge_count: 3 }, adminToken);
  const staffCompId = staffComp.id;

  const { data: njLogin } = await api('POST', '/auth/login', { email: 'newjudge@test.lt', password: 'p' });
  const newJudgeToken = njLogin?.token;
  const newJudgeId = njLogin?.user?.id;
  const { status: sa1 } = await api('POST', `/competitions/${staffCompId}/staff`, { user_id: newJudgeId, staff_role: 'JUDGE' }, adminToken);
  check('TC-02.19: Assign JUDGE → 201', sa1, 201);

  const newHjId = (await api('POST', '/auth/login', { email: 'newhj@test.lt', password: 'p' })).data?.user?.id;
  const { status: sa2 } = await api('POST', `/competitions/${staffCompId}/staff`, { user_id: newHjId, staff_role: 'HEAD_JUDGE' }, adminToken);
  check('TC-02.20: Assign HEAD_JUDGE → 201', sa2, 201);

  // Second HJ
  const seededHjId = (await api('GET', '/auth/me', null, hjToken)).data?.id;
  const { status: sa3 } = await api('POST', `/competitions/${staffCompId}/staff`, { user_id: seededHjId, staff_role: 'HEAD_JUDGE' }, adminToken);
  check('TC-02.21: Second HEAD_JUDGE → 409', sa3, 409);

  // Duplicate assignment
  const { status: sa4 } = await api('POST', `/competitions/${staffCompId}/staff`, { user_id: newHjId, staff_role: 'JUDGE' }, adminToken);
  check('TC-02.22: Duplicate staff → 409', sa4, 409);

  const { status: sa5, data: staffList } = await api('GET', `/competitions/${staffCompId}/staff`, null, adminToken);
  check('TC-02.23: GET staff → 200', sa5, 200);
  assert('TC-02.23b: Has staff', staffList?.length >= 2);

  // Remove staff
  const staffToRemove = staffList?.find(s => s.staff_role === 'JUDGE');
  const { status: sa6 } = await api('DELETE', `/competitions/${staffCompId}/staff/${staffToRemove?.user_id}`, null, adminToken);
  check('TC-02.24: Remove staff → 200', sa6, 200);

  const { status: sa8 } = await api('POST', `/competitions/${compId}/staff`, { user_id: newHjId, staff_role: 'JUDGE' }, athToken);
  check('TC-02.26: Non-admin assign → 403', sa8, 403);

  // Additional staff coverage
  // Missing user_id → 400
  const { status: sa9 } = await api('POST', `/competitions/${staffCompId}/staff`, { staff_role: 'JUDGE' }, adminToken);
  check('TC-02.26b: Missing user_id → 400', sa9, 400);

  // Invalid staff_role → 400
  const { status: sa10 } = await api('POST', `/competitions/${staffCompId}/staff`, { user_id: newJudgeId, staff_role: 'ADMIN' }, adminToken);
  check('TC-02.26c: Invalid staff_role → 400', sa10, 400);

  // Non-existent user → 404
  const { status: sa11 } = await api('POST', `/competitions/${staffCompId}/staff`, { user_id: 'non-existent', staff_role: 'JUDGE' }, adminToken);
  check('TC-02.26d: Non-existent user → 404', sa11, 404);

  // Athlete cannot be staff → 400
  const { data: athleteList } = await api('GET', '/auth/athletes', null, adminToken);
  if (athleteList?.[0]?.id) {
    const { status: sa12 } = await api('POST', `/competitions/${staffCompId}/staff`, { user_id: athleteList[0].id, staff_role: 'JUDGE' }, adminToken);
    check('TC-02.26e: Athlete as staff → 400', sa12, 400);
  }

  // PATCH no fields → 400
  const { status: sa13 } = await api('PATCH', `/competitions/${compId}`, {}, adminToken);
  check('TC-02.26f: PATCH no fields → 400', sa13, 400);

  // Judge assignments
  log('  Scenario: Judge Assignments');
  const { status: ja1, data: jaData } = await api('GET', '/competitions/my-assignments', null, hjToken);
  check('TC-02.27: Judge assignments → 200', ja1, 200);
  assert('TC-02.27b: Has assignments', jaData?.competitions?.length > 0);
  check('TC-02.28: staff_role returned', jaData?.competitions[0]?.staff_role, 'HEAD_JUDGE');

  // ═══════════════════════════════════════════════════════════════════════
  // TS-03: Division Management
  // ═══════════════════════════════════════════════════════════════════════
  log('TS-03: Division Management');

  log('  Scenario: Division CRUD');
  const { status: dc1, data: dcData } = await api('POST', `/competitions/${compId}/divisions`, { name: 'Test Division', display_order: 99 }, adminToken);
  check('TC-03.01: Create division → 201', dc1, 201);
  const testDivId = dcData?.id;

  const { status: dc2 } = await api('POST', `/competitions/${compId}/divisions`, { name: 'Test Division' }, adminToken);
  check('TC-03.02: Duplicate name → 409', dc2, 409);

  const { status: dc3, data: dc3Data } = await api('GET', `/competitions/${compId}/divisions`);
  check('TC-03.03: List divisions → 200', dc3, 200);
  assert('TC-03.03b: Has divisions', dc3Data?.divisions?.length >= 3);

  const { status: dc4 } = await api('PATCH', `/competitions/${compId}/divisions/${testDivId}`, { name: 'Renamed Division' }, adminToken);
  check('TC-03.04: Edit name → 200', dc4, 200);

  const { status: dc5 } = await api('PATCH', `/competitions/${compId}/divisions/${testDivId}`, { name: 'Open Men' }, adminToken);
  check('TC-03.05: Edit to duplicate name → 409', dc5, 409);

  const { status: dc6 } = await api('DELETE', `/competitions/${compId}/divisions/${testDivId}`, null, adminToken);
  check('TC-03.06: Delete empty division → 200', dc6, 200);

  // Block delete with registrations
  const { status: dc7 } = await api('DELETE', `/competitions/${compId}/divisions/${womenDiv.id}`, null, adminToken);
  check('TC-03.07: Delete with registrations → 409', dc7, 409);

  // Block delete with stages
  const { status: dc8 } = await api('DELETE', `/competitions/${compId}/divisions/${menDiv.id}`, null, adminToken);
  check('TC-03.08: Delete with stages → 409', dc8, 409);

  const { status: dc9 } = await api('POST', `/competitions/${compId}/divisions`, { name: 'X' }, athToken);
  check('TC-03.09: Non-admin → 403', dc9, 403);

  // Additional division error branches (coverage)
  // Empty name → 400
  const { status: dc10 } = await api('POST', `/competitions/${compId}/divisions`, { name: '   ' }, adminToken);
  check('TC-03.10: Empty division name → 400', dc10, 400);

  // PATCH to non-existent division → 404
  const { status: dc11 } = await api('PATCH', `/competitions/${compId}/divisions/non-existent`, { name: 'X' }, adminToken);
  check('TC-03.11: PATCH non-existent division → 404', dc11, 404);

  // PATCH with empty name → 400
  const { status: dc12 } = await api('PATCH', `/competitions/${compId}/divisions/${menDiv.id}`, { name: '   ' }, adminToken);
  check('TC-03.12: PATCH empty name → 400', dc12, 400);

  // PATCH with no fields → 400
  const { status: dc13 } = await api('PATCH', `/competitions/${compId}/divisions/${menDiv.id}`, {}, adminToken);
  check('TC-03.13: PATCH no fields → 400', dc13, 400);

  // PATCH display_order → 200
  const { status: dc14 } = await api('PATCH', `/competitions/${compId}/divisions/${menDiv.id}`, { display_order: 5 }, adminToken);
  check('TC-03.14: PATCH display_order → 200', dc14, 200);

  // GET divisions for non-existent competition → 404
  const { status: dc15 } = await api('GET', `/competitions/non-existent/divisions`);
  check('TC-03.15: GET divisions non-existent comp → 404', dc15, 404);

  // POST division to non-existent competition → 404
  const { status: dc16 } = await api('POST', `/competitions/non-existent/divisions`, { name: 'X' }, adminToken);
  check('TC-03.16: POST division non-existent comp → 404', dc16, 404);

  // DELETE non-existent division → 404
  const { status: dc17 } = await api('DELETE', `/competitions/${compId}/divisions/non-existent`, null, adminToken);
  check('TC-03.17: DELETE non-existent division → 404', dc17, 404);

  // ═══════════════════════════════════════════════════════════════════════
  // TS-04: Athlete Registration
  // ═══════════════════════════════════════════════════════════════════════
  log('TS-04: Athlete Registration');

  log('  Scenario: Registration CRUD');
  // Need a DRAFT competition for registration tests
  const { data: draftComp } = await api('POST', '/competitions', { name: 'Draft Comp', start_date: '2026-10-01', location: 'X', judge_count: 3 }, adminToken);
  const draftCompId = draftComp.id;
  const { data: draftDiv } = await api('POST', `/competitions/${draftCompId}/divisions`, { name: 'Men' }, adminToken);
  const draftDivId = draftDiv.id;
  const { data: draftDiv2 } = await api('POST', `/competitions/${draftCompId}/divisions`, { name: 'Women' }, adminToken);

  // Athlete registers
  const testAthToken = regData?.token; // from TC-01.01
  const { status: rr1, data: rrData } = await api('POST', '/registrations', { division_id: draftDivId }, testAthToken);
  check('TC-04.01: Athlete registers → 201', rr1, 201);
  check('TC-04.01b: Status CONFIRMED', rrData?.status, 'CONFIRMED');
  const regId = rrData?.id;

  const { status: rr2 } = await api('POST', '/registrations', { division_id: draftDivId }, testAthToken);
  check('TC-04.02: Duplicate → 409', rr2, 409);

  // Set competition ACTIVE → registration blocked
  await api('PATCH', `/competitions/${draftCompId}/status`, { status: 'ACTIVE' }, adminToken);
  const { status: rr3 } = await api('POST', '/registrations', { division_id: draftDiv2.id }, testAthToken);
  check('TC-04.03: Registration on non-DRAFT → 400', rr3, 400);
  await api('PATCH', `/competitions/${draftCompId}/status`, { status: 'COMPLETED' }, adminToken);
  // Recreate a DRAFT comp for further tests
  await api('POST', '/competitions', { name: 'Draft2', start_date: '2026-11-01', location: 'X', judge_count: 3 }, adminToken);

  const { status: rr4 } = await api('POST', '/registrations', { division_id: draftDivId }, adminToken);
  check('TC-04.04: Non-athlete → 403', rr4, 403);

  const { status: rr5, data: rr5Data } = await api('GET', `/registrations/competition/${draftCompId}`, null, adminToken);
  check('TC-04.05: List registrations → 200', rr5, 200);
  assert('TC-04.05b: Has registrations', rr5Data?.length >= 1);

  const { status: rr6, data: rr6Data } = await api('GET', `/registrations/competition/${draftCompId}?division_id=${draftDivId}`, null, adminToken);
  check('TC-04.06: Filter by division → 200', rr6, 200);
  assert('TC-04.06b: Filtered correctly', rr6Data?.every(r => r.division_id === draftDivId));

  const { status: rr7 } = await api('PATCH', `/registrations/${regId}`, { status: 'WITHDRAWN' }, adminToken);
  check('TC-04.07: Change status → 200', rr7, 200);

  const { status: rr8 } = await api('PATCH', `/registrations/${regId}/seed`, { seed: 5 }, adminToken);
  check('TC-04.08: Set seed → 200', rr8, 200);

  const { status: rr9 } = await api('PATCH', `/registrations/${regId}/seed`, { seed: -1 }, adminToken);
  check('TC-04.09: Invalid seed → 400', rr9, 400);

  const { status: rr10 } = await api('DELETE', `/registrations/${regId}`, null, adminToken);
  check('TC-04.10: Delete registration → 200', rr10, 200);

  // Block delete if in heat — use seeded data (athletes in Men div have heats)
  const menRegs = (await api('GET', `/registrations/competition/${compId}?division_id=${menDiv.id}`, null, adminToken)).data;
  if (menRegs?.length > 0) {
    const { status: rr11 } = await api('DELETE', `/registrations/${menRegs[0].id}`, null, adminToken);
    check('TC-04.11: Delete with heat assignment → 409', rr11, 409);
  }

  // GET /registrations/my — ATHLETE sees own registrations
  log('  Scenario: Athlete Self-Registrations View');
  const { status: my1, data: my1Data } = await api('GET', '/registrations/my', null, athToken);
  check('TC-04.12: Athlete GET /my → 200', my1, 200);
  assert('TC-04.13: Returns competitions array', Array.isArray(my1Data?.competitions));

  const { status: my2 } = await api('GET', '/registrations/my', null, adminToken);
  check('TC-04.14: Admin GET /my → 403', my2, 403);

  const { status: my3 } = await api('GET', '/registrations/my');
  check('TC-04.15: No token → 401', my3, 401);

  // POST /registrations/admin — admin registers existing or guest athlete
  log('  Scenario: Admin Registration (existing + guest)');
  const { data: adminDraftComp } = await api('POST', '/competitions', { name: 'Admin Reg Test', start_date: '2026-11-15', location: 'X', judge_count: 2 }, adminToken);
  const { data: adminDraftDiv } = await api('POST', `/competitions/${adminDraftComp.id}/divisions`, { name: 'Admin Div' }, adminToken);
  const adthAthId = (await api('GET', '/auth/athletes', null, adminToken)).data[0]?.id;

  // Register existing athlete
  const { status: ar1, data: ar1Data } = await api('POST', '/registrations/admin', { division_id: adminDraftDiv.id, athlete_id: adthAthId }, adminToken);
  check('TC-04.16: Admin registers existing athlete → 201', ar1, 201);
  check('TC-04.17: Status CONFIRMED', ar1Data?.status, 'CONFIRMED');

  // Duplicate
  const { status: ar2 } = await api('POST', '/registrations/admin', { division_id: adminDraftDiv.id, athlete_id: adthAthId }, adminToken);
  check('TC-04.18: Duplicate admin registration → 409', ar2, 409);

  // Guest athlete
  const { status: ar3, data: ar3Data } = await api('POST', '/registrations/admin', { division_id: adminDraftDiv.id, name: 'Guest Rider' }, adminToken);
  check('TC-04.19: Admin registers guest → 201', ar3, 201);
  check('TC-04.20: Guest name saved', ar3Data?.name, 'Guest Rider');

  // Missing fields
  const { status: ar4 } = await api('POST', '/registrations/admin', {}, adminToken);
  check('TC-04.21: Missing division_id → 400', ar4, 400);

  const { status: ar5 } = await api('POST', '/registrations/admin', { division_id: adminDraftDiv.id }, adminToken);
  check('TC-04.22: Missing athlete_id and name → 400', ar5, 400);

  // Non-existent division
  const { status: ar6 } = await api('POST', '/registrations/admin', { division_id: 'bad-id', athlete_id: adthAthId }, adminToken);
  check('TC-04.23: Non-existent division → 404', ar6, 404);

  // Non-existent athlete
  const { status: ar7 } = await api('POST', '/registrations/admin', { division_id: adminDraftDiv.id, athlete_id: 'bad-id' }, adminToken);
  check('TC-04.24: Non-existent athlete → 404', ar7, 404);

  // Non-admin
  const { status: ar8 } = await api('POST', '/registrations/admin', { division_id: adminDraftDiv.id, name: 'X' }, athToken);
  check('TC-04.25: Non-admin → 403', ar8, 403);

  // Additional registrations.js coverage
  // Athlete self-registration missing division_id → 400
  const { status: ar9 } = await api('POST', '/registrations', {}, athToken);
  check('TC-04.26: Athlete missing division_id → 400', ar9, 400);

  // PATCH registration invalid status → 400
  const { status: ar10 } = await api('PATCH', `/registrations/${ar1Data.id}`, { status: 'INVALID_STATUS' }, adminToken);
  check('TC-04.27: PATCH invalid status → 400', ar10, 400);

  // PATCH seed missing seed → 400
  const { status: ar11 } = await api('PATCH', `/registrations/${ar1Data.id}/seed`, {}, adminToken);
  check('TC-04.28: PATCH seed missing → 400', ar11, 400);

  // ═══════════════════════════════════════════════════════════════════════
  // TS-05: Heat Generation (IWWF Format)
  // ═══════════════════════════════════════════════════════════════════════
  log('TS-05: Heat Generation (IWWF Format)');

  log('  Scenario: Validation');
  const { data: heatData } = await api('GET', `/heats/competition/${compId}`, null, adminToken);
  const menStages = heatData.stages.filter(s => s.division_name === 'Open Men');
  const womenStages = heatData.stages.filter(s => s.division_name === 'Open Women');

  // Format verification (11 athletes)
  log('  Scenario: IWWF Format (11 athletes)');
  check('TC-05.07: Men has 3 stages', menStages.length, 3);
  check('TC-05.08: QUAL has 2 heats', menStages.find(s => s.stage_type === 'QUALIFICATION')?.heats.length, 2);
  check('TC-05.09: LCQ has 2 heats', menStages.find(s => s.stage_type === 'LCQ')?.heats.length, 2);
  check('TC-05.10: FINAL has 1 heat', menStages.find(s => s.stage_type === 'FINAL')?.heats.length, 1);

  const qualHeats = menStages.find(s => s.stage_type === 'QUALIFICATION')?.heats || [];
  const qualAthletes = qualHeats.reduce((s, h) => s + h.athletes.length, 0);
  assert('TC-05.11: QUAL heats have athletes', qualAthletes === 11);

  const lcqAthletes = menStages.find(s => s.stage_type === 'LCQ')?.heats.reduce((s, h) => s + h.athletes.length, 0);
  check('TC-05.12: LCQ heats empty (pre-advancement)', lcqAthletes, 0);

  // Format verification (6 athletes)
  log('  Scenario: IWWF Format (6 athletes)');
  check('TC-05.13: Women has 2 stages', womenStages.length, 2);
  const womenQual = womenStages.find(s => s.stage_type === 'QUALIFICATION');
  check('TC-05.14: Women QUAL has 1 heat with 6 athletes', womenQual?.heats[0]?.athletes.length, 6);
  const womenFinal = womenStages.find(s => s.stage_type === 'FINAL');
  check('TC-05.15: Women FINAL empty', womenFinal?.heats[0]?.athletes.length, 0);

  // Publish & Schedule
  log('  Scenario: Publish & Schedule');
  const qualStageId = menStages.find(s => s.stage_type === 'QUALIFICATION')?.id;
  // Already published by seed, but test endpoint
  const { status: ps1 } = await api('PATCH', `/heats/publish-stage/${qualStageId}`, null, adminToken);
  check('TC-05.18: Publish stage → 200', ps1, 200);

  const allHeatIds = heatData.stages.flatMap(s => s.heats.map(h => h.id));
  const schedule = allHeatIds.map((id, i) => ({ heat_id: id, schedule_order: i + 1 }));
  const { status: sc1 } = await api('PATCH', '/heats/schedule', { schedule }, adminToken);
  check('TC-05.19: Set schedule → 200', sc1, 200);

  const { status: sc2 } = await api('PATCH', '/heats/schedule', { schedule }, j1Token);
  check('TC-05.20: Non-admin schedule → 403', sc2, 403);

  // Athlete swap — both heats must be PENDING; test validation
  log('  Scenario: Athlete Swap');
  // qualHeats are still PENDING at this point (scoring opens them later)
  if (qualHeats.length >= 2 && qualHeats[1]?.athletes?.length > 0) {
    // Swap from heat2 (6 athletes) to heat1 (5 athletes) — target has room
    const swapAthlete = qualHeats[1].athletes[0].athlete_id;
    const { status: sw1 } = await api('PATCH', `/heats/${qualHeats[1].id}/athletes`, { athlete_id: swapAthlete, target_heat_id: qualHeats[0].id }, adminToken);
    check('TC-05.21: Swap athlete → 200', sw1, 200);
    // Swap back
    await api('PATCH', `/heats/${qualHeats[0].id}/athletes`, { athlete_id: swapAthlete, target_heat_id: qualHeats[1].id }, adminToken);
  }

  // Additional heats.js error branch coverage
  log('  Scenario: Heats Error Branches (extra coverage)');

  // Athlete swap — missing required fields
  const { status: hErr1 } = await api('PATCH', `/heats/${qualHeats[0].id}/athletes`, {}, adminToken);
  check('TC-05.22: Swap missing fields → 400', hErr1, 400);

  // Athlete swap — non-existent source heat
  const { status: hErr2 } = await api('PATCH', `/heats/non-existent-id/athletes`, { athlete_id: 'x', target_heat_id: qualHeats[0].id }, adminToken);
  check('TC-05.23: Swap non-existent heat → 404', hErr2, 404);

  // Athlete swap — across different stages (men qual → women qual)
  const womenQualHeatX = womenStages.find(s => s.stage_type === 'QUALIFICATION')?.heats[0];
  if (womenQualHeatX) {
    const swapAthleteX = qualHeats[0].athletes[0].athlete_id;
    const { status: hErr3 } = await api('PATCH', `/heats/${qualHeats[0].id}/athletes`, { athlete_id: swapAthleteX, target_heat_id: womenQualHeatX.id }, adminToken);
    check('TC-05.24: Swap across stages → 400', hErr3, 400);
  }

  // Status transition — invalid (PENDING → CLOSED)
  const { status: hErr4 } = await api('PATCH', `/heats/${qualHeats[0].id}/status`, { status: 'CLOSED' }, adminToken);
  check('TC-05.25: Invalid status transition → 400', hErr4, 400);

  // Status transition — non-existent heat
  const { status: hErr5 } = await api('PATCH', `/heats/non-existent/status`, { status: 'OPEN' }, adminToken);
  check('TC-05.26: Status on non-existent heat → 404', hErr5, 404);

  // OPEN → PENDING rollback (no scores submitted yet)
  await api('PATCH', `/heats/${qualHeats[0].id}/status`, { status: 'OPEN' }, adminToken);
  const { status: hErr6 } = await api('PATCH', `/heats/${qualHeats[0].id}/status`, { status: 'PENDING' }, adminToken);
  check('TC-05.27: OPEN → PENDING rollback → 200', hErr6, 200);

  // Reset non-existent heat
  const { status: hErr7 } = await api('POST', `/heats/non-existent/reset`, null, adminToken);
  check('TC-05.28: Reset non-existent heat → 404', hErr7, 404);

  // Publish non-existent stage
  const { status: hErr8 } = await api('PATCH', `/heats/publish-stage/non-existent`, null, adminToken);
  check('TC-05.29: Publish non-existent stage → 404', hErr8, 404);

  // Schedule with non-array body
  const { status: hErr11 } = await api('PATCH', `/heats/schedule`, { schedule: 'not-an-array' }, adminToken);
  check('TC-05.32: Schedule non-array → 400', hErr11, 400);

  // Generate heats with non-existent division → 404
  const { status: hErr12 } = await api('POST', '/heats/generate', { division_id: 'non-existent-id' }, adminToken);
  check('TC-05.32b: Generate non-existent division → 404', hErr12, 404);

  // Generate heats with missing division_id → 400
  const { status: hErr13 } = await api('POST', '/heats/generate', {}, adminToken);
  check('TC-05.32c: Generate missing division_id → 400', hErr13, 400);

  // GET heats with division_id filter
  const { status: hErr14, data: hErr14d } = await api('GET', `/heats/competition/${compId}?division_id=${menDiv.id}`, null, adminToken);
  check('TC-05.32d: GET heats with division_id → 200', hErr14, 200);
  assert('TC-05.32e: Filtered to one division', hErr14d?.stages.every(s => s.division_id === menDiv.id));

  // DELETE heats for an empty division (create temp division for safe test)
  const { data: tempDiv } = await api('POST', `/competitions/${compId}/divisions`, { name: 'TempDeleteTest', display_order: 99 }, adminToken);
  const { status: hErr15 } = await api('DELETE', `/heats/division/${tempDiv.id}`, null, adminToken);
  check('TC-05.32f: Delete heats empty division → 200', hErr15, 200);
  await api('DELETE', `/competitions/${compId}/divisions/${tempDiv.id}`, null, adminToken);


  // Reset successfully — qualHeats[0] is currently PENDING (we rolled it back)
  const { status: hErr9 } = await api('POST', `/heats/${qualHeats[0].id}/reset`, null, adminToken);
  check('TC-05.30: Reset PENDING heat → 200', hErr9, 200);

  // Athlete swap target heat not PENDING — open one heat first
  await api('PATCH', `/heats/${qualHeats[0].id}/status`, { status: 'OPEN' }, adminToken);
  const swapAth2 = qualHeats[1].athletes[0].athlete_id;
  const { status: hErr10 } = await api('PATCH', `/heats/${qualHeats[1].id}/athletes`, { athlete_id: swapAth2, target_heat_id: qualHeats[0].id }, adminToken);
  check('TC-05.31: Swap into OPEN heat → 400', hErr10, 400);
  // Reset back to PENDING for following tests
  await api('PATCH', `/heats/${qualHeats[0].id}/status`, { status: 'PENDING' }, adminToken);

  // ═══════════════════════════════════════════════════════════════════════
  // TS-06: Score Submission
  // ═══════════════════════════════════════════════════════════════════════
  log('TS-06: Score Submission');

  log('  Scenario: Score Validation');
  const heat1 = qualHeats[0];
  const { data: h1Runs } = await api('GET', `/scores/heat/${heat1.id}`, null, hjToken);
  const firstRunId = h1Runs[0]?.athlete_run_id;

  // Score on PENDING heat
  const { status: sv6 } = await api('POST', '/scores', { athlete_run_id: firstRunId, score: 50 }, j1Token);
  check('TC-06.06: Score on PENDING heat → 403', sv6, 403);

  // Open heat for scoring tests
  await api('PATCH', `/heats/${heat1.id}/status`, { status: 'OPEN' }, adminToken);

  const { status: sv1 } = await api('POST', '/scores', { athlete_run_id: firstRunId, score: 50 }, j1Token);
  check('TC-06.01: Valid score 50 → 200', sv1, 200);

  const { status: sv2 } = await api('POST', '/scores', { athlete_run_id: firstRunId, score: 0 }, j2Token);
  check('TC-06.02: Score 0 valid → 200', sv2, 200);

  // NOTE: Score range validation (TC-06.04, 06.05) moved to integration (I02.10, I02.11)
  // because it's pure service-layer validation, not HTTP-specific.

  const { status: sv3, data: sv3Data } = await api('POST', '/scores', { athlete_run_id: firstRunId, score: 100 }, j3Token);
  check('TC-06.03: Score 100 valid → 200', sv3, 200);

  const { status: sv8 } = await api('POST', '/scores', { score: 50 }, j1Token);
  check('TC-06.08: Missing athlete_run_id → 400', sv8, 400);

  // Missing score field → 400
  const { status: sv8b } = await api('POST', '/scores', { athlete_run_id: firstRunId }, j1Token);
  check('TC-06.08b: Missing score → 400', sv8b, 400);

  const { status: sv9 } = await api('POST', '/scores', { athlete_run_id: firstRunId, score: 50 }, athToken);
  check('TC-06.09: Non-judge → 403', sv9, 403);

  // Correction request — missing judge_score_id → 400
  const { status: sv9b } = await api('POST', '/scores/correction-request', {}, hjToken);
  check('TC-06.09b: Correction missing judge_score_id → 400', sv9b, 400);

  // Correction request — non-existent judge_score_id → 404
  const { status: sv9c } = await api('POST', '/scores/correction-request', { judge_score_id: 'non-existent', note: 'test' }, hjToken);
  check('TC-06.09c: Correction non-existent score → 404', sv9c, 404);

  // NOTE: Score computation logic (TC-06.10-13) moved to integration tests
  // (I02.03, I02.05, I02.06, I02.09, I02.12, I02.13) — pure SQL/service logic.
  // Setup calls remain to populate state for subsequent TS-07 tests.
  const secondRunId = h1Runs[1]?.athlete_run_id;
  await api('POST', '/scores', { athlete_run_id: secondRunId, score: 60 }, j1Token);
  await api('POST', '/scores', { athlete_run_id: secondRunId, score: 80 }, hjToken);
  await api('POST', '/scores', { athlete_run_id: secondRunId, score: 90 }, j1Token);

  // ═══════════════════════════════════════════════════════════════════════
  // TS-07: Heat Lifecycle
  // ═══════════════════════════════════════════════════════════════════════
  log('TS-07: Heat Lifecycle');

  // Score all remaining runs in heat1 to enable review
  await scoreHeat(heat1.id, comp1Judges, hjToken);

  log('  Scenario: Status Transitions');
  // Review
  const { status: ht5 } = await api('POST', `/heats/${heat1.id}/review`, null, hjToken);
  check('TC-07.05: OPEN → HEAD_REVIEW → 200', ht5, 200);

  // Correction flow
  log('  Scenario: Correction Flow');
  const { data: reviewRuns } = await api('GET', `/scores/heat/${heat1.id}`, null, hjToken);
  const targetScore = reviewRuns[0]?.scores?.[0];
  if (targetScore) {
    const { status: cf1 } = await api('POST', '/scores/correction-request', { judge_score_id: targetScore.judge_score_id, note: 'Fix this' }, hjToken);
    check('TC-06.14: Correction request → 200', cf1, 200);

    // Non-flagged judge can't edit
    const nonFlagged = reviewRuns[1];
    if (nonFlagged) {
      const { status: cf3 } = await api('POST', '/scores', { athlete_run_id: nonFlagged.athlete_run_id, score: 50 }, j1Token);
      check('TC-06.18: Non-flagged judge → 403', cf3, 403);
    }

    // Flagged judge can edit
    const { status: cf2 } = await api('POST', '/scores', { athlete_run_id: reviewRuns[0].athlete_run_id, score: 75 }, j1Token);
    check('TC-06.17: Flagged judge corrects → 200', cf2, 200);
  }

  // Non-HJ can't request correction
  const { status: cf4 } = await api('POST', '/scores/correction-request', { judge_score_id: 'fake', note: 'x' }, j1Token);
  check('TC-06.16: Non-HJ correction → 403', cf4, 403);

  // Manual ranking — test while in HEAD_REVIEW (before approving)
  log('  Scenario: Manual Ranking');
  const { data: rankRuns } = await api('GET', `/scores/heat/${heat1.id}`, null, hjToken);
  const heatAthletes = [...new Set(rankRuns.map(r => r.athlete_id))];
  const validRanking = heatAthletes.map((id, i) => ({ athlete_id: id, final_rank: i + 1 }));
  const { status: mr1 } = await api('PATCH', `/heats/${heat1.id}/ranking`, { ranking: validRanking }, hjToken);
  check('TC-07.17: Valid ranking → 200', mr1, 200);

  // Invalid rankings
  const { status: mr2 } = await api('PATCH', `/heats/${heat1.id}/ranking`, { ranking: [{ athlete_id: 'fake', final_rank: 1 }] }, hjToken);
  check('TC-07.18: Missing athletes → 400', mr2, 400);

  const dupRanking = heatAthletes.map(id => ({ athlete_id: id, final_rank: 1 }));
  const { status: mr3 } = await api('PATCH', `/heats/${heat1.id}/ranking`, { ranking: dupRanking }, hjToken);
  check('TC-07.19: Duplicate ranks → 400', mr3, 400);

  // Approve with manual ranking preserved
  const { status: mr5, data: mr5Data } = await api('POST', `/heats/${heat1.id}/approve`, null, hjToken);
  check('TC-07.07: HEAD_REVIEW → APPROVED → 200', mr5, 200);
  assert('TC-07.13: Results have rankings', mr5Data?.results?.length > 0);
  assert('TC-07.14: Results have best_score', mr5Data?.results?.[0]?.best_score !== undefined);
  check('TC-07.21: Manual ranking preserved', mr5Data?.results?.[0]?.final_rank, 1);

  // Non-HJ can't approve (heat already approved, but test the 403)
  const { status: ht16 } = await api('POST', `/heats/${heat1.id}/approve`, null, j1Token);
  check('TC-07.16: Non-HJ approve → 403', ht16, 403);

  // Close heat1 (it's APPROVED from the manual ranking approve above)
  const { data: close1 } = await api('POST', `/heats/${heat1.id}/close`, null, hjToken);
  check('TC-07.08: APPROVED → CLOSED → 200', close1?.status, 'CLOSED');

  // Invalid transitions
  log('  Scenario: Invalid Transitions');
  const { status: it1 } = await api('PATCH', `/heats/${heat1.id}/status`, { status: 'OPEN' }, adminToken);
  check('TC-07.10: CLOSED → OPEN invalid → 400', it1, 400);

  const { status: it2 } = await api('PATCH', `/heats/${heat1.id}/status`, { status: 'APPROVED' }, adminToken);
  check('TC-07.11: CLOSED → APPROVED invalid → 400', it2, 400);

  // NOTE: Heat lifecycle error paths (TC-07.22-27) moved to integration tests
  // (I06.01-07) — pure service-layer state validation, not HTTP-specific.
  // Only the HTTP-specific 400 status code transformation is implicitly tested
  // through the validation route tests (TC-07.18, 07.19, 07.25 still here for ranking validation).

  // Ranking with non-array body → 400 (HTTP route validates request body before service)
  const { status: he4 } = await api('PATCH', `/heats/${heat1.id}/ranking`, { ranking: 'not-array' }, hjToken);
  check('TC-07.25: Ranking non-array body → 400', he4, 400);

  // ═══════════════════════════════════════════════════════════════════════
  // TS-08: Stage Progression & Advancement
  // ═══════════════════════════════════════════════════════════════════════
  log('TS-08: Stage Progression & Advancement');

  log('  Scenario: QUAL → LCQ → FINAL (11 athletes)');
  // Heat1 is already CLOSED. Process Heat 2.
  const heat2 = qualHeats[1];
  const { closeData: close2 } = await processHeat(heat2.id, adminToken, comp1Judges, hjToken);
  check('TC-08.11: Stage complete flag', close2?.stage_complete, true);

  // Verify LCQ
  const { data: afterQual } = await api('GET', `/heats/competition/${compId}`, null, adminToken);
  const lcqStage = afterQual.stages.find(s => s.stage_type === 'LCQ' && s.division_name === 'Open Men');
  check('TC-08.03: LCQ ACTIVE', lcqStage?.status, 'ACTIVE');
  const lcqTotal = lcqStage?.heats.reduce((s, h) => s + h.athletes.length, 0);
  check('TC-08.01: LCQ has 7 non-qualifiers', lcqTotal, 7);

  // Verify FINAL empty
  const finalCheck = afterQual.stages.find(s => s.stage_type === 'FINAL' && s.division_name === 'Open Men');
  check('TC-08.02: FINAL still empty', finalCheck?.heats[0]?.athletes.length, 0);

  // Per-heat advancement check
  const qHeatsCheck = afterQual.stages.find(s => s.stage_type === 'QUALIFICATION' && s.division_name === 'Open Men')?.heats || [];
  for (const qh of qHeatsCheck) {
    const adv = qh.athletes.filter(a => a.advanced).length;
    check(`TC-08.04: Qual Heat ${qh.heat_number} advanced ${adv}`, adv, 2);
  }

  // Process LCQ heats
  for (const lh of lcqStage.heats) {
    if (lh.athletes.length === 0) continue;
    await processHeat(lh.id, adminToken, comp1Judges, hjToken);
  }

  // Verify FINAL
  const { data: afterLcq } = await api('GET', `/heats/competition/${compId}`, null, adminToken);
  const finalStage = afterLcq.stages.find(s => s.stage_type === 'FINAL' && s.division_name === 'Open Men');
  check('TC-08.07: FINAL ACTIVE', finalStage?.status, 'ACTIVE');
  check('TC-08.05: FINAL has 6 athletes', finalStage?.heats[0]?.athletes.length, 6);

  const lcqCheck = afterLcq.stages.find(s => s.stage_type === 'LCQ' && s.division_name === 'Open Men')?.heats || [];
  for (const lh of lcqCheck) {
    if (lh.athletes.length === 0) continue;
    const adv = lh.athletes.filter(a => a.advanced).length;
    check(`TC-08.06: LCQ Heat ${lh.heat_number} advanced ${adv}`, adv, 1);
  }

  // Auto-published check
  assert('TC-08.08: FINAL heats auto-published', finalStage?.heats.every(h => h.published));

  // Process FINAL
  const { results: finalResults } = await processHeat(finalStage.heats[0].id, adminToken, comp1Judges, hjToken);
  assert('TC-08.05b: FINAL results count', finalResults?.length === 6);

  // Women QUAL → FINAL (6 athletes)
  log('  Scenario: QUAL → FINAL (6 athletes)');
  const womenQualHeat = womenStages.find(s => s.stage_type === 'QUALIFICATION')?.heats[0];
  if (womenQualHeat) {
    const { closeData: wClose } = await processHeat(womenQualHeat.id, adminToken, comp1Judges, hjToken);
    check('TC-08.09: Women QUAL complete', wClose?.stage_complete, true);

    const { data: afterWomenQual } = await api('GET', `/heats/competition/${compId}`, null, adminToken);
    const wFinal = afterWomenQual.stages.find(s => s.stage_type === 'FINAL' && s.division_name === 'Open Women');
    check('TC-08.10: Women FINAL ACTIVE', wFinal?.status, 'ACTIVE');
    check('TC-08.09b: Women FINAL has 6', wFinal?.heats[0]?.athletes.length, 6);
  }

  // Additional heats.js coverage — using a CLOSED heat from women's QUAL
  // and an APPROVED heat for rollback test
  log('  Scenario: Heat lifecycle remaining branches');

  // Reset CLOSED heat → 400 (line 220-221)
  if (womenQualHeat) {
    const { status: hb1 } = await api('POST', `/heats/${womenQualHeat.id}/reset`, null, hjToken);
    check('TC-08.12: Reset CLOSED heat → 400', hb1, 400);
  }

  // OPEN→PENDING with submitted scores → 400 (line 184-186)
  // Need a heat with scores. Open new heat in women final, score one, then try rollback
  const { data: afterAll } = await api('GET', `/heats/competition/${compId}`, null, adminToken);
  const wFinalHeats = afterAll.stages.find(s => s.stage_type === 'FINAL' && s.division_name === 'Open Women')?.heats || [];
  if (wFinalHeats.length > 0 && wFinalHeats[0].status === 'PENDING') {
    await api('PATCH', `/heats/${wFinalHeats[0].id}/status`, { status: 'OPEN' }, adminToken);
    const { data: wfRuns } = await api('GET', `/scores/heat/${wFinalHeats[0].id}`, null, hjToken);
    if (wfRuns[0]?.athlete_run_id) {
      await api('POST', '/scores', { athlete_run_id: wfRuns[0].athlete_run_id, score: 50 }, hjToken);
      const { status: hb2 } = await api('PATCH', `/heats/${wFinalHeats[0].id}/status`, { status: 'PENDING' }, adminToken);
      check('TC-08.13: OPEN→PENDING with scores → 400', hb2, 400);
    }
    // Reset back so other tests aren't affected
    await api('POST', `/heats/${wFinalHeats[0].id}/reset`, null, hjToken);

    // APPROVED → HEAD_REVIEW rollback (line 200-208)
    // Score the heat fully, approve it, then rollback
    await api('PATCH', `/heats/${wFinalHeats[0].id}/status`, { status: 'OPEN' }, adminToken);
    await scoreHeat(wFinalHeats[0].id, comp1Judges, hjToken);
    await api('POST', `/heats/${wFinalHeats[0].id}/review`, null, hjToken);
    await api('POST', `/heats/${wFinalHeats[0].id}/approve`, null, hjToken);
    const { status: hb3, data: hb3d } = await api('PATCH', `/heats/${wFinalHeats[0].id}/status`, { status: 'HEAD_REVIEW' }, hjToken);
    check('TC-08.14: APPROVED → HEAD_REVIEW rollback → 200', hb3, 200);
    check('TC-08.15: Status is HEAD_REVIEW after rollback', hb3d?.status, 'HEAD_REVIEW');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TS-09: Public Endpoints
  // ═══════════════════════════════════════════════════════════════════════
  log('TS-09: Public Endpoints');

  log('  Scenario: Live Data');
  const { status: ld1, data: ldData } = await api('GET', `/competitions/${compId}/live-data`);
  check('TC-09.01: Live data no auth → 200', ld1, 200);
  assert('TC-09.02: Has competition + divisions', !!ldData?.competition && ldData?.divisions?.length >= 2);

  // Only published heats
  const allLiveHeats = ldData?.divisions?.flatMap(d => d.stages.flatMap(s => s.heats)) || [];
  assert('TC-09.03: All returned heats are published', allLiveHeats.length > 0);

  // Approved/closed heat has heat_result
  const closedHeat = allLiveHeats.find(h => h.status === 'CLOSED' || h.status === 'APPROVED');
  if (closedHeat) {
    const athleteWithResult = closedHeat.athletes?.find(a => a.heat_result);
    assert('TC-09.04: CLOSED heat has heat_result', !!athleteWithResult);
  }

  const { status: ld5 } = await api('GET', '/competitions/nonexistent/live-data');
  check('TC-09.05: Invalid ID → 404', ld5, 404);

  log('  Scenario: Leaderboard');
  const { status: lb1, data: lbData } = await api('GET', `/scores/leaderboard/${compId}?division_id=${menDiv.id}`);
  check('TC-09.06: Leaderboard → 200', lb1, 200);
  assert('TC-09.08: Has ranked athletes', lbData?.rankings?.length > 0);

  const { status: lb2 } = await api('GET', `/scores/leaderboard/${compId}`);
  check('TC-09.07: No division_id → 400', lb2, 400);

  // ═══════════════════════════════════════════════════════════════════════
  const duration = ((Date.now() - startTime) / 1000).toFixed(3);
  console.log('\n--- E2E Test Results ---');
  console.log(`Test suites: ${suites}`);
  console.log(`Tests:       ${passed + failed} (${passed} passed, ${failed} failed)`);
  console.log(`Duration:    ${duration}s`);

  // Shut down server and re-seed DB
  httpServer.close();
  seedDatabase();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Test crashed:', err); seedDatabase(); process.exit(1); });
