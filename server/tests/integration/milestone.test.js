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

    test("lists milestones for a project member with pagination", async () => {
        await Milestone.create([
            {
                project: projectId,
                name: "First Milestone",
                dueDate: "2026-03-31"
            },
            {
                project: projectId,
                name: "Second Milestone",
                dueDate: "2026-06-30"
            },
            {
                project: projectId,
                name: "Third Milestone",
                dueDate: "2026-09-30"
            }
        ]);

        const response = await request(app)
            .get(`/api/v1/projects/${projectId}/milestones?limit=2`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const { milestones, pagination } = response.body.data;

        expect(milestones).toHaveLength(2);
        expect(milestones[0].name).toBe("First Milestone");
        expect(milestones[1].name).toBe("Second Milestone");

        expect(pagination).toEqual({
            page: 1,
            limit: 2,
            total: 3,
            totalPages: 2,
            hasNextPage: true,
            hasPreviousPage: false
        });
    });

    test("paginates to the second page", async () => {
        await Milestone.create([
            {
                project: projectId,
                name: "First Milestone",
                dueDate: "2026-03-31"
            },
            {
                project: projectId,
                name: "Second Milestone",
                dueDate: "2026-06-30"
            },
            {
                project: projectId,
                name: "Third Milestone",
                dueDate: "2026-09-30"
            }
        ]);

        const response = await request(app)
            .get(`/api/v1/projects/${projectId}/milestones?page=2&limit=2`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);

        const { milestones, pagination } = response.body.data;

        expect(milestones).toHaveLength(1);
        expect(milestones[0].name).toBe("Third Milestone");
        expect(pagination.hasNextPage).toBe(false);
        expect(pagination.hasPreviousPage).toBe(true);
    });

    test("filters milestones by status while paginating", async () => {
        await Milestone.create([
            {
                project: projectId,
                name: "Planned One",
                dueDate: "2026-04-30",
                status: "planned"
            },
            {
                project: projectId,
                name: "Completed One",
                dueDate: "2026-05-30",
                status: "completed"
            },
            {
                project: projectId,
                name: "Planned Two",
                dueDate: "2026-06-30",
                status: "planned"
            }
        ]);

        const response = await request(app)
            .get(`/api/v1/projects/${projectId}/milestones?status=planned&limit=1`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);

        const { milestones, pagination } = response.body.data;

        expect(milestones).toHaveLength(1);
        expect(milestones[0].name).toBe("Planned One");
        expect(pagination.total).toBe(2);
        expect(pagination.totalPages).toBe(2);
    });

    test("rejects invalid milestone pagination query", async () => {
        const response = await request(app)
            .get(`/api/v1/projects/${projectId}/milestones?page=0&limit=101`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("VALIDATION_ERROR");
        expect(response.body.error.details.page).toBeDefined();
        expect(response.body.error.details.limit).toBeDefined();
    });

    test("rejects invalid milestone status query", async () => {
        const response = await request(app)
            .get(`/api/v1/projects/${projectId}/milestones?status=invalid`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(422);
        expect(response.body.error.code).toBe("VALIDATION_ERROR");
        expect(response.body.error.details.status).toBeDefined();
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
