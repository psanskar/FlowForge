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
- GitHub webhook signature verification and delivery idempotency have dedicated tests.
- Risk lifecycle and daily health history are modeled separately from live analysis.
- The server test suite covers core services, API behavior, workers, and Socket.IO; CI runs server tests and client lint/build.

## Gaps and risks to close

### Must fix before calling the project production-minded

1. **Concurrent dependency cycle creation.** Dependency creation checks the existing graph and writes the edge in separate operations. Two concurrent requests can each pass the cycle check against the old graph and create a cycle together. The sequential cycle check is useful but does not protect against this write race. Define and implement a cross-process serialization or conflict strategy, and add a regression test for opposing concurrent edges.
2. **Production deployment is not configured.** Compose is explicitly for local development. There is no production deployment target, TLS termination, managed secret integration, backup/restore procedure, or documented upgrade/rollback process. Keep this bounded to one deployable demo environment and document its limits.
3. **Operational health is shallow.** The API health endpoint reports that the process responds, not whether MongoDB and Redis are usable or workers are making progress. Add separate readiness/dependency checks and a small operational view of queue failures without leaking secrets.
4. **Frontend behavior lacks automated coverage.** The client currently has lint and build checks, but no component, browser-flow, or accessibility regression checks. Add a small number of high-value tests for registration/login, task conflict handling, and the project risk dashboard rather than broad shallow coverage.
5. **Risk quality needs explicit acceptance cases.** Rule tests exist, but thresholds and interpretation are not yet captured as product decisions. Document examples and expected outcomes for overdue work, stagnant work, dependency bottlenecks, milestone risk, workload imbalance, and GitHub signals; ensure the UI shows the evidence and relevant owner/task.

### Important follow-up

- Measure slow project dashboard and risk-history queries with realistic seed data; retain indexes that support observed filters/sorts and add cursor pagination where list sizes can grow.
- Verify user deletion, project membership changes, and project archival behavior across tasks, dependencies, GitHub connections, and history records; define retention versus cascading-delete rules.
- Confirm retry/backoff, dead-letter visibility, and safe replay behavior for both BullMQ queues. Webhook deliveries are idempotent; operational recovery still needs a documented procedure.
- Add API rate limits for authentication and any other public or expensive endpoints, with tests for the chosen limits.
- Review token expiry and logout/session behavior. Keep the current JWT model if it is sufficient for the demo; add refresh-token complexity only if the product requires long-lived sessions.
- Add basic structured request/job logs with correlation identifiers and redact credentials, tokens, and webhook signatures.

### Optional polish

- Improve responsive layout, empty states, and keyboard/accessibility details after the core risk workflow is reliable.
- Add a compact demo seed command that is safe by default and refuses to target a non-demo database.
- Add richer GitHub matching between repository contributors and FlowForge members only if mapping ambiguity is surfaced to the user.
- Add Redis caching only after profiling shows repeated database reads are a bottleneck; avoid cache invalidation complexity as a speculative optimization.

## Prioritized implementation plan

| Phase | Deliverable | Exit criteria | Estimate |
| --- | --- | --- | --- |
| 1. Correctness foundation | Prevent concurrent dependency writes from introducing cycles; clarify deletion and membership invariants; add focused regression tests. | Repeated concurrent opposite-edge attempts cannot leave a cyclic graph; domain behavior is documented. | 2–4 days |
| 2. Risk product contract | Record rule definitions, thresholds, evidence, ownership, and representative examples; refine dashboard presentation around actionability. | Each risk shown in the UI has a stable meaning, evidence, and a next action. | 2–3 days |
| 3. Reliability and security | Readiness checks, authentication rate limits, structured/redacted logs, queue retry/recovery notes, and production secret handling. | Failure modes are visible and the deploy guide includes safe recovery steps. | 3–5 days |
| 4. Client confidence | Add a few browser or component tests for core flows and accessible interaction checks. | CI catches regressions in login, task editing/conflicts, and the risk dashboard. | 3–5 days |
| 5. Demo deployment | Deploy one environment with HTTPS, managed MongoDB/Redis or equivalent services, secrets, backups, and rollback notes. | A reviewer can access the demo and the owner can restore it from documented backups. | 2–4 days |
| 6. Performance pass | Generate realistic data, profile key endpoints, inspect query plans, and tune only demonstrated bottlenecks. | Dashboard and list endpoints meet a stated response-time target at the chosen demo scale. | 2–4 days |

For a student working part time, Phases 1–5 are roughly **2–4 weeks**; Phase 6 can be a further **2–4 days**. The range assumes familiarity with MERN and access to a deployment provider. A compact showcase can stop after Phase 4 and still demonstrate strong engineering, provided the deployment limitations are stated honestly.

## Working rules for implementation

- Preserve `sources/` as read-only synced reference material.
- Prefer a focused change with a regression test over adding several new features.
- Do not add Redis caching, AI-generated risk recommendations, or more dashboards until the current risk signals are validated and their value is clear.
- Keep risk rules deterministic and evidence-backed; tune thresholds using documented examples rather than intuition alone.
- Treat local Compose as a development/demo tool, not proof of production readiness.
