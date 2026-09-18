const request = require("supertest");

const app = require("../../src/app");

const User = require("../../src/modules/users/user.model");
const Project = require("../../src/modules/projects/project.model");
const Task = require("../../src/modules/tasks/task.model");

describe("Health API", () => {
    let user;
    let project;

    beforeEach(async () => {
        user = await User.create({
            name: "Health API User",
            email: `health-api-${Date.now()}@example.com`,
            passwordHash: "hashed-password"
        });

        project = await Project.create({
            name: "Health API Project",
            description: "Project for health API tests",
            owner: user._id,
            members: [
                {
                    user: user._id,
                    role: "owner"
                }
            ],
            status: "active",
            startDate: new Date("2026-01-01"),
            targetDate: new Date("2026-12-31")
        });
    });

    afterEach(async () => {
        await Task.deleteMany({
            project: project._id
        });

        await Project.deleteOne({
            _id: project._id
        });

        await User.deleteOne({
            _id: user._id
        });
    });

    test("requires authentication", async () => {
        const response = await request(app)
            .get(
                `/api/v1/projects/${project._id}/health`
            );

        expect(response.statusCode).toBe(401);

        expect(response.body.success).toBe(false);
    });

    test("requires authentication before validating project id", async () => {
        const response = await request(app)
            .get(
                "/api/v1/projects/not-a-valid-id/health"
            );

        expect(response.statusCode).toBe(401);

        expect(response.body.success).toBe(false);
    });

    test("returns project health for an authenticated project member", async () => {
        const bcrypt = require("bcryptjs");

        const password = "TestPassword123!";

        user.passwordHash = await bcrypt.hash(
            password,
            12
        );

        await user.save();

        const loginResponse = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: user.email,
                password
            });

        expect(loginResponse.statusCode).toBe(200);

        const token = loginResponse.body.data.token;

        await Task.create({
            project: project._id,
            title: "Completed task",
            status: "completed",
            priority: "medium",
            progress: 100,
            createdBy: user._id
        });

        const response = await request(app)
            .get(
                `/api/v1/projects/${project._id}/health`
            )
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body.success).toBe(true);

        expect(response.body.data).toEqual(
            expect.objectContaining({
                health: "HEALTHY",
                score: 100
            })
        );

        expect(
            response.body.data.summary.totalTasks
        ).toBe(1);

        expect(
            response.body.data.summary.completedTasks
        ).toBe(1);

        expect(
            response.body.data.risks
        ).toEqual([]);
    });
});