# Contract preflight — unresolved points for lead

Original tech.md v1.0 is preserved unchanged in this kit. This is a proposed audit, not an approved change to product contracts. Validate each issue against the original files and resolve details before delegating. Record mechanical completions in tech.md version + changelog and SDD files together. Owner approval for semantic changes; don't block unrelated slices.

| Issue | Evidence / proposed resolution |
|---|---|
| Missing response/request definitions | tech.md §5.4 lists DashboardResponse, RoadmapResponse, VerifyNodeResponse, MCPToolResult, CalendarResponse, ExecuteMCPRequest, DailyPulseRequest etc.; §6 only includes certain Zod schemas. Lead defines exact envelopes, error shape, and types consistent with existing names before scaffold. |
| Contract for dependency graph | DB has depends_on_node_id but RoadmapNodeSchema omits it. For visual edges use already-defined schema only if order alone suffices; explicit edge field requires owner review/version bump. |
| SourceCitation scope | DB allows hr_confidential, SourceCitationSchema excludes it. Keep restricted documents out of citations unless authorized schema change; never leak content. Clarify manager behavior and filter rules. |
| Pydantic/Zod/API spec consistency | specs directory does not exist in archive. Generate OpenAPI, MCP and behavior specs; test real server vs schemas, don't invent alternate shapes in workers. |
| Demo auth vs security | fixed X-Demo-Access-Code and switchable identities intentionally demo-only; reject header-role/user mismatch, derive effective role/cluster from DB, reject payload user spoofing, scope actions to user. No production deployment. |
| HITL + replay | service_requests has unique key and status but no explicit confirmation token contract / full result fields. Use persisted proposal + server-derived canonical payload / ownership checks, transactions and reconstruct stable result from persisted records; never dispatch client-supplied unapproved actions. If contract needs new field request approval. |
| HNSW missing | tech.md §2 promises HNSW, migration §4 omits vector index. Lead proposes versioned index addition and verifies pgvector search. |
| MCP and absence/calendar | spec demands sync of absences and calendar, enum doesn't include absence; decision required if existing types cannot accurately represent absence. Affected slice may be deferred, other calendar flows continue. |
| Intern timeline and level | UserProfile lacks start date though users.created_at exists; use declared data through existing dashboard response once mechanically specified. Streak/day/zone rules and mascot levels need explicit clarification if not derivable. |
| Material missing | no actual Avito Playbook, corporate connectors, real checklist, Telegram bot/token, public HTTPS, or LLM key provided. Use clearly labeled fake seed documents, offline mock and MCP test adapters. Do not present as real verification. |
| Testing threshold | text says >80%, commands use >=80. Start with >80 (80.01 minimum), all app code included. |
| Role docs assume real humans/PR merge | replace workflow with lead-controlled feature branch + local checkpoints; protect main in GitHub separately. CODEOWNERS placeholder @team-lead must not be installed as a fake owner. |

All changed contract files need coherent versioning. Keep record of actual owner decisions in docs/PROGRESS.md/ADR. Owner may later approve additional scope; a proposed resolution is not automatically accepted.
