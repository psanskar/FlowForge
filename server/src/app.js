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
const dashboardRoutes = require("./modules/projects/dashboard.routes");

const githubRoutes = require("./modules/github/github.routes");
const githubWebhookRoutes = require("./modules/github/github.webhook.routes");

const healthTrendRoutes =
    require("./modules/projects/health.trend.routes");

const riskHistoryRoutes =
    require("./modules/risks/risk.history.routes");

const githubMetricsRoutes =
    require("./modules/github/github.metrics.routes");

const app = express();

// Security headers
app.use(helmet());

// Allow requests from the configured frontend origin.
// If FRONTEND_URL is not configured, allow all origins for local development.
const corsOrigin = process.env.FRONTEND_URL || "*";

app.use(
    cors({
        origin: corsOrigin
    })
);

// GitHub webhook routes must be registered before express.json()
// because webhook signature verification requires the raw request body.
app.use(
    "/api/v1/github",
    githubWebhookRoutes
);

// Parse JSON request bodies with an explicit size limit.
app.use(
    express.json({
        limit: "1mb"
    })
);

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

app.use(
    "/api/v1/projects",
    healthTrendRoutes
);

app.use(
    "/api/v1/projects",
    riskHistoryRoutes
);

app.use(
    "/api/v1/projects",
    githubMetricsRoutes
);

app.use(errorHandler);

module.exports = app;