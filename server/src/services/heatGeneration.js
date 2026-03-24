import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema.js';

/**
 * Generate heats for a competition category by splitting
 * confirmed athletes into groups of `athletesPerHeat`.
 */
export function generateHeats(competitionId, categoryId, athletesPerHeat = 4) {
  // Get confirmed registrations
  const athletes = db.prepare(`
    SELECT r.user_id FROM registrations r
    WHERE r.competition_id = ? AND r.category_id = ? AND r.status = 'confirmed'
  `).all(competitionId, categoryId);

  // Shuffle athletes randomly
  const shuffled = athletes.sort(() => Math.random() - 0.5);

  // Clear existing heats for this category/round
  const existingHeats = db.prepare(
    'SELECT id FROM heats WHERE competition_id = ? AND category_id = ? AND round = 1'
  ).all(competitionId, categoryId);

  for (const h of existingHeats) {
    db.prepare('DELETE FROM heat_athletes WHERE heat_id = ?').run(h.id);
  }
  db.prepare('DELETE FROM heats WHERE competition_id = ? AND category_id = ? AND round = 1')
    .run(competitionId, categoryId);

  // Create heats
  const heats = [];
  let heatNumber = 1;

  for (let i = 0; i < shuffled.length; i += athletesPerHeat) {
    const group = shuffled.slice(i, i + athletesPerHeat);
    const heatId = uuidv4();

    db.prepare('INSERT INTO heats (id, competition_id, category_id, round, heat_number) VALUES (?, ?, ?, 1, ?)')
      .run(heatId, competitionId, categoryId, heatNumber);

    const insertAthlete = db.prepare(
      'INSERT INTO heat_athletes (id, heat_id, user_id, ride_order) VALUES (?, ?, ?, ?)'
    );

    group.forEach((athlete, idx) => {
      insertAthlete.run(uuidv4(), heatId, athlete.user_id, idx + 1);
    });

    heats.push({ id: heatId, heat_number: heatNumber, athletes: group.length });
    heatNumber++;
  }

  return heats;
}
