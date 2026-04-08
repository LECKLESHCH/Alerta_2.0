#!/usr/bin/env bash

set -euo pipefail

# shellcheck source=./common.sh
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

use_project_node

if port_in_use 3001; then
  echo "Port 3001 is already in use."
  exit 1
fi

echo "Starting frontend on http://127.0.0.1:3001"
cd "$FRONTEND_DIR"
exec env HOST=127.0.0.1 PORT=3001 BROWSER=none NODE_OPTIONS=--openssl-legacy-provider "$NPM_BIN" start
