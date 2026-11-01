require("dotenv").config();

const { performance } = require("perf_hooks");
const mongoose = require("mongoose");
const Project = require("../src/modules/projects/project.model");
const Task = require("../src/modules/tasks/task.model");
const Dependency = require("../src/modules/dependencies/dependency.model");
const GithubSignal = require("../src/modules/github/github.signal.model");
const { loadProjectRiskData } = require("../src/modules/risks/risk.service");
const { analyzeProject } = require("../src/modules/risks/risk.engine");

const isSafeDemoDatabase = (name) =>
    /^flowforge[-_](demo|dev|test)([-_]|$)/i.test(name);

const summarizeExplain = (explain) => ({
    executionTimeMillis: explain.executionStats.executionTimeMillis,
    nReturned: explain.executionStats.nReturned,
    totalDocsExamined: explain.executionStats.totalDocsExamined,
    totalKeysExamined: explain.executionStats.totalKeysExamined,
    winningPlan: explain.queryPlanner.winningPlan
});

const run = async () => {
    if (!process.env.MONGO_URI || !mongoose.isValidObjectId(process.env.DEMO_PROJECT_ID)) {
        throw new Error("Set MONGO_URI and a valid DEMO_PROJECT_ID");
    }

    await mongoose.connect(process.env.MONGO_URI);

    if (!isSafeDemoDatabase(mongoose.connection.name)) {
        throw new Error(
            `Refusing to profile '${mongoose.connection.name}'. Use a flowforge_demo database.`
        );
    }

    const project = await Project.findById(process.env.DEMO_PROJECT_ID).lean();

    if (!project || !/demo|performance/i.test(project.name)) {
        throw new Error("The selected demo/performance project was not found");
    }

    const loadStart = performance.now();
    const data = await loadProjectRiskData(
        process.env.DEMO_PROJECT_ID,
        project.owner
    );
    const loadedAt = performance.now();
    const risks = analyzeProject({ ...data, now: new Date() });
    const analyzedAt = performance.now();

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [taskPlan, dependencyPlan, signalPlan] = await Promise.all([
        Task.find({ project: project._id })
            .sort({ dueDate: 1, createdAt: -1, _id: 1 })
            .limit(20)
            .explain("executionStats"),
        Dependency.find({ project: project._id })
            .select("fromTask toTask")
            .explain("executionStats"),
        GithubSignal.find({ project: project._id, occurredAt: { $gte: since } })
            .sort({ occurredAt: -1 })
            .limit(200)
            .explain("executionStats")
    ]);

    console.log(JSON.stringify({
        project: project.name,
        projectId: project._id.toString(),
        counts: {
            tasks: data.tasks.length,
            dependencies: data.dependencies.length,
            milestones: data.milestones.length,
            githubSignals: data.githubSignals.length,
            generatedRisks: risks.length
        },
        timingsMs: {
            loadRiskData: Number((loadedAt - loadStart).toFixed(2)),
            deterministicRiskAnalysis: Number((analyzedAt - loadedAt).toFixed(2))
        },
        queryPlans: {
            paginatedTaskList: summarizeExplain(taskPlan),
            projectDependencies: summarizeExplain(dependencyPlan),
            recentGithubSignals: summarizeExplain(signalPlan)
        }
    }, null, 2));
};

run()
    .catch((error) => {
        console.error("Performance profile failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });
