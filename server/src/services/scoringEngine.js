import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema.js';
import { ladderDistribute, stepladderDistribute } from './heatGeneration.js';
import { EVENTS } from '../utils/events.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function getHeatContext(heatId) {
  const ctx = db.prepare(`
    SELECT h.id as heat_id, h.status as heat_status, h.stage_id, h.run2_reorder,
           s.competition_id, s.division_id, s.stage_type, s.stage_order,
           s.runs_per_athlete, s.athletes_advance, s.distribution, s.reversed,
           c.judge_count
    FROM heat h
    JOIN stage s ON h.stage_id = s.id
    JOIN competition c ON s.competition_id = c.id
    WHERE h.id = ?
  `).get(heatId);
  if (!ctx) throw Object.assign(new Error('Heat not found'), { status: 404 });
  return ctx;
}

function verifyHeadJudge(competitionId, userId) {
  const staff = db.prepare(
    `SELECT id FROM competition_staff
     WHERE competition_id = ? AND user_id = ? AND staff_role = 'HEAD_JUDGE'`
  ).get(competitionId, userId);
  if (!staff) throw Object.assign(new Error('Not the Head Judge for this competition'), { status: 403 });
}

function err(message, status) {
  return Object.assign(new Error(message), { status });
}

/**
 * Validate that all athlete_run rows in a heat have computed_score set (non-null).
 * @param {string} heatId
 * @returns {{ valid: boolean, missing: Array }} missing list if invalid
 */
function validateAllScoresComputed(heatId) {
  const missing = db.prepare(`
    SELECT ar.athlete_id, u.name, ar.run_number
    FROM athlete_run ar
    JOIN user u ON ar.athlete_id = u.id
    WHERE ar.heat_id = ? AND ar.computed_score IS NULL
  `).all(heatId);
  return { valid: missing.length === 0, missing };
}

// ── 1. Score Submission ──────────────────────────────────────────────────

/**
 * Submit or update a judge's score for an athlete run.
 * Triggers computed_score calculation when all judges have scored.
 * Handles Finals Run 2 reorder when all Run 1 scores are computed.
 * @param {string} athleteRunId - The athlete_run to score
 * @param {string} judgeId - The judge submitting the score
 * @param {number} score - Score value (0.0–100.0)
 * @param {object} io - Socket.IO server instance
 * @returns {{ judge_score_id, athlete_run_id, score, scores_submitted, computed_score }}
 * @throws {Error} 400 if score out of range, 403 if heat not accepting scores, 404 if run not found
 */
