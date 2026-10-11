# 07 · Cheat meals tab

**Summary** Brought over from the old gym app: log what you ate off-plan (today by default,
backdating allowed), see how often each food comes up, a month calendar of cheat days (cells name
the food) and the recent list.

**Data** Stored in the profile as `S.cheatMeals` and merged across devices like workouts
(`lib/sync-merge.js` + test). History migrated from the old app is read until the first new entry.

**Layout since 2026-10-11 (private/ refactor):** the feature's own files live in
`frontend/src/private/cheat-meals/` (CheatMeals.jsx, cheat-meals.js + test, calendar-names.css,
feature.js = tab/sync list/icon description, routes.jsx, icons.jsx). Upstream-owned files only carry
tiny hooks: `App.jsx` (`{privateRoutes}`), `TabBar.jsx` (`<PrivateTabs after=… />`), `Icon.jsx`
(`Object.assign(P, privateIcons)`), `lib/sync-merge.js` (`privateSyncLists`, see below). If a sync
conflict hits one of those hook lines, re-add the hook; the feature itself is untouched.

**Where (original, pre-refactor description)**
- `frontend/src/lib/cheat-meals.js` (+ test): model, counts, calendar helpers.
- `frontend/src/views/CheatMeals.jsx`: the tab; `calendar-names.css`: calendar cell names
  (shared with Versus, feature 09); calendar can't go past the current month.
- `App.jsx` (route), `components/TabBar.jsx` (tab), `components/Icon.jsx` (icon).
- `lib/sync-merge.js`: merge rule for `cheatMeals` (this is the one that silently loses data if
  dropped — keep it and its test).

**Old commits** `b43a5a287`, `08112d794` (food name in cells), part of `862a86741` (cap at current month)

**Collision hotspots** `TabBar.jsx` (upstream adds/rearranges tabs), `sync-merge.js`, `App.jsx` routes.

**Verify** `cd frontend && npx vitest run src/lib/cheat-meals.test.js src/lib/sync-merge.test.js`.
