const request = require("supertest");

const app = require("../../src/app");

const User = require("../../src/modules/users/user.model");
const Project = require("../../src/modules/projects/project.model");
const ProjectHealthSnapshot =
    require("../../src/modules/projects/project.health.snapshot.model");
const ProjectRiskHistory =
    require("../../src/modules/risks/project.risk.history.model");

describe("Health trend API", () => {
    let ownerToken;
    let memberToken;
    let outsiderToken;

    let projectId;

    beforeEach(async () => {
        await User.deleteMany({});
        await Project.deleteMany({});
        await ProjectHealthSnapshot.deleteMany({});
        await ProjectRiskHistory.deleteMany({});

        const ownerRegisterResponse =
            await request(app)
                .post("/api/v1/auth/register")
                .send({
                    name: "Health Trend Owner",
                    email: "health-owner@flowforge.local",
                    password: "TestPassword123"
                });

        expect(
            ownerRegisterResponse.status
        ).toBe(201);

        ownerToken =
            ownerRegisterResponse.body.data.token;

        const memberRegisterResponse =
            await request(app)
                .post("/api/v1/auth/register")
                .send({
                    name: "Health Trend Member",
                    email: "health-member@flowforge.local",
                    password: "TestPassword123"
                });

        expect(
            memberRegisterResponse.status
        ).toBe(201);

        memberToken =
            memberRegisterResponse.body.data.token;

        const outsiderRegisterResponse =
            await request(app)
                .post("/api/v1/auth/register")
                .send({
                    name: "Health Trend Outsider",
                    email: "health-outsider@flowforge.local",
                    password: "TestPassword123"
                });

        expect(
            outsiderRegisterResponse.status
        ).toBe(201);

        outsiderToken =
            outsiderRegisterResponse.body.data.token;

        const projectResponse =
            await request(app)
                .post("/api/v1/projects")
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                )
                .send({
                    name: "Health Trend Project",
                    description:
                        "Project for health trend API testing",
                    status: "active",
                    startDate: "2026-09-01",
                    targetDate: "2026-12-31"
                });

        expect(
            projectResponse.status
        ).toBe(201);

        projectId =
            projectResponse.body.data.project._id;

        const project =
            await Project.findById(projectId);

        project.members.push({
            user:
                memberRegisterResponse.body.data.user.id,
            role: "member"
        });

        await project.save();

        await ProjectHealthSnapshot.create([
            {
                project: projectId,
                snapshotDate: "2026-09-15",
                healthScore: 72,
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
                    totalMilestoneTasks: 6,
                    completedMilestoneTasks: 4
                },
                capturedAt:
                    new Date(
                        "2026-09-15T12:00:00.000Z"
                    )
            },
            {
                project: projectId,
                snapshotDate: "2026-09-18",
                healthScore: 78,
                healthStatus: "ON_TRACK",
                riskCounts: {
                    high: 1,
                    medium: 1
                },
                taskSummary: {
                    totalTasks: 10,
                    completedTasks: 7,
                    overdueTasks: 1,
                    blockedTasks: 0,
                    stagnantTasks: 1,
                    workloadRisks: 0
                },
                milestoneSummary: {
                    totalMilestones: 2,
                    completedMilestones: 1,
                    totalMilestoneTasks: 6,
                    completedMilestoneTasks: 5
                },
                capturedAt:
                    new Date(
                        "2026-09-16T12:00:00.000Z"
                    )
            },
            {
                project: projectId,
                snapshotDate: "2026-09-19",
                healthScore: 82,
                healthStatus: "ON_TRACK",
                riskCounts: {
                    high: 0,
                    medium: 1
                },
                taskSummary: {
                    totalTasks: 10,
                    completedTasks: 8,
                    overdueTasks: 0,
                    blockedTasks: 0,
                    stagnantTasks: 0,
                    workloadRisks: 0
                },
                milestoneSummary: {
                    totalMilestones: 2,
                    completedMilestones: 1,
                    totalMilestoneTasks: 6,
                    completedMilestoneTasks: 5
                },
                capturedAt:
                    new Date(
                        "2026-09-17T12:00:00.000Z"
                    )
            },
            {
                project: projectId,
                snapshotDate: "2026-09-20",
                healthScore: 86,
                healthStatus: "HEALTHY",
                riskCounts: {
                    high: 0,
                    medium: 0
                },
                taskSummary: {
                    totalTasks: 10,
                    completedTasks: 9,
                    overdueTasks: 0,
                    blockedTasks: 0,
                    stagnantTasks: 0,
                    workloadRisks: 0
                },
                milestoneSummary: {
                    totalMilestones: 2,
                    completedMilestones: 2,
                    totalMilestoneTasks: 6,
                    completedMilestoneTasks: 6
                },
                capturedAt:
                    new Date(
                        "2026-09-20T12:00:00.000Z"
                    )
            }
        ]);
    });

    test("owner can retrieve health trend", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/health/trend`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        expect(
            response.body.data.projectId
        ).toBe(projectId);

        expect(
            response.body.data.range
        ).toBe("30d");

        expect(
            response.body.data.snapshots
        ).toHaveLength(4);
    });

    test("project member can retrieve health trend", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/health/trend`
                )
                .set(
                    "Authorization",
                    `Bearer ${memberToken}`
                );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        expect(
            response.body.data.snapshots
        ).toHaveLength(4);
    });

    test("returns snapshots from oldest to newest", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/health/trend`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(200);

        expect(
            response.body.data.snapshots.map(
                (snapshot) =>
                    snapshot.snapshotDate
            )
        ).toEqual([
            "2026-09-15",
            "2026-09-18",
            "2026-09-19",
            "2026-09-20"
        ]);
    });

    test("accepts a valid days range", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/health/trend?days=7`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(200);

        expect(
            response.body.data.range
        ).toBe("7d");
    });

    test("rejects an unsupported days range", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/health/trend?days=45`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(400);

        expect(
            response.body.error.code
        ).toBe(
            "INVALID_HEALTH_TREND_RANGE"
        );
    });

    test("rejects an invalid project id", async () => {
        const response =
            await request(app)
                .get(
                    "/api/v1/projects/invalid-project-id/health/trend"
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(400);

        expect(
            response.body.error.code
        ).toBe("INVALID_PROJECT_ID");
    });

    test("rejects a non-member", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/health/trend`
                )
                .set(
                    "Authorization",
                    `Bearer ${outsiderToken}`
                );

        expect(response.status).toBe(404);

        expect(
            response.body.error.code
        ).toBe("PROJECT_NOT_FOUND");
    });

    test("requires authentication", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/health/trend`
                );

        expect(response.status).toBe(401);

        expect(
            response.body.error.code
        ).toBe(
            "AUTHENTICATION_REQUIRED"
        );
    });
    test("returns execution trend signals with health trend", async () => {
        await ProjectHealthSnapshot.deleteMany({
            project: projectId
        });

        await ProjectRiskHistory.deleteMany({
            project: projectId
        });

        await ProjectHealthSnapshot.create([
            {
                project: projectId,
                snapshotDate: "2026-10-01",
                healthScore: 88,
                healthStatus: "ON_TRACK",
                riskCounts: {
                    high: 1,
                    medium: 2
                },
                taskSummary: {
                    totalTasks: 20,
                    completedTasks: 10,
                    overdueTasks: 1,
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
                        "2026-10-01T12:00:00.000Z"
                    )
            },
            {
                project: projectId,
                snapshotDate: "2026-10-02",
                healthScore: 76,
                healthStatus: "AT_RISK",
                riskCounts: {
                    high: 2,
                    medium: 3
                },
                taskSummary: {
                    totalTasks: 20,
                    completedTasks: 11,
                    overdueTasks: 4,
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
                        "2026-10-02T12:00:00.000Z"
                    )
            }
        ]);

        await ProjectRiskHistory.create({
            project: projectId,
            identity: "BLOCKED_TASK:task-persistent",
            type: "BLOCKED_TASK",
            status: "ACTIVE",
            currentSeverity: "HIGH",
            previousSeverity: "HIGH",
            firstDetectedAt: new Date("2026-09-28"),
            lastDetectedAt: new Date("2026-10-02"),
            resolvedAt: null,
            detectionCount: 5,
            lastLifecycle: "PERSISTENT",
            evidence: {
                taskId: "task-persistent"
            },
            snapshotKey:
                `${projectId}:2026-10-02`
        });

        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/health/trend?days=30`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(200);

        expect(
            response.body.data.signals
        ).toContainEqual({
            type:
                "HEALTH_DECLINING",
            severity: "MEDIUM",
            evidence: {
                previous: 88,
                current: 76,
                change: -12
            }
        });

        expect(
            response.body.data.signals
        ).toContainEqual({
            type:
                "BLOCKED_WORK_INCREASING",
            severity: "MEDIUM",
            evidence: {
                previous: 1,
                current: 4,
                change: 3
            }
        });

        expect(
            response.body.data.signals
        ).toContainEqual({
            type:
                "BLOCKED_WORK_RATIO_INCREASING",
            severity: "HIGH",
            evidence: {
                previousRatio: 0.1,
                currentRatio: 0.4444444444,
                change: 0.3444444444
            }
        });

        expect(
            response.body.data.signals
        ).toContainEqual({
            type:
                "OVERDUE_WORK_RATIO_INCREASING",
            severity: "HIGH",
            evidence: {
                previousRatio: 0.1,
                currentRatio: 0.4444444444,
                change: 0.3444444444
            }
        });

        expect(
            response.body.data.signals
        ).toContainEqual({
            type:
                "RISK_PERSISTENCE_INCREASING",
            severity: "HIGH",
            evidence: {
                persistentRiskCount: 1,
                highPersistenceRiskCount: 1,
                minimumDetectionCount: 3,
                risks: [
                    expect.objectContaining({
                        identity:
                            "BLOCKED_TASK:task-persistent",
                        type:
                            "BLOCKED_TASK",
                        severity: "HIGH",
                        detectionCount: 5
                    })
                ]
            }
        });
    });
});