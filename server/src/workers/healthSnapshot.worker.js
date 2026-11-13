require("dotenv").config();

const {
    Worker
} = require("bullmq");
const validateEnvironment = require("../config/validateEnvironment");
const connectDB = require("../config/db");
const mongoose = require("mongoose");
const { startWorkerHeartbeat } = require("../operations/workerHeartbeat");

const {
    EventEmitter
} = require("events");

const Project =
    require("../modules/projects/project.model");

const {
    captureProjectHealthSnapshot
} =
    require(
        "../modules/projects/project.health.snapshot.service"
    );

const {
    healthSnapshotQueue
} =
    require(
        "../queues/healthSnapshot.queue"
    );

const {
    dispatchHealthSnapshots
} = require("../queues/healthSnapshot.scheduler");

const connection = {
    url:
        process.env.REDIS_URL ||
        "redis://127.0.0.1:6379"
};

const processHealthSnapshotJob =
    async (job) => {
        if (job.name === "dispatch-health-snapshots") {
            return dispatchHealthSnapshots();
        }

        const {
            projectId,
            snapshotDate
        } = job.data;

        if (!projectId) {
            throw new Error(
                "Health snapshot job requires projectId"
            );
        }

        const project =
            await Project.findById(
                projectId
            ).select(
                "_id owner status"
            );

        if (!project) {
            return {
                skipped: true,
                reason: "PROJECT_NOT_FOUND",
                projectId: projectId.toString()
            };
        }

        if (
            ![
                "planning",
                "active"
            ].includes(project.status)
        ) {
            return {
                skipped: true,
                reason:
                    "PROJECT_NOT_ACTIVE",
                projectId:
                    projectId.toString()
            };
        }

        if (!project.owner) {
            throw new Error(
                `Project ${projectId} has no owner`
            );
        }

        const snapshot =
            await captureProjectHealthSnapshot(
                {
                    projectId,
                    userId:
                        project.owner,
                    snapshotDate
                }
            );

        console.log(
            `Health snapshot captured for project ${projectId} ` +
            `(${snapshotDate})`
        );

        return {
            skipped: false,
            projectId:
                projectId.toString(),
            snapshotId:
                snapshot._id.toString(),
            snapshotDate
        };
    };

const createTestWorker = () => {
    const testWorker =
        new EventEmitter();

    let closed = false;

    testWorker.processFn =
        processHealthSnapshotJob;

    testWorker.close = async () => {
        closed = true;
    };

    healthSnapshotQueue.setProcessor(
        async (job) => {
            if (closed) {
                return;
            }

            return testWorker.processFn(
                job
            );
        },
        testWorker
    );

    return testWorker;
};

const healthSnapshotWorker =
    process.env.NODE_ENV === "test"
        ? createTestWorker()
        : new Worker(
              "health-snapshot",
              processHealthSnapshotJob,
              {
                  connection,
                  concurrency: 5
              }
          );

let stopWorkerHeartbeat = async () => {};

healthSnapshotWorker.processFn =
    processHealthSnapshotJob;

if (
    process.env.NODE_ENV !== "test"
) {
    healthSnapshotWorker.on(
        "completed",
        (job, result) => {
            console.log(
                `Health snapshot job ${job.id} completed`,
                result
            );
        }
    );

    healthSnapshotWorker.on(
        "failed",
        (job, error) => {
            console.error(
                `Health snapshot job ${job?.id} failed:`,
                error
            );
        }
    );
}

const closeHealthSnapshotWorker =
    async () => {
        await healthSnapshotWorker.close();
    };

const startHealthSnapshotWorker = async () => {
    if (process.env.NODE_ENV !== "test") {
        await healthSnapshotWorker.waitUntilReady();
        stopWorkerHeartbeat = await startWorkerHeartbeat(
            healthSnapshotQueue,
            "health-worker"
        );
    }

        console.log(
            "FlowForge health snapshot worker running"
        );

        return healthSnapshotWorker;
};

if (require.main === module) {
    const shutdown = async (signal) => {
        console.log(
            `Received ${signal}. Shutting down health snapshot worker...`
        );
        await stopWorkerHeartbeat();
        await closeHealthSnapshotWorker();
        await mongoose.disconnect();
        console.log("Health snapshot worker stopped");
        process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    (async () => {
        validateEnvironment("worker");
        await connectDB();
        await startHealthSnapshotWorker();
    })().catch((error) => {
        console.error("Failed to start health snapshot worker:", error.message);
        process.exit(1);
    });
}

module.exports = {
    healthSnapshotWorker,
    closeHealthSnapshotWorker,
    startHealthSnapshotWorker
};
