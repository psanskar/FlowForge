const {
    Queue
} = require("bullmq");

const connection = {
    url:
        process.env.REDIS_URL ||
        "redis://127.0.0.1:6379"
};

const createTestQueue = () => {
    let processor = null;
    let closed = false;
    let worker = null;

    const processJob = async (job) => {
        if (!processor || closed) {
            return;
        }

        for (
            let attempt = 0;
            attempt < job.opts.attempts;
            attempt++
        ) {
            job.attemptsMade = attempt;

            try {
                const result =
                    await processor(job);

                if (worker) {
                    worker.emit(
                        "completed",
                        job,
                        result
                    );
                }

                return result;
            } catch (error) {
                if (
                    attempt + 1 >=
                    job.opts.attempts
                ) {
                    if (worker) {
                        worker.emit(
                            "failed",
                            job,
                            error
                        );
                    }

                    return;
                }
            }
        }
    };

    return {
        add: async (
            name,
            data,
            options = {}
        ) => {
            const job = {
                id:
                    options.jobId ||
                    null,

                name,

                data,

                opts: {
                    attempts:
                        options.attempts ||
                        3
                },

                attemptsMade: 0
            };

            setImmediate(() => {
                processJob(job).catch(
                    (error) => {
                        if (worker) {
                            worker.emit(
                                "failed",
                                job,
                                error
                            );
                        }
                    }
                );
            });

            return job;
        },

        setProcessor: (
            processorFunction,
            workerInstance
        ) => {
            processor =
                processorFunction;

            worker =
                workerInstance;
        },

        close: async () => {
            closed = true;
            processor = null;
            worker = null;
        }
    };
};

const healthSnapshotQueue =
    process.env.NODE_ENV === "test"
        ? createTestQueue()
        : new Queue(
              "health-snapshot",
              {
                  connection,

                  defaultJobOptions: {
                      attempts: 3,

                      backoff: {
                          type: "exponential",
                          delay: 5000
                      },

                      removeOnComplete: {
                          age:
                              24 * 60 * 60,
                          count: 1000
                      },

                      removeOnFail: {
                          age:
                              7 * 24 * 60 * 60,
                          count: 5000
                      }
                  }
              }
          );

const enqueueHealthSnapshot =
    async ({
        projectId,
        snapshotDate,
        jobId
    }) => {
        return healthSnapshotQueue.add(
            "capture-project-health",
            {
                projectId,
                snapshotDate
            },
            {
                jobId
            }
        );
    };

const closeHealthSnapshotQueue =
    async () => {
        await healthSnapshotQueue.close();
    };

module.exports = {
    healthSnapshotQueue,
    enqueueHealthSnapshot,
    closeHealthSnapshotQueue
};