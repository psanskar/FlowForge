const bcrypt = require("bcryptjs");
const request = require("supertest");

const app = require(
    "../../src/app"
);

const User = require(
    "../../src/modules/users/user.model"
);

const Project = require(
    "../../src/modules/projects/project.model"
);

const Task = require(
    "../../src/modules/tasks/task.model"
);

describe("Dashboard API", () => {
    let user;
    let project;
    let token;

    beforeEach(async () => {
        const email =
            `dashboard-api-${Date.now()}-${Math.random()}@example.com`;

        const passwordHash =
            await bcrypt.hash(
                "password123",
                10
            );

        user = await User.create({
            name: "Dashboard API User",
            email,
            passwordHash
        });

        project = await Project.create({
            name: "Dashboard API Project",
            description: "Dashboard API test",
            owner: user._id,
            members: [
                {
                    user: user._id,
                    role: "owner"
                }
            ],
            status: "active",
            startDate: new Date("2026-09-01"),
            targetDate: new Date("2026-12-01")
        });

        const loginResponse =
            await request(app)
                .post("/api/v1/auth/login")
                .send({
                    email,
                    password: "password123"
                });

        token =
            loginResponse.body.data.token;
    });

    test("requires authentication", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${project._id}/dashboard`
                );

        expect(response.statusCode)
            .toBe(401);

        expect(response.body.success)
            .toBe(false);
    });

    test("requires authentication before validating project ID", async () => {
        const response =
            await request(app)
                .get(
                    "/api/v1/projects/not-an-id/dashboard"
                );

        expect(response.statusCode)
            .toBe(401);

        expect(response.body.success)
            .toBe(false);
    });

    test("returns dashboard for authenticated project member", async () => {
        await Task.create({
            project: project._id,
            title: "Completed task",
            status: "completed",
            progress: 100,
            createdBy: user._id,
            assignee: user._id,
            completedAt: new Date(),
            lastActivityAt: new Date()
        });

        await Task.create({
            project: project._id,
            title: "Active task",
            status: "in_progress",
            progress: 50,
            createdBy: user._id,
            assignee: user._id,
            lastActivityAt: new Date()
        });

        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${project._id}/dashboard`
                )
                .set(
                    "Authorization",
                    `Bearer ${token}`
                );

        expect(response.statusCode)
            .toBe(200);

        expect(response.body.success)
            .toBe(true);

        expect(response.body.data.project.name)
            .toBe("Dashboard API Project");

        expect(response.body.data.health)
            .toBeDefined();

        expect(
            response.body.data.taskSummary.totalTasks
        ).toBe(2);

        expect(
            response.body.data.taskSummary.completedTasks
        ).toBe(1);

        expect(
            response.body.data.milestones
        ).toEqual([]);

        expect(
            response.body.data.topRisks
        ).toBeInstanceOf(Array);

        expect(
            response.body.data.workload
        ).toEqual([
            {
                userId: user._id.toString(),
                name: "Dashboard API User",
                activeTasks: 1
            }
        ]);
    });

    test("returns 404 for a project the user cannot access", async () => {
        const response =
            await request(app)
                .get(
                    `/api/v1/projects/${new Project()._id}/dashboard`
                )
                .set(
                    "Authorization",
                    `Bearer ${token}`
                );

        expect(response.statusCode)
            .toBe(404);

        expect(response.body.success)
            .toBe(false);

        expect(response.body.error.code)
            .toBe("PROJECT_NOT_FOUND");
    });

    test("returns 400 for an invalid project ID", async () => {
        const response =
            await request(app)
                .get(
                    "/api/v1/projects/not-an-id/dashboard"
                )
                .set(
                    "Authorization",
                    `Bearer ${token}`
                );

        expect(response.statusCode)
            .toBe(400);

        expect(response.body.success)
            .toBe(false);

        expect(response.body.error.code)
            .toBe("INVALID_ID");
    });
});