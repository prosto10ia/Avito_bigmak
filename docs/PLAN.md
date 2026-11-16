# Delivery stages

Use one working branch; only lead coordinates writes and commits. Stage 1 is a hard prerequisite for feature work. At every stage: criteria -> implement -> separate QA/review -> fix -> real gate -> checkpoint. Schedule independently scoped frontend/backend work in parallel inside each vertical slice, not all slices at once.

| Stage | Scope | Demo checkpoint |
|---|---|---|
| 1 | LEAD.md Stage 0 + slice 1: preflight, SDD, Compose (PostgreSQL+pgvector, Redis, Flask, React, Grafana), seed/mock LLM, shared Zod/Pydantic, nine UI primitives, five routes/shell, dashboard, role switch, telemetry, CI/test tools. | Browser opens dashboard; offline seed; invalid roles rejected; coverage/build/smoke green. |
| 2 | DEV_A A1 + DEV_B B1: roadmap, CLI/quiz/artifact verification, XP, dependencies, guards. | Verify demo CLI log, once-only XP, unlock node, private key 422. |
| 3 | DEV_A A2 (RAG portion) + DEV_B B2: chat, retrieval, citations, conflicts, escalation, role access. | Offline question yields sources; conflict warning; missing topic escalates; restricted access 403. |
| 4 | DEV_A A2 (action portion) + DEV_B B3 (MCP portion): proposed action cards, explicit confirmation, four tools, fake adapters, persist requests. | No side effects before confirm; real persisted demo request; repeated confirm no duplicate; denied admin access. |
| 5 | DEV_A A3 + DEV_B B3 remainder: calendar, profile, Daily Pulse, summary/equator, integration and telemetry/Grafana. | Confirmed meeting appears in calendar; one pulse per day and XP; summary; all five tabs. |
| 6 | Full demo QA, mobile/desktop accessibility, browser console, deterministic fresh startup, regression suite, README and demo instructions. | End-to-end happy path and negatives green, offline walkthrough, no unreported blockers. |

Do not mark missing semantic decisions as passed. Prioritize unblocked functionality and record exact reduced scope if deadline intervenes. All corporate data/actions simulated unless real access is provided and explicitly approved. Frontend agent reads DEV_A; backend reads DEV_B; QA and reviewer read stage-specific criteria. For stage splits, lead allocates shared file changes sequentially. No competing edits to calendar, auth, MCP registry or common types.
