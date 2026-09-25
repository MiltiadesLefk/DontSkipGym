// Demo build (VITE_DEMO=1) — what runs on the GitHub Pages deployment.
//
// Pages can only serve static files, so there is no API: passkey sign-in, per-profile sync
// and the admin dashboard all need the Node backend and are simply not part of a demo build.
// The app therefore stays in guest mode (everything in localStorage) and boots with a seeded
// example history (demoSeed.js), so the charts, heatmap, streaks and "last time you lifted…"
// pre-fills have something to show instead of an empty shell.
//
// Only these three constants are shared with normal builds: Vite replaces VITE_DEMO at build
// time, so the demo-only UI folds away and the seed generator — imported dynamically — never
// lands in a self-hosted bundle.
export const DEMO = import.meta.env.VITE_DEMO === '1'
export const DEMO_SEEDED = 'gym_demo_seeded_v1'
export const REPO = 'https://gitlab.com/DuarteSantos8/opengym'
// AGPL §13: everyone using a hosted instance must be able to get the source of the code that is
// actually running, modifications included — a link to upstream says nothing about a modified
// instance. The web image packs its own build context as this tarball, so the link is always
// exact. Relative, because the app is built with base './'.
export const SOURCE_URL = import.meta.env.VITE_SOURCE_URL || 'source.tar.gz'
