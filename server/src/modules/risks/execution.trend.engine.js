const HEALTH_DECLINE_THRESHOLD = 10;
const HEALTH_HIGH_THRESHOLD = 20;

const BLOCKED_INCREASE_THRESHOLD = 2;
const BLOCKED_HIGH_THRESHOLD = 4;

const OVERDUE_INCREASE_THRESHOLD = 2;
const OVERDUE_HIGH_THRESHOLD = 4;

const RISK_EXPOSURE_INCREASE_THRESHOLD = 2;
const RISK_EXPOSURE_HIGH_THRESHOLD = 4;

const BLOCKED_RATIO_INCREASE_THRESHOLD = 0.10;
const BLOCKED_RATIO_HIGH_THRESHOLD = 0.20;

const OVERDUE_RATIO_INCREASE_THRESHOLD = 0.10;
const OVERDUE_RATIO_HIGH_THRESHOLD = 0.20;

const MIN_VELOCITY_SNAPSHOTS = 7;
const VELOCITY_DECLINE_RATIO = 0.5;

const getSeverity = (
    change,
    mediumThreshold,
    highThreshold
) => {
    if (change >= highThreshold) {
        return "HIGH";
    }

    if (change >= mediumThreshold) {
        return "MEDIUM";
    }

    return null;
};

const calculateAverage = (values) => {
    if (!values.length) {
        return 0;
    }

    return (
        values.reduce(
            (sum, value) => sum + value,
            0
        ) / values.length
    );
};

const calculateVelocity = (
    snapshots,
    getValue
) => {
    const velocities = [];

    for (
        let index = 1;
        index < snapshots.length;
        index++
    ) {
        const previous =
            getValue(
                snapshots[index - 1]
            );

        const current =
            getValue(
                snapshots[index]
            );

        velocities.push(
            Math.max(
                0,
                current - previous
            )
        );
    }

    return velocities;
};

const detectHealthDecline = (
    snapshots
) => {
    const previous =
        snapshots[0].healthScore;

    const current =
        snapshots[
            snapshots.length - 1
        ].healthScore;

    const change =
        current - previous;

    const decline = -change;

    if (
        decline <
        HEALTH_DECLINE_THRESHOLD
    ) {
        return null;
    }

    return {
        type: "HEALTH_DECLINING",
        severity:
            decline >=
            HEALTH_HIGH_THRESHOLD
                ? "HIGH"
                : "MEDIUM",
        evidence: {
            previous,
            current,
            change
        }
    };
};

const detectIncreasingWork = ({
    snapshots,
    type,
    getValue,
    mediumThreshold,
    highThreshold
}) => {
    const previous =
        getValue(snapshots[0]);

    const current =
        getValue(
            snapshots[
                snapshots.length - 1
            ]
        );

    const change =
        current - previous;

    const severity =
        getSeverity(
            change,
            mediumThreshold,
            highThreshold
        );

    if (!severity) {
        return null;
    }

    return {
        type,
        severity,
        evidence: {
            previous,
            current,
            change
        }
    };
};

const detectRatioIncrease = ({
    snapshots,
    type,
    getNumerator,
    getDenominator,
    mediumThreshold,
    highThreshold
}) => {
    const calculateRatio = (
        snapshot
    ) => {
        const numerator =
            getNumerator(snapshot);

        const denominator =
            getDenominator(snapshot);

        if (denominator <= 0) {
            return 0;
        }

        return numerator / denominator;
    };

    const previous =
        calculateRatio(
            snapshots[0]
        );

    const current =
        calculateRatio(
            snapshots[
                snapshots.length - 1
            ]
        );

    const change =
        Number(
            (
                current - previous
            ).toFixed(10)
        );

    const severity =
        getSeverity(
            change,
            mediumThreshold,
            highThreshold
        );

    if (!severity) {
        return null;
    }

    return {
        type,
        severity,
        evidence: {
            previousRatio:
                Number(
                    previous.toFixed(10)
                ),
            currentRatio:
                Number(
                    current.toFixed(10)
                ),
            change
        }
    };
};

const getUnfinishedTaskCount = (
    snapshot
) => {
    const total =
        snapshot.taskSummary
            ?.totalTasks || 0;

    const completed =
        snapshot.taskSummary
            ?.completedTasks || 0;

    return Math.max(
        0,
        total - completed
    );
};

const detectBlockedWorkRatioIncrease = (
    snapshots
) => {
    return detectRatioIncrease({
        snapshots,
        type:
            "BLOCKED_WORK_RATIO_INCREASING",
        getNumerator: (snapshot) =>
            snapshot.taskSummary
                ?.blockedTasks || 0,
        getDenominator:
            getUnfinishedTaskCount,
        mediumThreshold:
            BLOCKED_RATIO_INCREASE_THRESHOLD,
        highThreshold:
            BLOCKED_RATIO_HIGH_THRESHOLD
    });
};

const detectOverdueWorkRatioIncrease = (
    snapshots
) => {
    return detectRatioIncrease({
        snapshots,
        type:
            "OVERDUE_WORK_RATIO_INCREASING",
        getNumerator: (snapshot) =>
            snapshot.taskSummary
                ?.overdueTasks || 0,
        getDenominator:
            getUnfinishedTaskCount,
        mediumThreshold:
            OVERDUE_RATIO_INCREASE_THRESHOLD,
        highThreshold:
            OVERDUE_RATIO_HIGH_THRESHOLD
    });
};

