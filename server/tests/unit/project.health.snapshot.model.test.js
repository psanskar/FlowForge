const mongoose = require("mongoose");

const ProjectHealthSnapshot =
    require("../../src/modules/projects/project.health.snapshot.model");

describe("ProjectHealthSnapshot model", () => {
    it("creates a valid project health snapshot", () => {
        const snapshot =
            new ProjectHealthSnapshot({
                project:
                    new mongoose.Types.ObjectId(),

                snapshotDate: "2026-09-19",

                healthScore: 82,

                healthStatus: "ON_TRACK",

                riskCounts: {
                    high: 1,
                    medium: 2
                },

                taskSummary: {
                    totalTasks: 10,
                    completedTasks: 4,
                    overdueTasks: 1,
                    blockedTasks: 1,
                    stagnantTasks: 2,
                    workloadRisks: 1
                },

                milestoneSummary: {
                    totalMilestones: 2,
                    completedMilestones: 1,
                    totalMilestoneTasks: 6,
                    completedMilestoneTasks: 3
                },

                capturedAt:
                    new Date("2026-09-19T10:00:00.000Z")
            });

        const error =
            snapshot.validateSync();

        expect(error).toBeUndefined();

        expect(
            snapshot.project.toString()
        ).toBeTruthy();

        expect(snapshot.snapshotDate).toBe(
            "2026-09-19"
        );

        expect(snapshot.healthScore).toBe(82);

        expect(snapshot.healthStatus).toBe(
            "ON_TRACK"
        );
    });

    it("rejects an invalid health score", () => {
        const snapshot =
            new ProjectHealthSnapshot({
                project:
                    new mongoose.Types.ObjectId(),

                snapshotDate: "2026-09-19",

                healthScore: 101,

                healthStatus: "ON_TRACK"
            });

        const error =
            snapshot.validateSync();

        expect(error).toBeDefined();

        expect(
            error.errors.healthScore
        ).toBeDefined();
    });

    it("rejects an invalid health status", () => {
        const snapshot =
            new ProjectHealthSnapshot({
                project:
                    new mongoose.Types.ObjectId(),

                snapshotDate: "2026-09-19",

                healthScore: 80,

                healthStatus: "INVALID_STATUS"
            });

        const error =
            snapshot.validateSync();

        expect(error).toBeDefined();

        expect(
            error.errors.healthStatus
        ).toBeDefined();
    });

    it("requires a project reference", () => {
        const snapshot =
            new ProjectHealthSnapshot({
                snapshotDate: "2026-09-19",

                healthScore: 80,

                healthStatus: "ON_TRACK"
            });

        const error =
            snapshot.validateSync();

        expect(error).toBeDefined();

        expect(
            error.errors.project
        ).toBeDefined();
    });
});