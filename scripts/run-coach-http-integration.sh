#!/usr/bin/env bash
set -euo pipefail

# Bounded offline cross-stack HTTP integration runner:
# 1. Boots BE55's real Spring MVC + Jackson + SecurityConfig + TimelineController + TimelineService + AiController
#    embedded Tomcat slice in offline bridge mode (`CoachTimelineHttpContractServerTest`).
# 2. Runs FE18's real SummonerInfo + AiAnalysisModal + Axios apiClient Vitest suite against that live HTTP server.
# 3. Signals clean server shutdown with zero orphaned processes and zero external provider/Riot/DB/Redis calls.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BE_ROOT="${BACKEND_HTTP_INTEGRATION_DIR:-${FE_ROOT}/../SummonerSearcher-Backend-http-integration}"

if [[ ! -d "${BE_ROOT}" ]]; then
  echo "ERROR: Backend integration worktree not found at ${BE_ROOT}" >&2
  echo "Set BACKEND_HTTP_INTEGRATION_DIR=/path/to/SummonerSearcher-Backend-http-integration" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
PORT_FILE="${TMP_DIR}/base_url.txt"
DONE_FILE="${TMP_DIR}/done.signal"
BE_LOG="${TMP_DIR}/backend-http-server.log"
BE_PID=""

cleanup() {
  touch "${DONE_FILE}" 2>/dev/null || true
  if [[ -n "${BE_PID}" ]] && kill -0 "${BE_PID}" 2>/dev/null; then
    wait "${BE_PID}" 2>/dev/null || true
  fi
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

if [[ -z "${JAVA_HOME:-}" && -d "/home/antigravity/.cache/jdk21/jdk-21.0.13+9" ]]; then
  export JAVA_HOME="/home/antigravity/.cache/jdk21/jdk-21.0.13+9"
  export PATH="${JAVA_HOME}/bin:${PATH}"
fi

echo "[1/3] Starting BE55 offline Spring MVC Tomcat server..."
(
  cd "${BE_ROOT}"
  COACH_HTTP_HOLD_PORT_FILE="${PORT_FILE}" \
  COACH_HTTP_DONE_FILE="${DONE_FILE}" \
  bash ./gradlew test \
    --tests "com.pride.summoner_searcher_api.integration.CoachTimelineHttpContractServerTest" \
    --rerun-tasks \
    --offline >"${BE_LOG}" 2>&1
) &
BE_PID=$!

for _ in $(seq 1 600); do
  if [[ -s "${PORT_FILE}" ]]; then
    break
  fi
  if ! kill -0 "${BE_PID}" 2>/dev/null; then
    echo "ERROR: Backend test server exited before publishing port. Log:" >&2
    cat "${BE_LOG}" >&2
    exit 1
  fi
  sleep 0.1
done

if [[ ! -s "${PORT_FILE}" ]]; then
  echo "ERROR: Timed out waiting for BE55 Tomcat server port. Log:" >&2
  cat "${BE_LOG}" >&2
  exit 1
fi

BASE_URL="$(cat "${PORT_FILE}")"
echo "[2/3] BE55 ready at ${BASE_URL}. Running FE18 real-HTTP Vitest integration suite..."

(
  cd "${FE_ROOT}"
  VITE_API_BASE_URL="${BASE_URL}" \
  VITE_COACH_HTTP_INTEGRATION_BASE_URL="${BASE_URL}" \
  npx vitest run src/integration/coachTimelineRealHttp.integration.test.tsx
)

echo "[3/3] Signaling BE55 server shutdown and verifying clean Gradle exit..."
touch "${DONE_FILE}"
wait "${BE_PID}"
BE_PID=""
echo "SUCCESS: Cross-stack FE18 <-> BE55 real-HTTP offline integration passed."
