# 08 · Hardened deployment (compose.yaml), NOTICE, ignore rules

**Summary** `compose.yaml` (Docker Compose prefers it over upstream's `docker-compose.yml`, which
stays untouched so upstream merges cleanly) runs the app behind a reverse proxy, hardened.

**Behaviour**
- `api` on an `internal: true` `backend` network shared only with `web`; `web` on `public` +
  `backend`, publishes `127.0.0.1:${HOST_PORT:-3000}:3000`.
- Both: read_only, `cap_drop: ALL`, `no-new-privileges`, pids/cpu/mem limits, log rotation, tmpfs
  for nginx dirs, non-root (`api` 1000:1000, `web` 101:101).
- Variables with safe defaults: `DATA_DIR` (host folder, default `./data`; must be writable by uid
  1000 — users, passkeys, password hashes, state, secret, audit log), `HOST_PORT`, `TAG`,
  `COMPOSE_PROJECT_NAME` (default `dontskipgym`).
- `web` builds with `VITE_APP_NAME=DontSkipGym` (feature 04). Media is mounted from `./media/{img,gif}`.
- `compose.override.example.yaml` → copy to gitignored `compose.override.yaml` to join an existing
  proxy network (`ports: !reset []`, `networks: !override`).
- `NOTICE.md`: modification notice. `.gitignore`: `*.local.md`, `compose.override.yaml`,
  `.env.*` (except `.env.example`). `.dockerignore`: keeps `*.local.md` out of the image.
- `.env.example`: `HOST_PORT`/`DATA_DIR`/`TAG` docs (+ SETUP_CODE/APP_NAME from 01/04).

**Files** `compose.yaml`, `compose.override.example.yaml`, `NOTICE.md`, `.gitignore`,
`.dockerignore`, `.env.example`. (`docker-compose.yml` only gets the one-line APP_NAME build arg from 04.)

**Old commits** `86aecfaa5`, `7ff36891d` (host folder instead of named volume), `7a9b9dfff` (generic via env)

**Collision hotspots** none structurally (new files). If upstream renames Dockerfile paths, the
`web` build `dockerfile:` and the `api` `target:` need updating; `api/Dockerfile` must `COPY` every
module `server.js` imports (see feature 09: `versus.js`).

**Verify** `docker compose config` parses; `docker compose up -d --build`; `curl localhost:$HOST_PORT/api/health`.
