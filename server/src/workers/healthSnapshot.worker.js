const {
    Worker
} = require("bullmq");

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

const connection = {
    url:
        process.env.REDIS_URL ||
        "redis://127.0.0.1:6379"
};

const processHealthSnapshotJob =
    async (job) => {
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
            throw new Error(
                `Project ${projectId} not found`
            );
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
                        project.owner
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

const startHealthSnapshotWorker =
    () => {
        console.log(
            "FlowForge health snapshot worker running"
        );

        return healthSnapshotWorker;
    };

if (require.main === module) {
    startHealthSnapshotWorker();

    const shutdown =
        async (signal) => {
            console.log(
                `Received ${signal}. ` +
                "Shutting down health snapshot worker..."
            );

            await closeHealthSnapshotWorker();

            console.log(
                "Health snapshot worker stopped"
            );

            process.exit(0);
        };

    process.on(
        "SIGINT",
        () => shutdown("SIGINT")
    );

    process.on(
        "SIGTERM",
        () => shutdown("SIGTERM")
    );
}

module.exports = {
    healthSnapshotWorker,
    closeHealthSnapshotWorker,
    startHealthSnapshotWorker
};