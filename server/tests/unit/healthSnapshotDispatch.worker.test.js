const {
    processHealthSnapshotDispatch
} = require(
    "../../src/workers/healthSnapshotDispatch.worker.js"
);

describe(
    "health snapshot dispatch worker",
    () => {
        test(
            "dispatches a job and returns the result",
            async () => {
                const result = {
                    snapshotDate: "2026-09-20",
                    projectsFound: 2,
                    queued: 2
                };

                const mockDispatch =
                    jest.fn().mockResolvedValue(result);

                const response =
                    await processHealthSnapshotDispatch(
                        { id: "dispatch-test-1" },
                        mockDispatch
                    );

                expect(mockDispatch).toHaveBeenCalledTimes(1);
                expect(response).toEqual(result);
            }
        );

        test(
            "propagates dispatch errors",
            async () => {
                const mockDispatch =
                    jest.fn()
                        .mockRejectedValue(
                            new Error(
                                "Dispatch failed"
                            )
                        );

                await expect(
                    processHealthSnapshotDispatch(
                        {
                            id:
                                "dispatch-test-2"
                        },
                        mockDispatch
                    )
                ).rejects.toThrow(
                    "Dispatch failed"
                );
            }
        );
    }
);