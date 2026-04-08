SHELL := /bin/bash

.PHONY: help bootstrap check infra-up infra-down dev dev-backend dev-frontend stop clean reset-deps

help:
	@echo "ALERTA 2.0 commands:"
	@echo "  make bootstrap    Install dependencies and prepare local environment"
	@echo "  make check        Validate Node, .env, ports, and Docker services"
	@echo "  make infra-up     Start MongoDB and Qdrant containers"
	@echo "  make infra-down   Stop MongoDB and Qdrant containers"
	@echo "  make dev          Start backend and frontend in development mode"
	@echo "  make dev-backend  Start only backend on port 3000"
	@echo "  make dev-frontend Start only frontend on port 3001"
	@echo "  make stop         Stop local dev processes on ports 3000 and 3001"
	@echo "  make clean        Stop dev processes and Docker infrastructure"
	@echo "  make reset-deps   Reinstall backend and frontend dependencies from scratch"

bootstrap:
	@./scripts/bootstrap.sh

check:
	@./scripts/check-env.sh

infra-up:
	@./scripts/infra-up.sh

infra-down:
	@./scripts/infra-down.sh

dev:
	@./scripts/dev.sh

dev-backend:
	@./scripts/dev-backend.sh

dev-frontend:
	@./scripts/dev-frontend.sh

stop:
	@./scripts/stop.sh

clean:
	@./scripts/clean.sh

reset-deps:
	@./scripts/reset-deps.sh