export function submitScore(athleteRunId, judgeId, score, io) {
  // Validate score range
  if (typeof score !== 'number' || score < 0 || score > 100) {
    throw err('Score must be between 0 and 100', 400);
  }

  const run = db.prepare(`
    SELECT ar.id, ar.heat_id, ar.athlete_id, ar.run_number, ar.scores_submitted,
           h.status as heat_status, h.stage_id, h.run2_reorder,
           s.competition_id, c.judge_count
    FROM athlete_run ar
    JOIN heat h ON ar.heat_id = h.id
    JOIN stage s ON h.stage_id = s.id
    JOIN competition c ON s.competition_id = c.id
    WHERE ar.id = ?
  `).get(athleteRunId);

  if (!run) throw err('Athlete run not found', 404);

  const result = db.transaction(() => {
    // Status gate — inside transaction to prevent race conditions
    // Re-read heat status within the transaction
    const heatStatus = db.prepare('SELECT status FROM heat WHERE id = ?').get(run.heat_id)?.status;

    if (heatStatus === 'OPEN') {
      // allowed
    } else if (heatStatus === 'HEAD_REVIEW') {
      const corr = db.prepare(
        'SELECT correction_requested FROM judge_score WHERE athlete_run_id = ? AND judge_id = ?'
      ).get(athleteRunId, judgeId);
      if (!corr || !corr.correction_requested) {
        throw err('Heat is not accepting scores', 403);
      }
    } else {
      throw err('Heat is not accepting scores', 403);
    }

    const existing = db.prepare(
      'SELECT id FROM judge_score WHERE athlete_run_id = ? AND judge_id = ?'
    ).get(athleteRunId, judgeId);

    let judgeScoreId;

    if (existing) {
      // UPDATE — do NOT increment scores_submitted
      db.prepare(`
        UPDATE judge_score SET score = ?, submitted_at = datetime('now'),
               correction_requested = 0, correction_note = NULL
        WHERE id = ?
      `).run(score, existing.id);
      judgeScoreId = existing.id;
    } else {
      // INSERT + increment
      judgeScoreId = uuidv4();
      db.prepare(`
        INSERT INTO judge_score (id, athlete_run_id, judge_id, score, submitted_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(judgeScoreId, athleteRunId, judgeId, score);

      db.prepare(
        'UPDATE athlete_run SET scores_submitted = scores_submitted + 1 WHERE id = ?'
      ).run(athleteRunId);
    }

    // Re-read scores_submitted
    const updated = db.prepare(
      'SELECT scores_submitted FROM athlete_run WHERE id = ?'
    ).get(athleteRunId);

    let computedScore = null;

    if (updated.scores_submitted >= run.judge_count) {
      // Compute average in SQL
      db.prepare(`
        UPDATE athlete_run SET computed_score = (
          SELECT ROUND(AVG(js.score), 2) FROM judge_score js WHERE js.athlete_run_id = ?
        ) WHERE id = ?
      `).run(athleteRunId, athleteRunId);

      computedScore = db.prepare(
        'SELECT computed_score FROM athlete_run WHERE id = ?'
      ).get(athleteRunId).computed_score;

      // Finals Run 2 reorder: after all Run 1 scores are computed, reorder for Run 2
      if (run.run2_reorder && run.run_number === 1) {
        const allRun1 = db.prepare(`
          SELECT ar.athlete_id, ar.computed_score
          FROM athlete_run ar
          WHERE ar.heat_id = ? AND ar.run_number = 1
        `).all(run.heat_id);

        const allComputed = allRun1.every(r => r.computed_score !== null);
        if (allComputed) {
          // Sort by score ASC (lowest first, highest last for Run 2)
          const sorted = allRun1.sort((a, b) => a.computed_score - b.computed_score);
          for (let i = 0; i < sorted.length; i++) {
            db.prepare(
              'UPDATE heat_athlete SET run_order = ? WHERE heat_id = ? AND athlete_id = ?'
            ).run(i + 1, run.heat_id, sorted[i].athlete_id);
          }
        }
      }
    }

    return {
      judge_score_id: judgeScoreId,
      athlete_run_id: athleteRunId,
      score,
      scores_submitted: updated.scores_submitted,
      computed_score: computedScore,
    };
  })();

  // Emit outside transaction
  if (io) {
    // Always emit score:submitted so all clients can refetch
    io.to(run.competition_id).emit(EVENTS.SCORE_SUBMITTED, {
      athlete_run_id: athleteRunId,
      heat_id: run.heat_id,
    });

    if (result.computed_score !== null) {
      io.to(run.competition_id).emit(EVENTS.SCORE_COMPUTED, {
        athlete_run_id: athleteRunId,
        athlete_id: run.athlete_id,
        run_number: run.run_number,
        heat_id: run.heat_id,
        computed_score: result.computed_score,
      });
    }
  }

  return result;
}

// ── 2. Correction Request ────────────────────────────────────────────────

/**
 * Head Judge requests a score correction from a specific judge.
 * Sets correction_requested flag and emits socket event to the judge.
 * @param {string} judgeScoreId - The judge_score row to flag
 * @param {string} note - Correction note for the judge
 * @param {string} requesterId - HEAD_JUDGE user ID
 * @param {object} io - Socket.IO server instance
 * @returns {{ judge_score_id, correction_requested: true }}
 */
export function requestCorrection(judgeScoreId, note, requesterId, io) {
  const js = db.prepare(`
    SELECT js.id, js.judge_id, js.athlete_run_id,
           ar.heat_id, h.status as heat_status, s.competition_id
    FROM judge_score js
    JOIN athlete_run ar ON js.athlete_run_id = ar.id
    JOIN heat h ON ar.heat_id = h.id
    JOIN stage s ON h.stage_id = s.id
    WHERE js.id = ?
  `).get(judgeScoreId);

  if (!js) throw err('Judge score not found', 404);
  verifyHeadJudge(js.competition_id, requesterId);

  if (js.heat_status !== 'HEAD_REVIEW') {
    throw err('Heat must be in HEAD_REVIEW to request corrections', 400);
  }

  db.prepare(
    'UPDATE judge_score SET correction_requested = 1, correction_note = ? WHERE id = ?'
  ).run(note || null, judgeScoreId);

  if (io) {
    io.to(`judge:${js.judge_id}`).emit(EVENTS.CORRECTION_REQUESTED, {
      judge_id: js.judge_id,
      athlete_run_id: js.athlete_run_id,
      note: note || null,
    });
  }

  return { judge_score_id: judgeScoreId, correction_requested: true };
}

// ── 3. Submit for Review ─────────────────────────────────────────────────

/**
 * Transition heat from OPEN to HEAD_REVIEW.
 * Validates all computed_scores are non-null before allowing transition.
 * @param {string} heatId
 * @param {string} userId - HEAD_JUDGE user ID
 * @returns {{ heat_id, status: 'HEAD_REVIEW' }}
 */
export function submitForReview(heatId, userId) {
  const ctx = getHeatContext(heatId);
  verifyHeadJudge(ctx.competition_id, userId);

  if (ctx.heat_status !== 'OPEN') {
    throw err(`Invalid status transition: ${ctx.heat_status} → HEAD_REVIEW`, 400);
  }

  // Check all computed_scores are non-null
  const { valid, missing } = validateAllScoresComputed(heatId);
  if (!valid) {
    throw Object.assign(new Error('Missing scores'), { status: 409, missing });
  }

  db.prepare('UPDATE heat SET status = ? WHERE id = ?').run('HEAD_REVIEW', heatId);
  return { heat_id: heatId, status: 'HEAD_REVIEW' };
}

// ── 4. Manual Reorder ────────────────────────────────────────────────────

/**
 * Head Judge manually reorders athlete ranking within a heat.
 * Upserts heat_result rows with custom final_rank values.
 * @param {string} heatId
 * @param {Array<{athlete_id: string, final_rank: number}>} ranking
 * @param {string} userId - HEAD_JUDGE user ID
 * @returns {{ heat_id, ranking_updated: true }}
 */
export function manualReorder(heatId, ranking, userId) {
  const ctx = getHeatContext(heatId);
  verifyHeadJudge(ctx.competition_id, userId);

  if (ctx.heat_status !== 'HEAD_REVIEW' && ctx.heat_status !== 'APPROVED') {
    throw err('Heat must be in HEAD_REVIEW or APPROVED to reorder ranking', 400);
  }

  // Get athletes in heat
  const heatAthletes = db.prepare(
    'SELECT athlete_id FROM heat_athlete WHERE heat_id = ?'
  ).all(heatId);
  const athleteIds = new Set(heatAthletes.map(ha => ha.athlete_id));

  // Validate ranking array
  if (!Array.isArray(ranking) || ranking.length !== athleteIds.size) {
    throw err(`Ranking must include all ${athleteIds.size} athletes in the heat`, 400);
  }

  const ranks = new Set();
  for (const entry of ranking) {
    if (!athleteIds.has(entry.athlete_id)) {
      throw err(`Athlete ${entry.athlete_id} is not in this heat`, 400);
    }
    if (typeof entry.final_rank !== 'number' || entry.final_rank < 1 || entry.final_rank > athleteIds.size) {
      throw err(`final_rank must be between 1 and ${athleteIds.size}`, 400);
    }
    if (ranks.has(entry.final_rank)) {
      throw err(`Duplicate final_rank: ${entry.final_rank}`, 400);
    }
    ranks.add(entry.final_rank);
  }

  db.transaction(() => {
    for (const entry of ranking) {
      // Compute best_score and second_score from athlete_runs
      const runs = db.prepare(`
        SELECT run_number, computed_score FROM athlete_run
        WHERE heat_id = ? AND athlete_id = ?
        ORDER BY run_number
      `).all(heatId, entry.athlete_id);

      const scores = runs.map(r => r.computed_score).filter(s => s !== null);
      const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
      const secondScore = scores.length > 1 ? Math.min(...scores) : null;

      // Upsert heat_result
      db.prepare(`
        INSERT INTO heat_result (id, heat_id, athlete_id, best_score, second_score, final_rank)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(heat_id, athlete_id) DO UPDATE SET
          best_score = excluded.best_score,
          second_score = excluded.second_score,
          final_rank = excluded.final_rank
      `).run(uuidv4(), heatId, entry.athlete_id, bestScore, secondScore, entry.final_rank);
    }
  })();

  return { heat_id: heatId, ranking_updated: true };
}

// ── 5. Approve Heat ──────────────────────────────────────────────────────

/**
 * Approve a heat: compute rankings, write heat_result, update stage_ranking.
 * Auto-ranks athletes by best_score DESC if no manual ranking exists.
 * Emits heat:approved and leaderboard:updated socket events.
 * @param {string} heatId
 * @param {string} userId - HEAD_JUDGE user ID
 * @param {object} io - Socket.IO server instance
 * @returns {{ heat_id, status: 'APPROVED', results: Array }}
 */
export function approveHeat(heatId, userId, io) {
  const ctx = getHeatContext(heatId);
  verifyHeadJudge(ctx.competition_id, userId);

  if (ctx.heat_status !== 'HEAD_REVIEW') {
    throw err(`Heat must be in HEAD_REVIEW to approve (current: ${ctx.heat_status})`, 400);
  }

  // Validate all computed_scores non-null
  const { valid, missing } = validateAllScoresComputed(heatId);
  if (!valid) {
    throw Object.assign(new Error('Missing scores'), { status: 409, missing });
  }

  const results = db.transaction(() => {
    // Check if manual ranking exists
    const existingResults = db.prepare(
      'SELECT id FROM heat_result WHERE heat_id = ?'
    ).all(heatId);

    if (existingResults.length === 0) {
      // Auto-compute ranking
      const athletes = db.prepare(
        'SELECT DISTINCT athlete_id FROM heat_athlete WHERE heat_id = ?'
      ).all(heatId);

      const ranked = athletes.map(a => {
        const runs = db.prepare(`
          SELECT run_number, computed_score FROM athlete_run
          WHERE heat_id = ? AND athlete_id = ?
          ORDER BY run_number
        `).all(heatId, a.athlete_id);

        const scores = runs.map(r => r.computed_score).filter(s => s !== null);
        const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
        const secondScore = scores.length > 1 ? Math.min(...scores) : null;

        return { athlete_id: a.athlete_id, best_score: bestScore, second_score: secondScore };
      });

      // Sort: best_score DESC, then second_score DESC (nulls last)
      ranked.sort((a, b) => {
        if (b.best_score !== a.best_score) return b.best_score - a.best_score;
        const aSecond = a.second_score ?? -1;
        const bSecond = b.second_score ?? -1;
        return bSecond - aSecond;
      });

      // Insert heat_result rows
      for (let i = 0; i < ranked.length; i++) {
        const r = ranked[i];
        db.prepare(`
          INSERT INTO heat_result (id, heat_id, athlete_id, best_score, second_score, final_rank)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), heatId, r.athlete_id, r.best_score, r.second_score, i + 1);
      }
    }

    // Upsert stage_ranking for each athlete
    const heatResults = db.prepare(`
      SELECT hr.athlete_id, hr.best_score, hr.final_rank
      FROM heat_result hr WHERE hr.heat_id = ?
    `).all(heatId);

    for (const hr of heatResults) {
      const existing = db.prepare(
        'SELECT id, best_score FROM stage_ranking WHERE stage_id = ? AND athlete_id = ?'
      ).get(ctx.stage_id, hr.athlete_id);

      if (existing) {
        const newBest = Math.max(existing.best_score, hr.best_score);
        db.prepare('UPDATE stage_ranking SET best_score = ? WHERE id = ?').run(newBest, existing.id);
      } else {
        db.prepare(`
          INSERT INTO stage_ranking (id, stage_id, athlete_id, best_score, rank, advanced)
          VALUES (?, ?, ?, ?, 0, 0)
        `).run(uuidv4(), ctx.stage_id, hr.athlete_id, hr.best_score);
      }
    }

    // Recalculate all ranks in the stage
    const allRankings = db.prepare(
      'SELECT id, best_score FROM stage_ranking WHERE stage_id = ? ORDER BY best_score DESC'
    ).all(ctx.stage_id);

    for (let i = 0; i < allRankings.length; i++) {
      db.prepare('UPDATE stage_ranking SET rank = ? WHERE id = ?').run(i + 1, allRankings[i].id);
    }

    // Set heat status to APPROVED
    db.prepare('UPDATE heat SET status = ? WHERE id = ?').run('APPROVED', heatId);

    // Build response with names
    const resultRows = db.prepare(`
      SELECT hr.athlete_id, u.name, hr.best_score, hr.second_score, hr.final_rank
      FROM heat_result hr
      JOIN user u ON hr.athlete_id = u.id
      WHERE hr.heat_id = ?
      ORDER BY hr.final_rank
    `).all(heatId);

    // Add best_run indicator
    return resultRows.map(r => {
      const run1 = db.prepare(
        'SELECT computed_score FROM athlete_run WHERE heat_id = ? AND athlete_id = ? AND run_number = 1'
      ).get(heatId, r.athlete_id);
      const bestRun = (run1 && run1.computed_score === r.best_score) ? 1 : 2;
      return { ...r, best_run: bestRun };
    });
  })();

  // Emit events outside transaction
  if (io) {
    io.to(ctx.competition_id).emit(EVENTS.HEAT_APPROVED, {
      heat_id: heatId,
      results: results.map(r => ({
        athlete_id: r.athlete_id,
        best_score: r.best_score,
        final_rank: r.final_rank,
      })),
    });

    const rankings = db.prepare(`
      SELECT sr.athlete_id, u.name, sr.best_score as score, sr.rank
      FROM stage_ranking sr
      JOIN user u ON sr.athlete_id = u.id
      WHERE sr.stage_id = ?
      ORDER BY sr.rank
    `).all(ctx.stage_id);

    io.to(ctx.competition_id).emit(EVENTS.LEADERBOARD_UPDATED, {
      stage_id: ctx.stage_id,
      rankings,
    });
  }

  return { heat_id: heatId, status: 'APPROVED', results };
}

