const request = require("supertest");

const app = require("../../src/app");
const User = require("../../src/modules/users/user.model");
const Project = require("../../src/modules/projects/project.model");
const Milestone = require("../../src/modules/milestones/milestone.model");
const Task = require("../../src/modules/tasks/task.model");

describe("Milestone API", () => {
    let token;
    let userId;
    let projectId;

    beforeEach(async () => {
        await User.deleteMany({});
        await Project.deleteMany({});
        await Milestone.deleteMany({});
        await Task.deleteMany({});

        const registerResponse = await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Milestone Test User",
                email: "milestone-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(registerResponse.status).toBe(201);

        userId = registerResponse.body.data.user.id;

        const loginResponse = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: "milestone-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(loginResponse.status).toBe(200);

        token = loginResponse.body.data.token;

        const projectResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Milestone Test Project",
                startDate: "2026-01-01",
                targetDate: "2026-12-31"
            });

        expect(projectResponse.status).toBe(201);

        projectId = projectResponse.body.data.project._id;
    });

    test("creates milestone for project owner", async () => {
        const response = await request(app)
            .post(`/api/v1/projects/${projectId}/milestones`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "MVP Release",
                description: "Complete the MVP",
                dueDate: "2026-06-30"
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe("MVP Release");
        expect(response.body.data.status).toBe("planned");
    });

    test("lists milestones for a project member", async () => {
        await Milestone.create({
            project: projectId,
            name: "First Milestone",
            dueDate: "2026-03-31"
        });

        await Milestone.create({
            project: projectId,
            name: "Second Milestone",
            dueDate: "2026-06-30"
        });

        const response = await request(app)
            .get(`/api/v1/projects/${projectId}/milestones`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);

        expect(response.body.data[0].name).toBe("First Milestone");
        expect(response.body.data[1].name).toBe("Second Milestone");
    });

    test("filters milestones by status", async () => {
        await Milestone.create({
            project: projectId,
            name: "Planned Milestone",
            dueDate: "2026-04-30",
            status: "planned"
        });

        await Milestone.create({
            project: projectId,
            name: "Completed Milestone",
            dueDate: "2026-05-30",
            status: "completed"
        });

        const response = await request(app)
            .get(`/api/v1/projects/${projectId}/milestones?status=completed`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe("Completed Milestone");
    });

    test("gets a milestone by id", async () => {
        const milestone = await Milestone.create({
            project: projectId,
            name: "Get Test Milestone",
            dueDate: "2026-07-31"
        });

        const response = await request(app)
            .get(`/api/v1/projects/milestones/${milestone._id}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data._id).toBe(milestone._id.toString());
    });

    test("updates milestone for project owner", async () => {
        const milestone = await Milestone.create({
            project: projectId,
            name: "Old Name",
            dueDate: "2026-07-31"
        });

        const response = await request(app)
            .patch(`/api/v1/projects/milestones/${milestone._id}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Updated Name",
                status: "completed"
            });

        expect(response.status).toBe(200);
        expect(response.body.data.name).toBe("Updated Name");
        expect(response.body.data.status).toBe("completed");
    });

    test("rejects milestone due date outside project dates", async () => {
        const response = await request(app)
            .post(`/api/v1/projects/${projectId}/milestones`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Invalid Milestone",
                dueDate: "2027-01-01"
            });

        expect(response.status).toBe(422);
        expect(response.body.error.code).toBe(
            "INVALID_MILESTONE_DUE_DATE"
        );
    });

    test("rejects milestone creation without authentication", async () => {
        const response = await request(app)
            .post(`/api/v1/projects/${projectId}/milestones`)
            .send({
                name: "Unauthorized Milestone",
                dueDate: "2026-05-31"
            });

        expect(response.status).toBe(401);
    });

    test("deletes milestone when no tasks reference it", async () => {
        const milestone = await Milestone.create({
            project: projectId,
            name: "Delete Test Milestone",
            dueDate: "2026-08-31"
        });

        const response = await request(app)
            .delete(`/api/v1/projects/milestones/${milestone._id}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(204);

        const deletedMilestone = await Milestone.findById(milestone._id);

        expect(deletedMilestone).toBeNull();
    });

    test("rejects milestone deletion when tasks reference it", async () => {
        const milestone = await Milestone.create({
            project: projectId,
            name: "Protected Milestone",
            dueDate: "2026-09-30"
        });

        await Task.create({
            project: projectId,
            title: "Milestone Task",
            createdBy: userId,
            milestone: milestone._id
        });

        const response = await request(app)
            .delete(`/api/v1/projects/milestones/${milestone._id}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe(
            "MILESTONE_HAS_TASKS"
        );

        const existingMilestone = await Milestone.findById(
            milestone._id
        );

        expect(existingMilestone).not.toBeNull();
    });
});