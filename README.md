# FlowForge

FlowForge helps teams spot execution risks before they threaten a project milestone. It combines project, task, milestone, and dependency data with explainable risk signals, project health history, and GitHub activity.

## What is implemented

- Account registration and login with JWT authentication.
- Projects, tasks, milestones, task assignment, filtering, pagination, and optimistic task updates.
- Task dependencies with cycle prevention.
- Project dashboards with evidence-backed execution risks, workload signals, health scores, and historical health trends.
- GitHub repository connection, activity metrics, and signed webhook ingestion through a background queue.
- Socket.IO project updates and scheduled health snapshots using Redis and BullMQ.

## Requirements

- Node.js 22 or newer.
- MongoDB 8 or a compatible MongoDB deployment.
- Redis 7 or a compatible Redis deployment.
- npm.
- Docker Compose (optional, for the containerized local setup).

The API, client, GitHub webhook worker, health snapshot worker, and health snapshot scheduler run as separate processes. Keep MongoDB and Redis available while they are running.

The API validates MongoDB, Redis, JWT, webhook-secret, and port settings before listening. Worker and scheduler entrypoints validate their required service URLs before starting. `JWT_SECRET` and `GITHUB_WEBHOOK_SECRET` must each contain at least 32 characters. The webhook secret must match the value configured in GitHub repository webhook settings.

## Local setup with Docker Compose

1. Copy `server/.env.example` to `server/.env` and replace both placeholder secrets with unique random values of at least 32 characters. The API requires a webhook secret because the signed webhook endpoint is enabled.
   Copy the root `.env.example` to `.env` if you need to change the Compose MongoDB database name.
2. Start the stack from the repository root:

   ```sh
   docker compose up --build
   ```

