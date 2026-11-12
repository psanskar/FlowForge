# Deployment runbook

## Current state and prerequisites

The production Compose template is a deployment candidate, not a live deployment. This repository does not select a cloud provider, register a domain, provision managed MongoDB/Redis, or create secrets. The production stack expects those resources to be available before startup.

Prepare a Linux Docker host with a public IP, DNS for the chosen hostname, and inbound TCP 80/443. Provision a transaction-capable MongoDB replica set or sharded cluster and managed Redis with TLS, network access restricted to the host, backups enabled, and credentials limited to the required databases. Keep MongoDB and Redis off the public internet. Production processes fail startup if MongoDB cannot support transactions; standalone MongoDB remains suitable only for local single-process development.

Create a root .env file on the host with:

    DOMAIN=flowforge.example.com
    MONGO_URI=mongodb+srv://...
    REDIS_URL=rediss://...
    JWT_SECRET=<unique random secret of at least 32 characters>
    GITHUB_WEBHOOK_SECRET=<secret of at least 32 characters>
    OPERATIONS_API_KEY=<unique random secret of at least 32 characters>
    JWT_EXPIRES_IN=1d

The root .env file is ignored by Git. Do not put real secrets in source control, issue comments, or terminal recordings. Confirm the MONGO_URI database name and the MongoDB user's access before starting the app. Configure the managed Redis service to support BullMQ's required Redis behavior and avoid key eviction.

## First deployment

From the deployment checkout at a reviewed release commit:

    docker compose -f docker-compose.production.yml config --quiet
    docker compose -f docker-compose.production.yml up -d --build
    docker compose -f docker-compose.production.yml ps
    docker compose -f docker-compose.production.yml logs --tail 100 api github-worker health-worker health-scheduler proxy

Wait for the API to report healthy. Confirm https://$DOMAIN/api/v1/health and https://$DOMAIN/api/v1/ready return success, then register/login and create a small demo project. Inspect `/api/v1/ops/queues` using the `X-FlowForge-Ops-Key` header. Verify the GitHub webhook endpoint at https://$DOMAIN/api/v1/github/webhook using a test delivery from the intended repository.

Caddy obtains and renews HTTPS certificates automatically. DNS must resolve to the host and ports 80 and 443 must be reachable. The client bundle receives its public API origin at build time, so rebuild the client after changing DOMAIN.

## MongoDB backup

Managed provider snapshots and point-in-time recovery are the primary production backup. Also keep periodic logical exports in an encrypted, access-controlled, off-host location. The repository scripts use the official mongo:8.0.30 image, which includes MongoDB Database Tools. The backup script dumps the database named in MONGO_URI to a compressed archive under backups/ by default:

    node scripts/backup-mongo.js

Set FLOWFORGE_BACKUP_DIR to a protected location to change the output directory. Protect the archive as production data: it contains account and project information. The repository ignores /backups/ to prevent accidental commits.

For a self-hosted standalone MongoDB, pause writers before taking a logical dump if a consistent backup is required. For a managed replica set, use the provider's snapshot/PITR feature for point-in-time recovery; this single-database logical dump is not an oplog-based point-in-time backup. Redis holds BullMQ state. Treat MongoDB as the source of truth for GitHub delivery idempotency and project data; after Redis loss, GitHub can redeliver webhook events and health snapshots will be dispatched on the next scheduled run.

## Restore drill

Restore only to an explicitly named target database. The script requires the target name twice and requires MONGO_URI to name that same target. It remaps collection namespaces from the archive's source database and replaces matching collections in the target:

    node scripts/restore-mongo.js --archive=backups/flowforge-example-<timestamp>.archive.gz --source-db=flowforge --target-db=flowforge_restore_test --confirm-target=flowforge_restore_test

Set MONGO_URI to the restore target before running the command. Prefer a new, empty database for a drill. The script uses mongorestore --drop for collections present in the archive; verify the target name carefully because this replaces matching target collections.

After restore, connect to the target and compare collection counts with the source, inspect representative documents and indexes, and start an application instance pointed only at the restored database. Verify login, project/task retrieval, dashboard risks, and health history before calling a restore successful. Record the archive timestamp, source and target database names, tool output, and any gaps. Do not run a restore drill against the live database.

## Upgrade procedure

1. Record the currently deployed Git commit and confirm a recent provider snapshot and logical archive exist.
2. Review schema/index changes and test the new release against a restored copy of production data. There is no versioned migration framework yet; changes to stored documents must remain backward-compatible or include a separately reviewed migration and recovery plan.
3. Check out the intended release commit on the deployment host. Review the Compose diff and validate required environment variables with docker compose config --quiet.
4. Build and roll out with docker compose -f docker-compose.production.yml up -d --build.
5. Inspect container status and logs. Confirm the API readiness endpoint, authenticated queue status, login, project dashboard, and a signed GitHub test delivery.
6. Keep the previous release commit available until the new release is stable. Record the deployed commit and backup reference.

## Rollback procedure

1. If the API is unhealthy or key journeys fail, stop further rollout and inspect logs and /api/v1/ready.
2. Check out the previous known-good release commit in the deployment checkout.
3. Rebuild and start that version with docker compose -f docker-compose.production.yml up -d --build.
4. Recheck readiness, queue workers, login, project data, and webhook processing.
5. If the release changed stored data incompatibly, rolling back code alone may be unsafe. Pause writes and restore the pre-upgrade snapshot into a separately verified database first; switch the connection only after the restored data has passed verification.

Compose currently builds from the checked-out source and does not publish immutable registry images or automate rolling releases. Keep release commits available on the host until a tagged-image pipeline is added. Do not remove MongoDB/Redis backups or volumes during rollback.
