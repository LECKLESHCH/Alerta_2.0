#!/usr/bin/env bash

set -euo pipefail

# shellcheck source=./common.sh
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

use_project_node

echo "Removing dependency directories..."
rm -rf "$BACKEND_DIR/node_modules" "$FRONTEND_DIR/node_modules"

echo "Reinstalling backend dependencies..."
(cd "$BACKEND_DIR" && "$NPM_BIN" ci)

echo "Reinstalling frontend dependencies..."
(cd "$FRONTEND_DIR" && "$NPM_BIN" install --legacy-peer-deps --no-audit --no-fund)

echo "Dependencies reinstalled."
