# WakeBoard Competition System — Claude Code Context

## What this project is

A web platform for managing wakeboard competitions. It handles athlete registration,
automatic heat generation (IWWF rules), live judge scoring, and real-time public
leaderboards. Built as a bachelor's thesis project at VGTU.

## Stack

- **Frontend**: React + Vite + TailwindCSS + socket.io-client
- **Backend**: Node.js + Express + better-sqlite3 + socket.io
- **Auth**: JWT + bcrypt
- **DB**: SQLite (dev) → PostgreSQL (prod)
- **IDs**: UUID everywhere (use the `uuid` package, never auto-increment)

## Monorepo structure

```
/client       React frontend
  /src
    api.js              Fetch wrapper with auth headers
    App.jsx             Routes + AuthProvider
    context/
      AuthContext.jsx    JWT auth state management
    components/
      Navbar.jsx
      StatusBadge.jsx
      LoadingSpinner.jsx
      ProtectedRoute.jsx
      admin/
        CompetitionForm.jsx
        StaffSection.jsx
        DivisionsSection.jsx
        RegistrationsSection.jsx
        HeatsSection.jsx      Sprint 3: heat generation UI
        StagePanel.jsx        Sprint 3: renders stage with heats
        HeatCard.jsx          Sprint 3: renders single heat
    pages/
      HomePage.jsx
      CompetitionDetailPage.jsx
      LoginPage.jsx
      RegisterPage.jsx
      admin/
        AdminDashboard.jsx
        AdminCompetitionDetail.jsx

/server       Node.js backend
  /src
    index.js            Express entry + Socket.IO setup
    db/
      schema.js         All CREATE TABLE statements (12 tables)
      seed.js           Test data + heat generation for dev
    routes/
      auth.js           Register, login, create-staff
      competitions.js   CRUD + status + staff management
      divisions.js      Division CRUD per competition
      registrations.js  Per-division registration
      heats.js          Heat generation, publish, athlete swap
      scores.js         Score submission + leaderboard (stubs for Sprint 4)
    middleware/
      auth.js           JWT verify + role guard
    services/
      heatGeneration.js IWWF heat generation engine (Sprint 3 — COMPLETE)
      scoringEngine.js  Score aggregation + ranking (Sprint 4 — STUB)
```

## Roles

Four roles enforced via JWT middleware:

- `ADMIN` — organiser, manages everything
- `HEAD_JUDGE` — scores like a judge + can approve/close heats + drag-reorder ranking
- `JUDGE` — scores all heats in their assigned competition
- `ATHLETE` — registers, views schedule and results

Public routes (no auth): `GET /competitions`, `GET /competitions/:id`,
`GET /competitions/:id/live`

## Database rules

- All primary keys are UUID (TEXT). Use `uuid` package: `import { v4 as uuidv4 } from 'uuid'`
- Enums stored as TEXT with CHECK constraints
- Never use auto-increment IDs
- Unique constraints: `registration(division_id, athlete_id)` and `judge_score(athlete_run_id, judge_id)`
- All score math happens in SQL with ROUND(AVG(score), 2) — never in JavaScript
- ES modules throughout server (`import`/`export`, `"type": "module"` in package.json)

## The 12 tables

```
user, competition, division, competition_staff, registration,
stage, heat, heat_athlete, athlete_run, judge_score,
heat_result, stage_ranking
```

Key relationships:
- `competition 1──* division 1──* registration`
- `division 1──* stage 1──* heat 1──* heat_athlete`
- `heat 1──* athlete_run 1──* judge_score`
- `heat 1──* heat_result` (written at APPROVED)
- `stage 1──* stage_ranking` (updated at each APPROVED)

Important columns added in Sprint 3:
- `stage.reversed` — 1 for QF/Semi/Finals (best-ranked rides last)
- `heat.run2_reorder` — 1 for Finals only (Run 2 order based on Run 1 scores)

## Multi-Division System

Competitions have multiple divisions (Open Men, Veterans, Junior, etc.).
Each division runs its own independent stage/heat pipeline.
Athletes can register for multiple divisions in the same competition.
Staff (judges, head judge) are assigned at competition level, not per division.
Registration unique constraint: `(division_id, athlete_id)`.

## Heat Generation — IWWF Format (from official IWWF Cablewakeboard document)

