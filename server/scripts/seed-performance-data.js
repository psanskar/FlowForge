const mongoose = require("mongoose");
require("dotenv").config();

const Project = require("../src/modules/projects/project.model");
const User = require("../src/modules/users/user.model");
const Task = require("../src/modules/tasks/task.model");
const Milestone = require("../src/modules/milestones/milestone.model");
const Dependency = require("../src/modules/dependencies/dependency.model");
const GithubRepository = require("../src/modules/github/github.model");
const GithubSignal = require("../src/modules/github/github.signal.model");

const PROJECT_ID = "6aaa680e8d75cff772ac9316";

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    const project = await Project.findById(PROJECT_ID);

    if (!project) {
        throw new Error("FlowForge Development project not found");
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
    // CLEAN PREVIOUS PERFORMANCE DATA
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

    console.log("Previous performance data cleared");

    // ---------------------------------------------------------
    // MILESTONES
    // ---------------------------------------------------------

    const now = new Date();

    const milestoneData = Array.from(
        { length: 10 },
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
        { length: 100 },
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

    for (let i = 0; i < 20; i++) {
        dependencyData.push({
            project: project._id,
            fromTask: tasks[i]._id,
            toTask: tasks[i + 1]._id,
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
        { length: 50 },
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

    await mongoose.disconnect();

    process.exit(1);
});