const RISK_LIFECYCLE = {
    NEW: "NEW",
    PERSISTENT: "PERSISTENT",
    ESCALATED: "ESCALATED",
    DE_ESCALATED: "DE_ESCALATED",
    RESOLVED: "RESOLVED"
};

const RISK_SEVERITY_ORDER = {
    MEDIUM: 1,
    HIGH: 2
};

const getRiskIdentity = (risk) => {
    if (risk?.identity) {
        return risk.identity;
    }

    if (risk?.type && risk?.taskId) {
        return `${risk.type}:${risk.taskId}`;
    }

    if (risk?.type && risk?.milestoneId) {
        return `${risk.type}:${risk.milestoneId}`;
    }

    if (risk?.type && risk?.userId) {
        return `${risk.type}:${risk.userId}`;
    }

    if (risk?.type && risk?.githubPrId) {
        return `${risk.type}:${risk.githubPrId}`;
    }

    return risk?.type || null;
};

const compareSeverity = (
    previousSeverity,
    currentSeverity
) => {
    const previous =
        RISK_SEVERITY_ORDER[
            previousSeverity
        ] || 0;

    const current =
        RISK_SEVERITY_ORDER[
            currentSeverity
        ] || 0;

    if (current > previous) {
        return "ESCALATED";
    }

    if (current < previous) {
        return "DE_ESCALATED";
    }

    return "PERSISTENT";
};

const createLifecycleRecord = ({
    risk,
    lifecycle,
    previousRisk = null
}) => {
    return {
        identity: getRiskIdentity(risk),
        type: risk.type,
        severity: risk.severity,
        lifecycle,
        previousSeverity:
            previousRisk?.severity || null,
        evidence: risk.evidence || null
    };
};

const analyzeRiskLifecycle = ({
    previousRisks = [],
    currentRisks = []
}) => {
    const previousByIdentity =
        new Map();

    const currentByIdentity =
        new Map();

    previousRisks.forEach((risk) => {
        const identity =
            getRiskIdentity(risk);

        if (identity) {
            previousByIdentity.set(
                identity,
                risk
            );
        }
    });

    currentRisks.forEach((risk) => {
        const identity =
            getRiskIdentity(risk);

        if (identity) {
            currentByIdentity.set(
                identity,
                risk
            );
        }
    });

    const records = [];

    currentByIdentity.forEach(
        (currentRisk, identity) => {
            const previousRisk =
                previousByIdentity.get(
                    identity
                );

            if (!previousRisk) {
                records.push(
                    createLifecycleRecord({
                        risk: currentRisk,
                        lifecycle:
                            RISK_LIFECYCLE.NEW
                    })
                );

                return;
            }

            const lifecycle =
                compareSeverity(
                    previousRisk.severity,
                    currentRisk.severity
                );

            records.push(
                createLifecycleRecord({
                    risk: currentRisk,
                    lifecycle,
                    previousRisk
                })
            );
        }
    );

    previousByIdentity.forEach(
        (previousRisk, identity) => {
            if (
                currentByIdentity.has(
                    identity
                )
            ) {
                return;
            }

            records.push(
                createLifecycleRecord({
                    risk: previousRisk,
                    lifecycle:
                        RISK_LIFECYCLE.RESOLVED,
                    previousRisk
                })
            );
        }
    );

    return records;
};

module.exports = {
    RISK_LIFECYCLE,
    RISK_SEVERITY_ORDER,
    getRiskIdentity,
    compareSeverity,
    createLifecycleRecord,
    analyzeRiskLifecycle
};