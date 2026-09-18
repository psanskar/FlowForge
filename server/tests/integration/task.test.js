const request = require("supertest");

const app = require("../../src/app");
const User = require("../../src/modules/users/user.model");
const Project = require("../../src/modules/projects/project.model");
const Task = require("../../src/modules/tasks/task.model");

describe("Task API", () => {
    let token;
    let userId;
    let projectId;

    beforeEach(async () => {
        await User.deleteMany({});
        await Project.deleteMany({});
        await Task.deleteMany({});

        const registerResponse = await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Task Test User",
                email: "task-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(registerResponse.status).toBe(201);

        userId = registerResponse.body.data.user.id;

        const loginResponse = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: "task-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(loginResponse.status).toBe(200);

        token = loginResponse.body.data.token;

        const projectResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Task Test Project"
            });

        expect(projectResponse.status).toBe(201);

        projectId = projectResponse.body.data.project._id;
    });

    test("creates a task for a project member", async () => {
        const response = await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "Implement authentication",
                description: "Build JWT authentication",
                priority: "high",
                status: "todo"
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);

        const task = response.body.data.task;

        expect(task.title).toBe("Implement authentication");
        expect(task.description).toBe("Build JWT authentication");
        expect(task.status).toBe("todo");
        expect(task.priority).toBe("high");
        expect(task.progress).toBe(0);
        expect(task.version).toBe(1);
        expect(task.project).toBe(projectId);
        expect(task.createdBy).toBe(userId);

        const databaseTask = await Task.findById(task._id);

        expect(databaseTask).not.toBeNull();
        expect(databaseTask.title).toBe("Implement authentication");
    });

    test("creates an in-progress task with normalized progress", async () => {
        const response = await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "Build dashboard",
                status: "in_progress",
                progress: 0
            });

        expect(response.status).toBe(201);

        const task = response.body.data.task;

        expect(task.status).toBe("in_progress");
        expect(task.progress).toBe(1);
        expect(task.startedAt).not.toBeNull();
        expect(task.completedAt).toBeNull();
    });

    test("lists tasks with pagination and filters", async () => {
        await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "High priority task",
                priority: "high"
            });

        await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "Low priority task",
                priority: "low"
            });

        const response = await request(app)
            .get(`/api/v1/projects/${projectId}/tasks`)
            .query({
                priority: "high",
                page: 1,
                limit: 20
            })
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const { tasks, pagination } = response.body.data;

        expect(tasks).toHaveLength(1);
        expect(tasks[0].title).toBe("High priority task");

        expect(pagination.page).toBe(1);
        expect(pagination.limit).toBe(20);
        expect(pagination.total).toBe(1);
        expect(pagination.totalPages).toBe(1);
    });

    test("updates a task and increments its version", async () => {
        const createResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "Task to update"
            });

        const taskId = createResponse.body.data.task._id;

        const updateResponse = await request(app)
            .patch(`/api/v1/tasks/${taskId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                version: 1,
                progress: 50,
                status: "in_progress"
            });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.success).toBe(true);

        const task = updateResponse.body.data.task;

        expect(task.progress).toBe(50);
        expect(task.status).toBe("in_progress");
        expect(task.version).toBe(2);
        expect(task.startedAt).not.toBeNull();
    });

    test("rejects a stale task update with 409 Conflict", async () => {
        const createResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "Concurrent task",
                status: "in_progress",
                progress: 25
            });

        expect(createResponse.status).toBe(201);

        const taskId = createResponse.body.data.task._id;

        expect(createResponse.body.data.task.status).toBe("in_progress");
        expect(createResponse.body.data.task.progress).toBe(25);
        expect(createResponse.body.data.task.version).toBe(1);

        const firstUpdate = await request(app)
            .patch(`/api/v1/tasks/${taskId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                version: 1,
                progress: 50
            });

        expect(firstUpdate.status).toBe(200);
        expect(firstUpdate.body.data.task.progress).toBe(50);
        expect(firstUpdate.body.data.task.version).toBe(2);

        const staleUpdate = await request(app)
            .patch(`/api/v1/tasks/${taskId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                version: 1,
                progress: 90
            });

        expect(staleUpdate.status).toBe(409);
        expect(staleUpdate.body.success).toBe(false);
        expect(staleUpdate.body.error.code).toBe(
            "TASK_VERSION_CONFLICT"
        );

        const databaseTask = await Task.findById(taskId);

        expect(databaseTask.progress).toBe(50);
        expect(databaseTask.version).toBe(2);
    });

    test("normalizes completed task progress to 100", async () => {
        const createResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "Task to complete"
            });

        const taskId = createResponse.body.data.task._id;

        const response = await request(app)
            .patch(`/api/v1/tasks/${taskId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                version: 1,
                status: "completed",
                progress: 60
            });

        expect(response.status).toBe(200);

        const task = response.body.data.task;

        expect(task.status).toBe("completed");
        expect(task.progress).toBe(100);
        expect(task.completedAt).not.toBeNull();
        expect(task.version).toBe(2);
    });

    test("rejects task creation without authentication", async () => {
        const response = await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .send({
                title: "Unauthorized task"
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
    });
    test("paginates tasks consistently", async () => {
        for (const title of ["Task One", "Task Two", "Task Three"]) {
            await request(app)
                .post(`/api/v1/projects/${projectId}/tasks`)
                .set("Authorization", `Bearer ${token}`)
                .send({ title });
        }

        const response = await request(app)
            .get(`/api/v1/projects/${projectId}/tasks`)
            .query({ page: 2, limit: 2 })
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.tasks).toHaveLength(1);
        expect(response.body.data.pagination).toEqual({
            page: 2,
            limit: 2,
            total: 3,
            totalPages: 2,
            hasNextPage: false,
            hasPreviousPage: true
        });
    });

    test("rejects invalid task pagination query", async () => {
        const response = await request(app)
            .get(`/api/v1/projects/${projectId}/tasks`)
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