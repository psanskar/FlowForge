# Architecture and Completion Roadmap

## Purpose and scope

FlowForge is a project execution monitoring platform. It should help a team see whether milestones are likely to be met, which execution signals explain the risk, and what needs attention. Task management is the source of execution data; risk and health analysis are the product's distinguishing workflow.

This document records the current implementation and a student-scale path to a production-minded project. It is based on the repository as it stands and is intended to guide the next implementation phases.

## Current architecture

```text
React client
  └─ REST API calls + Socket.IO project events
       └─ Express API (JWT auth, validation, project membership checks)
            ├─ MongoDB: users, projects, tasks, milestones, dependencies,
            │            GitHub repository/signals, risk history, health snapshots
            └─ Redis + BullMQ
                 ├─ GitHub webhook queue → GitHub worker → MongoDB signals
                 └─ Health snapshot queue → health worker → MongoDB snapshots
                      └─ scheduler dispatches daily snapshot jobs
```

The server is organized by domain modules under `server/src/modules`. The project membership list is the authorization boundary for project data. Task updates use a client-supplied version and a conditional MongoDB update to detect stale writes. GitHub webhook routes are mounted before JSON parsing so signature verification can use the raw body. The local Compose stack runs the API, client, workers, scheduler, MongoDB, and Redis as separate services.

## Domain and data model

| Entity | Responsibility and key relationships |
| --- | --- |
| User | Account identity and authentication. |
| Project | Owner, members and roles, lifecycle status, and project dates. |
| Task | Project work item, assignee, status, priority, due date, progress, milestone, activity timestamp, and optimistic concurrency version. |
| Dependency | Directed relationship between two tasks in the same project; a unique compound index prevents duplicate edges. |
| Milestone | Project deadline and completion status; tasks may reference it. |
| GitHubRepository | One connected repository per project, with unique repository identity. |
| GithubSignal | Normalized GitHub activity used for metrics and explainable risk analysis. |
| ProjectRiskHistory | Current and prior state of a risk identity, including severity changes and detection lifecycle. |
| ProjectHealthSnapshot | Daily health score, risk counts, task summary, and milestone summary for trend reporting. |
| GithubWebhookDelivery | Delivery tracking used to make webhook ingestion idempotent. |

## Main API surface

All routes are under `/api/v1`.

| Area | Routes |
| --- | --- |
| Authentication | `/auth` registration, login, and current-user access. |
| Projects | `/projects` create/list/get. |
| Tasks | `/projects/:projectId/tasks` create/list; `/tasks/:taskId` get/update/delete. |
| Dependencies | `/projects/:projectId/dependencies` list/create/delete. |
| Milestones | Project-scoped create/list/get/update/delete. |
| Execution health | Project health, dashboard, health trend, risk history, and GitHub metrics routes. |
| GitHub | Repository connection and signed webhook ingestion. |
| Health check | `/health` currently returns API process status. |

The server validates inputs at route boundaries and uses membership checks in domain services. Task listing supports pagination and filtering. The task update API requires a version and returns a conflict when another update has already advanced it.

## Confirmed strengths

- Risk outputs are explainable: they include stable identities, severity, and evidence text.
- Task writes detect stale client versions rather than silently overwriting concurrent changes.
- Project membership is checked in the services that access project-scoped records.
- Dependency creation rejects direct cycles through a graph traversal and duplicate relationships through a unique index.
- Dependency cycle checks and edge creation are serialized through a per-project MongoDB transaction sentinel on replica-set deployments. Standalone local MongoDB uses a process-local mutex; production must use a replica set or sharded cluster for cross-process serialization. Contending requests return `503 DEPENDENCY_GRAPH_BUSY` after the bounded wait.
- GitHub webhook signature verification and delivery idempotency have dedicated tests.
- Risk lifecycle and daily health history are modeled separately from live analysis.
- The server test suite covers core services, API behavior, workers, and Socket.IO; CI runs server tests and client lint/build.

### Project deletion and membership rules

- Permanent project deletion is not supported by the API. The project schema includes an `archived` status, but no archive transition endpoint is exposed yet. Treat archival as a future non-destructive state that retains tasks, dependencies, GitHub records, and risk history. Do not add permanent deletion until retention, export, and related-record handling are explicitly designed.
- Project creation records the creator as the project's sole `owner` member. Project-scoped access is granted by membership; current services do not distinguish owner permissions from member permissions, and there are no add-member, remove-member, or role-change endpoints.
- If membership management is added, only the owner may change membership, the owner must remain a member, and ownership must be transferred before the current owner can leave. Removing a member must also define what happens to their task assignments without deleting project history.

## Gaps and risks to close

### Must fix before calling the project production-minded

