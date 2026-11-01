const { randomUUID } = require("crypto");

const DependencyLock = require("./dependencyLock.model");

const LOCK_LEASE_MS = 30_000;
const LOCK_RENEW_INTERVAL_MS = 10_000;
const LOCK_ACQUIRE_TIMEOUT_MS = 10_000;
let lockIndexPromise;

const ensureLockIndex = () => {
    if (!lockIndexPromise) {
        lockIndexPromise = DependencyLock.collection.createIndex(
            { project: 1 },
            { unique: true }
        );
    }

    return lockIndexPromise;
};

const createLockError = (message, code) => {
    const error = new Error(message);
    error.statusCode = 503;
    error.code = code;
    return error;
};

const acquireLock = async (projectId, token) => {
    await ensureLockIndex();
    const deadline = Date.now() + LOCK_ACQUIRE_TIMEOUT_MS;

    while (Date.now() < deadline) {
        const now = new Date();

        try {
            const lock = await DependencyLock.findOneAndUpdate(
                {
                    project: projectId,
                    $or: [
                        { expiresAt: { $exists: false } },
                        { expiresAt: { $lte: now } }
                    ]
                },
                {
                    $set: {
                        token,
                        expiresAt: new Date(now.getTime() + LOCK_LEASE_MS)
                    }
                },
                {
                    upsert: true,
                    returnDocument: "after"
                }
            );

            if (lock?.token === token) {
                return;
            }
        } catch (error) {
            if (error.code !== 11000) {
                throw error;
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw createLockError(
        "Another dependency update is in progress. Please retry.",
        "DEPENDENCY_LOCK_TIMEOUT"
    );
};

const withProjectDependencyLock = async (projectId, operation) => {
    const token = randomUUID();

    try {
        await acquireLock(projectId, token);
    } catch (error) {
        if (error.code === "DEPENDENCY_LOCK_TIMEOUT") {
            throw error;
        }

        throw createLockError(
            "Dependency updates are temporarily unavailable.",
            "DEPENDENCY_LOCK_UNAVAILABLE"
        );
    }

    let lockLost = false;
    let renewalInProgress;

    const renewLock = async () => {
        try {
            const result = await DependencyLock.updateOne(
                { project: projectId, token },
                {
                    $set: {
                        expiresAt: new Date(Date.now() + LOCK_LEASE_MS)
                    }
                }
            );

            if (result.matchedCount !== 1) {
                lockLost = true;
                throw createLockError(
                    "The dependency update lock expired. Please retry.",
                    "DEPENDENCY_LOCK_LOST"
                );
            }
        } catch (error) {
            lockLost = true;
            throw error.code === "DEPENDENCY_LOCK_LOST"
                ? error
                : createLockError(
                    "Dependency updates are temporarily unavailable.",
                    "DEPENDENCY_LOCK_UNAVAILABLE"
                );
        }
    };

    const assertLockHeld = async () => {
        if (lockLost) {
            throw createLockError(
                "The dependency update lock expired. Please retry.",
                "DEPENDENCY_LOCK_LOST"
            );
        }

        await renewLock();
    };

    const interval = setInterval(() => {
        if (!renewalInProgress && !lockLost) {
            renewalInProgress = renewLock()
                .catch(() => {})
                .finally(() => {
                    renewalInProgress = null;
                });
        }
    }, LOCK_RENEW_INTERVAL_MS);
    interval.unref?.();

    let result;
    let operationError;

    try {
        result = await operation({ assertLockHeld });
    } catch (error) {
        operationError = error;
    } finally {
        clearInterval(interval);

        if (renewalInProgress) {
            await renewalInProgress;
        }

        try {
            await DependencyLock.deleteOne({ project: projectId, token });
        } catch {
            operationError ??= createLockError(
                "Dependency updates are temporarily unavailable.",
                "DEPENDENCY_LOCK_UNAVAILABLE"
            );
        }
    }

    if (operationError) {
        throw operationError;
    }

    return result;
};

module.exports = {
    withProjectDependencyLock
};