The complete lookup table is hardcoded in `server/src/services/heatGeneration.js`.
Max 6 athletes per heat. No upper limit on athletes (extends algorithmically for 55+).

```
3–6:   QUAL(1) + FINAL(1)
7–10:  QUAL(2, top 4) + LCQ(1, top 2, 1 run, LADDER) + FINAL(1)
11–12: QUAL(2, top 4) + LCQ(2, top 2, 1 run, STEPLADDER) + FINAL(1)
13–18: QUAL(3, top 3) + LCQ(3, top 3, 1 run, STEPLADDER) + FINAL(1)
19–20: QUAL(4, top 8) + LCQ(2, top 4) + SEMI(2, top 6) + FINAL(1)
21–24: QUAL(4, top 8) + LCQ(4, top 4) + SEMI(2, top 6) + FINAL(1)
25–36: QUAL(6, top 6) + LCQ(6, top 6) + SEMI(2, top 6) + FINAL(1)
37–40: QUAL(8, top 16) + LCQ(4, top 8) + QF(4, top 12) + SEMI(2, top 6) + FINAL(1)
41–48: QUAL(8, top 16) + LCQ(8, top 8) + QF(4, top 12) + SEMI(2, top 6) + FINAL(1)
49–54: QUAL(9, top 18) + LCQ(6, top 6) + QF(4, top 12) + SEMI(2, top 6) + FINAL(1)
55+:   Extended pattern — more qual heats, adjust LCQ heats, QF/Semi/Final fixed
```

Distribution algorithms:
- **SNAKE** (Qualification): zigzag seeding — top seeds spread evenly across heats
- **LADDER** (Finals 3-10, LCQ 7-10): sequential, best-ranked rides last
- **STEPLADDER** (LCQ 11+, QF, Semi): weakest in earliest heats, strongest in latest

At generation time, only QUALIFICATION heats get athletes assigned.
LCQ/Semi/QF/Final heats are created as empty shells — populated after preceding stage completes.

### Finals Run 2 Reorder (Finals ONLY)
After Run 1 scores are computed, athletes are reordered for Run 2:
lowest Run 1 score rides first, highest rides last. This is marked by `heat.run2_reorder = 1`.

## Scoring rules

1. Judges score one athlete at a time as they ride (sequential, not batch)
2. Score range: 0.0–100.0. 0 is valid (no-show athlete). Reject outside range with 400.
3. Upsert judge_score — never duplicate (athlete_run_id, judge_id)
4. On each INSERT: increment athlete_run.scores_submitted
5. When scores_submitted = competition.judge_count:
   - SET computed_score = ROUND(AVG(score), 2)
   - Emit `score:computed` via Socket.IO to competition room
6. Score only visible on public page once computed_score is non-null
7. FRS = Run 1 is best score. SRS = Run 2 is best score.

## Heat status machine

```
PENDING → OPEN → HEAD_REVIEW → APPROVED → CLOSED
```

CORRECTION_REQUESTED is a sub-state of HEAD_REVIEW (judge must fix a flagged score).
APPROVED → HEAD_REVIEW is valid (rollback before CLOSED).
No other transitions are valid. Enforce in the route handlers.

## Head Judge approval

1. All computed_scores must be non-null (0.0 is fine, NULL blocks approval)
2. Compute best_score = MAX(run1, run2) per athlete
3. Default rank = ORDER BY best_score DESC, second_score DESC
4. Head Judge can override with PATCH /heats/:id/ranking before approving
5. final_rank on heat_result is the source of truth for advancement
6. On approve: write heat_result rows, upsert stage_ranking, emit heat:approved + leaderboard:updated

## WebSocket events (Socket.IO rooms = competition_id)

```
score:computed       { athlete_run_id, athlete_id, run_number, heat_id, computed_score }
heat:approved        { heat_id, results: [{ athlete_id, best_score, final_rank }] }
heat:closed          { heat_id, stage_id }
leaderboard:updated  { stage_id, rankings: [{ athlete_id, score, rank }] }
correction:requested { judge_id, athlete_run_id, note }  — sent to that judge only
```

## API conventions

- All responses are JSON
- Errors: `{ "error": "message" }` with appropriate HTTP status
- Success creates: 201. Success reads/updates: 200
- Auth header: `Authorization: Bearer <token>`
- Dates: ISO 8601 strings
- IDs in responses always called `id`, foreign keys called `entity_id` (e.g. `competition_id`)

