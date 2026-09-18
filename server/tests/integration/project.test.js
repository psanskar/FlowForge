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
        expect(project.members[0].role).toBe("owner");

        const databaseProject = await Project.findById(project._id);

        expect(databaseProject).not.toBeNull();
        expect(databaseProject.name).toBe("Integration Test Project");
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

});