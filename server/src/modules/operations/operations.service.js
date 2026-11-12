const mongoose = require("mongoose");

const {
    getRedisClient
} = require("../../middleware/authRateLimit.middleware");

const {
    githubWebhookQueue
} = require("../../queues/githubWebhook.queue");

const {
    healthSnapshotQueue
} = require("../../queues/healthSnapshot.queue");

const GithubWebhookDelivery =
    require("../github/github.webhook.delivery.model");

const {
    getHeartbeatKey,
    HEARTBEAT_TTL_SECONDS
} = require("../../operations/workerHeartbeat");

const CHECK_TIMEOUT_MS = 2000;
const HEARTBEAT_STALE_AFTER_MS =
    HEARTBEAT_TTL_SECONDS * 1000;

const withTimeout = (promise, label) => {
    let timer;

    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(
                () => reject(new Error(`${label} check timed out`)),
                CHECK_TIMEOUT_MS
            );
            timer.unref?.();
        })
    ]).finally(() => clearTimeout(timer));
};

const checkMongo = async () => {
    if (
        mongoose.connection.readyState !== 1 ||
        !mongoose.connection.db
    ) {
        return false;
    }

    try {
        await withTimeout(
            mongoose.connection.db.command({ ping: 1 }),
            "MongoDB"
        );

        return true;
    } catch {
        return false;
    }
};

const checkRedis = async () => {
    try {
        const response = await withTimeout(
            getRedisClient().ping(),
            "Redis"
        );

        return response === "PONG";
    } catch {
        return false;
    }
};

const getReadiness = async () => {
    const [mongodb, redis] = await Promise.all([
        checkMongo(),
        checkRedis()
    ]);

    return {
        ready: mongodb && redis,
        checks: {
            mongodb: mongodb ? "ready" : "unavailable",
            redis: redis ? "ready" : "unavailable"
        }
    };
};

const getWorkerHeartbeat = async (queue, workerName) => {
    try {
        const client = await withTimeout(
            queue.client,
            `${workerName} Redis connection`
        );
        const value = await withTimeout(
            client.get(getHeartbeatKey(workerName)),
            `${workerName} heartbeat`
        );
        const timestamp = value ? Date.parse(value) : NaN;
        const ageMs = Date.now() - timestamp;

        return {
            status:
                Number.isFinite(timestamp) &&
                ageMs >= 0 &&
                ageMs <= HEARTBEAT_STALE_AFTER_MS
                    ? "running"
                    : "missing",
            lastSeenAt: Number.isFinite(timestamp) ? value : null
        };
    } catch {
        return {
            status: "unavailable",
            lastSeenAt: null
        };
    }
};

const getQueueCounts = async (queue) => {
    try {
        const counts = await withTimeout(
            queue.getJobCounts(
                "waiting",
                "active",
                "completed",
                "failed",
                "delayed",
                "paused",
                "waiting-children"
            ),
            "Queue"
        );

        return {
            status: "available",
            counts
        };
    } catch {
        return {
            status: "unavailable",
            counts: null
        };
    }
};

const getQueueOperations = async () => {
    const [
        githubCounts,
        healthCounts,
        githubWorker,
        healthWorker,
        scheduler,
        failedDeliveries
    ] =
        await Promise.all([
            getQueueCounts(githubWebhookQueue),
            getQueueCounts(healthSnapshotQueue),
            getWorkerHeartbeat(githubWebhookQueue, "github-worker"),
            getWorkerHeartbeat(healthSnapshotQueue, "health-worker"),
            getWorkerHeartbeat(healthSnapshotQueue, "health-scheduler"),
            withTimeout(
                GithubWebhookDelivery.countDocuments({
                    status: "FAILED"
                }),
                "GitHub delivery failure count"
            )
                .catch(() => null)
        ]);

    const healthy =
        githubCounts.status === "available" &&
        githubCounts.counts?.failed === 0 &&
        healthCounts.status === "available" &&
        healthCounts.counts?.failed === 0 &&
        githubWorker.status === "running" &&
        healthWorker.status === "running" &&
        scheduler.status === "running" &&
        failedDeliveries === 0;

    return {
        status: healthy ? "healthy" : "degraded",
        queues: {
            githubWebhook: {
                ...githubCounts,
                worker: githubWorker
            },
            healthSnapshot: {
                ...healthCounts,
                worker: healthWorker,
                scheduler
            }
        },
        failedWebhookDeliveries: failedDeliveries
    };
};

module.exports = {
    getReadiness,
    getQueueOperations,
    checkMongo,
    checkRedis
};
