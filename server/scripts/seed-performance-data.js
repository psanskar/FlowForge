const mongoose = require("mongoose");
require("dotenv").config();

const Project = require("../src/modules/projects/project.model");
const User = require("../src/modules/users/user.model");
const Task = require("../src/modules/tasks/task.model");
const Milestone = require("../src/modules/milestones/milestone.model");
const Dependency = require("../src/modules/dependencies/dependency.model");
const GithubRepository = require("../src/modules/github/github.model");
const GithubSignal = require("../src/modules/github/github.signal.model");
const ProjectHealthSnapshot = require("../src/modules/projects/project.health.snapshot.model");
const ProjectRiskHistory = require("../src/modules/risks/project.risk.history.model");

const parseCount = (name, fallback, maximum) => {
    const value = process.env[name];

    if (!value) {
        return fallback;
    }

    const count = Number(value);

    if (!Number.isInteger(count) || count < 1 || count > maximum) {
        throw new Error(`${name} must be an integer between 1 and ${maximum}`);
    }

    return count;
};

const getProjectId = () => {
    const projectId = process.env.DEMO_PROJECT_ID;

    if (!mongoose.isValidObjectId(projectId)) {
        throw new Error(
            "Set DEMO_PROJECT_ID to the ID of a dedicated FlowForge Demo project"
        );
    }

    return projectId;
};

