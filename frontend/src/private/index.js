// Registry of the private features (this fork only). Each folder here is one feature and
// describes itself in a `feature.js` default export:
//   { id,
//     tabs:        [{ key, path, icon, label: () => t('…'), after: 'plan' | 'stats',
//                     visibleWhen?: ({ user }) => bool, useDot?: () => bool, dotLabel?: () => string }],
//     syncLists:   [{ field, key?: x => id, time?: x => ms }]   // lists in the profile merged like workouts
//     auditLabels: { 'event.code': 'English sentence' },
//     icons:       { name: <path elements> } }
// Routes live in each folder's `routes.jsx` (see ./routes.jsx) — kept apart because the views
// pull in the store, and this file is imported by lib/sync-merge.js, which the store imports.
// Upstream-owned files only ever import the helpers below; adding a feature = adding a folder.
const mods = import.meta.glob('./*/feature.js', { eager: true })
export const privateFeatures = Object.values(mods).map(m => m.default).filter(Boolean)

const all = k => privateFeatures.flatMap(f => f[k] || [])
export const privateTabs = all('tabs')
const syncLists = all('syncLists')
export const privateSyncLists = syncLists.map(l => l.field)
/** Per field: how an entry is named (resetIds / deleted stamps) and when it was last edited. */
export const privateSyncKeys = Object.fromEntries(syncLists.map(l => [l.field, l.key || (x => x?.id)]))
export const privateSyncTimes = Object.fromEntries(syncLists.map(l => [l.field, l.time || (x => Number(x?._ts) || 0)]))
export const privateAuditLabels = Object.assign({}, ...privateFeatures.map(f => f.auditLabels))
export const privateIcons = Object.assign({}, ...privateFeatures.map(f => f.icons))
