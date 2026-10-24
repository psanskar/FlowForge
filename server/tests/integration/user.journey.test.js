const http = require("http");
const { io: createSocketClient } = require("socket.io-client");
const mongoose = require("mongoose");
const request = require("supertest");

const app = require("../../src/app");
const {
    closeAuthRateLimitStore
} = require("../../src/middleware/authRateLimit.middleware");
const {
    initializeSocket
} = require("../../src/realtime/socket");
const {
    createWebhookSignature
} = require("../../src/modules/github/github.webhook");
const GithubRepository = require("../../src/modules/github/github.model");
const GithubSignal = require("../../src/modules/github/github.signal.model");
const GithubWebhookDelivery = require("../../src/modules/github/github.webhook.delivery.model");
const {
    githubWebhookWorker,
    closeGithubWebhookWorker
} = require("../../src/workers/githubWebhook.worker");
const {
    closeGithubWebhookQueue
} = require("../../src/queues/githubWebhook.queue");

describe("core project execution journey", () => {
    const webhookSecret = "flowforge-journey-webhook-secret-32chars";
    let httpServer;
    let ioServer;
    let socket;

    beforeAll(async () => {
        process.env.GITHUB_WEBHOOK_SECRET = webhookSecret;
        httpServer = http.createServer(app);
        ioServer = initializeSocket(httpServer);
        await new Promise((resolve) => httpServer.listen(0, resolve));
    });

    afterAll(async () => {
        socket?.disconnect();

        if (ioServer) {
            await new Promise((resolve) => ioServer.close(resolve));
        }

        await closeGithubWebhookWorker();
        await closeGithubWebhookQueue();
        await closeAuthRateLimitStore();
    });

    test("registers, tracks execution, streams an update, and ingests a signed webhook", async () => {
        const email = `journey-${Date.now()}@flowforge.local`;
        const password = "JourneyPassword123";

        const registration = await request(app)
            .post("/api/v1/auth/register")
            .send({ name: "Journey User", email, password });

        expect(registration.status).toBe(201);

        const login = await request(app)
            .post("/api/v1/auth/login")
            .send({ email, password });

        expect(login.status).toBe(200);
        const token = login.body.data.token;
        const userId = registration.body.data.user.id;
        const auth = { Authorization: `Bearer ${token}` };

        const targetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const projectResponse = await request(app)
            .post("/api/v1/projects")
            .set(auth)
            .send({ name: "Journey Demo Project", targetDate });

        expect(projectResponse.status).toBe(201);
        const projectId = projectResponse.body.data.project._id;

        const milestoneDueDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
        const milestoneResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/milestones`)
            .set(auth)
            .send({ name: "First release", dueDate: milestoneDueDate });

        expect(milestoneResponse.status).toBe(201);
        const milestoneId = milestoneResponse.body.data._id;

        const firstTaskResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set(auth)
            .send({
                title: "Complete the critical feature",
                status: "todo",
                priority: "critical",
                assignee: userId,
                milestone: milestoneId,
                dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
            });

        expect(firstTaskResponse.status).toBe(201);
        const firstTask = firstTaskResponse.body.data.task;

        const secondTaskResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set(auth)
            .send({
                title: "Review the feature",
                status: "todo",
                assignee: userId
            });

        expect(secondTaskResponse.status).toBe(201);
        const secondTask = secondTaskResponse.body.data.task;

        const dependencyResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/dependencies`)
            .set(auth)
            .send({
                fromTask: firstTask._id,
                toTask: secondTask._id
            });

        expect(dependencyResponse.status).toBe(201);

        const dashboard = await request(app)
            .get(`/api/v1/projects/${projectId}/dashboard`)
            .set(auth);

        expect(dashboard.status).toBe(200);
        expect(dashboard.body.data.topRisks.map((risk) => risk.type))
            .toContain("TASK_OVERDUE");
        expect(dashboard.body.data.milestones).toHaveLength(1);

        const health = await request(app)
            .get(`/api/v1/projects/${projectId}/health`)
            .set(auth);

        expect(health.status).toBe(200);
        expect(health.body.data.risks.map((risk) => risk.type))
            .toContain("MILESTONE_RISK");

        const port = httpServer.address().port;
        socket = createSocketClient(`http://127.0.0.1:${port}`, {
            transports: ["websocket"],
            auth: { token }
        });

        await new Promise((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
        });

        const joined = await new Promise((resolve) => {
            socket.emit("project:join", projectId, resolve);
        });
        expect(joined.success).toBe(true);

        const taskUpdated = new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error("Timed out waiting for task.updated")),
                3000
            );

            socket.once("task.updated", (payload) => {
                clearTimeout(timeout);
                resolve(payload);
            });
        });

        const update = await request(app)
            .patch(`/api/v1/tasks/${firstTask._id}`)
            .set(auth)
            .send({ version: firstTask.version, status: "blocked" });

        expect(update.status).toBe(200);
        expect((await taskUpdated).task.status).toBe("blocked");

        await GithubRepository.create({
            project: new mongoose.Types.ObjectId(projectId),
            owner: "flowforge-journey",
            repo: "execution-demo",
            fullName: "flowforge-journey/execution-demo",
            githubId: 987654321,
            defaultBranch: "main",
            private: false
        });

        const webhookPayload = JSON.stringify({
            action: "opened",
            repository: { id: 987654321, name: "execution-demo" },
            issue: {
                id: 987654322,
                number: 7,
                title: "Track release blocker",
                state: "open",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                user: { id: 101, login: "demo-user" }
            },
            sender: { id: 101, login: "demo-user" }
        });
        const deliveryId = `journey-${Date.now()}`;
        const webhook = await request(app)
            .post("/api/v1/github/webhook")
            .set("X-GitHub-Event", "issues")
            .set("X-GitHub-Delivery", deliveryId)
            .set("X-Hub-Signature-256", createWebhookSignature(webhookPayload, webhookSecret))
            .set("Content-Type", "application/json")
            .send(webhookPayload);

        expect(webhook.status).toBe(202);
        expect(webhook.body.data.queued).toBe(true);

        const deadline = Date.now() + 3000;
        let delivery;
        while (Date.now() < deadline) {
            delivery = await GithubWebhookDelivery.findOne({ deliveryId });
            if (delivery?.status === "PROCESSED") {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 25));
        }

        expect(delivery?.status).toBe("PROCESSED");
        expect(await GithubSignal.exists({
            project: projectId,
            type: "ISSUE_OPENED"
        })).toBeTruthy();
    });
});
