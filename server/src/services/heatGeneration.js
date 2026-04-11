import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema.js';

// ---------------------------------------------------------------------------
// IWWF Format Lookup Table (from IWWF Cablewakeboard Scoring & Heat Systems)
// ---------------------------------------------------------------------------
// Each entry: { type, heatCount, qualifyTotal, runsPerAthlete, distribution, reversed }
// qualifyTotal = total athletes advancing from that round
// reversed = initial riding order inverted (best rides last)

function getFormatConfig(athleteCount) {
  if (athleteCount < 3) throw Object.assign(new Error('Minimum 3 athletes required'), { status: 400 });

  // 3-6: Qual(1) + Final(1)
  if (athleteCount <= 6) {
    return [
      { type: 'QUALIFICATION', heatCount: 1, qualifyTotal: athleteCount, runsPerAthlete: 2, distribution: 'SNAKE', reversed: false },
      { type: 'FINAL', heatCount: 1, qualifyTotal: null, runsPerAthlete: 2, distribution: 'LADDER', reversed: true },
    ];
  }

  // 7-10: Qual(2) + LCQ(1, ladder) + Final(1)
  if (athleteCount <= 10) {
    return [
      { type: 'QUALIFICATION', heatCount: 2, qualifyTotal: 4, runsPerAthlete: 2, distribution: 'SNAKE', reversed: false },
      { type: 'LCQ', heatCount: 1, qualifyTotal: 2, runsPerAthlete: 1, distribution: 'LADDER', reversed: false },
      { type: 'FINAL', heatCount: 1, qualifyTotal: null, runsPerAthlete: 2, distribution: 'LADDER', reversed: true },
    ];
  }

  // 11-12: Qual(2) + LCQ(2, step-ladder) + Final(1)
  if (athleteCount <= 12) {
    return [
      { type: 'QUALIFICATION', heatCount: 2, qualifyTotal: 4, runsPerAthlete: 2, distribution: 'SNAKE', reversed: false },
      { type: 'LCQ', heatCount: 2, qualifyTotal: 2, runsPerAthlete: 1, distribution: 'STEPLADDER', reversed: false },
      { type: 'FINAL', heatCount: 1, qualifyTotal: null, runsPerAthlete: 2, distribution: 'LADDER', reversed: true },
    ];
  }

  // 13-18: Qual(3) + LCQ(3) + Final(1)
  if (athleteCount <= 18) {
    return [
      { type: 'QUALIFICATION', heatCount: 3, qualifyTotal: 3, runsPerAthlete: 2, distribution: 'SNAKE', reversed: false },
      { type: 'LCQ', heatCount: 3, qualifyTotal: 3, runsPerAthlete: 1, distribution: 'STEPLADDER', reversed: false },
      { type: 'FINAL', heatCount: 1, qualifyTotal: null, runsPerAthlete: 2, distribution: 'LADDER', reversed: true },
    ];
  }

  // 19-20: Qual(4) + LCQ(2) + Semi(2) + Final(1)
  if (athleteCount <= 20) {
    return [
      { type: 'QUALIFICATION', heatCount: 4, qualifyTotal: 8, runsPerAthlete: 2, distribution: 'SNAKE', reversed: false },
      { type: 'LCQ', heatCount: 2, qualifyTotal: 4, runsPerAthlete: 1, distribution: 'STEPLADDER', reversed: false },
      { type: 'SEMIFINAL', heatCount: 2, qualifyTotal: 6, runsPerAthlete: 2, distribution: 'STEPLADDER', reversed: true },
      { type: 'FINAL', heatCount: 1, qualifyTotal: null, runsPerAthlete: 2, distribution: 'LADDER', reversed: true },
    ];
  }

  // 21-24: Qual(4) + LCQ(4) + Semi(2) + Final(1)
  if (athleteCount <= 24) {
    return [
      { type: 'QUALIFICATION', heatCount: 4, qualifyTotal: 8, runsPerAthlete: 2, distribution: 'SNAKE', reversed: false },
      { type: 'LCQ', heatCount: 4, qualifyTotal: 4, runsPerAthlete: 1, distribution: 'STEPLADDER', reversed: false },
      { type: 'SEMIFINAL', heatCount: 2, qualifyTotal: 6, runsPerAthlete: 2, distribution: 'STEPLADDER', reversed: true },
      { type: 'FINAL', heatCount: 1, qualifyTotal: null, runsPerAthlete: 2, distribution: 'LADDER', reversed: true },
    ];
  }

  // 25-36: Qual(6) + LCQ(6) + Semi(2) + Final(1)
  if (athleteCount <= 36) {
    return [
      { type: 'QUALIFICATION', heatCount: 6, qualifyTotal: 6, runsPerAthlete: 2, distribution: 'SNAKE', reversed: false },
      { type: 'LCQ', heatCount: 6, qualifyTotal: 6, runsPerAthlete: 1, distribution: 'STEPLADDER', reversed: false },
      { type: 'SEMIFINAL', heatCount: 2, qualifyTotal: 6, runsPerAthlete: 2, distribution: 'STEPLADDER', reversed: true },
      { type: 'FINAL', heatCount: 1, qualifyTotal: null, runsPerAthlete: 2, distribution: 'LADDER', reversed: true },
    ];
  }

  // 37-40: Qual(8) + LCQ(4) + QF(4) + Semi(2) + Final(1)
  if (athleteCount <= 40) {
    return [
      { type: 'QUALIFICATION', heatCount: 8, qualifyTotal: 16, runsPerAthlete: 2, distribution: 'SNAKE', reversed: false },
      { type: 'LCQ', heatCount: 4, qualifyTotal: 8, runsPerAthlete: 1, distribution: 'STEPLADDER', reversed: false },
      { type: 'QUARTERFINAL', heatCount: 4, qualifyTotal: 12, runsPerAthlete: 2, distribution: 'STEPLADDER', reversed: true },
      { type: 'SEMIFINAL', heatCount: 2, qualifyTotal: 6, runsPerAthlete: 2, distribution: 'STEPLADDER', reversed: true },
      { type: 'FINAL', heatCount: 1, qualifyTotal: null, runsPerAthlete: 2, distribution: 'LADDER', reversed: true },
    ];
  }

  // 41-48: Qual(8) + LCQ(8) + QF(4) + Semi(2) + Final(1)
  if (athleteCount <= 48) {
    return [
      { type: 'QUALIFICATION', heatCount: 8, qualifyTotal: 16, runsPerAthlete: 2, distribution: 'SNAKE', reversed: false },
      { type: 'LCQ', heatCount: 8, qualifyTotal: 8, runsPerAthlete: 1, distribution: 'STEPLADDER', reversed: false },
      { type: 'QUARTERFINAL', heatCount: 4, qualifyTotal: 12, runsPerAthlete: 2, distribution: 'STEPLADDER', reversed: true },
      { type: 'SEMIFINAL', heatCount: 2, qualifyTotal: 6, runsPerAthlete: 2, distribution: 'STEPLADDER', reversed: true },
      { type: 'FINAL', heatCount: 1, qualifyTotal: null, runsPerAthlete: 2, distribution: 'LADDER', reversed: true },
    ];
  }

  // 49-54: Qual(9) + LCQ(6) + QF(4) + Semi(2) + Final(1)
  if (athleteCount <= 54) {
    return [
      { type: 'QUALIFICATION', heatCount: 9, qualifyTotal: 18, runsPerAthlete: 2, distribution: 'SNAKE', reversed: false },
      { type: 'LCQ', heatCount: 6, qualifyTotal: 6, runsPerAthlete: 1, distribution: 'STEPLADDER', reversed: false },
      { type: 'QUARTERFINAL', heatCount: 4, qualifyTotal: 12, runsPerAthlete: 2, distribution: 'STEPLADDER', reversed: true },
      { type: 'SEMIFINAL', heatCount: 2, qualifyTotal: 6, runsPerAthlete: 2, distribution: 'STEPLADDER', reversed: true },
      { type: 'FINAL', heatCount: 1, qualifyTotal: null, runsPerAthlete: 2, distribution: 'LADDER', reversed: true },
    ];
  }

  // 55+: extend pattern — more qual heats, adjust LCQ heats
  const qualHeats = Math.ceil(athleteCount / 6);
  const qualQualify = qualHeats * 2;
  const qfCapacity = 24; // 4 QF heats × 6
  const lcqAthletes = athleteCount - qualQualify;
  const lcqHeats = Math.ceil(lcqAthletes / 6);
  const lcqQualify = qfCapacity - qualQualify;

  return [
    { type: 'QUALIFICATION', heatCount: qualHeats, qualifyTotal: qualQualify, runsPerAthlete: 2, distribution: 'SNAKE', reversed: false },
    { type: 'LCQ', heatCount: lcqHeats, qualifyTotal: lcqQualify, runsPerAthlete: 1, distribution: 'STEPLADDER', reversed: false },
    { type: 'QUARTERFINAL', heatCount: 4, qualifyTotal: 12, runsPerAthlete: 2, distribution: 'STEPLADDER', reversed: true },
    { type: 'SEMIFINAL', heatCount: 2, qualifyTotal: 6, runsPerAthlete: 2, distribution: 'STEPLADDER', reversed: true },
    { type: 'FINAL', heatCount: 1, qualifyTotal: null, runsPerAthlete: 2, distribution: 'LADDER', reversed: true },
  ];
}

