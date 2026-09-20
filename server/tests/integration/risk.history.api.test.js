const request = require("supertest");

const app = require("../../src/app");

const User = require("../../src/modules/users/user.model");
const Project = require(
    "../../src/modules/projects/project.model"
);
const ProjectRiskHistory = require(
    "../../src/modules/risks/project.risk.history.model"
);

describe("Risk history API", () => {
    let ownerToken;
    let memberToken;
    let outsiderToken;

    let projectId;

    beforeEach(async () => {
        await User.deleteMany({});
        await Project.deleteMany({});
        await ProjectRiskHistory.deleteMany({});

        const ownerRegisterResponse =
            await request(app)
                .post("/api/v1/auth/register")
                .send({
                    name: "Risk History Owner",
                    email:
                        "risk-history-owner@flowforge.local",
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
                    name: "Risk History Member",
                    email:
                        "risk-history-member@flowforge.local",
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
                    name: "Risk History Outsider",
                    email:
                        "risk-history-outsider@flowforge.local",
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
                    name: "Risk History Project",
                    description:
                        "Project for risk history API testing",
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

        await ProjectRiskHistory.create([
            {
                project: projectId,
                identity:
                    "BLOCKED_TASK:task-001",
                type: "BLOCKED_TASK",
                status: "ACTIVE",
                currentSeverity: "HIGH",
                previousSeverity: "MEDIUM",
                firstDetectedAt:
                    new Date(
                        "2026-09-10T12:00:00.000Z"
                    ),
                lastDetectedAt:
                    new Date(
                        "2026-09-19T12:00:00.000Z"
                    ),
                resolvedAt: null,
                detectionCount: 4,
                lastLifecycle: "ESCALATED",
                evidence: {
                    taskId: "task-001",
                    status: "blocked"
                },
                snapshotKey:
                    `${projectId}:2026-09-19`
            },
            {
                project: projectId,
                identity:
                    "STAGNANT_TASK:task-002",
                type: "STAGNANT_TASK",
                status: "ACTIVE",
                currentSeverity: "MEDIUM",
                previousSeverity: "MEDIUM",
                firstDetectedAt:
                    new Date(
                        "2026-09-12T12:00:00.000Z"
                    ),
                lastDetectedAt:
                    new Date(
                        "2026-09-18T12:00:00.000Z"
                    ),
                resolvedAt: null,
                detectionCount: 2,
                lastLifecycle: "PERSISTENT",
                evidence: {
                    taskId: "task-002",
                    stagnantDays: 6
                },
                snapshotKey:
                    `${projectId}:2026-09-18`
            },
            {
                project: projectId,
                identity:
                    "OVERDUE_TASK:task-003",
                type: "OVERDUE_TASK",
                status: "RESOLVED",
                currentSeverity: "HIGH",
                previousSeverity: "HIGH",
                firstDetectedAt:
                    new Date(
                        "2026-09-05T12:00:00.000Z"
                    ),
                lastDetectedAt:
                    new Date(
                        "2026-09-14T12:00:00.000Z"
                    ),
                resolvedAt:
                    new Date(
                        "2026-09-15T12:00:00.000Z"
                    ),
                detectionCount: 3,
                lastLifecycle: "RESOLVED",
                evidence: {
                    taskId: "task-003",
                    status: "completed"
                },
                snapshotKey:
                    `${projectId}:2026-09-15`
            }
        ]);
    });

    test("owner can retrieve risk history", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/risks/history`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        expect(
            response.body.data.histories
        ).toHaveLength(3);

        expect(
            response.body.data.pagination.total
        ).toBe(3);
    });

    test("project member can retrieve risk history", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/risks/history`
                )
                .set(
                    "Authorization",
                    `Bearer ${memberToken}`
                );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        expect(
            response.body.data.histories
        ).toHaveLength(3);
    });

    test("returns risk history ordered by most recently detected", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/risks/history`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(200);

        expect(
            response.body.data.histories.map(
                (history) =>
                    history.identity
            )
        ).toEqual([
            "BLOCKED_TASK:task-001",
            "STAGNANT_TASK:task-002",
            "OVERDUE_TASK:task-003"
        ]);
    });

    test("filters active risks", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/risks/history?status=ACTIVE`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(200);

        expect(
            response.body.data.histories
        ).toHaveLength(2);

        expect(
            response.body.data.histories.every(
                (history) =>
                    history.status === "ACTIVE"
            )
        ).toBe(true);
    });

    test("filters resolved risks", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/risks/history?status=RESOLVED`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(200);

        expect(
            response.body.data.histories
        ).toHaveLength(1);

        expect(
            response.body.data.histories[0].status
        ).toBe("RESOLVED");
    });

    test("filters risks by severity", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/risks/history?severity=HIGH`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(200);

        expect(
            response.body.data.histories
        ).toHaveLength(2);

        expect(
            response.body.data.histories.every(
                (history) =>
                    history.currentSeverity ===
                    "HIGH"
            )
        ).toBe(true);
    });

    test("supports pagination", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/risks/history?page=2&limit=2`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(200);

        expect(
            response.body.data.histories
        ).toHaveLength(1);

        expect(
            response.body.data.pagination
        ).toEqual({
            page: 2,
            limit: 2,
            total: 3,
            totalPages: 2,
            hasNextPage: false,
            hasPreviousPage: true
        });
    });

    test("rejects an invalid status filter", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/risks/history?status=UNKNOWN`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(400);

        expect(
            response.body.error.code
        ).toBe(
            "INVALID_RISK_HISTORY_STATUS"
        );
    });

    test("rejects an invalid severity filter", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/risks/history?severity=LOW`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(400);

        expect(
            response.body.error.code
        ).toBe(
            "INVALID_RISK_HISTORY_SEVERITY"
        );
    });

    test("rejects an invalid page", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/risks/history?page=0`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(400);

        expect(
            response.body.error.code
        ).toBe("INVALID_PAGE");
    });

    test("rejects a limit greater than 100", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/risks/history?limit=101`
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(400);

        expect(
            response.body.error.code
        ).toBe("INVALID_LIMIT");
    });

    test("rejects an invalid project id", async () => {
        const response =
            await request(app)
                .get(
                    "/api/v1/projects/invalid-project-id/risks/history"
                )
                .set(
                    "Authorization",
                    `Bearer ${ownerToken}`
                );

        expect(response.status).toBe(400);

        expect(
            response.body.error.code
        ).toBe("INVALID_ID");
    });

    test("rejects a non-member", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${projectId}/risks/history`
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
                    `/api/v1/projects/${projectId}/risks/history`
                );

        expect(response.status).toBe(401);

        expect(
            response.body.error.code
        ).toBe(
            "AUTHENTICATION_REQUIRED"
        );
    });
});
