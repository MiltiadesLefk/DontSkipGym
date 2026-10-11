# 10 · Home week strip names the sessions, tap opens the day

**Summary** Each day of the Home week strip is a small calendar cell that names the session logged
that day, else the one planned. Tap → the logged session (or a list if several), or the plan picker
on an empty day — same as the month calendar's `openDaySheet`. Calendars never go past the current month.

**Where**
- `views/Home.jsx` (strip cells), `index.css` (cell styles), `lib/history.js` (+ test): helper that
  names a day's session(s); `sheets.jsx` (`openDaySheet`) (+ `sheets.day.test.jsx`).
- Tests: `views/Home.weekstrip.test.jsx` (new), small edits to `Home.startdoor.test.jsx`,
  `starter-entry.test.jsx`.

**Old commits** `50e339c13`, part of `862a86741` (cap at current month: `sheets.jsx`, `Home.jsx`)

**Collision hotspots** `Home.jsx`, `sheets.jsx`, `history.js` (also touched by feature 06). Upstream
likely has its own Home week-strip/calendar work; if so keep upstream's and add only the names + tap.

**Verify** `cd frontend && npx vitest run src/views/Home.weekstrip.test.jsx src/sheets.day.test.jsx src/lib/history.test.js`.
