# 11 · Small UI tweaks: rename finished workout, “Today” range on the muscle map

**A. Rename a finished workout** — a free session starts as “Freestyle” before you know what it
will be, so the title in the workout *detail sheet* (`sheets.jsx`) is editable after the fact.
Old commit `09abd97ee` (+22 lines in `sheets.jsx` only).
*Note:* upstream merged a “rename workout from the header menu” (#228) for the **live** workout;
this is the finished-workout counterpart. Check upstream first — may already be covered.

**B. “Today” range on the muscle balance map** — the 1-day range is the *calendar day*, not the last
24 h, so last night's session doesn't colour this morning's map. `lib/muscles.js` (+ test),
`views/Stats.jsx` (range chip). Old commit `f8482e96d`.

**Verify** `cd frontend && npx vitest run src/lib/muscles.test.js`; open a finished workout → title editable.
