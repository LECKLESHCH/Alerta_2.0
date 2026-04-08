#!/usr/bin/env bash

set -euo pipefail

# shellcheck source=./common.sh
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ensure_run_dir

for pid_file in "$RUN_DIR/backend.pid" "$RUN_DIR/frontend.pid"; do
  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      echo "Stopping process $pid from $(basename "$pid_file")"
      kill "$pid" || true
    fi
    rm -f "$pid_file"
  fi
done

for port in 3000 3001; do
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN || true)"
  if [[ -n "$pids" ]]; then
    echo "Stopping processes on port $port: $pids"
    kill $pids
  else
    echo "Port $port is already free."
  fi
done
