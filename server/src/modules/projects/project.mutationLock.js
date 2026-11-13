const processLocks = new Map();
const Project = require("./project.model");

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

const createMutationBusyError = () => {
    const error = new Error(
        "Project data is being updated. Please retry the request."
    );
    error.statusCode = 503;
    error.code = "PROJECT_MUTATION_BUSY";
    return error;
};

const withProjectMutationLock = async (projectId, operation) => {
    const key = projectId.toString();
    const isConnected = Project.db?.readyState === 1;
    const topologyType = isConnected
        ? Project.db.getClient().topology.description.type
        : null;

    if (![
        "ReplicaSetWithPrimary",
        "Sharded",
        "LoadBalanced"
    ].includes(topologyType)) {
        // Standalone MongoDB is used by local Compose. The app runs as a
        // single API process there; production transactions serialize across
        // API instances by writing the same project revision document.
        return withProcessLock(key, operation);
    }

    const session = await Project.db.startSession();

    try {
        let result;
        await session.withTransaction(async () => {
            const lockResult = await Project.updateOne(
                { _id: projectId },
                { $inc: { mutationRevision: 1 } },
                { session }
            );

            if (lockResult.matchedCount !== 1) {
                const error = new Error("Project not found");
                error.statusCode = 404;
                error.code = "PROJECT_NOT_FOUND";
                throw error;
            }

            result = await operation({ session });
        });

        return result;
    } catch (error) {
        if (
            error.code === 112 ||
            error.codeName === "WriteConflict" ||
            error.hasErrorLabel?.("TransientTransactionError")
        ) {
            throw createMutationBusyError();
        }

        throw error;
    } finally {
        await session.endSession();
    }
};

module.exports = { withProjectMutationLock };