// ---------------------------------------------------------------------------
// Distribution Algorithms
// ---------------------------------------------------------------------------

/**
 * SNAKE: zigzag distribution for qualification.
 * Spreads top seeds evenly across heats.
 * @param {Array} athletes - sorted by seed ASC, nulls last
 * @param {number} heatCount
 * @returns {Array<Array>} array of heatCount arrays, each containing athlete objects
 */
function snakeDistribute(athletes, heatCount) {
  const heats = Array.from({ length: heatCount }, () => []);
  for (let i = 0; i < athletes.length; i++) {
    const row = Math.floor(i / heatCount);
    let col = i % heatCount;
    if (row % 2 === 1) col = heatCount - 1 - col; // reverse on odd rows
    heats[col].push(athletes[i]);
  }
  return heats;
}

/**
 * LADDER: sequential distribution, best-ranked rides last.
 * @param {Array} athletes - sorted by rank (1=best first)
 * @param {number} heatCount
 * @returns {Array<Array>}
 */
function ladderDistribute(athletes, heatCount) {
  const heats = Array.from({ length: heatCount }, () => []);
  for (let i = 0; i < athletes.length; i++) {
    heats[i % heatCount].push(athletes[i]);
  }
  // Reverse each heat so best-ranked rides last (highest run_order)
  return heats.map((heat) => heat.reverse());
}

