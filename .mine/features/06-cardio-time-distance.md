# 06 · Cardio logged as time + distance (speed derived)

**Summary** Pace changes during a session, so one speed per set was never what happened. A cardio
set is now the time and the distance the machine shows; average speed is stored alongside so every
existing reader of `speed` keeps working. Older sets/targets read distance back as speed × time.
Stats chart cardio as distance per workout.

**Where**
- `frontend/src/lib/cardio.js` (+ `cardio.test.js`): the conversion helpers (distance ⇄ speed,
  legacy fallback).
- `lib/history.js` (+ test), `lib/workout-model.js`, `lib/exercises.js`, `lib/plan-share.js`,
  `lib/import-csv.js`, `lib/import-hevy.js` (+ csv test): read/write the distance field.
- `sheets.jsx` (cardio config sheet inputs), `views/Workout.jsx` (set row), `views/Stats.jsx`
  (cardio chart = distance per workout).
- `mcp/src/labels.js`, `mcp/test/tools.test.js`: MCP labels the cardio fields.

**Old commit** `9314c788a`

**Collision hotspots** `Workout.jsx` set row and `sheets.jsx` are heavily edited upstream (set-row
layout rounds). Re-implement the inputs rather than fight the hunk: keep the data rule — set stores
`{ t, d, speed }` where `speed = d / t` — and use `cardio.js` helpers.

**Verify** `cd frontend && npx vitest run src/lib/cardio.test.js src/lib/history.test.js src/lib/import-csv.test.js`; `cd mcp && npm test`.
