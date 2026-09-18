const request = require("supertest");

const app = require("../../src/app");
const User = require("../../src/modules/users/user.model");
const Project = require("../../src/modules/projects/project.model");
const Task = require("../../src/modules/tasks/task.model");
const Dependency = require("../../src/modules/dependencies/dependency.model");

describe("Dependency API", () => {
    let token;
    let projectId;
    let firstTaskId;
    let secondTaskId;

    beforeEach(async () => {
        await User.deleteMany({});
        await Project.deleteMany({});
        await Task.deleteMany({});
        await Dependency.deleteMany({});

        const registerResponse = await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Dependency Test User",
                email: "dependency-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(registerResponse.status).toBe(201);

        const loginResponse = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: "dependency-test@flowforge.local",
                password: "TestPassword123"
            });

        expect(loginResponse.status).toBe(200);

        token = loginResponse.body.data.token;

        const projectResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Dependency Test Project"
            });

        expect(projectResponse.status).toBe(201);

        projectId = projectResponse.body.data.project._id;

        const firstTaskResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "Design database"
            });

        expect(firstTaskResponse.status).toBe(201);

        firstTaskId =
            firstTaskResponse.body.data.task._id;

        const secondTaskResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "Implement API"
            });

        expect(secondTaskResponse.status).toBe(201);

        secondTaskId =
            secondTaskResponse.body.data.task._id;
    });

    test("creates a dependency between two project tasks", async () => {
        const response = await request(app)
            .post(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromTask: firstTaskId,
                toTask: secondTaskId
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);

        const dependency =
            response.body.data.dependency;

        expect(dependency.project).toBe(projectId);
        expect(dependency.fromTask).toBe(firstTaskId);
        expect(dependency.toTask).toBe(secondTaskId);

        const databaseDependency =
            await Dependency.findById(dependency._id);

        expect(databaseDependency).not.toBeNull();
        expect(
            databaseDependency.fromTask.toString()
        ).toBe(firstTaskId);
        expect(
            databaseDependency.toTask.toString()
        ).toBe(secondTaskId);
    });

    test("rejects a self dependency", async () => {
        const response = await request(app)
            .post(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromTask: firstTaskId,
                toTask: firstTaskId
            });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(
            "SELF_DEPENDENCY"
        );
    });

    test("rejects a duplicate dependency with 409 Conflict", async () => {
        const dependencyData = {
            fromTask: firstTaskId,
            toTask: secondTaskId
        };

        const firstResponse = await request(app)
            .post(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .set("Authorization", `Bearer ${token}`)
            .send(dependencyData);

        expect(firstResponse.status).toBe(201);

        const duplicateResponse = await request(app)
            .post(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .set("Authorization", `Bearer ${token}`)
            .send(dependencyData);

        expect(duplicateResponse.status).toBe(409);
        expect(duplicateResponse.body.success).toBe(false);
        expect(duplicateResponse.body.error.code).toBe(
            "DEPENDENCY_ALREADY_EXISTS"
        );

        const dependencyCount =
            await Dependency.countDocuments({
                project: projectId
            });

        expect(dependencyCount).toBe(1);
    });

    test("lists project dependencies", async () => {
        await request(app)
            .post(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromTask: firstTaskId,
                toTask: secondTaskId
            });

        const response = await request(app)
            .get(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const dependencies =
            response.body.data.dependencies;

        expect(dependencies).toHaveLength(1);

        expect(dependencies[0].fromTask._id).toBe(
            firstTaskId
        );

        expect(dependencies[0].fromTask.title).toBe(
            "Design database"
        );

        expect(dependencies[0].toTask._id).toBe(
            secondTaskId
        );

        expect(dependencies[0].toTask.title).toBe(
            "Implement API"
        );
    });

    test("deletes a dependency", async () => {
        const createResponse = await request(app)
            .post(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromTask: firstTaskId,
                toTask: secondTaskId
            });

        expect(createResponse.status).toBe(201);

        const dependencyId =
            createResponse.body.data.dependency._id;

        const deleteResponse = await request(app)
            .delete(
                `/api/v1/projects/${projectId}/dependencies/${dependencyId}`
            )
            .set("Authorization", `Bearer ${token}`);

        expect(deleteResponse.status).toBe(204);

        const databaseDependency =
            await Dependency.findById(dependencyId);

        expect(databaseDependency).toBeNull();
    });

    test("rejects task deletion when the task has dependencies", async () => {
        // Create a dependency between the two existing tasks.
        const dependencyResponse = await request(app)
            .post(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromTask: firstTaskId,
                toTask: secondTaskId
            });

        expect(dependencyResponse.status).toBe(201);

        // Attempt to delete a task participating in the dependency.
        const deleteResponse = await request(app)
            .delete(`/api/v1/tasks/${firstTaskId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(deleteResponse.status).toBe(409);
        expect(deleteResponse.body.success).toBe(false);
        expect(deleteResponse.body.error.code).toBe(
            "TASK_HAS_DEPENDENCIES"
        );

        // Verify that the task still exists.
        const task = await Task.findById(firstTaskId);

        expect(task).not.toBeNull();

        // Verify that the dependency still exists.
        const dependencyId =
            dependencyResponse.body.data.dependency._id;

        const dependency =
            await Dependency.findById(dependencyId);

        expect(dependency).not.toBeNull();
    });

    test("rejects dependency creation that would create a cycle", async () => {
        // Create a third task.
        const thirdTaskResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/tasks`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "Write tests"
            });

        expect(thirdTaskResponse.status).toBe(201);

        const thirdTaskId =
            thirdTaskResponse.body.data.task._id;

        // Create A → B.
        const firstDependencyResponse = await request(app)
            .post(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromTask: firstTaskId,
                toTask: secondTaskId
            });

        expect(firstDependencyResponse.status).toBe(201);

        // Create B → C.
        const secondDependencyResponse = await request(app)
            .post(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromTask: secondTaskId,
                toTask: thirdTaskId
            });

        expect(secondDependencyResponse.status).toBe(201);

        // Attempt to create C → A.
        // This would create:
        //
        // A → B → C
        // ↑       ↓
        // └───────┘
        //
        const cycleResponse = await request(app)
            .post(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromTask: thirdTaskId,
                toTask: firstTaskId
            });

        expect(cycleResponse.status).toBe(409);
        expect(cycleResponse.body.success).toBe(false);
        expect(cycleResponse.body.error.code).toBe(
            "DEPENDENCY_CYCLE"
        );

        // Verify that the cyclic dependency was not created.
        const dependencyCount =
            await Dependency.countDocuments({
                project: projectId
            });

        expect(dependencyCount).toBe(2);
    });

    test("rejects dependency creation when a task belongs to another project", async () => {
        const otherProjectResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Other Project"
            });

        expect(otherProjectResponse.status).toBe(201);

        const otherProjectId =
            otherProjectResponse.body.data.project._id;

        const otherTaskResponse = await request(app)
            .post(
                `/api/v1/projects/${otherProjectId}/tasks`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "Other project task"
            });

        expect(otherTaskResponse.status).toBe(201);

        const otherTaskId =
            otherTaskResponse.body.data.task._id;

        const response = await request(app)
            .post(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromTask: firstTaskId,
                toTask: otherTaskId
            });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(
            "INVALID_DEPENDENCY_TASKS"
        );
    });

    test("rejects dependency deletion by a user from another project", async () => {
        // Create a second user.
        const secondUserResponse = await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Other User",
                email: "other-user@flowforge.local",
                password: "TestPassword123"
            });

        expect(secondUserResponse.status).toBe(201);

        // Log in as the second user.
        const secondLoginResponse = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: "other-user@flowforge.local",
                password: "TestPassword123"
            });

        expect(secondLoginResponse.status).toBe(200);

        const secondToken =
            secondLoginResponse.body.data.token;

        // Create a separate project owned by the second user.
        const secondProjectResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${secondToken}`)
            .send({
                name: "Other User Project"
            });

        expect(secondProjectResponse.status).toBe(201);

        const secondProjectId =
            secondProjectResponse.body.data.project._id;

        // Create a dependency in the original user's project.
        const dependencyResponse = await request(app)
            .post(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromTask: firstTaskId,
                toTask: secondTaskId
            });

        expect(dependencyResponse.status).toBe(201);

        const dependencyId =
            dependencyResponse.body.data.dependency._id;

        // Second user attempts to delete the dependency.
        const deleteResponse = await request(app)
            .delete(
                `/api/v1/projects/${projectId}/dependencies/${dependencyId}`
            )
            .set("Authorization", `Bearer ${secondToken}`);

        expect(deleteResponse.status).toBe(404);
        expect(deleteResponse.body.success).toBe(false);
        expect(deleteResponse.body.error.code).toBe(
            "DEPENDENCY_NOT_FOUND"
        );

        // Verify that the dependency still exists.
        const dependency =
            await Dependency.findById(dependencyId);

        expect(dependency).not.toBeNull();

        // Keep the second project referenced so the setup is explicit.
        expect(secondProjectId).toBeDefined();
    });

    test("rejects dependency creation without authentication", async () => {
        const response = await request(app)
            .post(
                `/api/v1/projects/${projectId}/dependencies`
            )
            .send({
                fromTask: firstTaskId,
                toTask: secondTaskId
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
    });
});