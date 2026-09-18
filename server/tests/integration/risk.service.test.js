const request = require("supertest");

const app = require("../../src/app");

const User = require("../../src/modules/users/user.model");
const Project = require("../../src/modules/projects/project.model");
const Task = require("../../src/modules/tasks/task.model");
const Dependency = require("../../src/modules/dependencies/dependency.model");
const Milestone = require("../../src/modules/milestones/milestone.model");
const GithubSignal = require("../../src/modules/github/github.signal.model");

const riskService = require("../../src/modules/risks/risk.service");

describe("Risk Service", () => {
    let token;
    let userId;
    let projectId;

    beforeEach(async () => {
        await User.deleteMany({});
        await Project.deleteMany({});
        await Task.deleteMany({});
        await Dependency.deleteMany({});
        await Milestone.deleteMany({});
        await GithubSignal.deleteMany({});

        const registerResponse = await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Risk Test User",
                email: "risk-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(registerResponse.status).toBe(201);

        userId = registerResponse.body.data.user.id;

        const loginResponse = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: "risk-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(loginResponse.status).toBe(200);

        token = loginResponse.body.data.token;

        const projectResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Risk Test Project"
            });

        expect(projectResponse.status).toBe(201);

        projectId = projectResponse.body.data.project._id;
    });

    test("loads project data and detects task risks", async () => {
        const dueDate = new Date(
            "2026-09-10T12:00:00.000Z"
        );

        const lastActivityAt = new Date(
            "2026-09-10T12:00:00.000Z"
        );

        await Task.create({
            project: projectId,
            title: "Overdue task",
            status: "in_progress",
            priority: "high",
            dueDate,
            lastActivityAt,
            createdBy: userId
        });

        const risks = await riskService.getProjectRisks(
            projectId,
            userId,
            new Date("2026-09-17T12:00:00.000Z")
        );

        expect(risks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: "TASK_OVERDUE",
                    severity: "HIGH"
                }),
                expect.objectContaining({
                    type: "TASK_STAGNANT",
                    severity: "MEDIUM"
                })
            ])
        );
    });

    test("loads dependencies and detects a bottleneck", async () => {
        const taskA = await Task.create({
            project: projectId,
            title: "Blocking task",
            status: "in_progress",
            priority: "high",
            createdBy: userId
        });

        const taskB = await Task.create({
            project: projectId,
            title: "Downstream task 1",
            status: "todo",
            createdBy: userId
        });

        const taskC = await Task.create({
            project: projectId,
            title: "Downstream task 2",
            status: "todo",
            createdBy: userId
        });

        const taskD = await Task.create({
            project: projectId,
            title: "Downstream task 3",
            status: "todo",
            createdBy: userId
        });

        await Dependency.create([
            {
                project: projectId,
                fromTask: taskA._id,
                toTask: taskB._id,
                createdBy: userId
            },
            {
                project: projectId,
                fromTask: taskA._id,
                toTask: taskC._id,
                createdBy: userId
            },
            {
                project: projectId,
                fromTask: taskA._id,
                toTask: taskD._id,
                createdBy: userId
            }
        ]);

        const risks = await riskService.getProjectRisks(
            projectId,
            userId,
            new Date("2026-09-17T12:00:00.000Z")
        );

        const bottleneckRisk = risks.find(
            (risk) =>
                risk.type === "DEPENDENCY_BOTTLENECK"
        );

        expect(bottleneckRisk).toBeDefined();
        expect(bottleneckRisk.severity).toBe("HIGH");
        expect(
            bottleneckRisk.taskId.toString()
        ).toBe(taskA._id.toString());
    });

    test("loads milestones and detects milestone risk", async () => {
        const milestone = await Milestone.create({
            project: projectId,
            name: "Release",
            description: "Production release",
            dueDate: new Date(
                "2026-09-20T12:00:00.000Z"
            ),
            status: "planned"
        });

        await Task.create({
            project: projectId,
            title: "Finish release preparation",
            status: "in_progress",
            priority: "high",
            milestone: milestone._id,
            createdBy: userId
        });

        const risks = await riskService.getProjectRisks(
            projectId,
            userId,
            new Date("2026-09-17T12:00:00.000Z")
        );

        const milestoneRisk = risks.find(
            (risk) => risk.type === "MILESTONE_RISK"
        );

        expect(milestoneRisk).toBeDefined();
        expect(milestoneRisk.severity).toBe("HIGH");

        expect(
            milestoneRisk.milestoneId.toString()
        ).toBe(milestone._id.toString());
    });

    test("loads GitHub signals and detects GitHub execution risks", async () => {
        await GithubSignal.create([
            {
                project: projectId,
                repository: "68b0a7e2c9f4a1d3e5f60718",
                type: "PULL_REQUEST_OPENED",
                externalId: "pr:401:opened",
                occurredAt: new Date(
                    "2026-09-08T12:00:00.000Z"
                ),
                actor: {
                    id: 123,
                    login: "developer"
                },
                metadata: {
                    githubId: 401,
                    number: 401,
                    title: "Long running feature"
                }
            }
        ]);

        const risks = await riskService.getProjectRisks(
            projectId,
            userId,
            new Date("2026-09-17T12:00:00.000Z")
        );

        const githubRisk = risks.find(
            (risk) =>
                risk.type === "GITHUB_AGING_PR"
        );

        expect(githubRisk).toBeDefined();

        expect(githubRisk).toMatchObject({
            type: "GITHUB_AGING_PR",
            severity: "MEDIUM",
            githubPrId: "401",
            prNumber: 401,
            title: "Long running feature",
            ageDays: 9
        });
    });

    test("rejects invalid project id", async () => {
        await expect(
            riskService.getProjectRisks(
                "invalid-project-id",
                userId
            )
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "INVALID_PROJECT_ID"
        });
    });

    test("rejects access to a project the user is not a member of", async () => {
        const otherUserResponse = await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Other User",
                email: "other-risk-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(otherUserResponse.status).toBe(201);

        const otherUserId =
            otherUserResponse.body.data.user.id;

        await expect(
            riskService.getProjectRisks(
                projectId,
                otherUserId
            )
        ).rejects.toMatchObject({
            statusCode: 404,
            code: "PROJECT_NOT_FOUND"
        });
    });
});