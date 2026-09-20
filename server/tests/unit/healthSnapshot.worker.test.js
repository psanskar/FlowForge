const mongoose = require("mongoose");

const Project =
    require("../../src/modules/projects/project.model");

const {
    captureProjectHealthSnapshot
} =
    require("../../src/modules/projects/project.health.snapshot.service");

const {
    healthSnapshotWorker,
    closeHealthSnapshotWorker
} =
    require("../../src/workers/healthSnapshot.worker");

jest.mock(
    "../../src/modules/projects/project.health.snapshot.service",
    () => ({
        captureProjectHealthSnapshot:
            jest.fn()
    })
);

describe("Health Snapshot Worker", () => {
    const processor =
        healthSnapshotWorker.processFn;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await closeHealthSnapshotWorker();
    });

    it("captures a snapshot for an eligible project", async () => {
        const projectId =
            new mongoose.Types.ObjectId();

        const ownerId =
            new mongoose.Types.ObjectId();

        jest.spyOn(Project, "findById")
            .mockReturnValue({
                select: jest
                    .fn()
                    .mockResolvedValue({
                        _id: projectId,
                        owner: ownerId,
                        status: "active"
                    })
            });

        const snapshotId =
            new mongoose.Types.ObjectId();

        captureProjectHealthSnapshot.mockResolvedValue(
            {
                _id: snapshotId
            }
        );

        const result =
            await processor({
                data: {
                    projectId:
                        projectId.toString(),
                    snapshotDate:
                        "2026-09-19"
                }
            });

        expect(
            captureProjectHealthSnapshot
        ).toHaveBeenCalledWith({
            projectId:
                projectId.toString(),
            userId: ownerId
        });

        expect(result).toEqual({
            skipped: false,
            projectId:
                projectId.toString(),
            snapshotId:
                snapshotId.toString(),
            snapshotDate:
                "2026-09-19"
        });
    });

    it("skips completed projects", async () => {
        const projectId =
            new mongoose.Types.ObjectId();

        jest.spyOn(Project, "findById")
            .mockReturnValue({
                select: jest
                    .fn()
                    .mockResolvedValue({
                        _id: projectId,
                        owner:
                            new mongoose.Types.ObjectId(),
                        status: "completed"
                    })
            });

        const result =
            await processor({
                data: {
                    projectId:
                        projectId.toString(),
                    snapshotDate:
                        "2026-09-19"
                }
            });

        expect(result).toEqual({
            skipped: true,
            reason:
                "PROJECT_NOT_ACTIVE",
            projectId:
                projectId.toString()
        });

        expect(
            captureProjectHealthSnapshot
        ).not.toHaveBeenCalled();
    });

    it("fails when the project does not exist", async () => {
        const projectId =
            new mongoose.Types.ObjectId();

        jest.spyOn(Project, "findById")
            .mockReturnValue({
                select: jest
                    .fn()
                    .mockResolvedValue(null)
            });

        await expect(
            processor({
                data: {
                    projectId:
                        projectId.toString(),
                    snapshotDate:
                        "2026-09-19"
                }
            })
        ).rejects.toThrow(
            `Project ${projectId} not found`
        );
    });

    it("fails when the project has no owner", async () => {
        const projectId =
            new mongoose.Types.ObjectId();

        jest.spyOn(Project, "findById")
            .mockReturnValue({
                select: jest
                    .fn()
                    .mockResolvedValue({
                        _id: projectId,
                        owner: null,
                        status: "active"
                    })
            });

        await expect(
            processor({
                data: {
                    projectId:
                        projectId.toString(),
                    snapshotDate:
                        "2026-09-19"
                }
            })
        ).rejects.toThrow(
            `Project ${projectId} has no owner`
        );
    });
});