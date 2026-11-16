#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
export LLM_API_KEY=""
# Test only a local/demo Compose stack. Never point at production.
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 180
docker compose exec -T frontend npm run format:check
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run typecheck
docker compose exec -T frontend npm run test:coverage
docker compose exec -T frontend npm run build
docker compose exec -T backend ruff format --check .
docker compose exec -T backend ruff check .
docker compose exec -T backend pytest --cov=app --cov-report=term-missing --cov-report=xml:coverage.xml --cov-fail-under=80.01
docker compose exec -T frontend npm run test:e2e
printf '\nQUALITY GATE PASSED\n'
