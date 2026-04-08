#!/usr/bin/env bash

set -euo pipefail

# shellcheck source=./common.sh
source "$(cd "$(dirname "$0")" && pwd)/common.sh"

mongo_exists=0
qdrant_exists=0

if docker ps -a --format '{{.Names}}' | grep -qx 'alerta-mongo'; then
  mongo_exists=1
  docker start alerta-mongo >/dev/null
fi

if docker ps -a --format '{{.Names}}' | grep -qx 'alerta-qdrant'; then
  qdrant_exists=1
  docker start alerta-qdrant >/dev/null
fi

if [[ "$mongo_exists" -eq 0 && "$qdrant_exists" -eq 0 ]]; then
  docker compose -f "$DOCKER_DIR/docker-compose.yml" up -d
else
  if [[ "$mongo_exists" -eq 0 ]]; then
    docker compose -f "$DOCKER_DIR/docker-compose.yml" up -d mongo
  fi

  if [[ "$qdrant_exists" -eq 0 ]]; then
    docker compose -f "$DOCKER_DIR/docker-compose.yml" up -d qdrant
  fi
fi

docker ps --filter "name=alerta-" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
