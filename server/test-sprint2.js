// Sprint 2 — Test runner
// Run: npm run seed && node test-sprint2.js (with server running on port 3001)

const BASE = 'http://localhost:3001/api';
let passed = 0;
let failed = 0;

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function check(name, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name} — expected ${expected}, got ${actual}`);
    failed++;
  }
}

async function run() {
  console.log('\n=== SPRINT 2 TESTS ===\n');

  // --- Get tokens ---
  const admin = await req('POST', '/auth/login', { email: 'admin@wakeboard.lt', password: 'password123' });
  const ADMIN = admin.data.token;
  const hj = await req('POST', '/auth/login', { email: 'headjudge@wakeboard.lt', password: 'password123' });
  const HJ_TOKEN = hj.data.token;
  const HJ_ID = hj.data.user.id;
  const judge1 = await req('POST', '/auth/login', { email: 'judge1@wakeboard.lt', password: 'password123' });
  const J1_TOKEN = judge1.data.token;
  const J1_ID = judge1.data.user.id;
  const judge2 = await req('POST', '/auth/login', { email: 'judge2@wakeboard.lt', password: 'password123' });
  const J2_ID = judge2.data.user.id;
  const ath1 = await req('POST', '/auth/login', { email: 'athlete1@wakeboard.lt', password: 'password123' });
  const ATH1 = ath1.data.token;
  const ATH1_ID = ath1.data.user.id;

  // =============================================
  // COMPETITIONS
  // =============================================
  console.log('Competitions - GET list');
  const list = await req('GET', '/competitions');
  check('GET /competitions → 200', list.status, 200);
  check('Has competitions array', Array.isArray(list.data?.competitions), true);
  check('Seeded comp has athlete_count 10', list.data?.competitions?.[0]?.athlete_count, 10);
  check('Has division field', list.data?.competitions?.[0]?.division !== undefined, true);
  check('Has video_url field', list.data?.competitions?.[0]?.video_url !== undefined, true);
  const COMP_ID = list.data?.competitions?.[0]?.id;

  console.log('\nCompetitions - GET detail');
  const detail = await req('GET', `/competitions/${COMP_ID}`);
  check('GET /competitions/:id → 200', detail.status, 200);
  check('Has stages array', Array.isArray(detail.data?.stages), true);
  check('Has description field', detail.data?.description !== undefined, true);
  check('Has timetable field', detail.data?.timetable !== undefined, true);
  check('Has judge_count', detail.data?.judge_count, 3);

  const notfound = await req('GET', '/competitions/nonexistent-id');
  check('Nonexistent competition → 404', notfound.status, 404);

  console.log('\nCompetitions - POST create');
  const create1 = await req('POST', '/competitions', {
    name: 'Summer Cup 2026', date: '2026-08-15', location: 'Kaunas',
    division: 'Women', description: 'Test comp', judge_count: 4
  }, ADMIN);
  check('Create competition → 201', create1.status, 201);
  check('Returns id', !!create1.data?.id, true);
  check('Returns status DRAFT', create1.data?.status, 'DRAFT');
  const COMP2_ID = create1.data?.id;

  const create2 = await req('POST', '/competitions', { name: 'Bad' }, ADMIN);
  check('Missing date → 400', create2.status, 400);

  const create3 = await req('POST', '/competitions', { name: 'Bad', date: '2026-01-01', judge_count: 7 }, ADMIN);
  check('judge_count > 5 → 400', create3.status, 400);

  const create4 = await req('POST', '/competitions', { name: 'Bad', date: '2026-01-01' }, ATH1);
  check('Create as ATHLETE → 403', create4.status, 403);

  console.log('\nCompetitions - PATCH edit');
  const edit1 = await req('PATCH', `/competitions/${COMP2_ID}`, { name: 'Updated Cup', division: 'Junior' }, ADMIN);
  check('Edit competition → 200', edit1.status, 200);
  check('Name updated', edit1.data?.name, 'Updated Cup');
  check('Division updated', edit1.data?.division, 'Junior');

  const edit2 = await req('PATCH', `/competitions/${COMP2_ID}`, { video_url: 'https://example.com/stream' }, ADMIN);
  check('Edit video_url → 200', edit2.status, 200);
  check('video_url updated', edit2.data?.video_url, 'https://example.com/stream');

  const edit3 = await req('PATCH', '/competitions/nonexistent', { name: 'X' }, ADMIN);
  check('Edit nonexistent → 404', edit3.status, 404);

  const edit4 = await req('PATCH', `/competitions/${COMP2_ID}`, { name: 'X' }, ATH1);
  check('Edit as ATHLETE → 403', edit4.status, 403);

  console.log('\nCompetitions - PATCH status');
  const stat1 = await req('PATCH', `/competitions/${COMP2_ID}/status`, { status: 'ACTIVE' }, ADMIN);
  check('DRAFT → ACTIVE → 200', stat1.status, 200);
  check('Status is ACTIVE', stat1.data?.status, 'ACTIVE');

  const stat2 = await req('PATCH', `/competitions/${COMP2_ID}/status`, { status: 'DRAFT' }, ADMIN);
  check('ACTIVE → DRAFT → 400 (invalid)', stat2.status, 400);

  // COMPLETED without heats should work (no heats = no open heats)
  const stat3 = await req('PATCH', `/competitions/${COMP2_ID}/status`, { status: 'COMPLETED' }, ADMIN);
  check('ACTIVE → COMPLETED (no heats) → 200', stat3.status, 200);

  const stat4 = await req('PATCH', `/competitions/${COMP2_ID}/status`, { status: 'ACTIVE' }, ADMIN);
  check('COMPLETED → ACTIVE → 400 (invalid)', stat4.status, 400);

  const stat5 = await req('PATCH', `/competitions/${COMP_ID}/status`, { status: 'ACTIVE' }, ATH1);
  check('Status change as ATHLETE → 403', stat5.status, 403);

  // date locked once ACTIVE
  await req('PATCH', `/competitions/${COMP_ID}/status`, { status: 'ACTIVE' }, ADMIN);
  const editDate = await req('PATCH', `/competitions/${COMP_ID}`, { date: '2026-12-01' }, ADMIN);
  check('Edit date on ACTIVE comp → 400', editDate.status, 400);

  const editName = await req('PATCH', `/competitions/${COMP_ID}`, { name: 'Renamed Open' }, ADMIN);
  check('Edit name on ACTIVE comp → 200 (allowed)', editName.status, 200);

  // =============================================
  // STAFF MANAGEMENT
  // =============================================
  console.log('\nStaff - POST assign');
  // First, re-create a DRAFT competition for staff tests (seeded one is now ACTIVE)
  const staffComp = await req('POST', '/competitions', {
    name: 'Staff Test Comp', date: '2026-09-01', location: 'Vilnius', judge_count: 3
  }, ADMIN);
  const SC_ID = staffComp.data.id;

  const s1 = await req('POST', `/competitions/${SC_ID}/staff`, { user_id: HJ_ID, staff_role: 'HEAD_JUDGE' }, ADMIN);
  check('Assign HEAD_JUDGE → 201', s1.status, 201);
  check('Returns staff_role', s1.data?.staff_role, 'HEAD_JUDGE');

  const s2 = await req('POST', `/competitions/${SC_ID}/staff`, { user_id: J1_ID, staff_role: 'JUDGE' }, ADMIN);
  check('Assign JUDGE → 201', s2.status, 201);

  const s3 = await req('POST', `/competitions/${SC_ID}/staff`, { user_id: J2_ID, staff_role: 'HEAD_JUDGE' }, ADMIN);
  check('Second HEAD_JUDGE → 409', s3.status, 409);

  const s4 = await req('POST', `/competitions/${SC_ID}/staff`, { user_id: J1_ID, staff_role: 'JUDGE' }, ADMIN);
  check('Duplicate staff → 409', s4.status, 409);

  const s5 = await req('POST', `/competitions/${SC_ID}/staff`, { user_id: ATH1_ID, staff_role: 'JUDGE' }, ADMIN);
  check('Assign ATHLETE as staff → 400', s5.status, 400);

  const s6 = await req('POST', `/competitions/${SC_ID}/staff`, { user_id: 'nonexistent', staff_role: 'JUDGE' }, ADMIN);
  check('Assign nonexistent user → 404', s6.status, 404);

  const s7 = await req('POST', `/competitions/${SC_ID}/staff`, { user_id: J2_ID, staff_role: 'INVALID' }, ADMIN);
  check('Invalid staff_role → 400', s7.status, 400);

  const s8 = await req('POST', `/competitions/${SC_ID}/staff`, { user_id: J2_ID, staff_role: 'JUDGE' }, ATH1);
  check('Assign staff as ATHLETE → 403', s8.status, 403);

  console.log('\nStaff - GET list');
  const staffList = await req('GET', `/competitions/${SC_ID}/staff`, null, ADMIN);
  check('GET staff → 200', staffList.status, 200);
  check('Staff count = 2', staffList.data?.length, 2);
  check('Staff has name', !!staffList.data?.[0]?.name, true);
  check('Staff has email', !!staffList.data?.[0]?.email, true);
  check('Staff has staff_role', !!staffList.data?.[0]?.staff_role, true);

  const staffList2 = await req('GET', `/competitions/${SC_ID}/staff`, null, ATH1);
  check('GET staff as ATHLETE → 403', staffList2.status, 403);

  console.log('\nStaff - DELETE');
  const del1 = await req('DELETE', `/competitions/${SC_ID}/staff/${J1_ID}`, null, ADMIN);
  check('Remove JUDGE → 200', del1.status, 200);

  const staffAfter = await req('GET', `/competitions/${SC_ID}/staff`, null, ADMIN);
  check('Staff count after removal = 1', staffAfter.data?.length, 1);

  const del2 = await req('DELETE', `/competitions/${SC_ID}/staff/${J1_ID}`, null, ADMIN);
  check('Remove already-removed → 404', del2.status, 404);

  const del3 = await req('DELETE', `/competitions/${SC_ID}/staff/${HJ_ID}`, null, ATH1);
  check('Remove staff as ATHLETE → 403', del3.status, 403);

  // =============================================
  // REGISTRATIONS
  // =============================================
  console.log('\nRegistrations - POST');
  // Register new athlete for staff test comp
  const newAth = await req('POST', '/auth/register', { name: 'New Guy', email: 'newguy@test.lt', password: 'test123' });
  const NEW_ATH = newAth.data.token;

  const r1 = await req('POST', '/registrations', { competition_id: SC_ID }, NEW_ATH);
  check('Register athlete → 201', r1.status, 201);
  check('Status = CONFIRMED', r1.data?.status, 'CONFIRMED');
  check('Returns competition_id', r1.data?.competition_id, SC_ID);
  check('Returns athlete_id', !!r1.data?.athlete_id, true);
  const REG_ID = r1.data?.id;

  const r2 = await req('POST', '/registrations', { competition_id: SC_ID }, NEW_ATH);
  check('Duplicate registration → 409', r2.status, 409);

  // Register for ACTIVE competition should fail
  const r3 = await req('POST', '/registrations', { competition_id: COMP_ID }, NEW_ATH);
  check('Register for ACTIVE comp → 400', r3.status, 400);

  const r4 = await req('POST', '/registrations', { competition_id: 'nonexistent' }, NEW_ATH);
  check('Register for nonexistent comp → 404', r4.status, 404);

  const r5 = await req('POST', '/registrations', { competition_id: SC_ID }, ADMIN);
  check('Register as ADMIN → 403', r5.status, 403);

  console.log('\nRegistrations - GET list');
  const regList = await req('GET', `/registrations/competition/${SC_ID}`, null, ADMIN);
  check('List registrations → 200', regList.status, 200);
  check('Registration count = 1', regList.data?.length, 1);
  check('Has name field', !!regList.data?.[0]?.name, true);
  check('Has email field', !!regList.data?.[0]?.email, true);
  check('Has seed field', regList.data?.[0]?.seed !== undefined, true);

  const regList2 = await req('GET', `/registrations/competition/${SC_ID}`, null, ATH1);
  check('List as ATHLETE → 403', regList2.status, 403);

  const regList3 = await req('GET', '/registrations/competition/nonexistent', null, ADMIN);
  check('List for nonexistent comp → 404', regList3.status, 404);

  console.log('\nRegistrations - PATCH seed');
  const seed1 = await req('PATCH', `/registrations/${REG_ID}/seed`, { seed: 5 }, ADMIN);
  check('Set seed → 200', seed1.status, 200);
  check('Returns seed value', seed1.data?.seed, 5);

  const seed2 = await req('PATCH', `/registrations/${REG_ID}/seed`, { seed: -1 }, ADMIN);
  check('Negative seed → 400', seed2.status, 400);

  const seed3 = await req('PATCH', `/registrations/${REG_ID}/seed`, { seed: 3 }, ATH1);
  check('Set seed as ATHLETE → 403', seed3.status, 403);

  const seed4 = await req('PATCH', '/registrations/nonexistent/seed', { seed: 1 }, ADMIN);
  check('Set seed on nonexistent → 404', seed4.status, 404);

  console.log('\nRegistrations - PATCH status');
  const pstat1 = await req('PATCH', `/registrations/${REG_ID}`, { status: 'WITHDRAWN' }, ADMIN);
  check('Withdraw registration → 200', pstat1.status, 200);
  check('Status = WITHDRAWN', pstat1.data?.status, 'WITHDRAWN');

  const pstat2 = await req('PATCH', `/registrations/${REG_ID}`, { status: 'CONFIRMED' }, ADMIN);
  check('Re-confirm → 200', pstat2.status, 200);

  const pstat3 = await req('PATCH', `/registrations/${REG_ID}`, { status: 'INVALID' }, ADMIN);
  check('Invalid status → 400', pstat3.status, 400);

  console.log('\nRegistrations - DELETE');
  const del4 = await req('DELETE', `/registrations/${REG_ID}`, null, ADMIN);
  check('Delete registration → 200', del4.status, 200);

  const del5 = await req('DELETE', `/registrations/${REG_ID}`, null, ADMIN);
  check('Delete already-deleted → 404', del5.status, 404);

  const regAfter = await req('GET', `/registrations/competition/${SC_ID}`, null, ADMIN);
  check('Registration count after delete = 0', regAfter.data?.length, 0);

  // =============================================
  // SORT ORDER CHECK
  // =============================================
  console.log('\nSort order');
  const sorted = await req('GET', '/competitions');
  const dates = sorted.data.competitions.map(c => c.date);
  const isSortedAsc = dates.every((d, i) => i === 0 || d >= dates[i - 1]);
  check('Competitions sorted by date ASC', isSortedAsc, true);

  // --- Summary ---
  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test error:', err.message);
  console.error('Is the server running on port 3001?');
  process.exit(1);
});
