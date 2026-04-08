/**
 * Sprint 4 Test: Full competition scoring lifecycle
 *
 * Tests: score submission, computed_score trigger, heat review,
 * heat approval, heat close, stage progression, LCQ population, and FINAL.
 *
 * Prerequisite: run `node src/db/seed.js` first, then start the server.
 * Usage: node test-sprint4.js
 */

const BASE = 'http://localhost:3001/api';

async function api(method, path, body, token) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok && res.status !== 409) {
    // 409 might be expected (missing scores), so don't throw
  }
  return { status: res.status, data };
}

async function login(email) {
  const { data } = await api('POST', '/auth/login', { email, password: 'password123' });
  return data.token;
}

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  PASS: ${msg}`);
}

async function main() {
  console.log('=== Sprint 4 Test: Full Competition Lifecycle ===\n');

  // Login all users
  console.log('1. Logging in all users...');
  const adminToken = await login('admin@wakeboard.lt');
  const hjToken = await login('headjudge@wakeboard.lt');
  const j1Token = await login('judge1@wakeboard.lt');
  const j2Token = await login('judge2@wakeboard.lt');
  const j3Token = await login('judge3@wakeboard.lt');
  console.log('  All logins successful.\n');

  // Get competition
  const { data: comps } = await api('GET', '/competitions');
  const compId = comps.competitions[0].id;
  console.log(`2. Competition: ${compId}\n`);

  // Get heats for Open Men division
  const { data: heatData } = await api('GET', `/heats/competition/${compId}`, null, adminToken);
  const qualStage = heatData.stages.find(s => s.stage_type === 'QUALIFICATION');
  assert(qualStage, 'Qualification stage exists');
  assert(qualStage.heats.length === 2, `Qual has 2 heats (got ${qualStage.heats.length})`);

  const heat1 = qualStage.heats[0];
  const heat2 = qualStage.heats[1];
  console.log(`  Heat 1: ${heat1.id} (${heat1.athletes.length} athletes)`);
  console.log(`  Heat 2: ${heat2.id} (${heat2.athletes.length} athletes)\n`);

  // Set competition to ACTIVE
  console.log('3. Setting competition to ACTIVE...');
  await api('PATCH', `/competitions/${compId}/status`, { status: 'ACTIVE' }, adminToken);
  console.log('  Done.\n');

  // Open Heat 1
  console.log('4. Opening Heat 1 (PENDING → OPEN)...');
  const { data: openResult } = await api('PATCH', `/heats/${heat1.id}/status`, { status: 'OPEN' }, adminToken);
  assert(openResult.status === 'OPEN', 'Heat 1 is OPEN');
  console.log('');

  // Score all athletes in Heat 1
  console.log('5. Scoring Heat 1...');
  const h1Runs = await getAthleteRuns(heat1.id, hjToken);

  for (const run of h1Runs) {
    const scores = [randomScore(), randomScore(), randomScore()];
    const tokens = [j1Token, j2Token, j3Token];

    for (let j = 0; j < 3; j++) {
      const { status, data } = await api('POST', '/scores', {
        athlete_run_id: run.athlete_run_id,
        score: scores[j],
      }, tokens[j]);
      assert(status === 200, `Judge ${j + 1} scored run ${run.run_number} for ${run.name}: ${scores[j]}`);

      if (j === 2) {
        // Last judge — computed_score should be set
        assert(data.computed_score !== null, `  computed_score = ${data.computed_score}`);
      }
    }
  }
  console.log('');

  // Submit Heat 1 for review
  console.log('6. Heat 1 → HEAD_REVIEW...');
  const { status: reviewStatus, data: reviewData } = await api('POST', `/heats/${heat1.id}/review`, null, hjToken);
  assert(reviewStatus === 200, `Heat 1 in HEAD_REVIEW`);
  console.log('');

  // Approve Heat 1
  console.log('7. Approving Heat 1...');
  const { status: approveStatus, data: approveData } = await api('POST', `/heats/${heat1.id}/approve`, null, hjToken);
  assert(approveStatus === 200, `Heat 1 APPROVED with ${approveData.results.length} results`);
  for (const r of approveData.results) {
    console.log(`  Rank ${r.final_rank}: ${r.name} — best: ${r.best_score}, second: ${r.second_score}`);
  }
  console.log('');

  // Close Heat 1
  console.log('8. Closing Heat 1...');
  const { status: closeStatus, data: closeData } = await api('POST', `/heats/${heat1.id}/close`, null, hjToken);
  assert(closeStatus === 200, `Heat 1 CLOSED`);
  assert(closeData.stage_complete === false, `Stage not yet complete (${closeData.next_action})`);
  console.log('');

  // Open, score, review, approve, close Heat 2
  console.log('9. Processing Heat 2 (open → score → review → approve → close)...');
  await api('PATCH', `/heats/${heat2.id}/status`, { status: 'OPEN' }, adminToken);

  const h2Runs = await getAthleteRuns(heat2.id, hjToken);
  for (const run of h2Runs) {
    const tokens = [j1Token, j2Token, j3Token];
    for (let j = 0; j < 3; j++) {
      await api('POST', '/scores', { athlete_run_id: run.athlete_run_id, score: randomScore() }, tokens[j]);
    }
  }
  console.log('  All scores submitted.');

  await api('POST', `/heats/${heat2.id}/review`, null, hjToken);
  console.log('  Heat 2 in HEAD_REVIEW.');

  const { data: approveData2 } = await api('POST', `/heats/${heat2.id}/approve`, null, hjToken);
  console.log(`  Heat 2 APPROVED with ${approveData2.results.length} results.`);

  const { data: closeData2 } = await api('POST', `/heats/${heat2.id}/close`, null, hjToken);
  assert(closeData2.stage_complete === true, 'QUALIFICATION stage complete!');
  console.log('');

  // Verify LCQ stage is now populated
  console.log('10. Verifying stage progression...');
  const { data: afterQual } = await api('GET', `/heats/competition/${compId}`, null, adminToken);
  const lcqStage = afterQual.stages.find(s => s.stage_type === 'LCQ');
  assert(lcqStage, 'LCQ stage exists');
  assert(lcqStage.status === 'ACTIVE', `LCQ stage is ACTIVE (got ${lcqStage.status})`);
  const lcqHeat = lcqStage.heats[0];
  assert(lcqHeat.athletes.length > 0, `LCQ heat has ${lcqHeat.athletes.length} athletes`);
  console.log(`  LCQ heat: ${lcqHeat.id} with ${lcqHeat.athletes.length} athletes.`);
  console.log('');

  // Process ALL LCQ heats
  console.log('11. Processing LCQ heats...');
  for (let hi = 0; hi < lcqStage.heats.length; hi++) {
    const lcqHeat = lcqStage.heats[hi];
    if (lcqHeat.athletes.length === 0) continue;
    console.log(`  LCQ Heat ${hi + 1}: ${lcqHeat.id} (${lcqHeat.athletes.length} athletes)`);
    await api('PATCH', `/heats/${lcqHeat.id}/status`, { status: 'OPEN' }, adminToken);
    const lcqRuns = await getAthleteRuns(lcqHeat.id, hjToken);
    for (const run of lcqRuns) {
      const tokens = [j1Token, j2Token, j3Token];
      for (let j = 0; j < 3; j++) {
        await api('POST', '/scores', { athlete_run_id: run.athlete_run_id, score: randomScore() }, tokens[j]);
      }
    }
    await api('POST', `/heats/${lcqHeat.id}/review`, null, hjToken);
    const { data: lcqApprove } = await api('POST', `/heats/${lcqHeat.id}/approve`, null, hjToken);
    console.log(`  LCQ Heat ${hi + 1} approved with ${lcqApprove.results.length} results.`);
    const { data: lcqClose } = await api('POST', `/heats/${lcqHeat.id}/close`, null, hjToken);
    if (hi === lcqStage.heats.length - 1) {
      assert(lcqClose.stage_complete === true, 'LCQ stage complete!');
    }
  }
  console.log('');

  // Verify FINAL populated
  console.log('12. Verifying FINAL stage...');
  const { data: afterLcq } = await api('GET', `/heats/competition/${compId}`, null, adminToken);
  const finalStage = afterLcq.stages.find(s => s.stage_type === 'FINAL');
  assert(finalStage, 'FINAL stage exists');
  assert(finalStage.status === 'ACTIVE', `FINAL stage is ACTIVE (got ${finalStage.status})`);
  const finalHeat = finalStage.heats[0];
  assert(finalHeat.athletes.length > 0, `FINAL heat has ${finalHeat.athletes.length} athletes`);
  console.log(`  FINAL heat: ${finalHeat.id} with ${finalHeat.athletes.length} athletes.`);
  console.log('');

  // Process FINAL
  console.log('13. Processing FINAL (open → score → review → approve → close)...');
  await api('PATCH', `/heats/${finalHeat.id}/status`, { status: 'OPEN' }, adminToken);
  const finalRuns = await getAthleteRuns(finalHeat.id, hjToken);
  for (const run of finalRuns) {
    const tokens = [j1Token, j2Token, j3Token];
    for (let j = 0; j < 3; j++) {
      await api('POST', '/scores', { athlete_run_id: run.athlete_run_id, score: randomScore() }, tokens[j]);
    }
  }
  await api('POST', `/heats/${finalHeat.id}/review`, null, hjToken);
  const { data: finalApprove } = await api('POST', `/heats/${finalHeat.id}/approve`, null, hjToken);
  console.log(`  FINAL approved with ${finalApprove.results.length} results.`);
  for (const r of finalApprove.results) {
    console.log(`  ${r.final_rank}. ${r.name} — ${r.best_score}`);
  }
  const { data: finalClose } = await api('POST', `/heats/${finalHeat.id}/close`, null, hjToken);
  assert(finalClose.stage_complete === true, 'FINAL stage complete!');
  console.log('');

  // Check leaderboard
  console.log('14. Checking leaderboard...');
  const divId = qualStage.division_id;
  const { data: lb } = await api('GET', `/scores/leaderboard/${compId}?division_id=${divId}`);
  assert(lb.rankings.length > 0, `Leaderboard has ${lb.rankings.length} athletes`);
  for (const r of lb.rankings) {
    console.log(`  ${r.rank}. ${r.name} — ${r.score}`);
  }
  console.log('');

  console.log('=== ALL TESTS PASSED ===');
}

async function getAthleteRuns(heatId, token) {
  const { data } = await api('GET', `/scores/heat/${heatId}`, null, token);
  return data;
}

function randomScore() {
  return Math.round((Math.random() * 80 + 20) * 2) / 2; // 20.0–100.0 in 0.5 steps
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
