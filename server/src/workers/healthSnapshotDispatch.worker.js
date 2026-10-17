require("dotenv").config();

const {
    Worker
} = require("bullmq");

const connectDB =
    require("../config/db");

const {
    dispatchHealthSnapshots
} =
    require(
        "../queues/healthSnapshot.scheduler"
    );

const connection = {
    url:
        process.env.REDIS_URL ||
        "redis://127.0.0.1:6379"
};

const processHealthSnapshotDispatch =
    async (
        job,
        dispatchFunction =
            dispatchHealthSnapshots
    ) => {
        console.log(
            `Starting health snapshot dispatch job ${job.id}`
        );

        const result =
            await dispatchFunction();

        console.log(
            `Health snapshot dispatch job ${job.id} completed`,
            result
        );

        return result;
    };

const healthSnapshotDispatchWorker =
    process.env.NODE_ENV === "test"
        ? null
        : new Worker(
              "health-snapshot-dispatch",
              (job) =>
                  processHealthSnapshotDispatch(
                      job,
                      dispatchHealthSnapshots
                  ),
              {
                  connection,
                  concurrency: 1
              }
          );

if (healthSnapshotDispatchWorker) {
    healthSnapshotDispatchWorker.on(
        "completed",
        (job, result) => {
            console.log(
                `Dispatch job ${job.id} completed`,
                result
            );
        }
    );

    healthSnapshotDispatchWorker.on(
        "failed",
        (job, error) => {
            console.error(
                `Dispatch job ${job?.id} failed:`,
                error
            );
        }
    );
}

const startHealthSnapshotDispatchWorker =
    async () => {
        await connectDB();

        console.log(
            "FlowForge health snapshot dispatch worker running"
        );

        return healthSnapshotDispatchWorker;
    };

const closeHealthSnapshotDispatchWorker =
    async () => {
        if (healthSnapshotDispatchWorker) {
            await healthSnapshotDispatchWorker.close();
        }
    };

if (require.main === module) {
    startHealthSnapshotDispatchWorker()
        .catch((error) => {
            console.error(
                "Failed to start health snapshot dispatch worker:",
                error
            );

            process.exit(1);
        });

    const shutdown = async (signal) => {
        console.log(
            `Received ${signal}. Shutting down health snapshot dispatch worker...`
        );

        await closeHealthSnapshotDispatchWorker();

        console.log(
            "Health snapshot dispatch worker stopped"
        );

        process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

module.exports = {
    healthSnapshotDispatchWorker,
    processHealthSnapshotDispatch,
    closeHealthSnapshotDispatchWorker,
    startHealthSnapshotDispatchWorker
};