// ── 6. Close Heat + Stage Progression ────────────────────────────────────

/**
 * Close an approved heat. Triggers stage progression if all heats in stage are closed.
 * Per-heat advancement: top N athletes from each heat advance, interleaved by rank.
 * @param {string} heatId
 * @param {string} userId - HEAD_JUDGE user ID
 * @param {object} io - Socket.IO server instance
 * @returns {{ heat_id, status: 'CLOSED', stage_complete: boolean, next_action: string }}
 */
export function closeHeat(heatId, userId, io) {
  const ctx = getHeatContext(heatId);
  verifyHeadJudge(ctx.competition_id, userId);

  if (ctx.heat_status !== 'APPROVED') {
    throw err('Heat must be approved before closing', 400);
  }

  db.prepare('UPDATE heat SET status = ? WHERE id = ?').run('CLOSED', heatId);

  if (io) {
    io.to(ctx.competition_id).emit(EVENTS.HEAT_CLOSED, {
      heat_id: heatId,
      stage_id: ctx.stage_id,
    });
  }

  // Check if all heats in stage are closed
  const counts = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed
    FROM heat WHERE stage_id = ?
  `).get(ctx.stage_id);

  if (counts.total === counts.closed) {
    completeStageAndAdvance(ctx.stage_id, ctx, io);
    return {
      heat_id: heatId,
      status: 'CLOSED',
      stage_complete: true,
      next_action: 'Stage completed. Athletes advanced to next stage.',
    };
  }

  const remaining = counts.total - counts.closed;
  return {
    heat_id: heatId,
    status: 'CLOSED',
    stage_complete: false,
    next_action: `${remaining} heats remaining in ${ctx.stage_type}`,
  };
}

function populateStageHeats(nextStage, athleteObjs) {
  const heats = db.prepare(
    'SELECT id, heat_number FROM heat WHERE stage_id = ? ORDER BY heat_number'
  ).all(nextStage.id);

  if (heats.length === 0 || athleteObjs.length === 0) return;

  let distributed;
  if (nextStage.distribution === 'LADDER') {
    distributed = ladderDistribute(athleteObjs, heats.length);
  } else if (nextStage.distribution === 'STEPLADDER') {
    distributed = stepladderDistribute(athleteObjs, heats.length);
  } else {
    distributed = ladderDistribute(athleteObjs, heats.length);
  }

  for (let h = 0; h < heats.length; h++) {
    const heatId = heats[h].id;
    const athletesForHeat = distributed[h] || [];

    for (let order = 0; order < athletesForHeat.length; order++) {
      const athlete = athletesForHeat[order];

      db.prepare(`
        INSERT INTO heat_athlete (id, heat_id, athlete_id, run_order, advanced)
        VALUES (?, ?, ?, ?, 0)
      `).run(uuidv4(), heatId, athlete.id, order + 1);

      for (let runNum = 1; runNum <= nextStage.runs_per_athlete; runNum++) {
        db.prepare(`
          INSERT INTO athlete_run (id, heat_id, athlete_id, run_number, scores_submitted, computed_score)
          VALUES (?, ?, ?, ?, 0, NULL)
        `).run(uuidv4(), heatId, athlete.id, runNum);
      }
    }
  }

  // Auto-publish next stage heats
  db.prepare('UPDATE heat SET published = 1 WHERE stage_id = ?').run(nextStage.id);
}

function getPerHeatAdvancers(stageId, athletesAdvanceTotal) {
  const heats = db.prepare(
    'SELECT id, heat_number FROM heat WHERE stage_id = ? ORDER BY heat_number'
  ).all(stageId);

  if (heats.length === 0) return [];

  const perHeat = Math.floor(athletesAdvanceTotal / heats.length);
  let remainder = athletesAdvanceTotal % heats.length;

  const allAdvancers = [];

  for (const heat of heats) {
    const advanceFromThis = perHeat + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;

    const results = db.prepare(`
      SELECT hr.athlete_id, hr.final_rank, hr.best_score, u.name
      FROM heat_result hr
      JOIN user u ON hr.athlete_id = u.id
      WHERE hr.heat_id = ?
      ORDER BY hr.final_rank ASC
    `).all(heat.id);

    for (let i = 0; i < Math.min(advanceFromThis, results.length); i++) {
      const r = results[i];
      db.prepare(
        'UPDATE heat_athlete SET advanced = 1 WHERE heat_id = ? AND athlete_id = ?'
      ).run(heat.id, r.athlete_id);

      allAdvancers.push({
        id: r.athlete_id, name: r.name, best_score: r.best_score,
        rank_in_heat: r.final_rank, heat_number: heat.heat_number,
      });
    }
  }

  // Interleave by rank across heats: rank 1s first (best), then rank 2s, etc.
  // Within same rank, alternate by heat_number
  allAdvancers.sort((a, b) => {
    if (a.rank_in_heat !== b.rank_in_heat) return a.rank_in_heat - b.rank_in_heat;
    return a.heat_number - b.heat_number;
  });

  // Re-assign seeds based on sorted order
  return allAdvancers.map((a, i) => ({ ...a, seed: i + 1 }));
}

function getNonAdvancers(stageId, advancerIds) {
  // Get all non-advancing athletes with their rank from heat_result, interleaved by rank
  const allResults = db.prepare(`
    SELECT hr.athlete_id, u.name, hr.final_rank, hr.best_score, h.heat_number
    FROM heat_result hr
    JOIN user u ON hr.athlete_id = u.id
    JOIN heat h ON hr.heat_id = h.id
    WHERE h.stage_id = ?
    ORDER BY hr.final_rank ASC, h.heat_number ASC
  `).all(stageId);

  const advSet = new Set(advancerIds);
  return allResults
    .filter(a => !advSet.has(a.athlete_id))
    .map((a, i) => ({ athlete_id: a.athlete_id, name: a.name, seed: i + 1 }));
}

function completeStageAndAdvance(stageId, ctx, io) {
  db.transaction(() => {
    // Mark stage as COMPLETED
    db.prepare('UPDATE stage SET status = ? WHERE id = ?').run('COMPLETED', stageId);

    // If FINAL stage, no advancement
    if (ctx.athletes_advance === null) return;

    // Per-heat advancement: winners of each heat advance
    const advancers = getPerHeatAdvancers(stageId, ctx.athletes_advance);
    const advancerIds = advancers.map(a => a.id);

    // Get all stages for this division
    const allStages = db.prepare(`
      SELECT * FROM stage WHERE division_id = ? ORDER BY stage_order
    `).all(ctx.division_id);

    const currentIdx = allStages.findIndex(s => s.id === stageId);
    const nextStage = allStages[currentIdx + 1];
    if (!nextStage) return;

    // QUALIFICATION → LCQ: non-qualifiers go to LCQ, qualifiers wait
    if (ctx.stage_type === 'QUALIFICATION' && nextStage.stage_type === 'LCQ') {
      // NON-advancing athletes → LCQ
      const nonAdvancers = getNonAdvancers(stageId, advancerIds);

      db.prepare('UPDATE stage SET status = ? WHERE id = ?').run('ACTIVE', nextStage.id);
      populateStageHeats(nextStage, nonAdvancers.map((a, i) => ({ id: a.athlete_id, name: a.name, seed: i + 1 })));

      // Qualifiers wait — they'll be combined with LCQ winners when LCQ completes
      return;
    }

    // LCQ completion: combine QUAL heat winners + LCQ heat winners → next stage
    if (ctx.stage_type === 'LCQ') {
      const qualStage = allStages[currentIdx - 1];

      // Get QUAL advancers (heat winners from qualification)
      let qualAdvancers = [];
      if (qualStage) {
        qualAdvancers = db.prepare(`
          SELECT ha.athlete_id, u.name
          FROM heat_athlete ha
          JOIN user u ON ha.athlete_id = u.id
          JOIN heat h ON ha.heat_id = h.id
          WHERE h.stage_id = ? AND ha.advanced = 1
        `).all(qualStage.id);
      }

      // Combine: QUAL advancers first, then LCQ advancers
      const combined = [
        ...qualAdvancers.map((a, i) => ({ id: a.athlete_id, name: a.name, seed: i + 1 })),
        ...advancers.map((a, i) => ({ id: a.id, name: a.name, seed: qualAdvancers.length + i + 1 })),
      ];

      db.prepare('UPDATE stage SET status = ? WHERE id = ?').run('ACTIVE', nextStage.id);
      populateStageHeats(nextStage, combined);
      return;
    }

    // Default: normal per-heat advancement (Semi→Final, QF→Semi, etc.)
    db.prepare('UPDATE stage SET status = ? WHERE id = ?').run('ACTIVE', nextStage.id);
    populateStageHeats(nextStage, advancers);
  })();
}

// ── 7. Reopen Heat (rollback APPROVED → HEAD_REVIEW) ─────────────────────

/**
 * Rollback an approved heat to HEAD_REVIEW.
 * Deletes all heat_result, judge_score rows and resets computed_score.
 * Recalculates stage_ranking for affected athletes.
 * @param {string} heatId
 * @param {string} userId - HEAD_JUDGE user ID
 * @param {object} io - Socket.IO server instance
 * @returns {{ heat_id, status: 'HEAD_REVIEW' }}
 */
export function reopenHeat(heatId, userId, io) {
  const ctx = getHeatContext(heatId);
  verifyHeadJudge(ctx.competition_id, userId);

  if (ctx.heat_status !== 'APPROVED') {
    throw err('Only APPROVED heats can be reopened', 400);
  }

  db.transaction(() => {
    // Delete heat_result rows
    db.prepare('DELETE FROM heat_result WHERE heat_id = ?').run(heatId);

    // Reset computed_score and scores_submitted for all athlete_runs in this heat
    db.prepare(`
      UPDATE athlete_run SET computed_score = NULL, scores_submitted = 0
      WHERE heat_id = ?
    `).run(heatId);

    // Delete all judge_scores for this heat's athlete_runs
    db.prepare(`
      DELETE FROM judge_score WHERE athlete_run_id IN (
        SELECT id FROM athlete_run WHERE heat_id = ?
      )
    `).run(heatId);

    // Recalculate stage_ranking: remove contributions from this heat's athletes
    // and recalculate from remaining approved heats
    const athletesInHeat = db.prepare(
      'SELECT athlete_id FROM heat_athlete WHERE heat_id = ?'
    ).all(heatId);

    for (const { athlete_id } of athletesInHeat) {
      // Check if athlete has results in other heats in same stage
      const otherResult = db.prepare(`
        SELECT MAX(hr.best_score) as best
        FROM heat_result hr
        JOIN heat h ON hr.heat_id = h.id
        WHERE h.stage_id = ? AND hr.athlete_id = ? AND hr.heat_id != ?
      `).get(ctx.stage_id, athlete_id, heatId);

      if (otherResult && otherResult.best !== null) {
        db.prepare(
          'UPDATE stage_ranking SET best_score = ? WHERE stage_id = ? AND athlete_id = ?'
        ).run(otherResult.best, ctx.stage_id, athlete_id);
      } else {
        db.prepare(
          'DELETE FROM stage_ranking WHERE stage_id = ? AND athlete_id = ?'
        ).run(ctx.stage_id, athlete_id);
      }
    }

    // Recalculate ranks for remaining stage_ranking rows
    const remaining = db.prepare(
      'SELECT id FROM stage_ranking WHERE stage_id = ? ORDER BY best_score DESC'
    ).all(ctx.stage_id);

    for (let i = 0; i < remaining.length; i++) {
      db.prepare('UPDATE stage_ranking SET rank = ? WHERE id = ?').run(i + 1, remaining[i].id);
    }

    // Set heat back to HEAD_REVIEW
    db.prepare('UPDATE heat SET status = ? WHERE id = ?').run('HEAD_REVIEW', heatId);
  })();

  return { heat_id: heatId, status: 'HEAD_REVIEW' };
}
