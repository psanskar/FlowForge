const bcrypt = require("bcryptjs");

const User = require(
    "../../src/modules/users/user.model"
);

const Project = require(
    "../../src/modules/projects/project.model"
);

const Task = require(
    "../../src/modules/tasks/task.model"
);

const Milestone = require(
    "../../src/modules/milestones/milestone.model"
);

const GithubSignal = require(
    "../../src/modules/github/github.signal.model"
);

const ProjectHealthSnapshot =
    require(
        "../../src/modules/projects/project.health.snapshot.model"
    );

const ProjectRiskHistory =
    require(
        "../../src/modules/risks/project.risk.history.model"
    );

const {
    buildSnapshotData,
    captureProjectHealthSnapshot
} = require(
    "../../src/modules/projects/project.health.snapshot.service"
);

describe(
    "Project Health Snapshot Service",
    () => {
        let user;
        let project;

        beforeEach(async () => {
            const passwordHash =
                await bcrypt.hash(
                    "password123",
                    10
                );

            user = await User.create({
                name: "Snapshot User",
                email: `snapshot-${Date.now()}-${Math.random()}@example.com`,
                passwordHash
            });

            project = await Project.create({
                name: "Snapshot Test Project",
                description:
                    "Snapshot service test",
                owner: user._id,
                members: [
                    {
                        user: user._id,
                        role: "owner"
                    }
                ],
                status: "active"
            });
        });

        it(
            "returns the existing snapshot when the same project/date is captured twice",
            async () => {
                const project =
                    await Project.create({
                        name:
                            "Idempotent Snapshot Project",
                        owner: user._id,
                        members: [
                            {
                                user: user._id,
                                role: "owner"
                            }
                        ],
                        status: "active",
                        startDate:
                            new Date(
                                "2026-09-01"
                            ),
                        targetDate:
                            new Date(
                                "2026-12-31"
                            )
                    });

                const capturedAt =
                    new Date(
                        "2026-09-19T10:00:00.000Z"
                    );

                const firstSnapshot =
                    await captureProjectHealthSnapshot(
                        {
                            projectId:
                                project._id,
                            userId:
                                user._id,
                            now: capturedAt
                        }
                    );

                const secondSnapshot =
                    await captureProjectHealthSnapshot(
                        {
                            projectId:
                                project._id,
                            userId:
                                user._id,
                            now: new Date(
                                "2026-09-19T18:00:00.000Z"
                            )
                        }
                    );

                expect(
                    secondSnapshot._id.toString()
                ).toBe(
                    firstSnapshot._id.toString()
                );

                const snapshotCount =
                    await ProjectHealthSnapshot.countDocuments(
                        {
                            project:
                                project._id,
                            snapshotDate:
                                "2026-09-19"
                        }
                    );

                expect(snapshotCount).toBe(1);
            }
        );

        test(
            "builds snapshot data from health, risks, tasks and milestones",
            () => {
                const capturedAt =
                    new Date(
                        "2026-09-17T12:00:00.000Z"
                    );

                const tasks = [
                    {
                        _id:
                            "000000000000000000000001",
                        status: "completed",
                        milestone:
                            "000000000000000000000010"
                    },
                    {
                        _id:
                            "000000000000000000000002",
                        status: "blocked",
                        milestone:
                            "000000000000000000000010"
                    },
                    {
                        _id:
                            "000000000000000000000003",
                        status: "in_progress"
                    }
                ];

                const milestones = [
                    {
                        _id:
                            "000000000000000000000010",
                        status: "completed"
                    },
                    {
                        _id:
                            "000000000000000000000011",
                        status: "planned"
                    }
                ];

                const risks = [
                    {
                        type: "TASK_OVERDUE",
                        severity: "HIGH"
                    },
                    {
                        type: "TASK_BLOCKED",
                        severity: "HIGH"
                    },
                    {
                        type: "TASK_STAGNANT",
                        severity: "MEDIUM"
                    }
                ];

                const health = {
                    score: 71,
                    health: "ON_TRACK",
                    summary: {
                        totalTasks: 3,
                        completedTasks: 1,
                        overdueTasks: 1,
                        blockedTasks: 1,
                        stagnantTasks: 1,
                        workloadRisks: 0
                    }
                };

                const snapshot =
                    buildSnapshotData({
                        tasks,
                        milestones,
                        risks,
                        health,
                        capturedAt
                    });

                expect(snapshot).toEqual({
                    healthScore: 71,
                    healthStatus: "ON_TRACK",

                    riskCounts: {
                        high: 2,
                        medium: 1
                    },

                    snapshotDate:
                        "2026-09-17",

                    taskSummary: {
                        totalTasks: 3,
                        completedTasks: 1,
                        overdueTasks: 1,
                        blockedTasks: 1,
                        stagnantTasks: 1,
                        workloadRisks: 0
                    },

                    milestoneSummary: {
                        totalMilestones: 2,
                        completedMilestones: 1,
                        totalMilestoneTasks: 2,
                        completedMilestoneTasks: 1
                    },

                    capturedAt
                });
            }
        );

        test(
            "captures and persists a project health snapshot",
            async () => {
                const capturedAt =
                    new Date(
                        "2026-09-17T12:00:00.000Z"
                    );

                await Task.create({
                    project: project._id,
                    title:
                        "Completed task",
                    status: "completed",
                    progress: 100,
                    createdBy: user._id,
                    assignee: user._id,
                    completedAt:
                        capturedAt,
                    lastActivityAt:
                        capturedAt
                });

                await Task.create({
                    project: project._id,
                    title:
                        "Blocked task",
                    status: "blocked",
                    priority: "high",
                    createdBy: user._id,
                    assignee: user._id,
                    lastActivityAt:
                        new Date(
                            "2026-09-10T12:00:00.000Z"
                        )
                });

                const milestone =
                    await Milestone.create({
                        project:
                            project._id,
                        name: "Release",
                        dueDate:
                            new Date(
                                "2026-12-01T12:00:00.000Z"
                            ),
                        status: "planned"
                    });

                await Task.create({
                    project: project._id,
                    title:
                        "Milestone task",
                    status: "in_progress",
                    milestone:
                        milestone._id,
                    createdBy: user._id,
                    assignee: user._id,
                    lastActivityAt:
                        capturedAt
                });

                const snapshot =
                    await captureProjectHealthSnapshot(
                        {
                            projectId:
                                project._id.toString(),

                            userId:
                                user._id.toString(),

                            now: capturedAt
                        }
                    );

                expect(snapshot)
                    .toBeDefined();

                expect(
                    snapshot.project.toString()
                ).toBe(
                    project._id.toString()
                );

                expect(
                    snapshot.capturedAt.toISOString()
                ).toBe(
                    capturedAt.toISOString()
                );

                expect(
                    snapshot.healthScore
                ).toBeGreaterThanOrEqual(0);

                expect(
                    snapshot.healthScore
                ).toBeLessThanOrEqual(100);

                expect(
                    snapshot.healthStatus
                ).toBeDefined();

                expect(
                    snapshot.riskCounts.high
                ).toBeGreaterThanOrEqual(1);

                expect(
                    snapshot.taskSummary.totalTasks
                ).toBe(3);

                expect(
                    snapshot.taskSummary
                        .completedTasks
                ).toBe(1);

                expect(
                    snapshot.taskSummary
                        .blockedTasks
                ).toBe(1);

                expect(
                    snapshot.milestoneSummary
                        .totalMilestones
                ).toBe(1);

                expect(
                    snapshot.milestoneSummary
                        .totalMilestoneTasks
                ).toBe(1);

                const storedSnapshot =
                    await ProjectHealthSnapshot
                        .findById(
                            snapshot._id
                        )
                        .lean();

                expect(
                    storedSnapshot
                ).not.toBeNull();

                expect(
                    storedSnapshot.project.toString()
                ).toBe(
                    project._id.toString()
                );
            }
        );

        test(
            "rejects access for a non-member",
            async () => {
                const otherUser =
                    await User.create({
                        name: "Other User",
                        email: `other-snapshot-${Date.now()}@example.com`,
                        passwordHash:
                            await bcrypt.hash(
                                "password123",
                                10
                            )
                    });

                await expect(
                    captureProjectHealthSnapshot(
                        {
                            projectId:
                                project._id.toString(),

                            userId:
                                otherUser._id.toString()
                        }
                    )
                ).rejects.toMatchObject({
                    statusCode: 404,
                    code:
                        "PROJECT_NOT_FOUND"
                });
            }
        );

        test(
            "rejects an invalid project id",
            async () => {
                await expect(
                    captureProjectHealthSnapshot(
                        {
                            projectId:
                                "invalid-project-id",

                            userId:
                                user._id.toString()
                        }
                    )
                ).rejects.toMatchObject({
                    statusCode: 400,
                    code:
                        "INVALID_PROJECT_ID"
                });
            }
        );

        /*
         * ------------------------------------------------------------
         * Risk lifecycle integration
         * ------------------------------------------------------------
         */

        test(
            "creates NEW risk history on the first snapshot",
            async () => {
                const capturedAt =
                    new Date(
                        "2026-09-19T10:00:00.000Z"
                    );

                const task =
                    await Task.create({
                        project:
                            project._id,
                        title:
                            "Blocked task",
                        status:
                            "blocked",
                        priority:
                            "medium",
                        createdBy:
                            user._id,
                        assignee:
                            user._id,
                        lastActivityAt:
                            capturedAt
                    });

                await captureProjectHealthSnapshot(
                    {
                        projectId:
                            project._id,
                        userId:
                            user._id,
                        now:
                            capturedAt
                    }
                );

                const history =
                    await ProjectRiskHistory
                        .find({
                            project:
                                project._id
                        })
                        .lean();

                const blockedRisk =
                    history.find(
                        (risk) =>
                            risk.identity ===
                            `TASK_BLOCKED:${task._id}`
                    );

                expect(
                    blockedRisk
                ).toBeDefined();

                expect(
                    blockedRisk.status
                ).toBe("ACTIVE");

                expect(
                    blockedRisk.currentSeverity
                ).toBe("MEDIUM");

                expect(
                    blockedRisk.lastLifecycle
                ).toBe("NEW");

                expect(
                    blockedRisk.detectionCount
                ).toBe(1);

                expect(
                    blockedRisk.firstDetectedAt
                ).toEqual(capturedAt);

                expect(
                    blockedRisk.lastDetectedAt
                ).toEqual(capturedAt);
            }
        );

        test(
            "marks an existing risk as PERSISTENT and increments detection count",
            async () => {
                const firstCapturedAt =
                    new Date(
                        "2026-09-19T10:00:00.000Z"
                    );

                const secondCapturedAt =
                    new Date(
                        "2026-09-20T10:00:00.000Z"
                    );

                const task =
                    await Task.create({
                        project:
                            project._id,
                        title:
                            "Persistent blocked task",
                        status:
                            "blocked",
                        priority:
                            "medium",
                        createdBy:
                            user._id,
                        assignee:
                            user._id,
                        lastActivityAt:
                            firstCapturedAt
                    });

                await captureProjectHealthSnapshot(
                    {
                        projectId:
                            project._id,
                        userId:
                            user._id,
                        now:
                            firstCapturedAt
                    }
                );

                await Task.updateOne(
                    {
                        _id:
                            task._id
                    },
                    {
                        $set: {
                            lastActivityAt:
                                secondCapturedAt
                        }
                    }
                );

                await captureProjectHealthSnapshot(
                    {
                        projectId:
                            project._id,
                        userId:
                            user._id,
                        now:
                            secondCapturedAt
                    }
                );

                const history =
                    await ProjectRiskHistory
                        .findOne({
                            project:
                                project._id,
                            identity:
                                `TASK_BLOCKED:${task._id}`
                        })
                        .lean();

                expect(history)
                    .not.toBeNull();

                expect(
                    history.lastLifecycle
                ).toBe("PERSISTENT");

                expect(
                    history.status
                ).toBe("ACTIVE");

                expect(
                    history.currentSeverity
                ).toBe("MEDIUM");

                expect(
                    history.detectionCount
                ).toBe(2);

                expect(
                    history.lastDetectedAt
                ).toEqual(
                    secondCapturedAt
                );
            }
        );

        test(
            "marks a risk as ESCALATED when severity increases",
            async () => {
                const firstCapturedAt =
                    new Date(
                        "2026-09-19T10:00:00.000Z"
                    );

                const secondCapturedAt =
                    new Date(
                        "2026-09-20T10:00:00.000Z"
                    );

                const task =
                    await Task.create({
                        project:
                            project._id,
                        title:
                            "Escalating blocked task",
                        status:
                            "blocked",
                        priority:
                            "medium",
                        createdBy:
                            user._id,
                        assignee:
                            user._id,
                        lastActivityAt:
                            firstCapturedAt
                    });

                await captureProjectHealthSnapshot(
                    {
                        projectId:
                            project._id,
                        userId:
                            user._id,
                        now:
                            firstCapturedAt
                    }
                );

                await Task.updateOne(
                    {
                        _id:
                            task._id
                    },
                    {
                        $set: {
                            priority:
                                "critical",
                            lastActivityAt:
                                secondCapturedAt
                        }
                    }
                );

                await captureProjectHealthSnapshot(
                    {
                        projectId:
                            project._id,
                        userId:
                            user._id,
                        now:
                            secondCapturedAt
                    }
                );

                const history =
                    await ProjectRiskHistory
                        .findOne({
                            project:
                                project._id,
                            identity:
                                `TASK_BLOCKED:${task._id}`
                        })
                        .lean();

                expect(history)
                    .not.toBeNull();

                expect(
                    history.lastLifecycle
                ).toBe("ESCALATED");

                expect(
                    history.previousSeverity
                ).toBe("MEDIUM");

                expect(
                    history.currentSeverity
                ).toBe("HIGH");

                expect(
                    history.detectionCount
                ).toBe(2);
            }
        );

        test(
            "marks a risk as DE_ESCALATED when severity decreases",
            async () => {
                const firstCapturedAt =
                    new Date(
                        "2026-09-19T10:00:00.000Z"
                    );

                const secondCapturedAt =
                    new Date(
                        "2026-09-20T10:00:00.000Z"
                    );

                const task =
                    await Task.create({
                        project:
                            project._id,
                        title:
                            "De-escalating blocked task",
                        status:
                            "blocked",
                        priority:
                            "critical",
                        createdBy:
                            user._id,
                        assignee:
                            user._id,
                        lastActivityAt:
                            firstCapturedAt
                    });

                await captureProjectHealthSnapshot(
                    {
                        projectId:
                            project._id,
                        userId:
                            user._id,
                        now:
                            firstCapturedAt
                    }
                );

                await Task.updateOne(
                    {
                        _id:
                            task._id
                    },
                    {
                        $set: {
                            priority:
                                "medium",
                            lastActivityAt:
                                secondCapturedAt
                        }
                    }
                );

                await captureProjectHealthSnapshot(
                    {
                        projectId:
                            project._id,
                        userId:
                            user._id,
                        now:
                            secondCapturedAt
                    }
                );

                const history =
                    await ProjectRiskHistory
                        .findOne({
                            project:
                                project._id,
                            identity:
                                `TASK_BLOCKED:${task._id}`
                        })
                        .lean();

                expect(history)
                    .not.toBeNull();

                expect(
                    history.lastLifecycle
                ).toBe("DE_ESCALATED");

                expect(
                    history.previousSeverity
                ).toBe("HIGH");

                expect(
                    history.currentSeverity
                ).toBe("MEDIUM");

                expect(
                    history.detectionCount
                ).toBe(2);
            }
        );

        test(
            "marks a risk as RESOLVED when the risk disappears",
            async () => {
                const firstCapturedAt =
                    new Date(
                        "2026-09-19T10:00:00.000Z"
                    );

                const secondCapturedAt =
                    new Date(
                        "2026-09-20T10:00:00.000Z"
                    );

                const task =
                    await Task.create({
                        project:
                            project._id,
                        title:
                            "Resolvable blocked task",
                        status:
                            "blocked",
                        priority:
                            "medium",
                        createdBy:
                            user._id,
                        assignee:
                            user._id,
                        lastActivityAt:
                            firstCapturedAt
                    });

                await captureProjectHealthSnapshot(
                    {
                        projectId:
                            project._id,
                        userId:
                            user._id,
                        now:
                            firstCapturedAt
                    }
                );

                await Task.updateOne(
                    {
                        _id:
                            task._id
                    },
                    {
                        $set: {
                            status:
                                "completed",
                            progress: 100,
                            completedAt:
                                secondCapturedAt,
                            lastActivityAt:
                                secondCapturedAt
                        }
                    }
                );

                await captureProjectHealthSnapshot(
                    {
                        projectId:
                            project._id,
                        userId:
                            user._id,
                        now:
                            secondCapturedAt
                    }
                );

                const history =
                    await ProjectRiskHistory
                        .findOne({
                            project:
                                project._id,
                            identity:
                                `TASK_BLOCKED:${task._id}`
                        })
                        .lean();

                expect(history)
                    .not.toBeNull();

                expect(
                    history.status
                ).toBe("RESOLVED");

                expect(
                    history.lastLifecycle
                ).toBe("RESOLVED");

                expect(
                    history.resolvedAt
                ).toEqual(
                    secondCapturedAt
                );

                expect(
                    history.detectionCount
                ).toBe(1);
            }
        );

        test(
            "does not duplicate risk lifecycle processing when the same snapshot date is captured twice",
            async () => {
                const firstCapturedAt =
                    new Date(
                        "2026-09-19T10:00:00.000Z"
                    );

                const secondCapturedAt =
                    new Date(
                        "2026-09-19T18:00:00.000Z"
                    );

                const task =
                    await Task.create({
                        project:
                            project._id,
                        title:
                            "Same day blocked task",
                        status:
                            "blocked",
                        priority:
                            "medium",
                        createdBy:
                            user._id,
                        assignee:
                            user._id,
                        lastActivityAt:
                            firstCapturedAt
                    });

                await captureProjectHealthSnapshot(
                    {
                        projectId:
                            project._id,
                        userId:
                            user._id,
                        now:
                            firstCapturedAt
                    }
                );

                await captureProjectHealthSnapshot(
                    {
                        projectId:
                            project._id,
                        userId:
                            user._id,
                        now:
                            secondCapturedAt
                    }
                );

                const historyCount =
                    await ProjectRiskHistory
                        .countDocuments({
                            project:
                                project._id,
                            identity:
                                `TASK_BLOCKED:${task._id}`
                        });

                expect(
                    historyCount
                ).toBe(1);

                const history =
                    await ProjectRiskHistory
                        .findOne({
                            project:
                                project._id,
                            identity:
                                `TASK_BLOCKED:${task._id}`
                        })
                        .lean();

                expect(
                    history.detectionCount
                ).toBe(1);

                expect(
                    history.lastLifecycle
                ).toBe("NEW");
            }
        );

        test(
            "handles concurrent captures for the same project and date without duplicating lifecycle history",
            async () => {
                const capturedAt =
                    new Date(
                        "2026-09-21T10:00:00.000Z"
                    );

                const task =
                    await Task.create({
                        project: project._id,
                        title:
                            "Concurrent blocked task",
                        status: "blocked",
                        priority: "medium",
                        createdBy: user._id,
                        assignee: user._id,
                        lastActivityAt:
                            capturedAt
                    });

                const [firstResult, secondResult] =
                    await Promise.all([
                        captureProjectHealthSnapshot({
                            projectId:
                                project._id,
                            userId:
                                user._id,
                            now: capturedAt
                        }),

                        captureProjectHealthSnapshot({
                            projectId:
                                project._id,
                            userId:
                                user._id,
                            now: capturedAt
                        })
                    ]);

                const snapshotCount =
                    await ProjectHealthSnapshot.countDocuments(
                        {
                            project:
                                project._id,
                            snapshotDate:
                                "2026-09-21"
                        }
                    );

                expect(snapshotCount).toBe(1);

                expect(
                    firstResult._id.toString()
                ).toBe(
                    secondResult._id.toString()
                );

                const history =
                    await ProjectRiskHistory.findOne({
                        project:
                            project._id,
                        identity:
                            `TASK_BLOCKED:${task._id}`
                    }).lean();

                expect(history).not.toBeNull();

                expect(
                    history.detectionCount
                ).toBe(1);

                expect(
                    history.lastLifecycle
                ).toBe("NEW");
            }
        );

        test(
            "does not store full risk arrays in health snapshots",
            async () => {
                const capturedAt =
                    new Date(
                        "2026-09-19T10:00:00.000Z"
                    );

                await Task.create({
                    project:
                        project._id,
                    title:
                        "Snapshot risk task",
                    status:
                        "blocked",
                    priority:
                        "medium",
                    createdBy:
                        user._id,
                    assignee:
                        user._id,
                    lastActivityAt:
                        capturedAt
                });

                const snapshot =
                    await captureProjectHealthSnapshot(
                        {
                            projectId:
                                project._id,
                            userId:
                                user._id,
                            now:
                                capturedAt
                        }
                    );

                const storedSnapshot =
                    await ProjectHealthSnapshot
                        .findById(
                            snapshot._id
                        )
                        .lean();

                expect(
                    storedSnapshot
                ).not.toHaveProperty(
                    "risks"
                );

                expect(
                    storedSnapshot
                ).not.toHaveProperty(
                    "riskDetails"
                );

                expect(
                    storedSnapshot
                ).toHaveProperty(
                    "riskCounts"
                );

                const history =
                    await ProjectRiskHistory
                        .find({
                            project:
                                project._id
                        })
                        .lean();

                expect(
                    history.length
                ).toBeGreaterThan(0);
            }
        );
    }
);