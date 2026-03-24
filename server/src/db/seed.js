import 'dotenv/config';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import db, { initDb } from './schema.js';

async function seed() {
  initDb();

  // Clear existing data
  db.exec(`
    DELETE FROM scores;
    DELETE FROM heat_athletes;
    DELETE FROM heats;
    DELETE FROM registrations;
    DELETE FROM categories;
    DELETE FROM competitions;
    DELETE FROM users;
  `);

  const hash = await bcrypt.hash('password123', 10);

  // Users
  const adminId = uuidv4();
  const judgeId = uuidv4();
  const athlete1Id = uuidv4();
  const athlete2Id = uuidv4();
  const athlete3Id = uuidv4();
  const athlete4Id = uuidv4();

  const insertUser = db.prepare(
    'INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)'
  );

  insertUser.run(adminId, 'admin@wakeboard.lt', hash, 'Admin User', 'admin');
  insertUser.run(judgeId, 'judge@wakeboard.lt', hash, 'Judge User', 'judge');
  insertUser.run(athlete1Id, 'athlete1@wakeboard.lt', hash, 'Jonas Jonaitis', 'athlete');
  insertUser.run(athlete2Id, 'athlete2@wakeboard.lt', hash, 'Petras Petraitis', 'athlete');
  insertUser.run(athlete3Id, 'athlete3@wakeboard.lt', hash, 'Lukas Lukauskas', 'athlete');
  insertUser.run(athlete4Id, 'athlete4@wakeboard.lt', hash, 'Tomas Tomaitis', 'athlete');

  // Competition
  const compId = uuidv4();
  db.prepare(
    'INSERT INTO competitions (id, name, date, location, status, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(compId, 'Lithuanian Wakeboard Open 2026', '2026-07-15', 'Vilnius Wake Park', 'open', adminId);

  // Categories
  const catOpenId = uuidv4();
  const catJuniorId = uuidv4();
  const insertCat = db.prepare(
    'INSERT INTO categories (id, competition_id, name) VALUES (?, ?, ?)'
  );
  insertCat.run(catOpenId, compId, 'Open');
  insertCat.run(catJuniorId, compId, 'Junior');

  // Registrations
  const insertReg = db.prepare(
    'INSERT INTO registrations (id, competition_id, category_id, user_id, status) VALUES (?, ?, ?, ?, ?)'
  );
  insertReg.run(uuidv4(), compId, catOpenId, athlete1Id, 'confirmed');
  insertReg.run(uuidv4(), compId, catOpenId, athlete2Id, 'confirmed');
  insertReg.run(uuidv4(), compId, catOpenId, athlete3Id, 'confirmed');
  insertReg.run(uuidv4(), compId, catJuniorId, athlete4Id, 'confirmed');

  console.log('Database seeded successfully');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
