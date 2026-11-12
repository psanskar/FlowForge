const HEARTBEAT_INTERVAL_MS = 15000;
const HEARTBEAT_TTL_SECONDS = 45;

const getHeartbeatKey = (workerName) =>
    `flowforge:worker-heartbeat:${workerName}`;

const startWorkerHeartbeat = async (
    queue,
    workerName
) => {
    const client = await queue.client;
    const key = getHeartbeatKey(workerName);
    let stopped = false;

    const writeHeartbeat = async () => {
        if (stopped) {
            return;
        }

        try {
            await client.set(
                key,
                new Date().toISOString(),
                "EX",
                HEARTBEAT_TTL_SECONDS
            );
        } catch (error) {
            console.error(
                `Worker heartbeat write failed (${workerName}):`,
                error.message
            );
        }
    };

    await writeHeartbeat();

    const timer = setInterval(
        writeHeartbeat,
        HEARTBEAT_INTERVAL_MS
    );

    timer.unref?.();

    return async () => {
        stopped = true;
        clearInterval(timer);

        try {
            await client.del(key);
        } catch (error) {
            console.error(
                `Worker heartbeat cleanup failed (${workerName}):`,
                error.message
            );
        }
    };
};

module.exports = {
    HEARTBEAT_INTERVAL_MS,
    HEARTBEAT_TTL_SECONDS,
    getHeartbeatKey,
    startWorkerHeartbeat
};