3. Open [http://localhost:8080](http://localhost:8080). The API health endpoint is [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health).

Stop the stack with `docker compose down`. MongoDB and Redis data persist in named volumes. To discard that data, use `docker compose down --volumes`; this permanently deletes the local databases.

This Compose file is for local development and demos. It does not configure production TLS, external access controls, backups, or managed secret storage. Do not expose its default MongoDB or Redis services publicly.

## Local setup without Docker

1. Start MongoDB and Redis locally. The default connection strings are `mongodb://127.0.0.1:27017/flowforge` and `redis://127.0.0.1:6379`.
2. Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`. In the server file, set `JWT_SECRET` to a long random value and set `CLIENT_URL` to the exact browser origin used by Vite. Multiple comma-separated origins are supported, for example `http://localhost:5173,http://localhost:5174`.
3. Confirm `VITE_API_BASE_URL` in the client file points to the API.
4. Install dependencies in each package directory:

   ```sh
   cd server
   npm ci
   cd ../client
   npm ci
   ```

5. Start each process in its own terminal from the indicated directory:

   ```sh
   # server/
   npm run dev
   ```

   ```sh
   # server/
   npm run worker:github
   ```

   ```sh
   # server/
   npm run worker:health
   ```

   ```sh
   # server/
   npm run scheduler:health
   ```

   ```sh
   # client/
   npm run dev
   ```

Open the URL printed by Vite. The API health endpoint is `http://localhost:5000/api/v1/health`.

### Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Server processes | Runtime mode; normally `development` locally. |
| `PORT` | API | HTTP port; defaults to `5000`. |
| `MONGO_URI` | Server processes | MongoDB connection string. |
| `REDIS_URL` | API and background processes | Redis connection string for BullMQ; defaults to local Redis. |
| `JWT_SECRET` | API | Secret used to sign and verify authentication tokens. Set a unique, long random value. |
| `JWT_EXPIRES_IN` | API | Optional JWT lifetime; defaults to `1d`. |
| `CLIENT_URL` | API and Socket.IO | Allowed frontend origin or comma-separated list of origins. Defaults to `http://localhost:5173`. |
| `GITHUB_WEBHOOK_SECRET` | API | Shared secret configured on the GitHub webhook. Required to accept signed webhook deliveries. |
| `VITE_API_BASE_URL` | Client build | API base URL; defaults in the example to `http://localhost:5000/api/v1`. |
| `MONGO_DATABASE` | Docker Compose | Optional MongoDB database name; defaults to `flowforge`. Use `flowforge_demo` for performance seed data. |

Never commit `.env` files or use development credentials in a deployed environment. Configure the same MongoDB, Redis, and JWT values for every server-side process. Configure the API's `CLIENT_URL` to match the actual client origin, including its port.

## Using the app

1. Register an account and create a project.
2. Add tasks, set priorities and due dates, and assign tasks to project members.
3. Add milestones and task dependencies. The API rejects dependency cycles.
4. Open the project workspace to review its dashboard, active risks and supporting evidence, milestone progress, and health trend. Historical trends populate after snapshots have been captured.
5. To use GitHub signals, connect a repository in the project and configure a GitHub webhook to send deliveries to `/api/v1/github/webhook` on the API host, using the same `GITHUB_WEBHOOK_SECRET` as the server.

## Tests and quality checks

The client provides lint and production-build scripts:

```sh
cd client
npm run lint
npm run build
```

The server suite uses a real MongoDB database. Create `server/.env.test` with `MONGO_URI` pointing to a **dedicated disposable test database** and set `JWT_SECRET` and `GITHUB_WEBHOOK_SECRET`. Then run:

```sh
cd server
npm test -- --runInBand
```

The test setup drops the configured test database after the suite completes. Never point `server/.env.test` at development, staging, or production data.

With MongoDB, Redis, and the API environment variables available, the startup smoke check starts the real API process and checks its health endpoint:

```sh
cd server
npm run smoke
```

## Operational notes

- Run the API, both workers, and the scheduler as independently supervised processes in a deployment.
- The scheduler dispatches daily health snapshots at midnight in the `Asia/Kolkata` time zone.
- Configure a publicly reachable HTTPS webhook URL in GitHub for deployments; webhook signatures are verified against the raw request body.
- Authentication endpoints use Redis-backed rate limits shared across API instances: 10 login attempts per IP per 15 minutes and 5 account registrations per IP per hour.
- GitHub API requests already retry rate limits and transient server errors with bounded backoff. Webhook signatures are validated and duplicate deliveries are tracked.

## Production deployment template

`docker-compose.production.yml` builds the API, workers, scheduler, and client, then serves them through Caddy with automatic HTTPS. It expects MongoDB and Redis to be supplied as managed services; the production stack intentionally does not run database containers.

1. Provide a Linux Docker host with Docker Compose, a DNS name pointing to it, and inbound TCP ports 80 and 443 available for Caddy's certificate issuance and HTTPS traffic.
2. Configure `MONGO_URI` for a production MongoDB database and `REDIS_URL` for a production Redis instance. Restrict both services to the application host/network and enable provider backups and access controls.
3. Set `DOMAIN`, `JWT_SECRET`, and `GITHUB_WEBHOOK_SECRET` in the deployment environment. Use unique random secrets of at least 32 characters; do not commit them or put them in the Compose file.
4. From the repository root, build and start with `docker compose -f docker-compose.production.yml up --build -d`, then check `docker compose -f docker-compose.production.yml ps` and `https://<DOMAIN>/api/v1/health`.
5. Configure the GitHub repository webhook to `https://<DOMAIN>/api/v1/github/webhook`, select the events the app supports, and enter the same `GITHUB_WEBHOOK_SECRET`.

Back up MongoDB and Redis according to their managed-provider procedures and test restoration before relying on the deployment. Caddy's certificate and configuration data use named Docker volumes. This template does not provision a cloud host, managed databases, DNS, secret storage, monitoring, or backups; those provider resources and credentials must be configured by the project owner. For changes, deploy a reviewed image/build and check the API health endpoint and worker logs.

## Demo and performance data

The performance seed replaces data only inside a selected demo project. It refuses databases outside the `flowforge_demo`, `flowforge_dev`, or `flowforge_test` naming pattern, requires an explicit replacement flag, and only accepts projects whose name contains `Demo` or `Performance`.

1. Copy the root `.env.example` to `.env` and set `MONGO_DATABASE=flowforge_demo`.
2. Copy `server/.env.example` to `server/.env`, set local secrets of at least 32 characters, and start the stack with `docker compose up --build`.
3. Create a disposable demo account and project inside the API container (replace the sample values with a local email and a unique password of at least 12 characters):

   ```sh
   docker compose exec -e DEMO_OWNER_EMAIL="demo@example.local" -e DEMO_OWNER_PASSWORD="choose-a-unique-local-password" api node scripts/create-demo-project.js
   ```

   The command prints the project ID. Log in to the app with the demo account if you want to view the seeded project in the UI.

4. Replace `YOUR_PROJECT_ID` with the printed ID and seed the project:

   ```sh
   docker compose exec -e DEMO_PROJECT_ID=YOUR_PROJECT_ID api node scripts/seed-performance-data.js --replace-project-data
   ```

The default dataset contains 100 tasks, 10 milestones, up to 100 dependency edges, and 50 GitHub activity records. Increase it with `SEED_TASK_COUNT` (up to 50,000) or `SEED_SIGNAL_COUNT` (up to 10,000):

```sh
docker compose exec -e DEMO_PROJECT_ID=YOUR_PROJECT_ID -e SEED_TASK_COUNT=5000 api node scripts/seed-performance-data.js --replace-project-data
```

Each run replaces the selected project's tasks, dependencies, milestones, GitHub repository/signals, risk history, and health snapshots. It does not delete the project or user accounts. Do not run it against a project containing work you want to keep.

To measure the loaded project data, deterministic risk calculation, and MongoDB query plans:

```sh
docker compose exec -e DEMO_PROJECT_ID=YOUR_PROJECT_ID api node scripts/profile-performance.js
```

The profile command is read-only and reports the actual query plans, documents examined, and timings for the selected project. Increase `SEED_TASK_COUNT` before profiling to exercise larger datasets.

## Project structure

```text
client/  React and Vite application
server/  Express API, MongoDB models, workers, scheduler, and tests
```