## Key validation rules (enforce in routes, not just frontend)

| Check | Error | Status |
|---|---|---|
| score outside 0–100 | Score must be between 0 and 100 | 400 |
| judge_score on non-OPEN heat | Heat is not accepting scores | 403 |
| approve with any null computed_score | Missing scores for: [list] | 409 |
| close without approving first | Heat must be approved before closing | 400 |
| duplicate registration | Athlete already registered | 409 |
| generate heats with no HEAD_JUDGE | A Head Judge must be assigned first | 400 |
| generate heats with < 3 athletes | Minimum 3 athletes required | 400 |
| regenerate with any OPEN+ heat | Cannot regenerate — active heats exist | 409 |

## What NOT to do

- Never compute score averages in JavaScript — always SQL ROUND(AVG(), 2)
- Never auto-increment IDs — always UUID
- Never block approval for 0.0 scores — only NULL blocks it
- Never add DNS/DNF status fields — judges enter 0 for no-shows
- Never build automatic tiebreak logic — Head Judge drags ranking manually
- Never let frontend be the only validation — backend must validate independently

## Coding style

- ES modules everywhere: `import`/`export` (both client and server)
- Async/await everywhere, no raw Promise chains
- Route files export a router, import into index.js
- Services contain business logic — routes are thin (validate → call service → respond)
- Environment variables via dotenv — never hardcode secrets
- All DB queries in the service layer, never in route handlers

## Environment variables (server/.env)

```
PORT=3001
JWT_SECRET=your_secret_here
DB_PATH=./wakeboard.db
```

## Dev commands

```bash
# From root
npm run dev          # runs client + server concurrently

# Client only (port 5173)
cd client && npm run dev

# Server only (port 3001)
cd server && npm run dev

# Run seed data
cd server && node src/db/seed.js
```

## Sprint progress

### Sprint 1 (DONE) — Scaffold, DB schema, JWT auth
- Monorepo with npm workspaces
- 12-table SQLite schema with UUIDs, CHECK constraints, indexes
- JWT auth: register, login, /auth/me, create-staff
- Role middleware (ADMIN, HEAD_JUDGE, JUDGE, ATHLETE)
- Seed script

### Sprint 2 (DONE) — Public pages, admin, divisions, registration
- Public home page + competition detail
- Multi-division system (division table, per-division registration)
- Admin dashboard + competition management (CRUD, status, staff, divisions, registrations)
- Athlete registration per division
- Login/Register pages, Navbar, AuthContext, ProtectedRoute

### Sprint 3 (DONE) — IWWF heat generation engine
- Full IWWF format lookup table (3-54 athletes + algorithmic extension for 55+)
- Snake, Ladder, Stepladder distribution algorithms
- `generateHeatsForDivision(divisionId)` — validates, creates stages/heats/athletes/runs
- `deleteHeatsForDivision(divisionId)` — FK-safe cleanup
- Routes: POST /heats/generate, DELETE /heats/division/:id, PATCH /publish-stage, PATCH /athletes
- Schema additions: stage.reversed, heat.run2_reorder
- Admin UI: HeatsSection, StagePanel, HeatCard components
- Seed data generates heats for Open Men division

### Sprint 4 (NEXT) — Scoring engine + Head Judge approval + manual reorder
See WakeBoard_MASTER.pdf sections 7.3 and 7.4 for exact prompts.
Key features:
- POST /scores — upsert judge_score, trigger computed_score
- Heat lifecycle: review, approve (with manual reorder), close
- Stage progression: advance athletes to next stage after all heats closed
- Populate LCQ/Semi/QF/Final heats using ladder/stepladder distribution
- Finals Run 2 reorder (heat.run2_reorder = 1)
- Socket.IO events: score:computed, heat:approved, leaderboard:updated
- Judge scoring UI, Head Judge approval UI

## Test accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@wakeboard.lt | password123 |
| Head Judge | headjudge@wakeboard.lt | password123 |
| Judge 1 | judge1@wakeboard.lt | password123 |
| Judge 2 | judge2@wakeboard.lt | password123 |
| Judge 3 | judge3@wakeboard.lt | password123 |
| Athletes | athlete1-10@wakeboard.lt | password123 |
