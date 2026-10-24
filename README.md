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

## Local setup with Docker Compose

1. Copy `server/.env.example` to `server/.env` and replace `JWT_SECRET` with a long random value. Set `GITHUB_WEBHOOK_SECRET` if you plan to receive webhook deliveries.
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

## Operational notes

- Run the API, both workers, and the scheduler as independently supervised processes in a deployment.
- The scheduler dispatches daily health snapshots at midnight in the `Asia/Kolkata` time zone.
- Configure a publicly reachable HTTPS webhook URL in GitHub for deployments; webhook signatures are verified against the raw request body.
- The performance-data seed script deletes existing tasks, dependencies, milestones, GitHub signals, and repository connections for its hard-coded development project. Review the script and use disposable data before running it.

## Project structure

```text
client/  React and Vite application
server/  Express API, MongoDB models, workers, scheduler, and tests
```