const run = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is required");
    }

    if (!process.argv.includes("--replace-project-data")) {
        throw new Error(
            "Refusing to replace project data. Re-run with --replace-project-data after checking the target project."
        );
    }

    const demoProjectId = getProjectId();
    const milestoneCount = 10;
    const taskCount = parseCount("SEED_TASK_COUNT", 100, 50000);
    const signalCount = parseCount("SEED_SIGNAL_COUNT", 50, 10000);

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    if (!/^flowforge[-_](demo|dev|test)([-_]|$)/i.test(mongoose.connection.name)) {
        throw new Error(
            `Refusing to seed database '${mongoose.connection.name}'. Use a dedicated flowforge_demo database.`
        );
    }

    const project = await Project.findById(demoProjectId);

    if (!project) {
        throw new Error("Demo project not found in the selected database");
    }

    if (!/demo|performance/i.test(project.name)) {
        throw new Error(
            `Refusing to replace data in '${project.name}'. Target a project named with 'Demo' or 'Performance'.`
        );
    }

    const ownerId = project.owner;

    // Use existing users.
    const users = await User.find({
        _id: {
            $in: project.members.map((member) => member.user)
        }
    }).select("_id name");

    if (users.length === 0) {
        throw new Error("No project members found");
    }

    const contributorIds = users.map((user) => user._id);

    console.log(`Using ${contributorIds.length} existing contributors`);

    // ---------------------------------------------------------
    // REPLACE ONLY DATA INSIDE THE EXPLICITLY SELECTED DEMO PROJECT
    // ---------------------------------------------------------

    await GithubSignal.deleteMany({
        project: project._id
    });

    await GithubRepository.deleteMany({
        project: project._id
    });

    await Dependency.deleteMany({
        project: project._id
    });

    await Task.deleteMany({
        project: project._id
    });

    await Milestone.deleteMany({
        project: project._id
    });

    await ProjectHealthSnapshot.deleteMany({
        project: project._id
    });

    await ProjectRiskHistory.deleteMany({
        project: project._id
    });

    console.log("Previous demo dataset removed");

    // ---------------------------------------------------------
    // MILESTONES
    // ---------------------------------------------------------

    const now = new Date();

    const milestoneData = Array.from(
        { length: milestoneCount },
        (_, index) => ({
            project: project._id,
            name: `Performance Test Milestone ${index + 1}`,
            description: "Temporary performance benchmark milestone",
            dueDate: new Date(
                now.getTime() +
                    (index + 1) * 7 * 24 * 60 * 60 * 1000
            ),
            status: "planned"
        })
    );

    const milestones = await Milestone.insertMany(
        milestoneData
    );

    console.log(`Created ${milestones.length} milestones`);

    // ---------------------------------------------------------
    // TASKS
    // ---------------------------------------------------------

    const statuses = [
        "todo",
        "in_progress",
        "blocked",
        "completed"
    ];

    const priorities = [
        "low",
        "medium",
        "high",
        "critical"
    ];

    const taskData = Array.from(
        { length: taskCount },
        (_, index) => {
            const status =
                statuses[index % statuses.length];

            const assignee =
                contributorIds[
                    index % contributorIds.length
                ];

            const milestone =
                milestones[
                    index % milestones.length
                ];

            const lastActivityAt =
                status === "completed"
                    ? new Date(
                          now.getTime() -
                              (index % 3) *
                                  24 *
                                  60 *
                                  60 *
                                  1000
                      )
                    : new Date(
                          now.getTime() -
                              (index % 10) *
                                  24 *
                                  60 *
                                  60 *
                                  1000
                      );

            return {
                project: project._id,
                title: `Performance Test Task ${index + 1}`,
                description:
                    "Temporary task created for dashboard performance testing",
                status,
                priority:
                    priorities[
                        index % priorities.length
                    ],
                assignee,
                milestone: milestone._id,
                dueDate: new Date(
                    now.getTime() +
                        ((index % 30) - 10) *
                            24 *
                            60 *
                            60 *
                            1000
                ),
                progress:
                    status === "completed"
                        ? 100
                        : status === "in_progress"
                        ? 25 + (index % 70)
                        : 0,
                startedAt:
                    status === "todo"
                        ? null
                        : new Date(
                              now.getTime() -
                                  5 *
                                      24 *
                                      60 *
                                      60 *
                                      1000
                          ),
                completedAt:
                    status === "completed"
                        ? new Date(
                              now.getTime() -
                                  (index % 5) *
                                      24 *
                                      60 *
                                      60 *
                                      1000
                          )
                        : null,
                lastActivityAt,
                createdBy: ownerId,
                version: 1
            };
        }
    );

    const tasks = await Task.insertMany(taskData);

    console.log(`Created ${tasks.length} tasks`);

    // ---------------------------------------------------------
    // DEPENDENCIES
    // ---------------------------------------------------------

    const dependencyData = [];

    for (let i = 1; i < Math.min(tasks.length, 101); i++) {
        dependencyData.push({
            project: project._id,
            fromTask: tasks[0]._id,
            toTask: tasks[i]._id,
            createdBy: ownerId
        });
    }

    const dependencies =
        await Dependency.insertMany(
            dependencyData
        );

    console.log(
        `Created ${dependencies.length} dependencies`
    );

    // ---------------------------------------------------------
    // GITHUB REPOSITORY
    // ---------------------------------------------------------

    const repository =
        await GithubRepository.create({
            project: project._id,
            owner: "performance-test",
            repo: "flowforge-performance",
            fullName:
                "performance-test/flowforge-performance",
            githubId: 999999999,
            defaultBranch: "main",
            private: true
        });

    console.log("Created temporary GitHub repository");

    // ---------------------------------------------------------
    // GITHUB SIGNALS
    // ---------------------------------------------------------

    const signalTypes = [
        "COMMIT",
        "PULL_REQUEST_OPENED",
        "PULL_REQUEST_MERGED",
        "PULL_REQUEST_CLOSED",
        "ISSUE_OPENED",
        "ISSUE_CLOSED"
    ];

    const githubSignals = Array.from(
        { length: signalCount },
        (_, index) => ({
            project: project._id,
            repository: repository._id,
            type:
                signalTypes[
                    index % signalTypes.length
                ],
            externalId:
                `performance-test-signal-${index + 1}`,
            occurredAt: new Date(
                now.getTime() -
                    (index % 30) *
                        24 *
                        60 *
                        60 *
                        1000
            ),
            actor: {
                id: index + 1,
                login: `test-user-${(index % 5) + 1}`
            },
            metadata: {
                performanceTest: true
            }
        })
    );

    const signals =
        await GithubSignal.insertMany(
            githubSignals
        );

    console.log(
        `Created ${signals.length} GitHub signals`
    );

    // ---------------------------------------------------------
    // SUMMARY
    // ---------------------------------------------------------

    console.log("\nPerformance dataset ready:");
    console.log({
        project: project.name,
        projectId: project._id.toString(),
        tasks: tasks.length,
        milestones: milestones.length,
        dependencies: dependencies.length,
        contributors: contributorIds.length,
        githubSignals: signals.length
    });

    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error(
        "Performance seed failed:",
        error
    );

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }

    process.exit(1);
});
