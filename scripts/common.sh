#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
DOCKER_DIR="$ROOT_DIR/docker"
RUN_DIR="$ROOT_DIR/.run"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
REQUIRED_NODE_VERSION="$(cat "$ROOT_DIR/.nvmrc")"

load_nvm() {
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    source "$NVM_DIR/nvm.sh"
  else
    echo "nvm not found at $NVM_DIR/nvm.sh"
    echo "Install nvm first: https://github.com/nvm-sh/nvm"
    exit 1
  fi
}

use_project_node() {
  load_nvm
  local node_bin
  node_bin="$(nvm which "$REQUIRED_NODE_VERSION")"
  if [[ ! -x "$node_bin" ]]; then
    echo "Node $REQUIRED_NODE_VERSION is not installed."
    echo "Run: nvm install $REQUIRED_NODE_VERSION"
    exit 1
  fi

  NODE_BIN="$node_bin"
  NODE_DIR="$(dirname "$NODE_BIN")"
  NPM_BIN="$NODE_DIR/npm"
  export NODE_BIN NODE_DIR NPM_BIN
  export PATH="$NODE_DIR:$PATH"
}

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file"
    exit 1
  fi
}

port_in_use() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for_http() {
  local url="$1"
  local attempts="${2:-30}"
  local delay="${3:-1}"

  for ((i = 1; i <= attempts; i += 1)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  return 1
}

ensure_backend_env() {
  if [[ ! -f "$BACKEND_DIR/.env" ]]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    echo "Created backend/.env from backend/.env.example"
  fi
}

ensure_run_dir() {
  mkdir -p "$RUN_DIR"
}
