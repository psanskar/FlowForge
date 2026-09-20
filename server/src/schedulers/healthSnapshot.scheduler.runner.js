const {
    startHealthSnapshotScheduler,
    closeHealthSnapshotScheduler
} = require("../queues/healthSnapshot.scheduler");

const start = async () => {
    await startHealthSnapshotScheduler();

    console.log(
        "FlowForge health snapshot scheduler process running"
    );
};

const shutdown = async (signal) => {
    console.log(
        `Received ${signal}. Shutting down health snapshot scheduler...`
    );

    await closeHealthSnapshotScheduler();

    console.log(
        "FlowForge health snapshot scheduler stopped"
    );

    process.exit(0);
};

if (require.main === module) {
    start().catch((error) => {
        console.error(
            "Failed to start health snapshot scheduler:",
            error
        );

        process.exit(1);
    });

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
    start,
    shutdown
};