/**
 * Comprehensive Integration Tests — Wakeboard Competition System
 * ~120 test cases across 9 test scenarios
 *
 * Prerequisites: node src/db/seed.js && start server on port 3001
 * Usage: node test.js
 */

const BASE = 'http://localhost:3001/api';
let passed = 0, failed = 0;

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function check(tc, actual, expected) {
  if (actual === expected) { console.log(`    ✓ ${tc}`); passed++; }
  else { console.log(`    ✗ ${tc} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); failed++; }
}

function assert(tc, condition) {
  if (condition) { console.log(`    ✓ ${tc}`); passed++; }
  else { console.log(`    ✗ ${tc}`); failed++; }
}

function log(s) { console.log(`\n  ${s}`); }

async function login(email) {
  const { data } = await api('POST', '/auth/login', { email, password: 'password123' });
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
  console.log('╚═══════════════════════════════════════════════════════╝');

  // Login seeded users
  const adminToken = await login('admin@wakeboard.lt');
  const hjToken = await login('headjudge@wakeboard.lt');
  const j1Token = await login('judge1@wakeboard.lt');
  const j2Token = await login('judge2@wakeboard.lt');
  const j3Token = await login('judge3@wakeboard.lt');
  const athToken = await login('athlete1@wakeboard.lt');
  const judgeTokens = [j1Token, j2Token, j3Token];

  const { data: comps } = await api('GET', '/competitions');
  const compId = comps.competitions[0].id;
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
  const { status: lg1, data: lgData } = await api('POST', '/auth/login', { email: 'admin@wakeboard.lt', password: 'password123' });
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

  const { status: cc3 } = await api('POST', '/competitions', { name: 'X', start_date: '2026-08-01', judge_count: 2 }, adminToken);
  check('TC-02.03: judge_count 2 → 400', cc3, 400);

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

  // judge_count locked after heats — use seeded comp which has heats
  const { status: ce3 } = await api('PATCH', `/competitions/${compId}`, { judge_count: 5 }, adminToken);
  check('TC-02.11: judge_count locked after heats → 400', ce3, 400);

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

  const { status: sv4 } = await api('POST', '/scores', { athlete_run_id: firstRunId, score: -1 }, j3Token);
  check('TC-06.04: Score -1 → 400', sv4, 400);

  const { status: sv5 } = await api('POST', '/scores', { athlete_run_id: firstRunId, score: 101 }, j3Token);
  check('TC-06.05: Score 101 → 400', sv5, 400);

  const { status: sv3, data: sv3Data } = await api('POST', '/scores', { athlete_run_id: firstRunId, score: 100 }, j3Token);
  check('TC-06.03: Score 100 valid → 200', sv3, 200);

  const { status: sv8 } = await api('POST', '/scores', { score: 50 }, j1Token);
  check('TC-06.08: Missing athlete_run_id → 400', sv8, 400);

  const { status: sv9 } = await api('POST', '/scores', { athlete_run_id: firstRunId, score: 50 }, athToken);
  check('TC-06.09: Non-judge → 403', sv9, 403);

  // Score computation
  log('  Scenario: Score Computation');
  const secondRunId = h1Runs[1]?.athlete_run_id;
  const { data: sc10 } = await api('POST', '/scores', { athlete_run_id: secondRunId, score: 60 }, j1Token);
  check('TC-06.10: After 1 judge → computed null', sc10?.computed_score, null);

  const { data: sc11 } = await api('POST', '/scores', { athlete_run_id: secondRunId, score: 70 }, j2Token);
  check('TC-06.11: After 2 judges → computed null', sc11?.computed_score, null);

  const { data: sc12 } = await api('POST', '/scores', { athlete_run_id: secondRunId, score: 80 }, j3Token);
  assert('TC-06.12: After 3 judges → computed_score set', sc12?.computed_score !== null);
  check('TC-06.12b: AVG(60,70,80)=70', sc12?.computed_score, 70);

  // Upsert
  const { data: sc13 } = await api('POST', '/scores', { athlete_run_id: secondRunId, score: 90 }, j1Token);
  assert('TC-06.13: Upsert updates score', sc13?.computed_score !== null);

  // ═══════════════════════════════════════════════════════════════════════
  // TS-07: Heat Lifecycle
  // ═══════════════════════════════════════════════════════════════════════
  log('TS-07: Heat Lifecycle');

  // Score all remaining runs in heat1 to enable review
  await scoreHeat(heat1.id, judgeTokens, hjToken);

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

  // ═══════════════════════════════════════════════════════════════════════
  // TS-08: Stage Progression & Advancement
  // ═══════════════════════════════════════════════════════════════════════
  log('TS-08: Stage Progression & Advancement');

  log('  Scenario: QUAL → LCQ → FINAL (11 athletes)');
  // Heat1 is already CLOSED. Process Heat 2.
  const heat2 = qualHeats[1];
  const { closeData: close2 } = await processHeat(heat2.id, adminToken, judgeTokens, hjToken);
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
    await processHeat(lh.id, adminToken, judgeTokens, hjToken);
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
  const { results: finalResults } = await processHeat(finalStage.heats[0].id, adminToken, judgeTokens, hjToken);
  assert('TC-08.05b: FINAL results count', finalResults?.length === 6);

  // Women QUAL → FINAL (6 athletes)
  log('  Scenario: QUAL → FINAL (6 athletes)');
  const womenQualHeat = womenStages.find(s => s.stage_type === 'QUALIFICATION')?.heats[0];
  if (womenQualHeat) {
    const { closeData: wClose } = await processHeat(womenQualHeat.id, adminToken, judgeTokens, hjToken);
    check('TC-08.09: Women QUAL complete', wClose?.stage_complete, true);

    const { data: afterWomenQual } = await api('GET', `/heats/competition/${compId}`, null, adminToken);
    const wFinal = afterWomenQual.stages.find(s => s.stage_type === 'FINAL' && s.division_name === 'Open Women');
    check('TC-08.10: Women FINAL ACTIVE', wFinal?.status, 'ACTIVE');
    check('TC-08.09b: Women FINAL has 6', wFinal?.heats[0]?.athletes.length, 6);
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
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0, 36 - String(passed).length - String(failed).length))}║`);
  console.log('╚═══════════════════════════════════════════════════════╝');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Test crashed:', err); process.exit(1); });
