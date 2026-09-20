const mongoose = require("mongoose");

const Project =
    require("../../src/modules/projects/project.model");

const ProjectHealthSnapshot =
    require(
        "../../src/modules/projects/project.health.snapshot.model"
    );

const ProjectRiskHistory =
    require(
        "../../src/modules/risks/project.risk.history.model"
    );

const {
    getExecutionTrend,
    getRiskPersistenceSignal
} =
    require(
        "../../src/modules/projects/execution.trend.service"
    );

describe("Execution trend service", () => {
    let ownerId;
    let memberId;
    let project;

    beforeEach(async () => {
        await ProjectHealthSnapshot.deleteMany({});
        await ProjectRiskHistory.deleteMany({});
        await Project.deleteMany({});

        ownerId =
            new mongoose.Types.ObjectId();

        memberId =
            new mongoose.Types.ObjectId();

        project =
            await Project.create({
                name: "Trend Test Project",
                description:
                    "Execution trend service test project",
                owner: ownerId,
                status: "active",
                startDate:
                    new Date("2026-09-01"),
                targetDate:
                    new Date("2026-12-31"),
                members: [
                    {
                        user: ownerId,
                        role: "owner"
                    },
                    {
                        user: memberId,
                        role: "member"
                    }
                ]
            });
    });

    test("returns snapshots and detected trend signals", async () => {
        await ProjectHealthSnapshot.create([
            {
                project: project._id,
                snapshotDate: "2026-09-16",
                healthScore: 88,
                healthStatus: "ON_TRACK",
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
                },
                capturedAt:
                    new Date(
                        "2026-09-16T12:00:00.000Z"
                    )
            },
            {
                project: project._id,
                snapshotDate: "2026-09-17",
                healthScore: 76,
                healthStatus: "AT_RISK",
                riskCounts: {
                    high: 2,
                    medium: 3
                },
                taskSummary: {
                    totalTasks: 20,
                    completedTasks: 11,
                    overdueTasks: 0,
                    blockedTasks: 4,
                    stagnantTasks: 1,
                    workloadRisks: 0
                },
                milestoneSummary: {
                    totalMilestones: 2,
                    completedMilestones: 1,
                    totalMilestoneTasks: 10,
                    completedMilestoneTasks: 6
                },
                capturedAt:
                    new Date(
                        "2026-09-17T12:00:00.000Z"
                    )
            }
        ]);

        const result =
            await getExecutionTrend({
                projectId:
                    project._id.toString(),
                userId: ownerId.toString(),
                days: 30
            });

        expect(result.projectId)
            .toBe(
                project._id.toString()
            );

        expect(result.range)
            .toBe("30d");

        expect(result.snapshots)
            .toHaveLength(2);

        expect(result.signals)
            .toContainEqual({
                type:
                    "HEALTH_DECLINING",
                severity: "MEDIUM",
                evidence: {
                    previous: 88,
                    current: 76,
                    change: -12
                }
            });

        expect(result.signals)
            .toContainEqual({
                type:
                    "BLOCKED_WORK_INCREASING",
                severity: "MEDIUM",
                evidence: {
                    previous: 1,
                    current: 4,
                    change: 3
                }
            });
    });

    test("returns snapshots in oldest-to-newest order", async () => {
        await ProjectHealthSnapshot.create([
            {
                project: project._id,
                snapshotDate: "2026-09-17",
                healthScore: 76,
                healthStatus: "AT_RISK",
                riskCounts: {
                    high: 2,
                    medium: 3
                },
                taskSummary: {
                    totalTasks: 20,
                    completedTasks: 11,
                    overdueTasks: 0,
                    blockedTasks: 4,
                    stagnantTasks: 1,
                    workloadRisks: 0
                },
                milestoneSummary: {
                    totalMilestones: 2,
                    completedMilestones: 1,
                    totalMilestoneTasks: 10,
                    completedMilestoneTasks: 6
                },
                capturedAt:
                    new Date(
                        "2026-09-17T12:00:00.000Z"
                    )
            },
            {
                project: project._id,
                snapshotDate: "2026-09-15",
                healthScore: 90,
                healthStatus: "HEALTHY",
                riskCounts: {
                    high: 0,
                    medium: 1
                },
                taskSummary: {
                    totalTasks: 20,
                    completedTasks: 9,
                    overdueTasks: 0,
                    blockedTasks: 0,
                    stagnantTasks: 0,
                    workloadRisks: 0
                },
                milestoneSummary: {
                    totalMilestones: 2,
                    completedMilestones: 1,
                    totalMilestoneTasks: 10,
                    completedMilestoneTasks: 4
                },
                capturedAt:
                    new Date(
                        "2026-09-15T12:00:00.000Z"
                    )
            },
            {
                project: project._id,
                snapshotDate: "2026-09-16",
                healthScore: 85,
                healthStatus: "ON_TRACK",
                riskCounts: {
                    high: 1,
                    medium: 1
                },
                taskSummary: {
                    totalTasks: 20,
                    completedTasks: 10,
                    overdueTasks: 0,
                    blockedTasks: 1,
                    stagnantTasks: 0,
                    workloadRisks: 0
                },
                milestoneSummary: {
                    totalMilestones: 2,
                    completedMilestones: 1,
                    totalMilestoneTasks: 10,
                    completedMilestoneTasks: 5
                },
                capturedAt:
                    new Date(
                        "2026-09-16T12:00:00.000Z"
                    )
            }
        ]);

        const result =
            await getExecutionTrend({
                projectId:
                    project._id.toString(),
                userId: ownerId.toString(),
                days: 30
            });

        expect(
            result.snapshots.map(
                (snapshot) =>
                    snapshot.snapshotDate
            )
        ).toEqual([
            "2026-09-15",
            "2026-09-16",
            "2026-09-17"
        ]);
    });

    test("respects the requested snapshot limit", async () => {
        await ProjectHealthSnapshot.create(
            [
                {
                    project: project._id,
                    snapshotDate: "2026-09-15",
                    healthScore: 90,
                    healthStatus: "HEALTHY",
                    riskCounts: {
                        high: 0,
                        medium: 1
                    },
                    taskSummary: {
                        totalTasks: 20,
                        completedTasks: 9,
                        overdueTasks: 0,
                        blockedTasks: 0,
                        stagnantTasks: 0,
                        workloadRisks: 0
                    },
                    milestoneSummary: {
                        totalMilestones: 2,
                        completedMilestones: 1,
                        totalMilestoneTasks: 10,
                        completedMilestoneTasks: 4
                    },
                    capturedAt:
                        new Date(
                            "2026-09-15T12:00:00.000Z"
                        )
                },
                {
                    project: project._id,
                    snapshotDate: "2026-09-16",
                    healthScore: 85,
                    healthStatus: "ON_TRACK",
                    riskCounts: {
                        high: 1,
                        medium: 1
                    },
                    taskSummary: {
                        totalTasks: 20,
                        completedTasks: 10,
                        overdueTasks: 0,
                        blockedTasks: 1,
                        stagnantTasks: 0,
                        workloadRisks: 0
                    },
                    milestoneSummary: {
                        totalMilestones: 2,
                        completedMilestones: 1,
                        totalMilestoneTasks: 10,
                        completedMilestoneTasks: 5
                    },
                    capturedAt:
                        new Date(
                            "2026-09-16T12:00:00.000Z"
                        )
                },
                {
                    project: project._id,
                    snapshotDate: "2026-09-17",
                    healthScore: 76,
                    healthStatus: "AT_RISK",
                    riskCounts: {
                        high: 2,
                        medium: 3
                    },
                    taskSummary: {
                        totalTasks: 20,
                        completedTasks: 11,
                        overdueTasks: 1,
                        blockedTasks: 4,
                        stagnantTasks: 1,
                        workloadRisks: 0
                    },
                    milestoneSummary: {
                        totalMilestones: 2,
                        completedMilestones: 1,
                        totalMilestoneTasks: 10,
                        completedMilestoneTasks: 6
                    },
                    capturedAt:
                        new Date(
                            "2026-09-17T12:00:00.000Z"
                        )
                }
            ]
        );

        const result =
            await getExecutionTrend({
                projectId:
                    project._id.toString(),
                userId: ownerId.toString(),
                days: 2
            });

        expect(result.snapshots)
            .toHaveLength(2);

        expect(
            result.snapshots[0].snapshotDate
        ).toBe("2026-09-16");

        expect(
            result.snapshots[1].snapshotDate
        ).toBe("2026-09-17");
    });

    test("allows a project member to retrieve execution trend", async () => {
        await ProjectHealthSnapshot.create({
            project: project._id,
            snapshotDate: "2026-09-17",
            healthScore: 82,
            healthStatus: "ON_TRACK",
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
            },
            capturedAt:
                new Date(
                    "2026-09-17T12:00:00.000Z"
                )
        });

        const result =
            await getExecutionTrend({
                projectId:
                    project._id.toString(),
                userId: memberId.toString(),
                days: 30
            });

        expect(result.projectId)
            .toBe(
                project._id.toString()
            );

        expect(result.snapshots)
            .toHaveLength(1);
    });

    test("rejects a non-member", async () => {
        const outsiderId =
            new mongoose.Types.ObjectId();

        await expect(
            getExecutionTrend({
                projectId:
                    project._id.toString(),
                userId:
                    outsiderId.toString(),
                days: 30
            })
        ).rejects.toMatchObject({
            statusCode: 404,
            code: "PROJECT_NOT_FOUND"
        });
    });

    test("rejects an invalid project id", async () => {
        await expect(
            getExecutionTrend({
                projectId: "invalid-project-id",
                userId:
                    ownerId.toString(),
                days: 30
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "INVALID_PROJECT_ID"
        });
    });

    test("detects persistent active risks", () => {
        const riskHistory = [
            {
                identity:
                    "OVERDUE_TASK:task-1",
                type:
                    "OVERDUE_TASK",
                status: "ACTIVE",
                currentSeverity: "HIGH",
                firstDetectedAt:
                    new Date(
                        "2026-09-10"
                    ),
                lastDetectedAt:
                    new Date(
                        "2026-09-17"
                    ),
                detectionCount: 3
            }
        ];

        const signal =
            getRiskPersistenceSignal(
                riskHistory
            );

        expect(signal)
            .toEqual({
                type:
                    "RISK_PERSISTENCE_INCREASING",
                severity: "MEDIUM",
                evidence: {
                    persistentRiskCount: 1,
                    highPersistenceRiskCount: 0,
                    minimumDetectionCount: 3,
                    risks: [
                        {
                            identity:
                                "OVERDUE_TASK:task-1",
                            type:
                                "OVERDUE_TASK",
                            severity: "HIGH",
                            detectionCount: 3,
                            firstDetectedAt:
                                new Date(
                                    "2026-09-10"
                                ),
                            lastDetectedAt:
                                new Date(
                                    "2026-09-17"
                                )
                        }
                    ]
                }
            });
    });

    test("detects high risk persistence", () => {
        const riskHistory = [
            {
                identity:
                    "BLOCKED_TASK:task-1",
                type:
                    "BLOCKED_TASK",
                status: "ACTIVE",
                currentSeverity: "HIGH",
                firstDetectedAt:
                    new Date(
                        "2026-09-01"
                    ),
                lastDetectedAt:
                    new Date(
                        "2026-09-17"
                    ),
                detectionCount: 5
            }
        ];

        const signal =
            getRiskPersistenceSignal(
                riskHistory
            );

        expect(signal)
            .toEqual({
                type:
                    "RISK_PERSISTENCE_INCREASING",
                severity: "HIGH",
                evidence: {
                    persistentRiskCount: 1,
                    highPersistenceRiskCount: 1,
                    minimumDetectionCount: 3,
                    risks: [
                        {
                            identity:
                                "BLOCKED_TASK:task-1",
                            type:
                                "BLOCKED_TASK",
                            severity: "HIGH",
                            detectionCount: 5,
                            firstDetectedAt:
                                new Date(
                                    "2026-09-01"
                                ),
                            lastDetectedAt:
                                new Date(
                                    "2026-09-17"
                                )
                        }
                    ]
                }
            });
    });

    test("ignores resolved risks and risks below persistence threshold", () => {
        const riskHistory = [
            {
                identity:
                    "RISK_1",
                type:
                    "BLOCKED_TASK",
                status: "RESOLVED",
                currentSeverity: "HIGH",
                detectionCount: 10
            },
            {
                identity:
                    "RISK_2",
                type:
                    "OVERDUE_TASK",
                status: "ACTIVE",
                currentSeverity: "MEDIUM",
                detectionCount: 2
            }
        ];

        const signal =
            getRiskPersistenceSignal(
                riskHistory
            );

        expect(signal)
            .toBeNull();
    });

    test("includes risk persistence in execution trend response", async () => {
        await ProjectHealthSnapshot.create({
            project: project._id,
            snapshotDate: "2026-09-17",
            healthScore: 82,
            healthStatus: "ON_TRACK",
            riskCounts: {
                high: 1,
                medium: 1
            },
            taskSummary: {
                totalTasks: 10,
                completedTasks: 5,
                overdueTasks: 0,
                blockedTasks: 1,
                stagnantTasks: 0,
                workloadRisks: 0
            },
            milestoneSummary: {
                totalMilestones: 1,
                completedMilestones: 0,
                totalMilestoneTasks: 5,
                completedMilestoneTasks: 2
            },
            capturedAt:
                new Date(
                    "2026-09-17T12:00:00.000Z"
                )
        });

        await ProjectRiskHistory.create({
            project: project._id,
            identity:
                "BLOCKED_TASK:task-1",
            type:
                "BLOCKED_TASK",
            status: "ACTIVE",
            currentSeverity: "HIGH",
            previousSeverity: "MEDIUM",
            firstDetectedAt:
                new Date(
                    "2026-09-10"
                ),
            lastDetectedAt:
                new Date(
                    "2026-09-17"
                ),
            detectionCount: 4,
            lastLifecycle:
                "PERSISTENT",
            evidence: {
                blocked: true
            },
            snapshotKey:
                `health:${project._id}:2026-09-17`
        });

        const result =
            await getExecutionTrend({
                projectId:
                    project._id.toString(),
                userId:
                    ownerId.toString(),
                days: 30
            });

        expect(result.signals)
            .toContainEqual(
                expect.objectContaining({
                    type:
                        "RISK_PERSISTENCE_INCREASING",
                    severity:
                        "MEDIUM"
                })
            );
    });
});