/**
 * STEPLADDER: even distribution (identical to ladder placement), weakest rides first.
 * Per IWWF spec, stepladder distributes athletes evenly across heats (sequential),
 * with running order reversed so lowest-seeded (weakest) athletes ride first.
 * @param {Array} athletes - sorted by rank (strongest first)
 * @param {number} heatCount
 * @returns {Array<Array>}
 */
function stepladderDistribute(athletes, heatCount) {
  const heats = Array.from({ length: heatCount }, () => []);
  for (let i = 0; i < athletes.length; i++) {
    heats[i % heatCount].push(athletes[i]);
  }
  // Reverse each heat so weakest (highest seed) rides first, strongest last
  return heats.map((heat) => heat.reverse());
}

// ---------------------------------------------------------------------------
// Format description string
// ---------------------------------------------------------------------------

function formatDescription(config, athleteCount) {
  const parts = config.map((s) => {
    const name = s.type === 'QUARTERFINAL' ? 'QF' :
      s.type === 'SEMIFINAL' ? 'Semi' :
        s.type === 'QUALIFICATION' ? 'Qual' : s.type.charAt(0) + s.type.slice(1).toLowerCase();
    return `${name}(${s.heatCount})`;
  });
  return `${athleteCount} athletes: ${parts.join(' + ')}`;
}

