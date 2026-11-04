#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: node and npm are required on PATH." >&2
  exit 1
fi

echo "[preflight] Using Node $(node -v) / npm $(npm -v)"

START_TS=$(date +%s)

echo "[preflight] Step 1/4: Running TypeScript typecheck (npx tsc -b)..."
npx tsc -b

echo "[preflight] Step 2/4: Running Vitest suite (npm test -- --run $*)..."
npm test -- --run "$@"

echo "[preflight] Step 3/4: Running ESLint (npm run lint)..."
npm run lint

echo "[preflight] Step 4/4: Running full production build (npm run build)..."
npm run build

END_TS=$(date +%s)
echo "[preflight] SUCCESS in $((END_TS - START_TS))s"
