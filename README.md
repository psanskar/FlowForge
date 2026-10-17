# FlowForge

FlowForge helps teams see whether project work is on track by combining task status, deadlines, dependencies, contributor workload, and GitHub activity into explainable project health signals.

## Run locally with Docker Compose

Prerequisites: Docker Desktop running, plus a private JWT secret for local development.

1. Copy `.env.example` to `.env` in the repository root.
2. Replace `JWT_SECRET` with a unique random value. Keep `.env` private; it is ignored by Git.
3. Start the stack with `docker compose up --build -d`.
4. Open the client at `http://localhost:5173`. The API health endpoint is `http://localhost:5000/api/v1/health`.
5. Check service status with `docker compose ps`; inspect a service with `docker compose logs -f api` (replace `api` with `client`, `mongo`, `redis`, or a worker name as needed).
6. Stop the stack with `docker compose down`. This keeps MongoDB and Redis data. `docker compose down -v` also deletes that data.

If the host ports are already in use, set `API_PORT` or `CLIENT_PORT` in `.env` to another available port. When changing the client port, update `FRONTEND_URL` and `CLIENT_URL` to the matching browser origin. When changing the API port, update the port in `VITE_API_BASE_URL`. That URL is embedded into the client image at build time, so rebuild the client after changing it.

## GitHub webhooks

A GitHub webhook cannot reach `localhost`. For local webhook testing, expose the API through a public tunnel and configure the repository webhook URL as:

`https://<your-public-tunnel-host>/api/v1/github/webhook`

Set the same private webhook secret in the repository webhook settings and `GITHUB_WEBHOOK_SECRET` in `.env`, then restart/recreate the API service. Do not publish either secret or commit `.env`.

## Services

Compose starts the React client, Express API, MongoDB, Redis, GitHub webhook worker, health snapshot worker, dispatch worker, and health snapshot scheduler. MongoDB and Redis use named volumes so their data survives a normal `docker compose down`.

For hosted deployment, configure `FRONTEND_URL`, `CLIENT_URL`, and `VITE_API_BASE_URL` with the real public origins/endpoints, and use platform-managed secrets and persistent database/Redis services. The local Compose file is a reproducible single-machine deployment setup; it does not provision a public domain, TLS, or managed infrastructure.