// ---------------------------------------------------------------------------
// Main: Generate heats for a division
// ---------------------------------------------------------------------------

export function generateHeatsForDivision(divisionId) {
  // 1. Validate division
  const division = db.prepare(`
    SELECT d.id, d.competition_id, c.status, c.judge_count
    FROM division d
    JOIN competition c ON d.competition_id = c.id
    WHERE d.id = ?
  `).get(divisionId);

  if (!division) throw Object.assign(new Error('Division not found'), { status: 404 });
  if (!['DRAFT', 'ACTIVE'].includes(division.status)) {
    throw Object.assign(new Error('Competition must be DRAFT or ACTIVE'), { status: 400 });
  }

  // 2. Validate HEAD_JUDGE assigned
  const headJudge = db.prepare(
    "SELECT id FROM competition_staff WHERE competition_id = ? AND staff_role = 'HEAD_JUDGE'"
  ).get(division.competition_id);
  if (!headJudge) throw Object.assign(new Error('A Head Judge must be assigned first'), { status: 400 });

  // 3. Check for active heats (OPEN or higher)
  const activeHeat = db.prepare(`
    SELECT h.id, h.heat_number, h.status FROM heat h
    JOIN stage s ON h.stage_id = s.id
    WHERE s.division_id = ? AND h.status IN ('OPEN', 'HEAD_REVIEW', 'APPROVED', 'CLOSED')
    LIMIT 1
  `).get(divisionId);
  if (activeHeat) {
    throw Object.assign(
      new Error(`Cannot regenerate — active heats exist (Heat ${activeHeat.heat_number}: ${activeHeat.status})`),
      { status: 409 }
    );
  }

  // 4. Get confirmed athletes
  const athletes = db.prepare(`
    SELECT r.athlete_id, r.seed, u.name
    FROM registration r
    JOIN user u ON r.athlete_id = u.id
    WHERE r.division_id = ? AND r.status = 'CONFIRMED'
    ORDER BY
      CASE WHEN r.seed IS NULL THEN 1 ELSE 0 END,
      r.seed ASC,
      r.registered_at ASC
  `).all(divisionId);

  if (athletes.length < 3) {
    throw Object.assign(new Error(`Minimum 3 athletes required (found: ${athletes.length})`), { status: 400 });
  }

  // 5. Get format config
  const config = getFormatConfig(athletes.length);

  // 6. Run in transaction
  const generate = db.transaction(() => {
    // Delete existing PENDING heats for this division (regeneration)
    deleteHeatsForDivisionInternal(divisionId);

    let stagesCreated = 0;
    let heatsCreated = 0;

    config.forEach((stageConfig, idx) => {
      const stageId = uuidv4();
      const isFinal = stageConfig.type === 'FINAL';

      db.prepare(`
        INSERT INTO stage (id, competition_id, division_id, stage_type, stage_order,
                           runs_per_athlete, athletes_advance, status, distribution, reversed)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
      `).run(
        stageId,
        division.competition_id,
        divisionId,
        stageConfig.type,
        idx + 1,
        stageConfig.runsPerAthlete,
        stageConfig.qualifyTotal,
        stageConfig.distribution,
        stageConfig.reversed ? 1 : 0
      );
      stagesCreated++;

      // Create heat shells
      for (let h = 0; h < stageConfig.heatCount; h++) {
        const heatId = uuidv4();
        db.prepare(`
          INSERT INTO heat (id, stage_id, heat_number, status, published, run2_reorder)
          VALUES (?, ?, ?, 'PENDING', 0, ?)
        `).run(heatId, stageId, h + 1, isFinal ? 1 : 0);
        heatsCreated++;

        // Only populate QUALIFICATION heats with athletes
        if (stageConfig.type === 'QUALIFICATION') {
          const distributed = snakeDistribute(athletes, stageConfig.heatCount);
          const heatAthletes = distributed[h];

          const insertHeatAthlete = db.prepare(
            'INSERT INTO heat_athlete (id, heat_id, athlete_id, run_order) VALUES (?, ?, ?, ?)'
          );
          const insertAthleteRun = db.prepare(
            'INSERT INTO athlete_run (id, heat_id, athlete_id, run_number) VALUES (?, ?, ?, ?)'
          );

          heatAthletes.forEach((athlete, order) => {
            insertHeatAthlete.run(uuidv4(), heatId, athlete.athlete_id, order + 1);
            for (let run = 1; run <= stageConfig.runsPerAthlete; run++) {
              insertAthleteRun.run(uuidv4(), heatId, athlete.athlete_id, run);
            }
          });
        }
      }
    });

    return { stages_created: stagesCreated, heats_created: heatsCreated, format: formatDescription(config, athletes.length) };
  });

  return generate();
}

