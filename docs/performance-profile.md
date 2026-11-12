# Performance profile

## Scope and method

Profiled on 2026-11-12 against the isolated `flowforge_demo` MongoDB database in the test Compose stack. The regular `flowforge` database was not used or modified. The disposable `FlowForge Demo` project contains 5,000 synthetic tasks, 100 dependencies, 10 milestones, and 1,000 synthetic GitHub signals; task records are evenly distributed across statuses and priorities and assigned to the demo owner.

The measurements use the local development machine and MongoDB container, not a production host. The profile script measured project risk-data loading, deterministic risk calculation, and `executionStats` for the default paginated task query, project dependency lookup, and recent GitHub signals. The actual task service was also timed, including its matching total-count query; the dashboard service's built-in timings were sampled three times.

## Results

| Operation | Observed | Notes |
| --- | ---: | --- |
| Risk-data load (5,000 tasks) | 129–244 ms across dashboard samples; 190 ms in standalone profile | Four project-scoped collections are loaded concurrently. |
| Deterministic risk analysis | 22–36 ms in dashboard samples; 38 ms in standalone profile | Synthetic data produced 4,422 risks; this is a stress fixture, not a claim about a typical team's risk rate. |
| Full dashboard service | 195–353 ms across 3 samples; the latter 2 were 197 and 195 ms | Includes health aggregation, user/repository lookup, and dashboard assembly. |
| Actual task list service | 13–42 ms across 3 samples, returning 20 of 5,000 tasks | Includes membership lookup, page query, and total count. |
| Default paginated task query | 3 ms; 20 keys and 20 documents examined | Uses `project_1_dueDate_1_createdAt_-1__id_1`; no collection scan or blocking sort. |
| Project dependency query | 4 ms; 100 keys and 100 documents examined | Uses `project_1_fromTask_1`. |
| Recent GitHub signals query | 4 ms; 200 keys and 200 documents examined | Uses `project_1_occurredAt_-1`. |

Three service samples are a local baseline, not a statistically robust p95 or a concurrency/load test. They include one colder dashboard sample, so the warm results should not be treated as a guaranteed response time.

## Decision and next threshold

No index or query change is justified by this measurement: the inspected query plans use the intended indexes, examine only the returned page/records, and the measured service times are within a reasonable student-demo budget at 5,000 tasks. Avoid adding speculative indexes or Redis caching. Keep the existing indexes.

For future comparisons on the same environment, use these provisional budgets at 5,000 tasks: dashboard service under 500 ms and task-list service under 100 ms. Before increasing scale or claiming production capacity, gather at least 30 warm samples, report p50/p95, test concurrent requests, and profile the production-like database and deployment resources. Revisit risk dashboard pagination/aggregation if full-project loading becomes the measured bottleneck at larger project sizes.

## Reproduce

Follow the guarded demo-project and synthetic-data instructions in the root README. Set `MONGO_URI` explicitly to `mongodb://127.0.0.1:27018/flowforge_demo` when using the isolated test Compose MongoDB, set `DEMO_PROJECT_ID` to the disposable project ID, seed the chosen size, then run `node scripts/profile-performance.js` from the `server/` directory. From the repository root, use the `docker compose exec ... api node scripts/profile-performance.js` command shown in the README. The seed replaces only the explicitly selected demo project's tasks, dependencies, milestones, GitHub repository/signals, risk history, and snapshots.
