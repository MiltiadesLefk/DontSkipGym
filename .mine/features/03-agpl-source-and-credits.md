# 03 · AGPL §13 source tarball + “© Gym visual” credit

**Summary** Legal-compliance bits for running a modified public instance.

**Behaviour**
- `web/Dockerfile` gets a `FROM alpine AS source` stage that tars its own build context
  (excluding .git, media, data, coach-auth, .env*, node_modules, dist) to `/source.tar.gz`, copied
  into nginx's html root. Settings links to it.
- `lib/demo.js` exports `SOURCE_URL = import.meta.env.VITE_SOURCE_URL || 'source.tar.gz'`.
  Settings “source code” link: `MOBILE || DEMO ? REPO : SOURCE_URL`.
- `components/Media.jsx` renders `<span className="gifcredit">` “© Gym visual” on every exercise
  animation (media terms require the notice on each use); CSS `.exmedia .gifcredit` in `index.css`.

**Old commit** `0eff9cc52`

**Collision hotspots** upstream reworks `Media.jsx` (WebP/native playback) and the Settings footer
(update checker); keep the `gifcredit` span inside the media wrapper and the footer link logic.

**Verify** `docker build -f web/Dockerfile .` then `tar tzf` the served `/source.tar.gz`; Library
animation shows the credit.
