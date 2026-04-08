#!/usr/bin/env bash

set -euo pipefail

# shellcheck source=./common.sh
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

use_project_node
ensure_backend_env
ensure_run_dir

"$ROOT_DIR/scripts/check-env.sh"

if ! curl -fsS http://127.0.0.1:27017 >/dev/null 2>&1 || ! curl -fsS http://127.0.0.1:6333/collections >/dev/null 2>&1; then
  echo "Infrastructure is not ready. Starting Docker services..."
  "$ROOT_DIR/scripts/infra-up.sh"
fi

if port_in_use 3000 || port_in_use 3001; then
  echo "Ports 3000 and/or 3001 are already busy. Run 'make stop' first."
  exit 1
fi

BACKEND_LOG="$RUN_DIR/backend.log"
FRONTEND_LOG="$RUN_DIR/frontend.log"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"

echo "Starting backend in background..."
nohup env \
  BACKEND_DIR="$BACKEND_DIR" \
  NODE_DIR="$NODE_DIR" \
  NODE_BIN="$NODE_BIN" \
  bash -lc '
    cd "$BACKEND_DIR"
    export PATH="$NODE_DIR:$PATH"
    exec "$NODE_BIN" -r ts-node/register/transpile-only -r tsconfig-paths/register src/main.ts
  ' >"$BACKEND_LOG" 2>&1 </dev/null &
BACKEND_PID=$!
echo "$BACKEND_PID" >"$BACKEND_PID_FILE"

if ! wait_for_http "http://127.0.0.1:3000/articles" 30 1; then
  echo "Backend did not become ready. See $BACKEND_LOG"
  exit 1
fi

echo "Starting frontend in background..."
nohup env \
  FRONTEND_DIR="$FRONTEND_DIR" \
  NODE_DIR="$NODE_DIR" \
  NPM_BIN="$NPM_BIN" \
  bash -lc '
    cd "$FRONTEND_DIR"
    export PATH="$NODE_DIR:$PATH"
    exec env HOST=127.0.0.1 PORT=3001 BROWSER=none NODE_OPTIONS=--openssl-legacy-provider "$NPM_BIN" start
  ' >"$FRONTEND_LOG" 2>&1 </dev/null &
FRONTEND_PID=$!
echo "$FRONTEND_PID" >"$FRONTEND_PID_FILE"

if ! wait_for_http "http://127.0.0.1:3001" 90 1; then
  echo "Frontend did not become ready. See $FRONTEND_LOG"
  exit 1
fi

echo "Backend:  http://127.0.0.1:3000"
echo "Frontend: http://127.0.0.1:3001"
echo "Logs:"
echo "  $BACKEND_LOG"
echo "  $FRONTEND_LOG"
