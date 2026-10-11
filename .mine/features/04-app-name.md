# 04 · Configurable app name (APP_NAME)

**Summary** One setting renames the app everywhere (title, home-screen name, manifest, all
languages, notifications, passkey prompt). File formats, storage keys and upstream URLs stay
`openGym`, so backups remain compatible. Unset ⇒ byte-identical build.

**Where**
- `frontend/src/lib/brand.js` (+ `brand.test.js`): `APP_NAME`, `REBRANDED` from `VITE_APP_NAME`.
- `frontend/vite.config.js`: `brand` plugin — rewrites `openGym` in index.html and in
  `dist/manifest.json` (`name`, `short_name`) at `closeBundle`; added to `plugins`.
- `frontend/src/lib/i18n-core.js`: `t()` swaps the name into each translated sentence (never into
  user text).
- `Home.jsx`, `Login.jsx`, `MobileOnboarding.jsx`, `Settings.jsx`: the few spots printing the name
  outside `t()`.
- `api/push-messages.js`, `api/server.js` (RP_NAME / notification titles).
- `web/Dockerfile`: `ARG/ENV VITE_APP_NAME`; `docker-compose.yml` build arg `VITE_APP_NAME=${APP_NAME:-}`;
  `.env.example` documents `APP_NAME`.
- `compose.yaml` (feature 08) hard-codes `VITE_APP_NAME=DontSkipGym`.

**Old commit** `9717c4e79`

**Collision hotspots** `i18n-core.js` and `vite.config.js` change with upstream releases;
re-add the plugin and the `t()` substitution by hand if the patch fails.

**Verify** `cd frontend && npx vitest run src/lib/brand.test.js`; `VITE_APP_NAME=X npm run build`
→ `dist/manifest.json` name is X.
