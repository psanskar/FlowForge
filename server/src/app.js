const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const authRoutes = require("./modules/auth/auth.routes");
const errorHandler = require("./middleware/error.middleware");
const projectRoutes = require("./modules/projects/project.routes");
const taskRoutes = require("./modules/tasks/task.routes");
const taskDetailRoutes = require("./modules/tasks/task.detail.routes");
const dependencyRoutes = require("./modules/dependencies/dependency.routes");
const milestoneRoutes = require("./modules/milestones/milestone.routes");
const healthRoutes = require("./modules/risks/health.routes");
const dashboardRoutes = require(
    "./modules/projects/dashboard.routes"
);
const githubRoutes = require(
    "./modules/github/github.routes"
);
const githubWebhookRoutes = require(
    "./modules/github/github.webhook.routes"
);

const app = express();

// Security headers
app.use(helmet());

// Allow requests from frontend
app.use(cors());

app.use(
    "/api/v1/github",
    githubWebhookRoutes
);

// Parse JSON request bodies
app.use(express.json());

// Basic health check
app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            status: "ok",
            service: "FlowForge API"
        }
    });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/projects", taskRoutes);
app.use("/api/v1/projects", dependencyRoutes);
app.use("/api/v1/tasks", taskDetailRoutes);
app.use("/api/v1/projects", milestoneRoutes);
app.use("/api/v1/projects", healthRoutes);
app.use(
    "/api/v1/projects",
    dashboardRoutes
);
app.use(
    "/api/v1/projects",
    githubRoutes
);

app.use(errorHandler);

module.exports = app;