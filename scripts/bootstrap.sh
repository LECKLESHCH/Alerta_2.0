#!/usr/bin/env bash

set -euo pipefail

# shellcheck source=./common.sh
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

use_project_node
ensure_backend_env

echo "Using Node $(node -v)"
echo "Installing backend dependencies..."
(cd "$BACKEND_DIR" && "$NPM_BIN" ci)

echo "Installing frontend dependencies..."
(cd "$FRONTEND_DIR" && "$NPM_BIN" install --legacy-peer-deps --no-audit --no-fund)

echo "Starting local infrastructure..."
"$ROOT_DIR/scripts/infra-up.sh"

echo "Running environment checks..."
"$ROOT_DIR/scripts/check-env.sh"

echo "Bootstrap complete."
