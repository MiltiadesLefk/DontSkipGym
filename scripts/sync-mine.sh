#!/usr/bin/env bash
# Bring the private "mine" branch onto the latest upstream, after pressing "Sync fork" on GitHub.
#
#   main  = a pure mirror of upstream (the GitHub "Sync fork" button keeps it so). Never commit to it.
#   mine  = main + one commit per private feature (docs: .mine/README.md).
#
# Usage:   scripts/sync-mine.sh [--upstream] [--verify]   # fetch, reset main, rebase mine onto it
#          scripts/sync-mine.sh --finish [--verify]       # after resolving a conflicted rebase
#
#   --upstream  take upstream's main directly (skip the GitHub button)
#   --verify    after a successful sync, run scripts/verify-mine.sh (tests + build + compose parse,
#               scratch DATA_DIR) and report SAFE TO DEPLOY or NOT SAFE
#   --finish    move the mine-base tag once `git rebase --continue` has completed
#
# It never pushes and never touches data folders. The old mine is kept under backup/mine-<time>.
# Conflicts stop the rebase: resolve them (or ask Claude: "continue the mine sync, read
# .mine/README.md"), `git rebase --continue`, then run `scripts/sync-mine.sh --finish`.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

FEATURE_BRANCH=mine
BASE_TAG=mine-base          # the upstream commit mine currently sits on; moved after each sync
source_ref=origin/main
finish=0
verify=0
for arg in "$@"; do
  case "$arg" in
    --upstream) source_ref=upstream/main ;;
    --finish)   finish=1 ;;
    --verify)   verify=1 ;;
    -h|--help)  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg (see --help)" >&2; exit 1 ;;
  esac
done

rebase_in_progress() {
  [ -d "$(git rev-parse --git-path rebase-merge)" ] || [ -d "$(git rev-parse --git-path rebase-apply)" ]
}

next_steps() {
  echo
  echo "Next steps (nothing was pushed):"
  if [ "$verify" -eq 1 ]; then
    echo "  1. review the verify verdict above"
  else
    echo "  1. scripts/verify-mine.sh            # tests + build + compose parse, scratch DATA_DIR"
  fi
  echo "  2. SAFE TO DEPLOY?  git push --force-with-lease origin $FEATURE_BRANCH"
  echo "  3. deploy from $FEATURE_BRANCH only (your real data folder was never touched)"
}

finish_sync() {
  git rev-parse -q --verify "refs/heads/$FEATURE_BRANCH" >/dev/null || { echo "No $FEATURE_BRANCH branch." >&2; exit 1; }
  git merge-base --is-ancestor main "$FEATURE_BRANCH" || {
    echo "$FEATURE_BRANCH is not on top of main yet — the rebase is not finished; not moving $BASE_TAG." >&2; exit 1; }
  git tag -f "$BASE_TAG" main >/dev/null
  echo "Done: $BASE_TAG -> $(git rev-parse --short main), $FEATURE_BRANCH replayed on it."
  if [ "$verify" -eq 1 ]; then
    local rc=0
    env -u DATA_DIR "$(dirname "$0")/verify-mine.sh" || rc=$?
    next_steps
    exit "$rc"
  fi
  next_steps
}

if rebase_in_progress; then
  if [ "$finish" -eq 1 ]; then
    echo "A rebase is still in progress. Resolve the conflicts, 'git add -A && git rebase --continue' until it ends, then re-run --finish." >&2
  else
    echo "A rebase is already in progress. Finish it ('git rebase --continue') or cancel it ('git rebase --abort'), then re-run." >&2
  fi
  exit 1
fi

if [ "$finish" -eq 1 ]; then finish_sync; exit 0; fi

[ -z "$(git status --porcelain)" ] || { echo "Working tree is not clean — commit or stash first." >&2; exit 1; }
git config rerere.enabled true          # a conflict resolved once is resolved the same way next time

git fetch origin --prune
if git remote get-url upstream >/dev/null 2>&1; then git fetch upstream --prune; fi

git rev-parse -q --verify "$source_ref" >/dev/null || { echo "No $source_ref — add the remote or use --upstream." >&2; exit 1; }
git rev-parse -q --verify "refs/heads/$FEATURE_BRANCH" >/dev/null || { echo "No $FEATURE_BRANCH branch." >&2; exit 1; }
if ! git rev-parse -q --verify "refs/tags/$BASE_TAG" >/dev/null; then
  echo "Tag $BASE_TAG is missing; it must point at the upstream commit $FEATURE_BRANCH was built on." >&2
  echo "Not guessing. If upstream has not rewritten history, the last commit shared with upstream is:" >&2
  for r in upstream/main origin/main; do
    if git rev-parse -q --verify "$r" >/dev/null; then
      mb=$(git merge-base "$FEATURE_BRANCH" "$r" 2>/dev/null || true)
      [ -z "$mb" ] || echo "  git tag $BASE_TAG $mb    # merge-base of $FEATURE_BRANCH and $r" >&2
    fi
  done
  echo "Check with 'git log --oneline <that commit>..$FEATURE_BRANCH' that only your private commits are listed, run the tag command, then re-run." >&2
  exit 1
fi

# main follows upstream exactly (it may be rewritten upstream, so this is a reset, not a merge)
current=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [ "$current" = main ]; then git switch -q "$FEATURE_BRANCH"; fi
git branch -f main "$source_ref"
echo "main -> $(git rev-parse --short main) ($source_ref)"

backup="backup/mine-$(date +%Y%m%d-%H%M)"
if git rev-parse -q --verify "refs/heads/$backup" >/dev/null; then backup="$backup$(date +%S)"; fi
git branch "$backup" "$FEATURE_BRANCH"
echo "backup of the old mine: $backup"

git switch -q "$FEATURE_BRANCH"
# Replay only the private commits (BASE_TAG..mine) onto the new main. Using the tag instead of
# the merge-base keeps this correct even if upstream rewrote its history.
if git rebase --onto main "$BASE_TAG" "$FEATURE_BRANCH"; then
  finish_sync
else
  echo
  echo "Rebase stopped on a conflict. Conflicting files:"
  git diff --name-only --diff-filter=U | sed 's/^/  /'
  echo "Fix them (see .mine/features/*.md for what each feature must do), then:"
  echo "  git add -A && git rebase --continue   # repeat until done"
  echo "  scripts/sync-mine.sh --finish$([ "$verify" -eq 1 ] && echo ' --verify')"
  exit 1
fi
