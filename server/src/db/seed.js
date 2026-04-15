import 'dotenv/config';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import db, { initDb } from './schema.js';
import { generateHeatsForDivision } from '../services/heatGeneration.js';
import { submitScore, submitForReview, approveHeat, closeHeat } from '../services/scoringEngine.js';

async function seed() {
  // Drop all tables and recreate
  db.exec(`
    DROP TABLE IF EXISTS stage_ranking;
    DROP TABLE IF EXISTS heat_result;
    DROP TABLE IF EXISTS judge_score;
    DROP TABLE IF EXISTS athlete_run;
    DROP TABLE IF EXISTS heat_athlete;
    DROP TABLE IF EXISTS heat;
    DROP TABLE IF EXISTS stage;
    DROP TABLE IF EXISTS registration;
    DROP TABLE IF EXISTS competition_staff;
    DROP TABLE IF EXISTS division;
    DROP TABLE IF EXISTS competition;
    DROP TABLE IF EXISTS user;
  `);

  db.exec(`
    DROP INDEX IF EXISTS idx_division_competition;
    DROP INDEX IF EXISTS idx_registration_division;
    DROP INDEX IF EXISTS idx_stage_division;
    DROP INDEX IF EXISTS idx_heat_athlete_heat_id;
    DROP INDEX IF EXISTS idx_athlete_run_heat_athlete;
    DROP INDEX IF EXISTS idx_judge_score_run_id;
    DROP INDEX IF EXISTS idx_heat_result_heat_id;
    DROP INDEX IF EXISTS idx_stage_ranking_stage_rank;
  `);

  initDb();

  const hash = await bcrypt.hash('password123', 10);

  // ═══════════════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════════════
  const adminId = uuidv4();
  const headJudgeId = uuidv4();
  const judge1Id = uuidv4();
  const judge2Id = uuidv4();
  const judge3Id = uuidv4();

  const insertUser = db.prepare(
    'INSERT INTO user (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
  );

  insertUser.run(adminId, 'admin@wakeboard.lt', hash, 'Admin Vaitkus', 'ADMIN');
  insertUser.run(headJudgeId, 'headjudge@wakeboard.lt', hash, 'Rimas Kazlauskas', 'HEAD_JUDGE');
  insertUser.run(judge1Id, 'judge1@wakeboard.lt', hash, 'Tomas Jurkus', 'JUDGE');
  insertUser.run(judge2Id, 'judge2@wakeboard.lt', hash, 'Andrius Baltas', 'JUDGE');
  insertUser.run(judge3Id, 'judge3@wakeboard.lt', hash, 'Dainius Giedrius', 'JUDGE');

  // 20 Men athletes
  const menNames = [
    'Jonas Jonaitis', 'Petras Petraitis', 'Lukas Lukauskas',
    'Matas Matauskas', 'Karolis Karolaitis', 'Giedrius Giedraitis',
    'Tautvydas Tautvilas', 'Rokas Rokaitis', 'Domas Domaitis',
    'Paulius Paulauskas', 'Mantas Mantauskas',
    'Dovydas Dovydaitis', 'Eimantas Eimantauskas', 'Faustas Faustauskas',
    'Henrikas Henrikauskas', 'Ignas Ignauskas', 'Justinas Justinauskas',
    'Kipras Kiprauskas', 'Laurynas Laurynauskas', 'Nerijus Nerijauskas'
  ];
  const menIds = menNames.map((name, i) => {
    const id = uuidv4();
    insertUser.run(id, `athlete${i + 1}@wakeboard.lt`, hash, name, 'ATHLETE');
    return id;
  });

  // 8 Women athletes
  const womenNames = [
    'Gabija Gabijaitė', 'Austėja Austėjaitė', 'Ieva Ievaitė',
    'Emilija Emilijaitė', 'Kotryna Kotrynaitė', 'Ugnė Ugnaitė',
    'Rūta Rūtaitė', 'Simona Simonaitė'
  ];
  const womenIds = womenNames.map((name, i) => {
    const id = uuidv4();
    insertUser.run(id, `wathlete${i + 1}@wakeboard.lt`, hash, name, 'ATHLETE');
    return id;
  });

  const insertComp = db.prepare(`
    INSERT INTO competition (id, name, start_date, end_date, location, description, timetable, video_url, image_url, prize_pool, level, judge_count, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertDiv = db.prepare(
    'INSERT INTO division (id, competition_id, name, display_order) VALUES (?, ?, ?, ?)'
  );
  const insertStaff = db.prepare(
    'INSERT INTO competition_staff (id, competition_id, user_id, staff_role) VALUES (?, ?, ?, ?)'
  );
  const insertReg = db.prepare(
    'INSERT INTO registration (id, competition_id, division_id, athlete_id, status, seed) VALUES (?, ?, ?, ?, ?, ?)'
  );

  // Helper: generate heats, publish, set schedule
  function setupCompetition(compId, divIds) {
    const results = {};
    for (const divId of divIds) {
      try {
        results[divId] = generateHeatsForDivision(divId);
      } catch (err) {
        console.error(`  Heat generation failed for ${divId}:`, err.message);
      }
    }

    db.prepare(`
      UPDATE heat SET published = 1
      WHERE id IN (SELECT h.id FROM heat h JOIN stage s ON h.stage_id = s.id WHERE s.competition_id = ?)
    `).run(compId);

    const allStages = db.prepare(`
      SELECT s.id FROM stage s
      JOIN division d ON s.division_id = d.id
      WHERE s.competition_id = ?
      ORDER BY s.stage_order, d.display_order
    `).all(compId);

    let order = 1;
    for (const stage of allStages) {
      const heats = db.prepare('SELECT id FROM heat WHERE stage_id = ? ORDER BY heat_number').all(stage.id);
      for (const heat of heats) {
        db.prepare('UPDATE heat SET schedule_order = ? WHERE id = ?').run(order++, heat.id);
      }
    }

    return results;
  }

  // Helper: score all runs in a single heat with random scores
  function scoreHeatRuns(heatId, judgeIds) {
    const randomScore = () => Math.round((Math.random() * 40 + 55) * 2) / 2; // 55-95 range
    const runs = db.prepare(
      'SELECT id FROM athlete_run WHERE heat_id = ? ORDER BY athlete_id, run_number'
    ).all(heatId);
    for (const run of runs) {
      for (const judgeId of judgeIds) {
        submitScore(run.id, judgeId, randomScore(), null);
      }
    }
  }

  // Helper: process single heat lifecycle (open → score → review → approve → close)
  function processHeatLifecycle(heatId, judgeIds) {
    const athletes = db.prepare(
      'SELECT athlete_id FROM heat_athlete WHERE heat_id = ?'
    ).all(heatId);
    if (athletes.length === 0) return;

    db.prepare("UPDATE heat SET status = 'OPEN' WHERE id = ?").run(heatId);
    scoreHeatRuns(heatId, judgeIds);
    submitForReview(heatId, judgeIds[0]);
    approveHeat(heatId, judgeIds[0], null);
    closeHeat(heatId, judgeIds[0], null);
  }

  // Helper: score and process all heats for a competition (for COMPLETED comps)
  function scoreEntireCompetition(compId, judgeIds) {
    const divs = db.prepare(
      'SELECT id FROM division WHERE competition_id = ? ORDER BY display_order'
    ).all(compId);

    for (const div of divs) {
      const divStages = db.prepare(
        'SELECT id FROM stage WHERE division_id = ? ORDER BY stage_order'
      ).all(div.id);

      // Activate first stage of each division
      if (divStages.length > 0) {
        db.prepare("UPDATE stage SET status = 'ACTIVE' WHERE id = ?").run(divStages[0].id);
      }

      for (const stage of divStages) {
        // Re-read stage status (may have been activated by previous stage completion)
        const currentStage = db.prepare('SELECT status FROM stage WHERE id = ?').get(stage.id);
        if (currentStage.status !== 'ACTIVE') continue;

        const heats = db.prepare(
          'SELECT id FROM heat WHERE stage_id = ? ORDER BY heat_number'
        ).all(stage.id);

        for (const heat of heats) {
          processHeatLifecycle(heat.id, judgeIds);
        }
      }
    }

    // Set competition to COMPLETED
    db.prepare("UPDATE competition SET status = 'COMPLETED' WHERE id = ?").run(compId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPETITION 1: Baltic Wakeboard Championship — COMPLETED with scores
  // ═══════════════════════════════════════════════════════════════════════
  console.log('--- Creating Competition 1: Baltic Wakeboard Championship (COMPLETED) ---');

  const comp1Id = uuidv4();
  insertComp.run(
    comp1Id,
    'Baltic Wakeboard Championship 2026',
    '2026-06-05',
    '2026-06-07',
    'Klaipėda Sea Park',
    'The premier Baltic wakeboard championship bringing together top riders from Lithuania, Latvia, and Estonia. Three days of intense competition across two divisions with IWWF-compliant judging and live scoring.',
    'DAY 1 — June 5\n09:00 — Opening Ceremony\n09:30 — Men Qualification\n11:00 — Women Qualification\n12:00 — Lunch Break\n13:00 — Men Final\n14:30 — Women Final\n16:00 — Award Ceremony',
    null,
    'https://images.unsplash.com/photo-1530870110042-98b2cb110834?w=1200&q=80',
    '€3,000',
    'Regional',
    2,
    'ACTIVE', // will be set to COMPLETED after scoring
    adminId
  );

  const c1DivMen = uuidv4();
  const c1DivWomen = uuidv4();
  insertDiv.run(c1DivMen, comp1Id, 'Open Men', 1);
  insertDiv.run(c1DivWomen, comp1Id, 'Open Women', 2);

  insertStaff.run(uuidv4(), comp1Id, headJudgeId, 'HEAD_JUDGE');
  insertStaff.run(uuidv4(), comp1Id, judge1Id, 'JUDGE');

  // 6 men + 6 women → simple format: QUAL(1) + FINAL(1)
  menIds.slice(0, 6).forEach((id, i) => insertReg.run(uuidv4(), comp1Id, c1DivMen, id, 'CONFIRMED', i + 1));
  womenIds.slice(0, 6).forEach((id, i) => insertReg.run(uuidv4(), comp1Id, c1DivWomen, id, 'CONFIRMED', i + 1));

  setupCompetition(comp1Id, [c1DivMen, c1DivWomen]);

  // Score all heats and complete
  scoreEntireCompetition(comp1Id, [headJudgeId, judge1Id]);
  console.log('  Scored and completed all heats.');

  // ═══════════════════════════════════════════════════════════════════════
  // COMPETITION 2: Lithuanian Wakeboard Open — ACTIVE
  // ═══════════════════════════════════════════════════════════════════════
  console.log('--- Creating Competition 2: Lithuanian Wakeboard Open (ACTIVE) ---');

  const comp2Id = uuidv4();
  insertComp.run(
    comp2Id,
    'Lithuanian Wakeboard Open 2026',
    '2026-07-15',
    '2026-07-17',
    'Vilnius Wake Park',
    'Prepare for the most prestigious wakeboarding event in the Baltics. The Lithuanian Wakeboard Open brings together athletes from across the region to showcase their talent and compete for a three-day showcase of extreme water sports.\n\nHosted at the premier Vilnius Wake Park, this competition features IWWF-compliant format with qualification rounds, last chance qualifiers, and an exciting final.',
    'DAY 1 — July 15\n09:00 — Opening Ceremony\n09:30 — Men Qualification Heat 1\n10:15 — Men Qualification Heat 2\n11:00 — Women Qualification Heat 1\n12:00 — Lunch Break\n13:00 — Men LCQ Heat 1\n13:45 — Men LCQ Heat 2\n14:30 — Women Final\n15:30 — Men Final\n16:30 — Award Ceremony',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1610665905070-959e6d7ccefa?w=1200&q=80',
    '€5,000',
    'National',
    2,
    'ACTIVE',
    adminId
  );

  const c2DivMen = uuidv4();
  const c2DivWomen = uuidv4();
  insertDiv.run(c2DivMen, comp2Id, 'Open Men', 1);
  insertDiv.run(c2DivWomen, comp2Id, 'Open Women', 2);

  insertStaff.run(uuidv4(), comp2Id, headJudgeId, 'HEAD_JUDGE');
  insertStaff.run(uuidv4(), comp2Id, judge1Id, 'JUDGE');

  menIds.slice(0, 11).forEach((id, i) => insertReg.run(uuidv4(), comp2Id, c2DivMen, id, 'CONFIRMED', i + 1));
  womenIds.slice(0, 6).forEach((id, i) => insertReg.run(uuidv4(), comp2Id, c2DivWomen, id, 'CONFIRMED', i + 1));

  const c2Results = setupCompetition(comp2Id, [c2DivMen, c2DivWomen]);

  // ═══════════════════════════════════════════════════════════════════════
  // COMPETITION 3: Kaunas Wakeboard Cup — DRAFT (upcoming)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('--- Creating Competition 3: Kaunas Wakeboard Cup (DRAFT) ---');

  const comp3Id = uuidv4();
  insertComp.run(
    comp3Id,
    'Kaunas Wakeboard Cup 2026',
    '2026-08-20',
    '2026-08-21',
    'Kaunas Reservoir',
    'The biggest wakeboard competition in the Baltic region returns for its 5th edition! Featuring athletes across two divisions, the Kaunas Wakeboard Cup brings together the best riders from Lithuania, Latvia, Estonia, and Poland.\n\nWith a €10,000 prize pool and international-level judging, this is the must-attend event of the summer.',
    'DAY 1 — August 20\n08:30 — Registration & Check-in\n09:00 — Men Qualification Heats\n11:00 — Women Qualification Heats\n12:00 — Lunch Break\n\nDAY 2 — August 21\n09:00 — Men LCQ & Semi-finals\n12:00 — Women Final\n14:00 — Men Final\n15:30 — Award Ceremony',
    null,
    'https://images.unsplash.com/photo-1774804819042-3e688108c50f?w=1200&q=80',
    '€10,000',
    'International',
    2,
    'DRAFT',
    adminId
  );

  const c3DivMen = uuidv4();
  const c3DivWomen = uuidv4();
  insertDiv.run(c3DivMen, comp3Id, 'Open Men', 1);
  insertDiv.run(c3DivWomen, comp3Id, 'Open Women', 2);

  // Register athletes but no heats generated (DRAFT)
  menIds.forEach((id, i) => insertReg.run(uuidv4(), comp3Id, c3DivMen, id, 'CONFIRMED', i + 1));
  womenIds.forEach((id, i) => insertReg.run(uuidv4(), comp3Id, c3DivWomen, id, 'CONFIRMED', i + 1));

  // ═══════════════════════════════════════════════════════════════════════
  // COMPETITION 4: Vilnius Wake Festival — DRAFT (upcoming)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('--- Creating Competition 4: Vilnius Wake Festival (DRAFT) ---');

  const comp4Id = uuidv4();
  insertComp.run(
    comp4Id,
    'Vilnius Wake Festival 2026',
    '2026-09-10',
    '2026-09-12',
    'Vilnius Wake Park',
    'A fun and inclusive wakeboard festival for riders of all levels! The Vilnius Wake Festival combines competitive wakeboarding with music, food, and entertainment. Whether you are a seasoned pro or trying wakeboarding for the first time, this event has something for everyone.',
    'DAY 1 — September 10\n10:00 — Registration & Open Practice\n14:00 — Men Qualification\n\nDAY 2 — September 11\n10:00 — Women Qualification\n14:00 — Men & Women Finals\n\nDAY 3 — September 12\n10:00 — Awards & Best Trick Contest\n14:00 — Festival & Afterparty',
    null,
    'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=1200&q=80',
    '€2,000',
    'National',
    2,
    'DRAFT',
    adminId
  );

  const c4DivMen = uuidv4();
  const c4DivWomen = uuidv4();
  insertDiv.run(c4DivMen, comp4Id, 'Open Men', 1);
  insertDiv.run(c4DivWomen, comp4Id, 'Open Women', 2);

  menIds.slice(0, 8).forEach((id, i) => insertReg.run(uuidv4(), comp4Id, c4DivMen, id, 'CONFIRMED', i + 1));
  womenIds.slice(0, 4).forEach((id, i) => insertReg.run(uuidv4(), comp4Id, c4DivWomen, id, 'CONFIRMED', i + 1));

  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('Database seeded successfully');
  console.log('');
  console.log('=== Test Accounts ===');
  console.log('  Admin:       admin@wakeboard.lt / password123');
  console.log('  Head Judge:  headjudge@wakeboard.lt / password123');
  console.log('  Judges:      judge1-3@wakeboard.lt / password123');
  console.log('  Men athletes:   athlete1-20@wakeboard.lt / password123');
  console.log('  Women athletes: wathlete1-8@wakeboard.lt / password123');
  console.log('');
  console.log('=== Competitions ===');
  console.log('  1. Baltic Wakeboard Championship 2026 — COMPLETED (with scores)');
  console.log('  2. Lithuanian Wakeboard Open 2026 — ACTIVE');
  console.log('  3. Kaunas Wakeboard Cup 2026 — DRAFT (upcoming)');
  console.log('  4. Vilnius Wake Festival 2026 — DRAFT (upcoming)');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
