const DependencyGraphLock = require(
    "./dependencyGraphLock.model"
);

const processLocks = new Map();

const createBusyError = () => {
    const error = new Error(
        "The project dependency graph is busy. Please retry the request."
    );
    error.statusCode = 503;
    error.code = "DEPENDENCY_GRAPH_BUSY";
    return error;
};

const withProcessLock = async (key, operation) => {
    const previous = processLocks.get(key) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
        release = resolve;
    });
    const tail = previous.then(() => current);

    processLocks.set(key, tail);
    await previous;

    try {
        return await operation({ session: null });
    } finally {
        release();

        if (processLocks.get(key) === tail) {
            processLocks.delete(key);
        }
    }
};

const ensureLockRecord = async (projectId) => {
    try {
        await DependencyGraphLock.updateOne(
            { _id: projectId },
            { $setOnInsert: { revision: 0 } },
            { upsert: true }
        );
    } catch (error) {
        // A concurrent first request may create the sentinel document first.
        if (error.code !== 11000) {
            throw error;
        }
    }
};

const withTransactionLock = async (projectId, operation) => {
    await ensureLockRecord(projectId);
    const session = await DependencyGraphLock.db.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            const lockResult = await DependencyGraphLock.updateOne(
                { _id: projectId },
                { $inc: { revision: 1 } },
                { session }
            );

            if (lockResult.matchedCount !== 1) {
                throw createBusyError();
            }

            result = await operation({ session });
            return result;
        });

        return result;
    } catch (error) {
        if (
            error.code === 112 ||
            error.codeName === "WriteConflict" ||
            error.hasErrorLabel?.("TransientTransactionError")
        ) {
            throw createBusyError();
        }

        throw error;
    } finally {
        await session.endSession();
    }
};

const withDependencyGraphLock = async (projectId, operation) => {
    const key = projectId.toString();
    const topologyType =
        DependencyGraphLock.db?.getClient()?.topology?.description?.type;

    if (
        [
            "ReplicaSetWithPrimary",
            "Sharded",
            "LoadBalanced"
        ].includes(topologyType)
    ) {
        return withTransactionLock(projectId, operation);
    }

    if (topologyType === "Single") {
        // Standalone MongoDB is supported for local single-process development.
        return withProcessLock(key, operation);
    }

    throw createBusyError();
};

module.exports = {
    withDependencyGraphLock
};
