const {
    analyzeExecutionTrend
} = require(
    "../../src/modules/risks/execution.trend.engine"
);

describe("Execution trend engine", () => {
    test("returns no signals when there are no snapshots", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: []
            });

        expect(result).toEqual({
            signals: []
        });
    });

    test("returns no signals when there is only one snapshot", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-17",
                        healthScore: 82,
                        riskCounts: {
                            high: 2,
                            medium: 3
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            overdueTasks: 1,
                            blockedTasks: 1,
                            stagnantTasks: 2,
                            workloadRisks: 1
                        },
                        milestoneSummary: {
                            totalMilestones: 3,
                            completedMilestones: 1,
                            totalMilestoneTasks: 10,
                            completedMilestoneTasks: 5
                        }
                    }
                ]
            });

        expect(result).toEqual({
            signals: []
        });
    });

    test("detects significant health decline", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-16",
                        healthScore: 88,
                        riskCounts: {
                            high: 1,
                            medium: 2
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            overdueTasks: 0,
                            blockedTasks: 1,
                            stagnantTasks: 1,
                            workloadRisks: 0
                        },
                        milestoneSummary: {
                            totalMilestones: 2,
                            completedMilestones: 1,
                            totalMilestoneTasks: 10,
                            completedMilestoneTasks: 5
                        }
                    },
                    {
                        snapshotDate: "2026-09-17",
                        healthScore: 76,
                        riskCounts: {
                            high: 1,
                            medium: 2
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 11,
                            overdueTasks: 0,
                            blockedTasks: 1,
                            stagnantTasks: 1,
                            workloadRisks: 0
                        },
                        milestoneSummary: {
                            totalMilestones: 2,
                            completedMilestones: 1,
                            totalMilestoneTasks: 10,
                            completedMilestoneTasks: 6
                        }
                    }
                ]
            });

        expect(result.signals).toContainEqual({
            type: "HEALTH_DECLINING",
            severity: "MEDIUM",
            evidence: {
                previous: 88,
                current: 76,
                change: -12
            }
        });
    });

    test("detects severe health decline as high severity", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-16",
                        healthScore: 95,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            overdueTasks: 0,
                            blockedTasks: 0,
                            stagnantTasks: 0,
                            workloadRisks: 0
                        },
                        milestoneSummary: {
                            totalMilestones: 2,
                            completedMilestones: 1,
                            totalMilestoneTasks: 10,
                            completedMilestoneTasks: 5
                        }
                    },
                    {
                        snapshotDate: "2026-09-17",
                        healthScore: 70,
                        riskCounts: {
                            high: 2,
                            medium: 3
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 11,
                            overdueTasks: 0,
                            blockedTasks: 0,
                            stagnantTasks: 0,
                            workloadRisks: 0
                        },
                        milestoneSummary: {
                            totalMilestones: 2,
                            completedMilestones: 1,
                            totalMilestoneTasks: 10,
                            completedMilestoneTasks: 6
                        }
                    }
                ]
            });

        expect(result.signals).toContainEqual({
            type: "HEALTH_DECLINING",
            severity: "HIGH",
            evidence: {
                previous: 95,
                current: 70,
                change: -25
            }
        });
    });

    test("does not report insignificant health change", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-16",
                        healthScore: 82,
                        riskCounts: {
                            high: 1,
                            medium: 2
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            overdueTasks: 0,
                            blockedTasks: 1,
                            stagnantTasks: 1,
                            workloadRisks: 0
                        },
                        milestoneSummary: {
                            totalMilestones: 2,
                            completedMilestones: 1,
                            totalMilestoneTasks: 10,
                            completedMilestoneTasks: 5
                        }
                    },
                    {
                        snapshotDate: "2026-09-17",
                        healthScore: 76,
                        riskCounts: {
                            high: 1,
                            medium: 2
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 11,
                            overdueTasks: 0,
                            blockedTasks: 1,
                            stagnantTasks: 1,
                            workloadRisks: 0
                        },
                        milestoneSummary: {
                            totalMilestones: 2,
                            completedMilestones: 1,
                            totalMilestoneTasks: 10,
                            completedMilestoneTasks: 6
                        }
                    }
                ]
            });

        expect(result.signals).not.toContainEqual(
            expect.objectContaining({
                type: "HEALTH_DECLINING"
            })
        );
    });

    test("detects increasing blocked work", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-16",
                        healthScore: 85,
                        riskCounts: {
                            high: 1,
                            medium: 2
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            overdueTasks: 0,
                            blockedTasks: 1,
                            stagnantTasks: 1,
                            workloadRisks: 0
                        },
                        milestoneSummary: {
                            totalMilestones: 2,
                            completedMilestones: 1,
                            totalMilestoneTasks: 10,
                            completedMilestoneTasks: 5
                        }
                    },
                    {
                        snapshotDate: "2026-09-17",
                        healthScore: 85,
                        riskCounts: {
                            high: 1,
                            medium: 2
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            overdueTasks: 0,
                            blockedTasks: 4,
                            stagnantTasks: 1,
                            workloadRisks: 0
                        },
                        milestoneSummary: {
                            totalMilestones: 2,
                            completedMilestones: 1,
                            totalMilestoneTasks: 10,
                            completedMilestoneTasks: 5
                        }
                    }
                ]
            });

        expect(result.signals).toContainEqual({
            type: "BLOCKED_WORK_INCREASING",
            severity: "MEDIUM",
            evidence: {
                previous: 1,
                current: 4,
                change: 3
            }
        });
    });

    test("detects increasing overdue work", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-16",
                        healthScore: 85,
                        riskCounts: {
                            high: 1,
                            medium: 2
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            overdueTasks: 0,
                            blockedTasks: 1,
                            stagnantTasks: 1,
                            workloadRisks: 0
                        },
                        milestoneSummary: {
                            totalMilestones: 2,
                            completedMilestones: 1,
                            totalMilestoneTasks: 10,
                            completedMilestoneTasks: 5
                        }
                    },
                    {
                        snapshotDate: "2026-09-17",
                        healthScore: 85,
                        riskCounts: {
                            high: 1,
                            medium: 2
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            overdueTasks: 3,
                            blockedTasks: 1,
                            stagnantTasks: 1,
                            workloadRisks: 0
                        },
                        milestoneSummary: {
                            totalMilestones: 2,
                            completedMilestones: 1,
                            totalMilestoneTasks: 10,
                            completedMilestoneTasks: 5
                        }
                    }
                ]
            });

        expect(result.signals).toContainEqual({
            type: "OVERDUE_WORK_INCREASING",
            severity: "MEDIUM",
            evidence: {
                previous: 0,
                current: 3,
                change: 3
            }
        });
    });

    test("detects increasing risk exposure", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-16",
                        healthScore: 85,
                        riskCounts: {
                            high: 1,
                            medium: 2
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            overdueTasks: 0,
                            blockedTasks: 1,
                            stagnantTasks: 1,
                            workloadRisks: 0
                        },
                        milestoneSummary: {
                            totalMilestones: 2,
                            completedMilestones: 1,
                            totalMilestoneTasks: 10,
                            completedMilestoneTasks: 5
                        }
                    },
                    {
                        snapshotDate: "2026-09-17",
                        healthScore: 85,
                        riskCounts: {
                            high: 4,
                            medium: 4
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            overdueTasks: 0,
                            blockedTasks: 1,
                            stagnantTasks: 1,
                            workloadRisks: 0
                        },
                        milestoneSummary: {
                            totalMilestones: 2,
                            completedMilestones: 1,
                            totalMilestoneTasks: 10,
                            completedMilestoneTasks: 5
                        }
                    }
                ]
            });

        expect(result.signals).toContainEqual({
            type: "RISK_EXPOSURE_INCREASING",
            severity: "HIGH",
            evidence: {
                previous: 3,
                current: 8,
                change: 5
            }
        });
    });

    test("detects increasing blocked work ratio", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-16",
                        healthScore: 85,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            blockedTasks: 1,
                            overdueTasks: 0
                        },
                        milestoneSummary: {}
                    },
                    {
                        snapshotDate: "2026-09-17",
                        healthScore: 85,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            blockedTasks: 4,
                            overdueTasks: 0
                        },
                        milestoneSummary: {}
                    }
                ]
            });

        const signal =
            result.signals.find(
                (item) =>
                    item.type ===
                    "BLOCKED_WORK_RATIO_INCREASING"
            );

        expect(signal)
            .toEqual({
                type:
                    "BLOCKED_WORK_RATIO_INCREASING",
                severity: "HIGH",
                evidence: {
                    previousRatio: 0.1,
                    currentRatio: 0.4,
                    change: 0.3
                }
            });
    });

    test("detects increasing overdue work ratio", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-16",
                        healthScore: 85,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            blockedTasks: 0,
                            overdueTasks: 1
                        },
                        milestoneSummary: {}
                    },
                    {
                        snapshotDate: "2026-09-17",
                        healthScore: 85,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            blockedTasks: 0,
                            overdueTasks: 4
                        },
                        milestoneSummary: {}
                    }
                ]
            });

        const signal =
            result.signals.find(
                (item) =>
                    item.type ===
                    "OVERDUE_WORK_RATIO_INCREASING"
            );

        expect(signal)
            .toEqual({
                type:
                    "OVERDUE_WORK_RATIO_INCREASING",
                severity: "HIGH",
                evidence: {
                    previousRatio: 0.1,
                    currentRatio: 0.4,
                    change: 0.3
                }
            });
    });

    test("does not report blocked work ratio when unfinished work is zero", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-16",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 0
                        },
                        taskSummary: {
                            totalTasks: 10,
                            completedTasks: 10,
                            blockedTasks: 0,
                            overdueTasks: 0
                        },
                        milestoneSummary: {}
                    },
                    {
                        snapshotDate: "2026-09-17",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 0
                        },
                        taskSummary: {
                            totalTasks: 10,
                            completedTasks: 10,
                            blockedTasks: 0,
                            overdueTasks: 0
                        },
                        milestoneSummary: {}
                    }
                ]
            });

        expect(result.signals).not.toContainEqual(
            expect.objectContaining({
                type:
                    "BLOCKED_WORK_RATIO_INCREASING"
            })
        );
    });

    test("does not report overdue work ratio when there is no ratio increase", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-16",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 0
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            blockedTasks: 0,
                            overdueTasks: 1
                        },
                        milestoneSummary: {}
                    },
                    {
                        snapshotDate: "2026-09-17",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 0
                        },
                        taskSummary: {
                            totalTasks: 20,
                            completedTasks: 10,
                            blockedTasks: 0,
                            overdueTasks: 1
                        },
                        milestoneSummary: {}
                    }
                ]
            });

        expect(result.signals).not.toContainEqual(
            expect.objectContaining({
                type:
                    "OVERDUE_WORK_RATIO_INCREASING"
            })
        );
    });

    test("detects declining completion velocity", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-11",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 0
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 0
                        }
                    },
                    {
                        snapshotDate: "2026-09-12",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 3
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 1
                        }
                    },
                    {
                        snapshotDate: "2026-09-13",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 5
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 2
                        }
                    },
                    {
                        snapshotDate: "2026-09-14",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 8
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 4
                        }
                    },
                    {
                        snapshotDate: "2026-09-15",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 10
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 6
                        }
                    },
                    {
                        snapshotDate: "2026-09-16",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 11
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 7
                        }
                    },
                    {
                        snapshotDate: "2026-09-17",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 11
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 7
                        }
                    }
                ]
            });

        expect(result.signals).toContainEqual(
            expect.objectContaining({
                type:
                    "COMPLETION_VELOCITY_DECLINING",
                severity: "MEDIUM"
            })
        );

        const signal =
            result.signals.find(
                (item) =>
                    item.type ===
                    "COMPLETION_VELOCITY_DECLINING"
            );

        expect(
            signal.evidence.previousVelocities
        ).toEqual([3, 2, 3]);

        expect(
            signal.evidence.recentVelocities
        ).toEqual([2, 1, 0]);
    });

    test("does not detect completion velocity decline with insufficient snapshots", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-13",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 0
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 0
                        }
                    },
                    {
                        snapshotDate: "2026-09-14",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 3
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 1
                        }
                    },
                    {
                        snapshotDate: "2026-09-15",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 5
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 2
                        }
                    }
                ]
            });

        expect(result.signals).not.toContainEqual(
            expect.objectContaining({
                type:
                    "COMPLETION_VELOCITY_DECLINING"
            })
        );
    });

    test("detects slowing milestone progress", () => {
        const result =
            analyzeExecutionTrend({
                snapshots: [
                    {
                        snapshotDate: "2026-09-11",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 10
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 0
                        }
                    },
                    {
                        snapshotDate: "2026-09-12",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 10
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 3
                        }
                    },
                    {
                        snapshotDate: "2026-09-13",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 10
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 5
                        }
                    },
                    {
                        snapshotDate: "2026-09-14",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 10
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 8
                        }
                    },
                    {
                        snapshotDate: "2026-09-15",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 10
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 10
                        }
                    },
                    {
                        snapshotDate: "2026-09-16",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 10
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 11
                        }
                    },
                    {
                        snapshotDate: "2026-09-17",
                        healthScore: 90,
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            completedTasks: 10
                        },
                        milestoneSummary: {
                            completedMilestoneTasks: 11
                        }
                    }
                ]
            });

        expect(result.signals).toContainEqual(
            expect.objectContaining({
                type:
                    "MILESTONE_PROGRESS_SLOWING",
                severity: "MEDIUM"
            })
        );

        const signal =
            result.signals.find(
                (item) =>
                    item.type ===
                    "MILESTONE_PROGRESS_SLOWING"
            );

        expect(
            signal.evidence.previousVelocities
        ).toEqual([3, 2, 3]);

        expect(
            signal.evidence.recentVelocities
        ).toEqual([2, 1, 0]);
    });
});