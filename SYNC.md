# How to sync with upstream (openGym) — the short version

Upstream: `DuarteSantos8/openGym` · Fork: `MiltiadesLefk/DontSkipGym` · Deployed branch: **`mine`**
(`main` is only a mirror of upstream. Never commit to it.)

## Every time (about 5 minutes when nothing conflicts)

1. **GitHub → your fork → Sync fork → Update branch.** (This updates `main` only. `mine` will say "behind"; that is expected.)
2. In the repo on the server:
   ```bash
   cd /root/dontskipgym
   git switch mine
   scripts/sync-mine.sh --verify
   ```
   It saves the old `mine` as `backup/mine-<time>`, moves `main` to upstream, replays your private
   commits on top, then runs every test, the build and a compose parse on a **scratch** data folder
   (it never reads `/opt` or your `.env`).
3. Read the last lines:
   - **`SAFE TO DEPLOY`** → go to *Deploy* below.
   - **`NOT SAFE: <steps>`** → open the log path it prints, or ask Claude: *"The mine sync verify failed, here is the log."*
   - **"Rebase stopped on a conflict"** → ask Claude: ***"Continue the mine sync. Read .mine/README.md and the feature docs."***
     When it is resolved: `scripts/sync-mine.sh --finish --verify`.
   - **"Tag mine-base is missing"** → it prints the exact `git tag mine-base <sha>` command; run it, then repeat step 2.

## Deploy (only after SAFE TO DEPLOY)

```bash
cd /root/dontskipgym
cp -a /opt/dontskipgym/data /root/backups/dontskipgym-data-$(date +%Y%m%d-%H%M)   # backup copy first (mkdir -p /root/backups once)
docker tag dontskipgym-api:new dontskipgym-api:prev && docker tag dontskipgym-web:new dontskipgym-web:prev   # rollback images
git push --force-with-lease origin mine
docker compose up -d --build
docker ps                                   # both dontskipgym containers "healthy"
docker exec nginx-proxy-manager sh -c 'curl -s http://gym:3000/api/health'    # {"ok":true,...}
```
Rollback: `docker tag dontskipgym-api:prev dontskipgym-api:new` (same for web), then `docker compose up -d --no-build`.
If the disk is tight (it shares the data disk): `docker builder prune -f`.

## Rules that keep it easy
- Never commit to `main`. Never merge `main` into `mine` — only the script rebases.
- New private feature → put it in `frontend/src/private/<feature>/` and `api/private/<feature>-routes.js`
  (the registries load them), and add `.mine/features/NN-<feature>.md`. Upstream files then only carry one-line hooks.
- If upstream ships the same thing as one of your features, drop your commit and mark its doc "superseded".
- Site settings live in the gitignored `.env` and `compose.override.yaml` (keeps `web` on the `gym-net` proxy network —
  recreate it from `compose.override.example.yaml` if it is ever missing).
- Your real data is `/opt/dontskipgym/data`. No script here touches it; tests use a scratch folder.

## Where the details are
`.mine/README.md` (procedure + layout), `.mine/features/NN-*.md` (what each private feature is and how to re-apply it),
`scripts/sync-mine.sh`, `scripts/verify-mine.sh`.
