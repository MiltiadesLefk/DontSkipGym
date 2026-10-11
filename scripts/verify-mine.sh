#!/usr/bin/env bash
# Post-sync safety check for the "mine" branch. Parse/test/build only: it never starts a container,
# never pushes, and never reads your real data folder or the repo's .env.
#
# Usage:  scripts/verify-mine.sh                 # all steps: frontend, api, mcp, compose
#         scripts/verify-mine.sh --quick         # frontend vitest + api tests only (no build)
#         scripts/verify-mine.sh --only=<step>   # one of: frontend api mcp compose
#
# Exit code 0 = every step that ran passed (SAFE TO DEPLOY), 1 = something failed or bad usage.
set -euo pipefail

quick=0
only=""
for arg in "$@"; do
  case "$arg" in
    --quick) quick=1 ;;
    --only=*) only="${arg#--only=}" ;;
    -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg (see --help)" >&2; exit 1 ;;
  esac
done
case "$only" in ""|frontend|api|mcp|compose) ;; *) echo "--only must be one of: frontend api mcp compose" >&2; exit 1 ;; esac

# Never run against a real data folder: refuse if the caller already points DATA_DIR somewhere.
if [ -n "${DATA_DIR:-}" ]; then
  echo "Refusing to run: DATA_DIR is already set to '$DATA_DIR'." >&2
  echo "This script makes its own scratch folder; run it with DATA_DIR unset (env -u DATA_DIR $0)." >&2
  exit 1
fi

root=$(git rev-parse --show-toplevel)
cd "$root"

scratch=$(mktemp -d "${TMPDIR:-/tmp}/verify-mine.XXXXXX")
log="$scratch/verify.log"
: > "$log"
export DATA_DIR="$scratch/data"
mkdir -p "$DATA_DIR"
# compose parses only; give it a scratch env file so the repo's .env is never read.
printf 'DATA_DIR=%s\n' "$DATA_DIR" > "$scratch/compose.env"

names=(); results=()

wanted() {   # wanted <step>
  [ -z "$only" ] || [ "$only" = "$1" ]
}
record() { names+=("$1"); results+=("$2"); printf '%-10s %s\n' "$1" "$2"; }

# run_step <name> <dir> <command...>: runs in a subshell, output to the log, tail shown on failure
run_step() {
  local name=$1 dir=$2; shift 2
  wanted "$name" || return 0
  if [ ! -d "$dir" ]; then record "$name" "SKIP (no $dir/ folder)"; return 0; fi
  echo "== $name: $*" >> "$log"
  local out="$scratch/$name.out" rc=0
  ( cd "$dir" && eval "$*" ) > "$out" 2>&1 || rc=$?
  cat "$out" >> "$log"
  if [ "$rc" -eq 0 ]; then record "$name" PASS
  else
    record "$name" "FAIL (exit $rc)"
    echo "---- last lines of $name ----"; tail -n 15 "$out"; echo "------------------------------"
  fi
}

echo "scratch dir: $scratch (DATA_DIR=$DATA_DIR)"

if [ "$quick" -eq 1 ]; then
  run_step frontend frontend "npm ci --no-audit --no-fund && npx vitest run"
else
  run_step frontend frontend "npm ci --no-audit --no-fund && npx vitest run && npm run build"
fi

if wanted api && [ -d api ]; then
  run_step api api "{ [ -d node_modules ] || npm ci --no-audit --no-fund; } && node --test test/*.test.js"
else
  run_step api api true
fi

if [ "$quick" -eq 0 ]; then
  if [ -d mcp ] && grep -q '"test"' mcp/package.json 2>/dev/null; then
    run_step mcp mcp "{ [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm test"
  elif wanted mcp; then
    record mcp "SKIP (no mcp/ test script)"
  fi
  if [ -f compose.yaml ] && command -v docker >/dev/null 2>&1; then
    run_step compose . "docker compose --env-file '$scratch/compose.env' -f compose.yaml config -q"
  elif wanted compose; then
    record compose "SKIP (compose.yaml or docker missing)"
  fi
fi

echo
echo "=========== verdict ==========="
failed=()
for i in "${!names[@]}"; do
  printf '  %-10s %s\n' "${names[$i]}" "${results[$i]}"
  case "${results[$i]}" in FAIL*) failed+=("${names[$i]}") ;; esac
done
echo "==============================="
passed=0
for r in "${results[@]}"; do [ "$r" = PASS ] && passed=$((passed + 1)); done
if [ "$passed" -eq 0 ] && [ "${#failed[@]}" -eq 0 ]; then
  echo "NOT SAFE: nothing was actually checked (every step skipped)"; echo "log: $log"; exit 1
fi
if [ "${#failed[@]}" -eq 0 ]; then
  echo "SAFE TO DEPLOY"; echo "log: $log"; exit 0
fi
echo "NOT SAFE: ${failed[*]}"; echo "log: $log"; exit 1
