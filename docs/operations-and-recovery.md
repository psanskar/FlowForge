# Operations and recovery

## Health endpoints

- GET /api/v1/health is a liveness check. It reports that the API process can answer HTTP requests; it does not check dependencies.
- GET /api/v1/ready is the API readiness check. It pings MongoDB and Redis with a short timeout and returns HTTP 503 if either dependency is unavailable. The local and production Compose API health checks use this endpoint.
- GET /api/v1/ops/queues requires the `X-FlowForge-Ops-Key` header with the configured `OPERATIONS_API_KEY`. It is separate from user login so any registered account cannot inspect operational state. It returns queue counts for waiting, active, completed, failed, delayed, paused, and waiting-child jobs; worker/scheduler heartbeat freshness; and the count of GitHub webhook deliveries marked FAILED. It does not return job payloads, IDs, credentials, or failure text.

Worker heartbeats expire after 45 seconds if a process exits without a clean shutdown. Queue failed counts are limited by BullMQ retention settings: seven days and 5,000 failed jobs for webhooks, and seven days and 5,000 failed snapshot jobs. GitHub webhook delivery failure records are retained in MongoDB.

## Startup and incident checks

From the repository root, inspect service state and recent logs:

    docker compose ps
    docker compose logs --tail 100 api github-worker health-worker health-scheduler
    docker compose exec api node -e "fetch('http://127.0.0.1:5000/api/v1/ready').then(async r => { console.log(r.status, await r.text()); process.exit(r.ok ? 0 : 1); })"

For a deployed environment, use the public HTTPS health endpoint or run the readiness request inside the API container. Send `X-FlowForge-Ops-Key: $OPERATIONS_API_KEY` when inspecting queue status. Keep this key in a secret manager and do not copy it into shared logs or screenshots.

## Recovery procedure

1. Confirm MongoDB and Redis availability with /api/v1/ready. Check provider status and API logs before restarting anything.
2. Check /api/v1/ops/queues and worker logs. A missing heartbeat means the corresponding worker or scheduler is stopped or has been unable to reach Redis.
3. Restart only the affected process after correcting its dependency or configuration:

       docker compose restart github-worker
       docker compose restart health-worker
       docker compose restart health-scheduler

   For production Compose, use the same commands with -f docker-compose.production.yml and the configured environment file.
4. BullMQ retries transient job errors with exponential backoff. A crashed worker's active job is recovered by BullMQ stalled-job handling when a worker returns. Confirm that the failed count stops increasing and work resumes.
5. GitHub webhook failures are marked FAILED after retries. Use GitHub's webhook delivery page to redeliver the original delivery after fixing the cause; the signed webhook endpoint can reclaim failed delivery records idempotently.
6. Health snapshot jobs are retried three times. If one remains failed, inspect worker logs and dependencies; the next scheduled dispatch runs at 00:00 Asia/Kolkata. Verify the relevant project's latest health snapshot before considering manual intervention.

Do not run docker compose down -v, delete Redis keys, or remove Mongo/Redis volumes as a recovery step. Those actions erase durable data or queue state. If a restart does not restore processing, preserve logs and queue counts and investigate before attempting data cleanup.

## Known limits

Queue status is a lightweight operational snapshot, not a metrics or alerting system. The API returns counts and heartbeat state but does not provide an admin UI, alert delivery, per-job failure details, or a manual health-snapshot replay endpoint. Use service logs and the queue's retained failure counts for diagnosis. Backups, restore drills, and production upgrade/rollback procedures are separate deployment milestone work.
