#!/usr/bin/env bash

set -euo pipefail

# shellcheck source=./common.sh
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

use_project_node
ensure_backend_env

if port_in_use 3000; then
  echo "Port 3000 is already in use."
  exit 1
fi

echo "Starting backend on http://localhost:3000"
cd "$BACKEND_DIR"
exec "$NODE_BIN" -r ts-node/register/transpile-only -r tsconfig-paths/register src/main.ts
