// Sprint 1 — Manual test runner
// Run: node test-sprint1.js (with server running on port 3001)

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
  console.log('\n=== SPRINT 1 TESTS ===\n');

  // --- Auth: Login all roles ---
  console.log('Auth - Login');
  const admin = await req('POST', '/auth/login', { email: 'admin@wakeboard.lt', password: 'password123' });
  check('Admin login → 200', admin.status, 200);
  check('Admin role = ADMIN', admin.data?.user?.role, 'ADMIN');
  const ADMIN_TOKEN = admin.data?.token;

  const hj = await req('POST', '/auth/login', { email: 'headjudge@wakeboard.lt', password: 'password123' });
  check('Head Judge login → 200', hj.status, 200);
  check('Head Judge role = HEAD_JUDGE', hj.data?.user?.role, 'HEAD_JUDGE');

  const judge = await req('POST', '/auth/login', { email: 'judge1@wakeboard.lt', password: 'password123' });
  check('Judge login → 200', judge.status, 200);
  check('Judge role = JUDGE', judge.data?.user?.role, 'JUDGE');
  const JUDGE_TOKEN = judge.data?.token;

  const ath = await req('POST', '/auth/login', { email: 'athlete1@wakeboard.lt', password: 'password123' });
  check('Athlete login → 200', ath.status, 200);
  check('Athlete role = ATHLETE', ath.data?.user?.role, 'ATHLETE');
  const ATHLETE_TOKEN = ath.data?.token;

  // --- Auth: Register ---
  console.log('\nAuth - Register');
  const reg1 = await req('POST', '/auth/register', { name: 'Testas Testauskas', email: 'testas@test.lt', password: 'test123' });
  check('Register new athlete → 201', reg1.status, 201);
  check('Register returns token', !!reg1.data?.token, true);
  check('Register role = ATHLETE', reg1.data?.user?.role, 'ATHLETE');
  const NEW_ATH_TOKEN = reg1.data?.token;

  const reg2 = await req('POST', '/auth/register', { name: 'Testas Testauskas', email: 'testas@test.lt', password: 'test123' });
  check('Duplicate email → 409', reg2.status, 409);

  // --- Auth: /me ---
  console.log('\nAuth - /me');
  const me1 = await req('GET', '/auth/me', null, ADMIN_TOKEN);
  check('GET /me with token → 200', me1.status, 200);
  check('/me returns correct name', me1.data?.name, 'Admin Vaitkus');

  const me2 = await req('GET', '/auth/me');
  check('GET /me no token → 401', me2.status, 401);

  // --- Auth: Wrong password ---
  console.log('\nAuth - Errors');
  const bad = await req('POST', '/auth/login', { email: 'admin@wakeboard.lt', password: 'wrongpass' });
  check('Wrong password → 401', bad.status, 401);

  const missing = await req('POST', '/auth/register', { email: 'x@x.lt', password: 'x' });
  check('Register missing name → 400', missing.status, 400);

  // --- Auth: Create staff ---
  console.log('\nAuth - Create Staff');
  const staff1 = await req('POST', '/auth/create-staff', { name: 'New Judge', email: 'newjudge@test.lt', password: 'pass123', role: 'JUDGE' }, ADMIN_TOKEN);
  check('Create staff as ADMIN → 201', staff1.status, 201);

  const staff2 = await req('POST', '/auth/create-staff', { name: 'Hack', email: 'hack@test.lt', password: 'pass', role: 'ADMIN' }, JUDGE_TOKEN);
  check('Create staff as JUDGE → 403', staff2.status, 403);

  const staff3 = await req('POST', '/auth/create-staff', { name: 'Bad', email: 'bad@test.lt', password: 'pass', role: 'ADMIN' }, ADMIN_TOKEN);
  check('Create staff with ADMIN role → 400', staff3.status, 400);

  // --- Competitions ---
  console.log('\nCompetitions');
  const comps = await req('GET', '/competitions');
  check('GET /competitions → 200', comps.status, 200);
  check('Has competitions array', Array.isArray(comps.data?.competitions), true);
  check('Seeded competition has athlete_count 10', comps.data?.competitions?.[0]?.athlete_count, 10);
  const COMP_ID = comps.data?.competitions?.[0]?.id;

  const comp = await req('GET', `/competitions/${COMP_ID}`);
  check('GET /competitions/:id → 200', comp.status, 200);
  check('Competition has stages array', Array.isArray(comp.data?.stages), true);
  check('Competition status = DRAFT', comp.data?.status, 'DRAFT');

  const create1 = await req('POST', '/competitions', { name: 'Test Comp', date: '2026-08-01', location: 'Kaunas', judge_count: 3 }, ADMIN_TOKEN);
  check('Create competition as ADMIN → 201', create1.status, 201);
  check('New comp status = DRAFT', create1.data?.status, 'DRAFT');

  const create2 = await req('POST', '/competitions', { name: 'Hack', date: '2026-08-01', location: 'X' }, ATHLETE_TOKEN);
  check('Create competition as ATHLETE → 403', create2.status, 403);

  const create3 = await req('POST', '/competitions', { name: 'Bad', date: '2026-08-01', location: 'X', judge_count: 9 }, ADMIN_TOKEN);
  check('judge_count > 5 → 400', create3.status, 400);

  // --- Registrations ---
  console.log('\nRegistrations');
  const regA1 = await req('POST', '/registrations', { competition_id: COMP_ID }, NEW_ATH_TOKEN);
  check('Register athlete for competition → 201', regA1.status, 201);
  check('Registration status = CONFIRMED', regA1.data?.status, 'CONFIRMED');

  const regA2 = await req('POST', '/registrations', { competition_id: COMP_ID }, NEW_ATH_TOKEN);
  check('Duplicate registration → 409', regA2.status, 409);

  const regList = await req('GET', `/registrations/competition/${COMP_ID}`, null, ADMIN_TOKEN);
  check('List registrations as ADMIN → 200', regList.status, 200);
  check('Registration count = 11 (10 seed + 1 new)', regList.data?.length, 11);

  const regA3 = await req('POST', '/registrations', { competition_id: COMP_ID }, JUDGE_TOKEN);
  check('Register as JUDGE → 403', regA3.status, 403);

  // --- Heats (stub) ---
  console.log('\nHeats');
  const gen = await req('POST', '/heats/generate', { competition_id: COMP_ID }, ADMIN_TOKEN);
  check('Heat generation stub → 501', gen.status, 501);

  // --- Role protection on registrations list ---
  const regList2 = await req('GET', `/registrations/competition/${COMP_ID}`, null, ATHLETE_TOKEN);
  check('List registrations as ATHLETE → 403', regList2.status, 403);

  // --- Summary ---
  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test error:', err.message);
  console.error('Is the server running on port 3001?');
  process.exit(1);
});
