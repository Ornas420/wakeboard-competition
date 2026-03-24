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
/server       Node.js backend
  /src
    index.js            Express entry + Socket.IO setup
    db/
      schema.js         All CREATE TABLE statements
      seed.js           Test data for development
    routes/
      auth.js
      competitions.js
      registrations.js
      heats.js
      scores.js
    middleware/
      auth.js           JWT verify + role guard
    services/
      heatGeneration.js IWWF heat generation logic
      scoringEngine.js  Score aggregation + ranking
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

- All primary keys are UUID (TEXT). Use `uuid` package: `const { v4: uuidv4 } = require('uuid')`
- Enums stored as TEXT with CHECK constraints
- Never use auto-increment IDs
- Unique constraints: `registration(competition_id, athlete_id)` and `judge_score(athlete_run_id, judge_id)`
- All score math happens in SQL with ROUND(AVG(score), 2) — never in JavaScript

## The 11 tables

```
user, competition, competition_staff, registration,
stage, heat, heat_athlete, athlete_run, judge_score,
heat_result, stage_ranking
```

Key relationship: `heat → athlete_run → judge_score`
- 6 athletes × 2 runs = 12 athlete_run rows per heat
- Each athlete_run gets one judge_score row per judge
- computed_score on athlete_run is set automatically when scores_submitted = judge_count

## Heat generation — IWWF format (hardcode exactly, never infer)

```
3–6 athletes:   QUALIFICATION(1 heat, all advance, 2 runs) + FINAL(1,—,2)
7–10 athletes:  QUALIFICATION(2 heats, top 4, 2 runs) + LCQ(1, top 2, 1 run) + FINAL(1,—,2)
11–18 athletes: QUALIFICATION(2-3 heats, top 4, 2 runs) + LCQ(2, top 2, 1 run)
                + SEMIFINAL(2, top 3, 2 runs) + FINAL(1,—,2)
19–36 athletes: QUALIFICATION(4-6 heats, 8-16, 2 runs) + LCQ(4, 8, 1 run)
                + QUARTERFINAL(4, 12, 2 runs) + SEMIFINAL(2, 6, 2 runs) + FINAL(1,—,2)
```

Max 6 athletes per heat. Distribution: SNAKE for qualification, LADDER for
semi/finals, STEPLADDER for LCQ.

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
- Never push directly to main — always use a feature branch + PR

## Coding style

- ES modules in client (import/export), CommonJS in server (require)
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
CLIENT_URL=http://localhost:5173
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

## Current sprint

**Sprint 1** — Scaffold, DB schema, JWT auth with all 4 roles.
See the master planning document (WakeBoard_MASTER.docx) for full sprint details,
API shapes, edge cases, and Claude Code prompts for each feature.
