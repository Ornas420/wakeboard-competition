# WakeScore — Competition Management System

## What this project is

A web platform for managing wakeboard competitions (WakeScore). It handles athlete registration,
automatic IWWF-compliant heat generation, live judge scoring, real-time public scoreboards,
and stage progression with per-heat advancement. Built as a bachelor's thesis project at VGTU.

## Stack

- **Frontend**: React 19 + Vite + TailwindCSS + socket.io-client
- **Backend**: Node.js + Express + better-sqlite3 + socket.io
- **Auth**: JWT + bcrypt
- **DB**: SQLite (dev) → PostgreSQL (prod)
- **IDs**: UUID everywhere (use the `uuid` package, never auto-increment)
- **Font**: Inter (Google Fonts)
- **Theme**: Dark navy (#1a1a2e) + accent teal (#00b4d8)

## Monorepo structure

```
/client       React frontend
  /src
    api.js              Fetch wrapper with auth headers
    App.jsx             Routes + AuthProvider + SocketProvider
    index.css           Tailwind + Inter font base styles
    context/
      AuthContext.jsx    JWT auth state management
      SocketContext.jsx  Shared Socket.IO connection (env-configurable URL)
    components/
      Navbar.jsx         Dark scroll-aware navbar, mobile hamburger
      Footer.jsx         Dark navy footer with link columns
      StatusBadge.jsx    Color-coded status pills
      LoadingSpinner.jsx Animated spinner
      ProtectedRoute.jsx Auth guards (ProtectedRoute + RoleRoute)
      admin/
        CompetitionForm.jsx    Create/edit competition (all fields incl. image, prize, level)
        StaffSection.jsx       Dropdown picker + create judge form (no UUIDs)
        DivisionsSection.jsx   Division CRUD
        RegistrationsSection.jsx  Registration table + "Add Athlete" (existing or guest)
        HeatsSection.jsx       Heat generation UI
        ScheduleSection.jsx    Draggable global heat order
        StagePanel.jsx         Renders stage with heats
        HeatCard.jsx           Renders single heat
    utils/
      format.js             Shared: formatDateRange, STAGE_LABELS, GRADIENTS, getHeatStatusColor
      format.test.js        26 frontend unit tests
    pages/
      HomePage.jsx              Landing: hero, active comp slider, card grid, results
      BrowseCompetitionsPage.jsx All competitions with filters (status, date, level)
      CompetitionDetailPage.jsx Hero banner, overview, stats, divisions, schedule sidebar
      LoginPage.jsx
      RegisterPage.jsx
      LivePage.jsx              Public live scoreboard, heat ranking sidebar, competition schedule
      JudgeCompetitionsPage.jsx Judge's assigned competitions list
      JudgeScoringPage.jsx      Sequential scoring UI + Head Judge panel
      admin/
        AdminDashboard.jsx
        AdminCompetitionDetail.jsx

/server       Node.js backend
  /src
    index.js            Express entry + Socket.IO setup (rooms: competition, judge)
    db/
      schema.js         All CREATE TABLE statements (12 tables + indexes)
      seed.js           2 competitions, 20 men + 8 women athletes, full data
    routes/
      auth.js           Register, login, create-staff, /judges, /athletes
      competitions.js   CRUD + status + staff + my-assignments + live-data
      divisions.js      Division CRUD per competition
      registrations.js  Per-division registration + admin registration (guest athletes)
      heats.js          Generation, publish, swap, schedule, status, reset, review, ranking, approve, close
      scores.js         Score submission + correction-request + leaderboard
    middleware/
      auth.js           JWT verify + role guard
    services/
      heatGeneration.js IWWF heat generation engine (complete, JSDoc)
      scoringEngine.js  Score submission, approval, stage progression (complete, JSDoc)
    utils/
      events.js         Socket.IO event name constants (EVENTS object)
  test.js               140 E2E integration tests across 9 scenarios
  test.unit.js          223 unit tests (pure logic: algorithms, formats, constants)
```

## Roles

Four roles enforced via JWT middleware:

- `ADMIN` — organiser, manages everything, creates judge/athlete accounts
- `HEAD_JUDGE` — scores like a judge + opens heats + reviews/approves/closes + drag-reorder ranking + correction requests
- `JUDGE` — scores the currently open heat only (locked to active heat)
- `ATHLETE` — registers, views schedule and results

Public routes (no auth): `GET /competitions`, `GET /competitions/:id`,
`GET /competitions/:id/live`, `GET /competitions/:id/live-data`, `/browse`

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

### Competition table columns
```
id, name, start_date, end_date, location, description, timetable, video_url, image_url,
prize_pool, level, judge_count (1–5), status, created_by, created_at
```

### Heat table columns
```
id, stage_id, heat_number, status, published, manually_adjusted,
run2_reorder, scheduled_time, schedule_order
```

Important flags:
- `stage.reversed` — 1 for QF/Semi/Finals (best-ranked rides last)
- `heat.run2_reorder` — 1 for Finals only (Run 2 order based on Run 1 scores)
- `heat.schedule_order` — global execution order set by admin

## Multi-Division System

Competitions have multiple divisions (Open Men, Open Women, Junior, etc.).
Each division runs its own independent stage/heat pipeline.
Athletes can register for multiple divisions in the same competition.
Staff (judges, head judge) are assigned at competition level, not per division.
Registration unique constraint: `(division_id, athlete_id)`.

## Heat Generation — IWWF Format

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

### Stage Progression — Per-Heat Advancement
- Advancement is **per-heat**: top N from each heat advance (not a global leaderboard)
- Athletes are **interleaved by rank** across heats when advancing (rank 1s first, rank 2s next, etc.)
- **QUAL → LCQ**: non-qualifiers go to LCQ (interleaved by rank). Qualifiers wait.
- **LCQ → next stage**: LCQ heat winners combine with QUAL qualifiers → populate SEMI/FINAL
- **SEMI → FINAL**: per-heat advancers interleaved by rank, distributed via LADDER
- Next-stage heats are **auto-published** after advancement

### Finals Run 2 Reorder (Finals ONLY)
After Run 1 scores are computed, athletes are reordered for Run 2:
lowest Run 1 score rides first, highest rides last. This is marked by `heat.run2_reorder = 1`.

## Scoring rules

1. Judges score one athlete at a time as they ride (sequential, not batch)
2. Score range: 0.0–100.0. 0 is valid (no-show athlete). Reject outside range with 400.
3. Upsert judge_score — never duplicate (athlete_run_id, judge_id)
4. On each INSERT: increment athlete_run.scores_submitted
5. When scores_submitted = competition.judge_count:
   - SET computed_score = ROUND(AVG(score), 2) — always in SQL
   - Emit `score:computed` via Socket.IO to competition room
6. Score only visible on public page once computed_score is non-null
7. FRS = Run 1 is best score. SRS = Run 2 is best score.

## Heat status machine

```
PENDING → OPEN → HEAD_REVIEW → APPROVED → CLOSED
```

Additional transitions:
- `OPEN → PENDING` (undo open, only if no scores)
- `APPROVED → HEAD_REVIEW` (rollback/reopen, deletes all scores)
- `Any non-CLOSED → PENDING` via POST /heats/:id/reset (wipes all scores)

CORRECTION_REQUESTED is a sub-state of HEAD_REVIEW (judge must fix a flagged score).

## Judge Scoring Flow

1. **No heat open** → Judge sees "Waiting for Head Judge" screen
2. **Heat opened** → Judge auto-enters scoring UI (no navigation, locked to active heat)
3. **Scoring** → Sequential one-athlete-at-a-time: score input, submit, auto-advance
4. **Runs completed** → Head Judge submits for review
5. **HEAD_REVIEW** → Judges see waiting screen. Head Judge sees score review table with Flag buttons
6. **Correction** → Flagged judge gets instant popup modal to fix one score
7. **Approved/Closed** → Judges locked out, Head Judge closes heat

## Head Judge Panel

- Opens heats (PENDING → OPEN)
- Scores like a regular judge
- Score review table showing all judges' individual scores with names
- Flag scores for correction (sends instant popup to that judge)
- Self-correction (flag own score, inline edit)
- Draggable ranking reorder before approval
- Review → Approve → Close flow
- Reset heat (wipe all scores, return to PENDING)

## WebSocket events (Socket.IO rooms = competition_id)

```
score:computed       { athlete_run_id, athlete_id, run_number, heat_id, computed_score }
score:submitted      { athlete_run_id, heat_id }  — triggers refetch on all clients
heat:approved        { heat_id, results: [{ athlete_id, best_score, final_rank }] }
heat:closed          { heat_id, stage_id }
heat:opened          { heat_id }
heat:status_changed  { heat_id, status }
leaderboard:updated  { stage_id, rankings: [{ athlete_id, score, rank }] }
correction:requested { judge_id, athlete_run_id, note }  — sent to judge:{userId} room only
```

## API Endpoints (30 total)

### Auth (4)
- `POST /auth/register` — public, creates ATHLETE
- `POST /auth/login` — public, returns JWT
- `GET /auth/me` — authenticated, returns profile
- `POST /auth/create-staff` — ADMIN, creates JUDGE/HEAD_JUDGE
- `GET /auth/judges` — ADMIN, lists all judge users
- `GET /auth/athletes` — ADMIN, lists all athlete users

### Competitions (10)
- `GET /competitions` — public list
- `GET /competitions/:id` — public detail
- `GET /competitions/:id/live-data` — public, optimized bulk data for live page
- `GET /competitions/my-assignments` — JUDGE/HEAD_JUDGE, assigned competitions
- `POST /competitions` — ADMIN, create
- `PATCH /competitions/:id` — ADMIN, edit fields
- `PATCH /competitions/:id/status` — ADMIN, status transitions
- `POST /competitions/:id/staff` — ADMIN, assign judge
- `GET /competitions/:id/staff` — ADMIN, list staff
- `DELETE /competitions/:id/staff/:userId` — ADMIN, remove staff

### Divisions (4)
- `GET /competitions/:id/divisions` — public
- `POST /competitions/:id/divisions` — ADMIN
- `PATCH /competitions/:id/divisions/:divisionId` — ADMIN
- `DELETE /competitions/:id/divisions/:divisionId` — ADMIN

### Registrations (5)
- `GET /registrations/competition/:id` — ADMIN
- `POST /registrations` — ATHLETE, self-register
- `POST /registrations/admin` — ADMIN, register existing athlete or create guest
- `PATCH /registrations/:id` — ADMIN, change status
- `PATCH /registrations/:id/seed` — ADMIN, set seed
- `DELETE /registrations/:id` — ADMIN

### Heats (11)
- `GET /heats/competition/:id` — authenticated
- `POST /heats/generate` — ADMIN
- `DELETE /heats/division/:id` — ADMIN
- `PATCH /heats/schedule` — ADMIN, batch set schedule_order
- `PATCH /heats/publish-stage/:stageId` — ADMIN
- `PATCH /heats/:id/athletes` — ADMIN, swap athlete
- `PATCH /heats/:id/status` — ADMIN/HEAD_JUDGE (PENDING↔OPEN, APPROVED→HEAD_REVIEW)
- `POST /heats/:id/reset` — ADMIN/HEAD_JUDGE, reset to PENDING (wipe scores)
- `POST /heats/:id/review` — HEAD_JUDGE
- `PATCH /heats/:id/ranking` — HEAD_JUDGE
- `POST /heats/:id/approve` — HEAD_JUDGE
- `POST /heats/:id/close` — HEAD_JUDGE

### Scores (4)
- `GET /scores/heat/:heatId` — JUDGE/HEAD_JUDGE/ADMIN
- `POST /scores` — JUDGE/HEAD_JUDGE
- `POST /scores/correction-request` — HEAD_JUDGE
- `GET /scores/leaderboard/:competitionId` — public

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
- Never use a global leaderboard for advancement — always per-heat

## Coding style

- ES modules everywhere: `import`/`export` (both client and server)
- Async/await everywhere, no raw Promise chains
- Route files export a router, import into index.js
- Services contain business logic — routes are thin (validate → call service → respond)
- Environment variables via dotenv — never hardcode secrets
- Score status check inside db.transaction() to prevent race conditions
- Socket handlers use refs for latest state (prevent stale closures)

## Environment variables

```
# server/.env
PORT=3001
JWT_SECRET=your_secret_here
DB_PATH=./wakeboard.db

# client (optional)
VITE_SOCKET_URL=http://localhost:3001   # defaults to localhost:3001
```

## Dev commands

```bash
# From root
npm run dev          # runs client + server concurrently

# Client only (port 5173)
cd client && npm run dev

# Server only (port 3001)
cd server && npm run dev

# Run seed data (2 competitions, full data)
cd server && node src/db/seed.js

# Run unit tests (249 tests, no server needed)
cd server && node test.unit.js
node client/src/utils/format.test.js

# Run E2E tests (140 tests, server must be running)
cd server && node src/db/seed.js && node test.js
```

## Sprint progress

### Sprint 1 (DONE) — Scaffold, DB schema, JWT auth
### Sprint 2 (DONE) — Public pages, admin, divisions, registration
### Sprint 3 (DONE) — IWWF heat generation engine
### Sprint 4 (DONE) — Scoring engine + Head Judge approval + stage progression
- POST /scores with upsert, computed_score trigger via SQL AVG
- Heat lifecycle: review, approve (with manual reorder), close
- Per-heat advancement with interleaving by rank
- Correction request flow with real-time Socket.IO
- Finals Run 2 reorder

### Sprint 5 (DONE) — Real-time WebSocket + Judge scoring UI + Live page
- SocketContext for shared connection
- Judge scoring: sequential one-athlete-at-a-time, locked to active heat
- Head Judge panel: score review table, flag corrections, drag ranking, approve/close
- Public live page: division/stage/heat tabs, real-time updates, NOW SCORING banner
- Admin schedule section

### Sprint 6 (DONE) — UI redesign + polish
- Renamed to WakeScore
- Dark navy theme with Inter font
- Homepage: hero, active competition slider, card grid, footer
- /browse page: all competitions with filters (status, date range, level)
- Competition detail: hero banner, two-column layout, stats, schedule sidebar
- Live page: redesigned scorecard, heat ranking sidebar, competition schedule sidebar
- New fields: image_url, prize_pool, level, start_date/end_date (multi-day support)
- Admin improvements: staff dropdown, registration add athlete (existing + guest)
- Heat reset functionality
- judge_count constraint relaxed to 1–5 (was 3–5)
- PATCH competition: silently skips locked fields (date, judge_count) instead of error
- Fixed navbar overlap on all pages
- Extracted shared utilities: formatDateRange, STAGE_LABELS, GRADIENTS, getHeatStatusColor
- Socket event constants (server/src/utils/events.js)
- JSDoc on all scoringEngine exported functions
- Standardized auth.js (async bcrypt, authorize middleware)
- 389 total tests: 223 unit + 26 frontend unit + 140 E2E

## Test accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@wakeboard.lt | password123 |
| Head Judge | headjudge@wakeboard.lt | password123 |
| Judge 1 | judge1@wakeboard.lt | password123 |
| Men Athletes | athlete1-20@wakeboard.lt | password123 |
| Women Athletes | wathlete1-8@wakeboard.lt | password123 |

## Seeded Competitions

**Competition 1: Lithuanian Wakeboard Open 2026**
- Jul 15–17, 11 Men + 6 Women, National, €5,000 prize, judge_count=2, ACTIVE
- Full timetable, video URL, image URL
- Men: QUAL(2) → LCQ(2) → FINAL(1)
- Women: QUAL(1) → FINAL(1)

**Competition 2: Kaunas Wakeboard Cup 2026**
- Aug 20–21, 20 Men + 8 Women, International, €10,000 prize, judge_count=2, ACTIVE
- 2-day timetable, image URL
- Men: QUAL(4) → LCQ(2) → SEMI(2) → FINAL(1)
- Women: QUAL(2) → LCQ(1) → FINAL(1)
