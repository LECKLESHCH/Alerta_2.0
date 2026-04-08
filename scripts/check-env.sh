#!/usr/bin/env bash

set -euo pipefail

# shellcheck source=./common.sh
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

use_project_node

require_file "$BACKEND_DIR/package.json"
require_file "$FRONTEND_DIR/package.json"
require_file "$DOCKER_DIR/docker-compose.yml"
ensure_backend_env

NODE_VERSION="$(node -v)"
NPM_VERSION="$(npm -v)"

echo "Node: $NODE_VERSION"
echo "npm: $NPM_VERSION"
echo "Required Node: v$REQUIRED_NODE_VERSION"

if port_in_use 3000; then
  echo "Port 3000: busy"
else
  echo "Port 3000: free"
fi

if port_in_use 3001; then
  echo "Port 3001: busy"
else
  echo "Port 3001: free"
fi

if curl -fsS http://127.0.0.1:27017 >/dev/null 2>&1; then
  echo "MongoDB: reachable on 27017"
else
  echo "MongoDB: not reachable on 27017"
fi

if curl -fsS http://127.0.0.1:6333/collections >/dev/null 2>&1; then
  echo "Qdrant: reachable on 6333"
else
  echo "Qdrant: not reachable on 6333"
fi
