const request = require("supertest");

const app = require("../../src/app");
const User = require("../../src/modules/users/user.model");
const Project = require("../../src/modules/projects/project.model");

describe("Project API", () => {
    let token;
    let userId;

    beforeEach(async () => {
        await User.deleteMany({});
        await Project.deleteMany({});

        const registerResponse = await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Project Test User",
                email: "project-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(registerResponse.status).toBe(201);

        userId = registerResponse.body.data.user.id;

        const loginResponse = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: "project-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(loginResponse.status).toBe(200);

        token = loginResponse.body.data.token;
    });

    test("creates a project for the authenticated user", async () => {
        const response = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Integration Test Project",
                description: "Created through the API",
                startDate: "2026-09-16",
                targetDate: "2026-12-31"
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);

        const project = response.body.data.project;

        expect(project.name).toBe("Integration Test Project");
        expect(project.description).toBe("Created through the API");
        expect(project.status).toBe("planning");
        expect(project.owner).toBe(userId);

        expect(project.members).toHaveLength(1);
        expect(project.members[0].user).toBe(userId);
        expect(project.members[0]).not.toHaveProperty("role");

        const databaseProject = await Project.findById(project._id);

        expect(databaseProject).not.toBeNull();
        expect(databaseProject.name).toBe("Integration Test Project");

        const detailResponse = await request(app)
            .get(`/api/v1/projects/${project._id}`)
            .set("Authorization", `Bearer ${token}`);

        expect(detailResponse.status).toBe(200);
        expect(detailResponse.body.data.project.members[0].user)
            .toMatchObject({
                _id: userId,
                name: "Project Test User"
            });
    });

    test("rejects project creation without authentication", async () => {
        const response = await request(app)
            .post("/api/v1/projects")
            .send({
                name: "Unauthorized Project"
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
    });

    test("rejects invalid project dates", async () => {
        const response = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Invalid Date Project",
                startDate: "2026-12-31",
                targetDate: "2026-09-16"
            });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("lists projects belonging to the authenticated user", async () => {
        await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Project One"
            });

        await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Project Two"
            });

        const response = await request(app)
            .get("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const { projects, pagination } = response.body.data;

        expect(projects).toHaveLength(2);
        expect(pagination.total).toBe(2);
        expect(pagination.page).toBe(1);
        expect(pagination.limit).toBe(20);
        expect(pagination.totalPages).toBe(1);
        expect(pagination.hasNextPage).toBe(false);
        expect(pagination.hasPreviousPage).toBe(false);
    });

    test("does not expose a project to a user who is not a member", async () => {
        const projectResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Private Project" });

        expect(projectResponse.status).toBe(201);

        const outsiderResponse = await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Outside User",
                email: "outside-project-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(outsiderResponse.status).toBe(201);
        const outsiderToken = outsiderResponse.body.data.token;

        const getResponse = await request(app)
            .get(`/api/v1/projects/${projectResponse.body.data.project._id}`)
            .set("Authorization", `Bearer ${outsiderToken}`);

        expect(getResponse.status).toBe(404);
        expect(getResponse.body.error.code).toBe("PROJECT_NOT_FOUND");

        const listResponse = await request(app)
            .get("/api/v1/projects")
            .set("Authorization", `Bearer ${outsiderToken}`);

        expect(listResponse.status).toBe(200);
        expect(listResponse.body.data.projects).toHaveLength(0);
    });

    test("paginates projects consistently", async () => {
        for (const name of ["Project One", "Project Two", "Project Three"]) {
            await request(app)
                .post("/api/v1/projects")
                .set("Authorization", `Bearer ${token}`)
                .send({ name });
        }

        const response = await request(app)
            .get("/api/v1/projects")
            .query({ page: 2, limit: 2 })
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.projects).toHaveLength(1);
        expect(response.body.data.pagination).toEqual({
            page: 2,
            limit: 2,
            total: 3,
            totalPages: 2,
            hasNextPage: false,
            hasPreviousPage: true
        });
    });

    test("rejects invalid project pagination query", async () => {
        const response = await request(app)
            .get("/api/v1/projects")
            .query({ page: 0, limit: 101 })
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(422);
        expect(response.body.error.code).toBe("VALIDATION_ERROR");
        expect(response.body.error.details).toEqual({
            page: "Page must be an integer greater than or equal to 1",
            limit: "Limit must be an integer between 1 and 100"
        });
    });

    test("archives a project for its owner and restores its previous status", async () => {
        const createResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Archive lifecycle project" });

        const projectId = createResponse.body.data.project._id;
        await Project.updateOne({ _id: projectId }, { $set: { status: "active" } });

        const archiveResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/archive`)
            .set("Authorization", `Bearer ${token}`);

        expect(archiveResponse.status).toBe(200);
        expect(archiveResponse.body.data.project.status).toBe("archived");

        const archivedInDatabase = await Project.findById(projectId);
        expect(archivedInDatabase.status).toBe("archived");

        const restoreResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/restore`)
            .set("Authorization", `Bearer ${token}`);

        expect(restoreResponse.status).toBe(200);
        expect(restoreResponse.body.data.project.status).toBe("active");

        const restoredInDatabase = await Project.findById(projectId);
        expect(restoredInDatabase.status).toBe("active");
        expect(restoredInDatabase.statusBeforeArchive ?? null).toBeNull();
    });

    test("archived projects stay readable, retain tasks, and reject task writes", async () => {
        const createResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Read-only archived project" });

        const projectId = createResponse.body.data.project._id;
        const taskResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Task retained after archive" });

        expect(taskResponse.status).toBe(201);

        const archiveResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/archive`)
            .set("Authorization", `Bearer ${token}`);
        expect(archiveResponse.status).toBe(200);

        const detailResponse = await request(app)
            .get(`/api/v1/projects/${projectId}`)
            .set("Authorization", `Bearer ${token}`);
        expect(detailResponse.status).toBe(200);
        expect(detailResponse.body.data.project.status).toBe("archived");

        const listResponse = await request(app)
            .get(`/api/v1/projects/${projectId}/tasks`)
            .set("Authorization", `Bearer ${token}`);
        expect(listResponse.status).toBe(200);
        expect(listResponse.body.data.tasks).toHaveLength(1);

        const writeResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Should be rejected" });
        expect(writeResponse.status).toBe(409);
        expect(writeResponse.body.error.code).toBe("PROJECT_ARCHIVED");
    });

    test("only the owner can archive or restore a project", async () => {
        const createResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Owner-only archive project" });

        const outsiderResponse = await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Archive Outsider",
                email: "archive-outsider@flowforge.local",
                password: "TestPassword123"
            });
        const outsiderToken = outsiderResponse.body.data.token;
        const projectId = createResponse.body.data.project._id;

        const archiveResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/archive`)
            .set("Authorization", `Bearer ${outsiderToken}`);
        expect(archiveResponse.status).toBe(404);

        const restoreResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/restore`)
            .set("Authorization", `Bearer ${outsiderToken}`);
        expect(restoreResponse.status).toBe(404);

        const projectInDatabase = await Project.findById(projectId);
        expect(projectInDatabase.status).toBe("planning");
    });

});