1. **Risk quality needs validation with real teams.** The current rule definitions, thresholds, evidence, representative outcomes, and known limitations are documented in [risk-contract.md](risk-contract.md). Dashboard cards show entity context, evidence, and recommended next steps with relevant links. Treat the thresholds as heuristic defaults until they are evaluated against real project histories.
2. **Public deployment is still pending.** The production Compose template has been validated, backup/restore was exercised against an isolated test database, and [deployment-runbook.md](deployment-runbook.md) documents startup, backup, restore, upgrade, and rollback. A public host, domain, and managed database services still need to be provisioned.
3. **Operational visibility is basic.** Liveness and readiness distinguish API process health from MongoDB/Redis readiness. An authenticated queue status endpoint reports worker heartbeats, queue counts, and failed webhook deliveries; see [operations-and-recovery.md](operations-and-recovery.md). Add alerting and a richer admin view only if the deployment needs them.
4. **Frontend accessibility coverage remains limited.** Browser tests now cover project/milestone/task creation, an actionable overdue-risk card, and stale task-edit rejection. Add broader keyboard and screen-reader checks during UI polish.

### Important follow-up

- The 5,000-task local performance baseline and query plans are recorded in [performance-profile.md](performance-profile.md). Re-run with larger data and concurrent requests before making production-capacity claims; add cursor pagination if measured list sizes require it.
- Before adding user deletion, project membership changes, or archive transitions, define their effects on tasks, dependencies, GitHub connections, and history records; retain project data by default.
- Add alerting for degraded queue status and failed webhook deliveries if the chosen deployment has an alert channel.
- Add API rate limits for authentication and any other public or expensive endpoints, with tests for the chosen limits.
- Review token expiry and logout/session behavior. Keep the current JWT model if it is sufficient for the demo; add refresh-token complexity only if the product requires long-lived sessions.
- Review structured/redacted request and job logs during deployment work; redact credentials, tokens, and webhook signatures.

### Optional polish

- Improve responsive layout, empty states, and keyboard/accessibility details after the core risk workflow is reliable.
- Add keyboard and screen-reader browser checks to the CI workflow.
- Add a compact demo seed command that is safe by default and refuses to target a non-demo database.
- Add richer GitHub matching between repository contributors and FlowForge members only if mapping ambiguity is surfaced to the user.
- Add Redis caching only after profiling shows repeated database reads are a bottleneck; avoid cache invalidation complexity as a speculative optimization.

## Prioritized implementation plan

| Phase | Deliverable | Exit criteria | Estimate |
| --- | --- | --- | --- |
| 1. Correctness foundation | Serialize concurrent dependency writes; document the current deletion and membership rules; add focused regression and access-control tests. | Concurrent opposing edges cannot leave a cyclic graph; owner creation and member-only project access are tested; unsupported deletion and membership operations are documented. | Completed |
| 2. Risk product contract | Document all current and trend signals, thresholds, evidence, representative outcomes, and limitations; surface entity context and recommended next steps. | Every current risk and trend signal has a documented meaning and evidence; live dashboard risks include a relevant next step and link when available. | Completed |
| 3. Operational readiness | Add MongoDB/Redis readiness checks, worker and queue failure visibility, correct worker database startup, scheduled snapshot dispatch handling, and safe recovery instructions. | Readiness distinguishes liveness from dependency health; authenticated queue status exposes worker heartbeats and failed counts; restart/replay guidance avoids destructive data cleanup. | Completed |
| 4. Browser confidence | Cover the project creation journey, actionable risk dashboard behavior, and conflicting task edits in Playwright. | Browser suite verifies an overdue risk's evidence/action link and confirms a stale edit cannot overwrite the latest task version. | Completed |
| 5. Demo deployment | Prepare production Compose, MongoDB backup/restore scripts, and an upgrade/rollback runbook; deploy one HTTPS environment with managed MongoDB/Redis. | Local backup was restored into a separate test database with matching collection counts. Public deployment still requires a host/domain and managed service credentials; complete that before calling the phase done. | Prepared; deployment pending |
| 6. Performance pass | Generate realistic data, profile key endpoints, inspect query plans, and tune only demonstrated bottlenecks. | At 5,000 synthetic tasks, dashboard service sampled 195–353 ms (3 runs) against a provisional 500 ms budget; task-list service sampled 13–42 ms against a 100 ms budget. The default page, dependency, and recent-signal queries used indexes and examined only returned documents. No speculative tuning was made. See [performance-profile.md](performance-profile.md). | Completed for the local demo baseline; production-scale/load testing remains follow-up |

For a student working part time, Phases 1–5 are roughly **2–4 weeks**; Phase 6 can be a further **2–4 days**. The range assumes familiarity with MERN and access to a deployment provider. A compact showcase can stop after Phase 4 and still demonstrate strong engineering, provided the deployment limitations are stated honestly.

## Working rules for implementation

- Preserve `sources/` as read-only synced reference material.
- Prefer a focused change with a regression test over adding several new features.
- Do not add Redis caching, AI-generated risk recommendations, or more dashboards until the current risk signals are validated and their value is clear.
- Keep risk rules deterministic and evidence-backed; tune thresholds using documented examples rather than intuition alone.
- Treat local Compose as a development/demo tool, not proof of production readiness.
