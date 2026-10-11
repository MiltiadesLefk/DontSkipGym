#!/usr/bin/env bash
# Bring the private "mine" branch onto the latest upstream, after pressing "Sync fork" on GitHub.
#
#   main  = a pure mirror of upstream (the GitHub "Sync fork" button keeps it so). Never commit to it.
#   mine  = main + one commit per private feature (docs: .mine/README.md, gitignored).
#
# Usage:   scripts/sync-mine.sh            # fetch, fast-forward main, rebase mine onto it
#          scripts/sync-mine.sh --upstream # same, but take upstream's main directly (skip the button)
#
# It never pushes and never touches data folders. The old mine is kept under backup/mine-<time>.
# Conflicts stop the rebase: resolve them (or ask Claude: "continue the mine sync, read
# .mine/README.md"), `git rebase --continue`, then run `scripts/sync-mine.sh --finish`.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

FEATURE_BRANCH=mine
BASE_TAG=mine-base          # the upstream commit mine currently sits on; moved after each sync
source_ref=origin/main
[ "${1:-}" = "--upstream" ] && source_ref=upstream/main

if [ "${1:-}" = "--finish" ]; then
  git rev-parse -q --verify "refs/heads/$FEATURE_BRANCH" >/dev/null
  git tag -f "$BASE_TAG" main >/dev/null
  echo "Done: $BASE_TAG -> $(git rev-parse --short main). Test it, then:  git push --force-with-lease origin $FEATURE_BRANCH"
  exit 0
fi

[ -z "$(git status --porcelain)" ] || { echo "Working tree is not clean — commit or stash first." >&2; exit 1; }
git config rerere.enabled true          # a conflict resolved once is resolved the same way next time

git fetch origin --prune
git remote get-url upstream >/dev/null 2>&1 && git fetch upstream --prune || true

git rev-parse -q --verify "$source_ref" >/dev/null || { echo "No $source_ref — add the remote or use --upstream." >&2; exit 1; }
git rev-parse -q --verify "refs/tags/$BASE_TAG" >/dev/null || { echo "Tag $BASE_TAG is missing: point it at the upstream commit mine was built on (git tag $BASE_TAG <commit>)." >&2; exit 1; }

# main follows upstream exactly (it may be rewritten upstream, so this is a reset, not a merge)
current=$(git symbolic-ref --short HEAD)
[ "$current" != main ] || git switch -q "$FEATURE_BRANCH"
git branch -f main "$source_ref"
echo "main -> $(git rev-parse --short main) ($source_ref)"

backup="backup/mine-$(date +%Y%m%d-%H%M)"
git branch "$backup" "$FEATURE_BRANCH"
echo "backup of the old mine: $backup"

git switch -q "$FEATURE_BRANCH"
# Replay only the private commits (BASE_TAG..mine) onto the new main. Using the tag instead of
# the merge-base keeps this correct even if upstream rewrote its history.
if git rebase --onto main "$BASE_TAG" "$FEATURE_BRANCH"; then
  "$0" --finish
else
  echo
  echo "Rebase stopped on a conflict. Conflicting files:"
  git diff --name-only --diff-filter=U | sed 's/^/  /'
  echo "Fix them (see .mine/features/*.md for what each feature must do), then:"
  echo "  git add -A && git rebase --continue   # repeat until done"
  echo "  scripts/sync-mine.sh --finish"
  exit 1
fi
