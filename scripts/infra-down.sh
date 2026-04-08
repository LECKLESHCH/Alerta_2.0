#!/usr/bin/env bash

set -euo pipefail

# shellcheck source=./common.sh
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

docker compose -f "$DOCKER_DIR/docker-compose.yml" down
