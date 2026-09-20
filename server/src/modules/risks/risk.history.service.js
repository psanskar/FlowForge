const ProjectRiskHistory =
    require("./project.risk.history.model");

const {
    RISK_LIFECYCLE,
    analyzeRiskLifecycle
} =
    require("./risk.lifecycle.engine");

const buildSnapshotKey = ({
    projectId,
    snapshotDate
}) => {
    if (!projectId) {
        throw new Error(
            "Project id is required"
        );
    }

    if (!snapshotDate) {
        throw new Error(
            "Snapshot date is required"
        );
    }

    return `${projectId}:${snapshotDate}`;
};

const createHistoryDocument = ({
    projectId,
    risk,
    lifecycle,
    capturedAt,
    snapshotKey
}) => {
    if (
        lifecycle ===
        RISK_LIFECYCLE.RESOLVED
    ) {
        throw new Error(
            "A resolved risk cannot create a new history document"
        );
    }

    return {
        project: projectId,
        identity: risk.identity,
        type: risk.type,

        status: "ACTIVE",

        currentSeverity:
            risk.severity,

        previousSeverity:
            risk.previousSeverity ||
            null,

        firstDetectedAt:
            capturedAt,

        lastDetectedAt:
            capturedAt,

        resolvedAt: null,

        detectionCount: 1,

        lastLifecycle:
            lifecycle,

        evidence:
            risk.evidence || null,

        snapshotKey
    };
};

const applyRiskLifecycle = async ({
    projectId,
    lifecycleRecord,
    capturedAt,
    snapshotKey
}) => {
    const {
        identity,
        type,
        severity,
        previousSeverity,
        lifecycle,
        evidence
    } = lifecycleRecord;

    if (!identity) {
        throw new Error(
            "Risk identity is required"
        );
    }

    const existing =
        await ProjectRiskHistory.findOne({
            project: projectId,
            identity
        });

    /*
     * Idempotency and ordering:
     *
     * A risk history record can only move
     * forward through snapshot dates.
     *
     * Same snapshot:
     *   Already processed -> no-op.
     *
     * Older snapshot:
     *   Stale data -> no-op.
     *
     * Newer snapshot:
     *   Apply lifecycle transition.
     */
    if (existing) {
        const existingSnapshotDate =
            existing.snapshotKey?.split(":")[1];

        const currentSnapshotDate =
            snapshotKey.split(":")[1];

        if (
            existingSnapshotDate &&
            currentSnapshotDate &&
            currentSnapshotDate <=
                existingSnapshotDate
        ) {
            return existing;
        }
    }

    if (!existing) {
        if (
            lifecycle ===
            RISK_LIFECYCLE.RESOLVED
        ) {
            return null;
        }

        try {
            return await ProjectRiskHistory.create({
                project: projectId,
                identity,
                type,
                status: "ACTIVE",
                currentSeverity: severity,
                previousSeverity:
                    previousSeverity || null,
                firstDetectedAt:
                    capturedAt,
                lastDetectedAt:
                    capturedAt,
                resolvedAt: null,
                detectionCount: 1,
                lastLifecycle: lifecycle,
                evidence: evidence || null,
                snapshotKey
            });
        } catch (error) {
            /*
             * Another concurrent request may have
             * created the same risk history between
             * our findOne() and create().
             *
             * The unique (project, identity) index
             * protects the database. Treat the
             * duplicate-key error as an idempotent
             * race and return the document that won.
             */
            if (error?.code !== 11000) {
                throw error;
            }

            const concurrentHistory =
                await ProjectRiskHistory.findOne({
                    project: projectId,
                    identity
                });

            if (!concurrentHistory) {
                throw error;
            }

            if (
                concurrentHistory.snapshotKey ===
                snapshotKey
            ) {
                return concurrentHistory;
            }

            return concurrentHistory;
        }
    }

    if (
        lifecycle ===
        RISK_LIFECYCLE.RESOLVED
    ) {
        existing.status = "RESOLVED";

        existing.resolvedAt =
            capturedAt;

        existing.lastLifecycle =
            lifecycle;

        existing.evidence =
            evidence || null;

        existing.snapshotKey =
            snapshotKey;

        await existing.save();

        return existing;
    }

    existing.status = "ACTIVE";

    existing.currentSeverity =
        severity;

    existing.previousSeverity =
        previousSeverity || null;

    existing.lastDetectedAt =
        capturedAt;

    existing.resolvedAt = null;

    existing.lastLifecycle =
        lifecycle;

    existing.evidence =
        evidence || null;

    existing.detectionCount += 1;

    existing.snapshotKey =
        snapshotKey;

    await existing.save();

    return existing;
};

const updateProjectRiskHistory =
    async ({
        projectId,
        previousRisks = [],
        currentRisks = [],
        capturedAt = new Date(),
        snapshotDate
    }) => {
        if (!projectId) {
            throw new Error(
                "Project id is required"
            );
        }

        if (!snapshotDate) {
            throw new Error(
                "Snapshot date is required"
            );
        }

        const snapshotKey =
            buildSnapshotKey({
                projectId,
                snapshotDate
            });

        const lifecycleRecords =
            analyzeRiskLifecycle({
                previousRisks,
                currentRisks
            });

        const results = [];

        for (
            const lifecycleRecord
            of lifecycleRecords
        ) {
            const result =
                await applyRiskLifecycle({
                    projectId,
                    lifecycleRecord,
                    capturedAt,
                    snapshotKey
                });

            if (result) {
                results.push(result);
            }
        }

        return results;
    };

module.exports = {
    buildSnapshotKey,
    createHistoryDocument,
    applyRiskLifecycle,
    updateProjectRiskHistory
};