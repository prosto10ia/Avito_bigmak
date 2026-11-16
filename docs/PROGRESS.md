# AI-buddy progress

Stage 1–5 MVP implementation is present. Lead-owned SDD v1.0, Compose topology, PostgreSQL/pgvector migration and Grafana provisioning are present. The demo is offline by default and uses synthetic fixtures only.

- [x] Stage 1 — preflight and scaffold / dashboard (Compose health, backend/frontend checks and typed dashboard path verified)
- [x] Stage 2 — roadmap / XP (roadmap dependencies, artifact guardrails and idempotent XP verification)
- [x] Stage 3 — RAG / conflicts / escalation (role/cluster filtering, citations, conflict warning and escalation)
- [x] Stage 4 — MCP / confirmation (four simulated tools, confirmation, payload validation and user-scoped idempotency)
- [x] Stage 5 — calendar / pulse / summaries (calendar aggregation, offline summary and once-per-day pulse)
- [x] Stage 6 — end-to-end / demo readiness (MVP path and mandatory quality gate are green; remaining items are P2)
- [x] Stage 7 — Interactive UI Polish (five-screen interaction audit, clickable flows, feedback states and regression coverage)

For each checkpoint record: stage, tech.md version, commit, tests and exit codes, actual coverage, reviewer verdict/findings, unresolved decisions, next step. If interrupted, resume first unverified stage from current working tree; do not reset it.

## Stage 1 acceptance checklist

- [x] `docker compose config --quiet` and all five services healthy (verified with `docker compose up -d --wait`; host ports are loopback and use 15432/16379 to avoid unrelated local services).
- [x] Offline, idempotent seed populates three demo users, six roadmap periods, synthetic knowledge, restricted fixtures and calendar events.
- [x] `/health`, dashboard, role switch and telemetry persist/validate state; auth mismatch and bad demo code are rejected.
- [x] Frontend five-tab browser fallback, role switch and dashboard render with typed client/UI primitives.
- [x] Frontend/backend format, lint, typecheck, tests, coverage >80%, production build; Playwright image is pinned to the matching 1.65.1 browser runtime.
- [x] Final independent reviewer PASS on the last micro-diff; P0/P1 absent, P2 items are listed in the Stage 7 backlog.

## MVP evidence checkpoint

- Backend: `pytest` 29 tests, 88.77% coverage; Ruff format/check pass.
- Frontend: 10 Vitest tests, 93.98% configured coverage, format/lint/typecheck/build pass.
- Acceptance QA: roadmap/RAG/MCP/calendar/pulse QA scenarios pass after contract fixes.
- Full gate passed with `bash scripts/check.sh` after the current fixes: backend/frontend rebuild, healthchecks, frontend checks/16 tests/build, backend 29 tests/88.77% coverage and 4 Playwright E2E.

## Stage 7 — Interactive UI Polish checkpoint

- Scope completed: dashboard task/meeting/progress cards and quick links; roadmap node detail states and deep links; chat user messages, local synthetic-source preview, copy/cancel/loading/error/success states; calendar month/day navigation, today reset, date filtering and event details; profile progress/reward details and role-switch feedback.
- Regression evidence: `bash scripts/check.sh` passed; frontend 16 Vitest tests with 97.32% configured coverage, backend 29 pytest tests with 88.77% coverage, production build and 4 Playwright E2E tests passed.
- Security follow-up: side-effect MCP tools now require a chat-persisted proposal bound to user, tool, idempotency key and exact payload; exact confirmed replay remains idempotent. Roadmap service actions use that proposal flow, with the active service-action node selected server-side; onboarding verification is exposed only through the protected roadmap endpoint. Added `backend/tests/test_mcp_proposal_binding.py` and updated affected contract tests.
- Current commit: will be recorded in the follow-up documentation commit. `.DS_Store` remains an unrelated user change and is not staged.

### Deferred P2 backlog

- Extend frontend coverage collection to all newly changed routes/components.
- Add Escape/focus management to calendar and meeting detail dialogs.
- Tighten the MCP success response schema and revisit Redis caching/pgvector ranking after the demo path.
- Make chat proposal creation atomic under concurrent identical requests (`ServiceRequest` unique-key race).
- Split the protected roadmap verification type from the public proposed-action type in frontend schemas.

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
- Final reviewer PASS: no P0/P1 product blocker remains; P2 backlog is intentionally deferred after the 30-minute MVP-focused scope.
