const bcrypt = require("bcryptjs");

const User = require(
    "../../src/modules/users/user.model"
);

const Project = require(
    "../../src/modules/projects/project.model"
);

const ProjectHealthSnapshot =
    require(
        "../../src/modules/projects/project.health.snapshot.model"
    );

const {
    getHealthTrend
} = require(
    "../../src/modules/projects/health.trend.service"
);

describe(
    "Health Trend Service",
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
                name: "Trend User",
                email: `trend-${Date.now()}-${Math.random()}@example.com`,
                passwordHash
            });

            project = await Project.create({
                name: "Health Trend Project",
                description:
                    "Health trend service test",
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

        test(
            "returns snapshots ordered from oldest to newest",
            async () => {
                await ProjectHealthSnapshot.create({
                    project: project._id,
                    snapshotDate: "2026-09-17",
                    healthScore: 78,
                    healthStatus: "ON_TRACK",
                    riskCounts: {
                        high: 1,
                        medium: 2
                    },
                    taskSummary: {
                        totalTasks: 10,
                        completedTasks: 6,
                        overdueTasks: 1,
                        blockedTasks: 1,
                        stagnantTasks: 1,
                        workloadRisks: 0
                    },
                    milestoneSummary: {
                        totalMilestones: 2,
                        completedMilestones: 1,
                        totalMilestoneTasks: 5,
                        completedMilestoneTasks: 3
                    },
                    capturedAt:
                        new Date(
                            "2026-09-17T12:00:00.000Z"
                        )
                });

                await ProjectHealthSnapshot.create({
                    project: project._id,
                    snapshotDate: "2026-09-19",
                    healthScore: 72,
                    healthStatus: "ON_TRACK",
                    riskCounts: {
                        high: 2,
                        medium: 3
                    },
                    taskSummary: {
                        totalTasks: 10,
                        completedTasks: 7,
                        overdueTasks: 1,
                        blockedTasks: 2,
                        stagnantTasks: 1,
                        workloadRisks: 1
                    },
                    milestoneSummary: {
                        totalMilestones: 2,
                        completedMilestones: 1,
                        totalMilestoneTasks: 5,
                        completedMilestoneTasks: 4
                    },
                    capturedAt:
                        new Date(
                            "2026-09-19T12:00:00.000Z"
                        )
                });

                await ProjectHealthSnapshot.create({
                    project: project._id,
                    snapshotDate: "2026-09-18",
                    healthScore: 75,
                    healthStatus: "ON_TRACK",
                    riskCounts: {
                        high: 1,
                        medium: 3
                    },
                    taskSummary: {
                        totalTasks: 10,
                        completedTasks: 6,
                        overdueTasks: 1,
                        blockedTasks: 1,
                        stagnantTasks: 1,
                        workloadRisks: 0
                    },
                    milestoneSummary: {
                        totalMilestones: 2,
                        completedMilestones: 1,
                        totalMilestoneTasks: 5,
                        completedMilestoneTasks: 3
                    },
                    capturedAt:
                        new Date(
                            "2026-09-18T12:00:00.000Z"
                        )
                });

                const result =
                    await getHealthTrend({
                        projectId:
                            project._id.toString(),
                        userId:
                            user._id.toString()
                    });

                expect(result.projectId).toBe(
                    project._id.toString()
                );

                expect(result.range).toBe(
                    "30d"
                );

                expect(
                    result.snapshots
                ).toHaveLength(3);

                expect(
                    result.snapshots.map(
                        (snapshot) =>
                            snapshot.snapshotDate
                    )
                ).toEqual([
                    "2026-09-17",
                    "2026-09-18",
                    "2026-09-19"
                ]);
            }
        );

        test(
            "respects the requested number of days",
            async () => {
                const dates = [
                    "2026-09-15",
                    "2026-09-16",
                    "2026-09-17",
                    "2026-09-18",
                    "2026-09-19"
                ];

                for (
                    let index = 0;
                    index < dates.length;
                    index++
                ) {
                    await ProjectHealthSnapshot.create({
                        project:
                            project._id,
                        snapshotDate:
                            dates[index],
                        healthScore:
                            80 - index,
                        healthStatus:
                            "ON_TRACK",
                        riskCounts: {
                            high: 0,
                            medium: 1
                        },
                        taskSummary: {
                            totalTasks: 10,
                            completedTasks:
                                index,
                            overdueTasks: 0,
                            blockedTasks: 0,
                            stagnantTasks: 0,
                            workloadRisks: 0
                        },
                        milestoneSummary: {
                            totalMilestones: 1,
                            completedMilestones: 0,
                            totalMilestoneTasks: 5,
                            completedMilestoneTasks:
                                index
                        },
                        capturedAt:
                            new Date(
                                `2026-09-${String(
                                    15 + index
                                ).padStart(
                                    2,
                                    "0"
                                )}T12:00:00.000Z`
                            )
                    });
                }

                const result =
                    await getHealthTrend({
                        projectId:
                            project._id.toString(),
                        userId:
                            user._id.toString(),
                        days: 3
                    });

                expect(result.range).toBe(
                    "3d"
                );

                expect(
                    result.snapshots
                ).toHaveLength(3);

                expect(
                    result.snapshots.map(
                        (snapshot) =>
                            snapshot.snapshotDate
                    )
                ).toEqual([
                    "2026-09-17",
                    "2026-09-18",
                    "2026-09-19"
                ]);
            }
        );

        test(
            "rejects access for a non-member",
            async () => {
                const otherUser =
                    await User.create({
                        name: "Other Trend User",
                        email: `other-trend-${Date.now()}@example.com`,
                        passwordHash:
                            await bcrypt.hash(
                                "password123",
                                10
                            )
                    });

                await expect(
                    getHealthTrend({
                        projectId:
                            project._id.toString(),
                        userId:
                            otherUser._id.toString()
                    })
                ).rejects.toMatchObject({
                    statusCode: 404,
                    code: "PROJECT_NOT_FOUND"
                });
            }
        );

        test(
            "rejects an invalid project id",
            async () => {
                await expect(
                    getHealthTrend({
                        projectId:
                            "invalid-project-id",
                        userId:
                            user._id.toString()
                    })
                ).rejects.toMatchObject({
                    statusCode: 400,
                    code: "INVALID_PROJECT_ID"
                });
            }
        );
    }
);