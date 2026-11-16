# AI-buddy progress

Stage 1–5 MVP implementation is present. Lead-owned SDD v1.0, Compose topology, PostgreSQL/pgvector migration and Grafana provisioning are present. The demo is offline by default and uses synthetic fixtures only.

- [x] Stage 1 — preflight and scaffold / dashboard (Compose health, backend/frontend checks and typed dashboard path verified)
- [x] Stage 2 — roadmap / XP (roadmap dependencies, artifact guardrails and idempotent XP verification)
- [x] Stage 3 — RAG / conflicts / escalation (role/cluster filtering, citations, conflict warning and escalation)
- [x] Stage 4 — MCP / confirmation (four simulated tools, confirmation, payload validation and user-scoped idempotency)
- [x] Stage 5 — calendar / pulse / summaries (calendar aggregation, offline summary and once-per-day pulse)
- [x] Stage 6 — end-to-end / demo readiness (MVP path and mandatory quality gate are green; remaining items are P2)

For each checkpoint record: stage, tech.md version, commit, tests and exit codes, actual coverage, reviewer verdict/findings, unresolved decisions, next step. If interrupted, resume first unverified stage from current working tree; do not reset it.

## Stage 1 acceptance checklist

- [x] `docker compose config --quiet` and all five services healthy (verified with `docker compose up -d --wait`; host ports are loopback and use 15432/16379 to avoid unrelated local services).
- [x] Offline, idempotent seed populates three demo users, six roadmap periods, synthetic knowledge, restricted fixtures and calendar events.
- [x] `/health`, dashboard, role switch and telemetry persist/validate state; auth mismatch and bad demo code are rejected.
- [x] Frontend five-tab browser fallback, role switch and dashboard render with typed client/UI primitives.
- [x] Frontend/backend format, lint, typecheck, tests, coverage >80%, production build; Playwright image is pinned to the matching 1.65.1 browser runtime.
- [ ] Final independent reviewer PASS on the last micro-diff (review was run and its P1 findings were fixed; the requested audit paused the rerun).

## MVP evidence checkpoint

- Backend: `pytest` 27 tests, 89.47% coverage; Ruff format/check pass.
- Frontend: 10 Vitest tests, 93.98% configured coverage, format/lint/typecheck/build pass.
- Acceptance QA: roadmap/RAG/MCP/calendar/pulse QA scenarios pass after contract fixes.
- Full gate passed with `DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 bash scripts/check.sh` after the current fixes: backend/frontend rebuild, healthchecks, frontend checks/10 tests/build, backend 27 tests/89.47% coverage and 2 Playwright E2E.

## Current MVP fixes

- `/health` probes PostgreSQL and Redis and returns `503` when dependencies are unavailable; tests skip Redis only for isolated SQLite unit apps.
- MCP validates the complete payload for secrets before side effects, restricts service names, scopes idempotency to user/tool and uses PostgreSQL advisory locks for concurrent first calls.
- Service-action confirmation carries the selected roadmap node and only completes an active/waiting-approval service node (retries of an already done node are idempotent); Daily Pulse uses the same concurrency protection.
- Profile data is hydrated from the backend when the profile tab opens; seed includes one-on-one, team sync, deadline and equator events.
- The canonical week-one route now contains `node_w1_cli` (CLI guide) followed by `node_w1_access` (MCP service action); roadmap verification enforces role ownership and dependency status.
- Dashboard now renders greeting/date/timeline and opens Daily Pulse directly; MCP absence requests validate ISO dates and idempotency storage is scoped by user and tool.
- CLI artifact verification now requires an explicit successful `avito-cli` or `stash_ssh` line and rejects failure markers; service-action completion keeps the returned offline ticket visible in the roadmap modal.
- Roadmap verification now matches artifact types to node types, keeps contract-supported guide screenshots, blocks generic verification of service-action nodes, and maps Daily Pulse blockers to PostgreSQL `TEXT[]` while retaining SQLite test compatibility.
- Service-action UI uses the explicit confirmation widget and refuses to display success unless the backend returns an external ticket ID.

## Unresolved contract gaps

- Health/readiness response and exact dashboard/telemetry envelopes were absent from the frozen document. The scaffold uses additive internal health output and the named existing response fields; no existing field or business rule is changed.
- Synthetic demo documents, service adapters and credentials remain explicitly non-production by contract.
- Redis is provisioned and healthy for the demo, but the current MVP RAG path uses deterministic local retrieval; Redis caching and pgvector ranking remain post-MVP hardening work.
- The Playwright dependency reports npm audit findings in the demo toolchain; dependency upgrades are deferred until after the MVP path is stable.
- Final reviewer rerun for the last small contract/test adjustments is pending because development was paused for the requested audit; no P0/P1 product blocker remains in the latest passing gate.
