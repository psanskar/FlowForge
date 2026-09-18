const mongoose = require("mongoose");

const Project = require("../../src/modules/projects/project.model");
const User = require("../../src/modules/users/user.model");
const Task = require("../../src/modules/tasks/task.model");

const {
    getProjectHealth
} = require("../../src/modules/risks/health.service");

describe("Health Service", () => {
    let user;
    let project;

    beforeEach(async () => {
        user = await User.create({
            name: "Health Test User",
            email: `health-${Date.now()}@example.com`,
            passwordHash: "hashed-password"
        });

        project = await Project.create({
            name: "Health Test Project",
            description: "Project for health service tests",
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

    test("returns healthy project when there are no risks", async () => {
        await Task.create({
            project: project._id,
            title: "Normal task",
            status: "todo",
            priority: "medium",
            createdBy: user._id
        });

        const result = await getProjectHealth(
            project._id.toString(),
            user._id.toString(),
            new Date("2026-06-01")
        );

        expect(result.health).toBe("HEALTHY");
        expect(result.score).toBe(100);
        expect(result.summary.totalTasks).toBe(1);
        expect(result.summary.completedTasks).toBe(0);
        expect(result.risks).toEqual([]);
    });

    test("detects overdue task and reduces project health", async () => {
        await Task.create({
            project: project._id,
            title: "Overdue task",
            status: "in_progress",
            priority: "high",
            dueDate: new Date("2026-05-20"),
            progress: 50,
            createdBy: user._id
        });

        const result = await getProjectHealth(
            project._id.toString(),
            user._id.toString(),
            new Date("2026-06-01")
        );

        expect(result.health).toBe("ON_TRACK");
        expect(result.score).toBe(85);

        expect(result.summary.overdueTasks).toBe(1);

        expect(result.risks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: "TASK_OVERDUE",
                    severity: "HIGH"
                })
            ])
        );
    });

    test("rejects invalid project id", async () => {
        await expect(
            getProjectHealth(
                "invalid-id",
                user._id.toString()
            )
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "INVALID_PROJECT_ID"
        });
    });

    test("rejects non-member access", async () => {
        const anotherUser = await User.create({
            name: "Another User",
            email: `another-${Date.now()}@example.com`,
            passwordHash: "hashed-password"
        });

        await expect(
            getProjectHealth(
                project._id.toString(),
                anotherUser._id.toString()
            )
        ).rejects.toMatchObject({
            statusCode: 404,
            code: "PROJECT_NOT_FOUND"
        });

        await User.deleteOne({
            _id: anotherUser._id
        });
    });
});