// ---------------------------------------------------------------------------
// Delete heats for a division
// ---------------------------------------------------------------------------

function deleteHeatsForDivisionInternal(divisionId) {
  // Get all stage IDs for this division
  const stageIds = db.prepare('SELECT id FROM stage WHERE division_id = ?').all(divisionId).map((r) => r.id);
  if (stageIds.length === 0) return;

  const heatIds = db.prepare(
    `SELECT id FROM heat WHERE stage_id IN (${stageIds.map(() => '?').join(',')})`
  ).all(...stageIds).map((r) => r.id);

  if (heatIds.length > 0) {
    const placeholders = heatIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM judge_score WHERE athlete_run_id IN (SELECT id FROM athlete_run WHERE heat_id IN (${placeholders}))`).run(...heatIds);
    db.prepare(`DELETE FROM athlete_run WHERE heat_id IN (${placeholders})`).run(...heatIds);
    db.prepare(`DELETE FROM heat_athlete WHERE heat_id IN (${placeholders})`).run(...heatIds);
    db.prepare(`DELETE FROM heat_result WHERE heat_id IN (${placeholders})`).run(...heatIds);
    db.prepare(`DELETE FROM heat WHERE id IN (${placeholders})`).run(...heatIds);
  }

  const stagePlaceholders = stageIds.map(() => '?').join(',');
  db.prepare(`DELETE FROM stage_ranking WHERE stage_id IN (${stagePlaceholders})`).run(...stageIds);
  db.prepare(`DELETE FROM stage WHERE id IN (${stagePlaceholders})`).run(...stageIds);
}

export function deleteHeatsForDivision(divisionId) {
  // Check for active heats first
  const activeHeat = db.prepare(`
    SELECT h.id, h.heat_number, h.status FROM heat h
    JOIN stage s ON h.stage_id = s.id
    WHERE s.division_id = ? AND h.status IN ('OPEN', 'HEAD_REVIEW', 'APPROVED', 'CLOSED')
    LIMIT 1
  `).get(divisionId);

  if (activeHeat) {
    throw Object.assign(
      new Error(`Cannot delete — active heats exist (Heat ${activeHeat.heat_number}: ${activeHeat.status})`),
      { status: 409 }
    );
  }

  const doDelete = db.transaction(() => {
    deleteHeatsForDivisionInternal(divisionId);
  });
  doDelete();
}

// Export for testing
export { getFormatConfig, snakeDistribute, ladderDistribute, stepladderDistribute };
