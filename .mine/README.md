# The "mine" fork — how to stay on top of upstream

Upstream: https://github.com/DuarteSantos8/openGym  ·  Fork: https://github.com/MiltiadesLefk/DontSkipGym

```
upstream/main ──► origin/main (GitHub "Sync fork" keeps it equal)      = local `main`   (never commit here)
                       └── + 1 commit per private feature               = `mine`         (what you deploy)
tag mine-base = the upstream commit `mine` currently sits on
```

This folder (`.mine/`, gitignored — copy it somewhere safe too) explains every private feature
(`features/NN-*.md`): what it does, which files, what must survive a conflict, how to test it.

## Every time you want upstream's latest

1. GitHub → your fork → **Sync fork** → *Update branch*  (updates `main` only; `mine` shows "behind" — expected).
2. In the repo: `scripts/sync-mine.sh`
   - fast-forwards local `main`, keeps the old `mine` as `backup/mine-<time>`, replays the
     feature commits onto the new `main` (`git rebase --onto main mine-base mine`), and moves `mine-base`.
   - `git rerere` is on, so a conflict you resolved once is resolved automatically next time.
3. No conflicts → run the tests (below), then `git push --force-with-lease origin mine`.
4. Conflicts → tell Claude: **"Continue the mine sync. Read .mine/README.md and the feature docs."**
   It resolves each conflicting commit using the matching feature doc, then `git rebase --continue`
   and `scripts/sync-mine.sh --finish`.
5. Deploy from `mine` only. Your data folder (DATA_DIR in `.env`, e.g. under /opt) is never touched
   by any of this — don't run containers on it from a half-synced tree; test with a scratch DATA_DIR.

## Rules that keep the next sync easy
- One feature = one commit (or a few), message starts with what it does. Amend/fixup into the feature
  commit rather than piling "fix" commits on top. Use `git commit --fixup=<feature commit>` +
  `git rebase -i --autosquash main` (or ask Claude).
- Never commit to `main`. Never merge `main` into `mine` — always rebase (history stays flat).
- New private feature ⇒ add `features/NN-name.md` here in the same sitting.
- Prefer new files over editing upstream files (e.g. `compose.yaml` instead of `docker-compose.yml`);
  fewer touched lines = fewer conflicts.
- If upstream ships something equivalent to a feature (as it did with password login), drop your
  commit (`git rebase -i`, delete the line) and mark the doc "superseded".

## Test checklist after a sync (use a SCRATCH data dir, never the real one)
```
cd frontend && npm ci && npx vitest run && npm run build
cd api      && DATA_DIR=$(mktemp -d) npm test
cd mcp      && npm test
docker compose -f compose.yaml config -q      # parses only, starts nothing
```

## Feature index
| # | Feature | Status after the 2026-10-11 sync onto upstream v1.4.1 |
|---|---------|------|
| 01 | Security hardening (SETUP_CODE, no user count on /health, leaked-key guard) | re-applied |
| 02 | Username + password login | **superseded** by upstream's PASSWORD_LOGIN=1 (sign-in by profile name) — dropped |
| 03 | AGPL §13 source tarball + © Gym visual badge | re-applied (tarball excludes catalogue/media) |
| 04 | APP_NAME rebranding | re-applied |
| 05 | 1D barcode gym cards | re-applied |
| 06 | Cardio time + distance | re-applied (speed column replaced; mph still shown for derived speed) |
| 07 | Cheat meals tab | re-applied (+ sync-merge entries) |
| 08 | Hardened compose.yaml | re-applied (media volume removed — media ships in the image now) |
| 09 | Versus tab | re-applied, asks by profile name instead of username; routes in openapi.yaml |
| 10 | Home week strip names | re-applied |
| 11 | Rename finished workout, Today range | re-applied |

Original (pre-sync) history: branch `backup/mine-before-public-sync-20261010`.
