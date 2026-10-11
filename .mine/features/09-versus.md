# 09 · Versus tab (compare with a friend, by mutual consent)

**Summary** Ask someone by username; they accept/decline at the top of their Versus tab (dot on
the tab icon while a request waits). Either side can end it; chips switch between partners. The
server computes the comparison and sends **aggregates only**: sessions, sets, load, a shared month
calendar (session names + food names per day, never workout contents), best lifts on common
exercises, cheat meals and — unless switched off per pairing — body weight.

**Update 2026-10-11:** feature 02 was dropped (upstream has password login), so `POST /api/versus/request` takes `name` (also still accepts `username` as a field name) and looks the person up by `nameKey(profile name)`; more than one profile with that name → 409. The routes are documented in `api/openapi.yaml` (tag `versus`, registered in `scripts/build-api-docs.mjs`) because an upstream test requires every route there.

**Depends on** 07 (cheat meals shown in the calendar).

**API (`api/`)**
- `api/versus.js` (+ `api/test/versus.test.js`, `api/test/server-versus.test.js`): `summarize`,
  `commonBests`, month calendar.
- `api/server.js`: `import { summarize, commonBests } from './versus.js'`; `db.versus` array
  `{id,from,to,status:'pending'|'active'|'declined',created,answered?,hideBw?}`; limits
  `VERSUS_MAX_PENDING=5`, `VERSUS_MAX_ACTIVE=20`, `VERSUS_COOLDOWN=7d`; helpers `versusLive`,
  `versusView`; routes `GET /api/versus`, `POST /api/versus/request|respond|end|share`,
  `GET /api/versus/compare`; account deletion also drops its pairings
  (`db.versus = db.versus.filter(...)` in the admin delete route); calendar capped to current month.
- `api/Dockerfile`: `COPY ... versus.js` (**easy to forget — the container crashes without it**).

**Frontend**
- `lib/versus.js` (+ test): zustand `useVersus` (`incoming` count), `refreshVersus`, calendar helpers.
- `views/Versus.jsx`, `src/versus.css`, `src/calendar-names.css` (shared with Cheat meals).
- `App.jsx` route `/versus`; `components/TabBar.jsx`: Versus tab with `tab-dot`, polling on
  visibilitychange + every 60 s; `lib/audit.js` labels `auth.versus.*`.

**Old commits** `8bf310c26`, `63c120694` (calendar), part of `862a86741`

**Collision hotspots** `TabBar.jsx`, `App.jsx`, `api/server.js` (admin delete route, audit labels),
`api/Dockerfile` (upstream may change its COPY line).

**Verify** `cd api && npm test` (versus + server-versus), `cd frontend && npx vitest run src/lib/versus.test.js`.