const detectRiskExposureIncrease = (
    snapshots
) => {
    const getExposure = (snapshot) => {
        const high =
            snapshot.riskCounts?.high || 0;

        const medium =
            snapshot.riskCounts?.medium || 0;

        return high + medium;
    };

    return detectIncreasingWork({
        snapshots,
        type:
            "RISK_EXPOSURE_INCREASING",
        getValue: getExposure,
        mediumThreshold:
            RISK_EXPOSURE_INCREASE_THRESHOLD,
        highThreshold:
            RISK_EXPOSURE_HIGH_THRESHOLD
    });
};

const detectVelocityDecline = ({
    snapshots,
    type,
    getValue
}) => {
    if (
        snapshots.length <
        MIN_VELOCITY_SNAPSHOTS
    ) {
        return null;
    }

    const velocities =
        calculateVelocity(
            snapshots,
            getValue
        );

    const midpoint =
        Math.floor(
            velocities.length / 2
        );

    const previousVelocities =
        velocities.slice(
            0,
            midpoint
        );

    const recentVelocities =
        velocities.slice(
            midpoint
        );

    const previousAverage =
        calculateAverage(
            previousVelocities
        );

    const recentAverage =
        calculateAverage(
            recentVelocities
        );

    if (
        previousAverage <= 0
    ) {
        return null;
    }

    const declineRatio =
        (
            previousAverage -
            recentAverage
        ) /
        previousAverage;

    if (
        declineRatio <
        VELOCITY_DECLINE_RATIO
    ) {
        return null;
    }

    return {
        type,
        severity:
            declineRatio >= 0.75
                ? "HIGH"
                : "MEDIUM",
        evidence: {
            previousAverage,
            recentAverage,
            declineRatio,
            previousVelocities,
            recentVelocities
        }
    };
};

const detectCompletionVelocityDecline = (
    snapshots
) => {
    return detectVelocityDecline({
        snapshots,
        type:
            "COMPLETION_VELOCITY_DECLINING",
        getValue: (snapshot) =>
            snapshot.taskSummary
                ?.completedTasks || 0
    });
};

const detectMilestoneProgressSlowing = (
    snapshots
) => {
    return detectVelocityDecline({
        snapshots,
        type:
            "MILESTONE_PROGRESS_SLOWING",
        getValue: (snapshot) =>
            snapshot.milestoneSummary
                ?.completedMilestoneTasks || 0
    });
};

const analyzeExecutionTrend = ({
    snapshots = []
}) => {
    if (snapshots.length < 2) {
        return {
            signals: []
        };
    }

    const signals = [];

    const healthDecline =
        detectHealthDecline(
            snapshots
        );

    if (healthDecline) {
        signals.push(healthDecline);
    }

    const blockedWork =
        detectIncreasingWork({
            snapshots,
            type:
                "BLOCKED_WORK_INCREASING",
            getValue: (snapshot) =>
                snapshot.taskSummary
                    ?.blockedTasks || 0,
            mediumThreshold:
                BLOCKED_INCREASE_THRESHOLD,
            highThreshold:
                BLOCKED_HIGH_THRESHOLD
        });

    if (blockedWork) {
        signals.push(blockedWork);
    }

    const overdueWork =
        detectIncreasingWork({
            snapshots,
            type:
                "OVERDUE_WORK_INCREASING",
            getValue: (snapshot) =>
                snapshot.taskSummary
                    ?.overdueTasks || 0,
            mediumThreshold:
                OVERDUE_INCREASE_THRESHOLD,
            highThreshold:
                OVERDUE_HIGH_THRESHOLD
        });

    if (overdueWork) {
        signals.push(overdueWork);
    }

    const blockedRatio =
        detectBlockedWorkRatioIncrease(
            snapshots
        );

    if (blockedRatio) {
        signals.push(blockedRatio);
    }

    const overdueRatio =
        detectOverdueWorkRatioIncrease(
            snapshots
        );

    if (overdueRatio) {
        signals.push(overdueRatio);
    }

    const completionVelocity =
        detectCompletionVelocityDecline(
            snapshots
        );

    if (completionVelocity) {
        signals.push(
            completionVelocity
        );
    }

    const milestoneVelocity =
        detectMilestoneProgressSlowing(
            snapshots
        );

    if (milestoneVelocity) {
        signals.push(
            milestoneVelocity
        );
    }

    const riskExposure =
        detectRiskExposureIncrease(
            snapshots
        );

    if (riskExposure) {
        signals.push(riskExposure);
    }

    return {
        signals
    };
};

module.exports = {
    analyzeExecutionTrend,
    calculateAverage,
    calculateVelocity,
    detectHealthDecline,
    detectIncreasingWork,
    detectRiskExposureIncrease,
    detectBlockedWorkRatioIncrease,
    detectOverdueWorkRatioIncrease,
    detectCompletionVelocityDecline,
    detectMilestoneProgressSlowing
};