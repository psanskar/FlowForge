const mongoose = require("mongoose");

const Project =
    require("../../src/modules/projects/project.model");

const {
    getSnapshotDate,
    dispatchHealthSnapshots
} =
    require("../../src/queues/healthSnapshot.scheduler");

const {
    enqueueHealthSnapshot
} =
    require("../../src/queues/healthSnapshot.queue");

jest.mock(
    "../../src/queues/healthSnapshot.queue",
    () => ({
        enqueueHealthSnapshot:
            jest.fn()
    })
);

describe("Health Snapshot Scheduler", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("getSnapshotDate", () => {
        it("formats a date as YYYY-MM-DD", () => {
            const date =
                new Date(
                    2026,
                    8,
                    19,
                    10,
                    30,
                    0
                );

            expect(
                getSnapshotDate(date)
            ).toBe("2026-09-19");
        });
    });

    describe("dispatchHealthSnapshots", () => {
        it("queues snapshots for planning and active projects", async () => {
            const planningProject = {
                _id:
                    new mongoose.Types.ObjectId()
            };

            const activeProject = {
                _id:
                    new mongoose.Types.ObjectId()
            };

            jest.spyOn(Project, "find")
                .mockReturnValue({
                    select: jest.fn()
                        .mockReturnValue({
                            lean: jest
                                .fn()
                                .mockResolvedValue([
                                    planningProject,
                                    activeProject
                                ])
                        })
                });

            const now =
                new Date(
                    2026,
                    8,
                    19,
                    10,
                    30,
                    0
                );

            const result =
                await dispatchHealthSnapshots({
                    now
                });

            expect(
                Project.find
            ).toHaveBeenCalledWith({
                status: {
                    $in: [
                        "planning",
                        "active"
                    ]
                }
            });

            expect(
                enqueueHealthSnapshot
            ).toHaveBeenCalledTimes(2);

            expect(
                enqueueHealthSnapshot
            ).toHaveBeenNthCalledWith(
                1,
                {
                    projectId:
                        planningProject._id.toString(),
                    snapshotDate:
                        "2026-09-19",
                    jobId:
                        `health:${planningProject._id.toString()}:2026-09-19`
                }
            );

            expect(
                enqueueHealthSnapshot
            ).toHaveBeenNthCalledWith(
                2,
                {
                    projectId:
                        activeProject._id.toString(),
                    snapshotDate:
                        "2026-09-19",
                    jobId:
                        `health:${activeProject._id.toString()}:2026-09-19`
                }
            );

            expect(result).toEqual({
                snapshotDate:
                    "2026-09-19",
                projectsFound: 2,
                queued: 2
            });
        });

        it("returns zero when there are no eligible projects", async () => {
            jest.spyOn(Project, "find")
                .mockReturnValue({
                    select: jest.fn()
                        .mockReturnValue({
                            lean: jest
                                .fn()
                                .mockResolvedValue([])
                        })
                });

            const result =
                await dispatchHealthSnapshots({
                    now: new Date(
                        2026,
                        8,
                        19
                    )
                });

            expect(
                enqueueHealthSnapshot
            ).not.toHaveBeenCalled();

            expect(result).toEqual({
                snapshotDate:
                    "2026-09-19",
                projectsFound: 0,
                queued: 0
            });
        });
    });

    it("formats snapshot dates using Asia/Kolkata", () => {
        const date =
            new Date(
                "2026-09-18T19:00:00.000Z"
            );

        expect(
            getSnapshotDate(date)
        ).toBe("2026-09-19");
    });
});