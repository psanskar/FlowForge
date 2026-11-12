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
    const jobs = new Map();

    const processJob = async (job) => {
        if (!processor || closed) {
            return;
        }

        let lastError = null;
        job.state = "active";

        for (
            let attempt = 0;
            attempt < job.opts.attempts;
            attempt++
        ) {
            job.attemptsMade = attempt;

            try {
                const result =
                    await processor(job);

                job.state = "completed";
                if (worker) {
                    worker.emit(
                        "completed",
                        job,
                        result
                    );
                }

                return result;
            } catch (error) {
                lastError = error;

                if (
                    attempt + 1 >=
                    job.opts.attempts
                ) {
                    job.state = "failed";
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

        job.state = "failed";
        return lastError;
    };

    let worker = null;

    return {
        getJob: async (jobId) => jobs.get(jobId) || null,

        getJobCounts: async (...states) =>
            Object.fromEntries(
                states.map((state) => [state, 0])
            ),

        add: async (
            name,
            data,
            options = {}
        ) => {
            if (options.jobId && jobs.has(options.jobId)) {
                return jobs.get(options.jobId);
            }

            const job = {
                id:
                    options.jobId ||
                    null,

                name,

                data,

                opts: {
                    attempts:
                        options.attempts ||
                        5
                },

                state: "waiting",
                attemptsMade: 0,
                getState: async () => job.state
            };

            if (job.id) {
                jobs.set(job.id, job);
            }

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
            jobs.clear();
        }
    };
};

const githubWebhookQueue =
    process.env.NODE_ENV === "test"
        ? createTestQueue()
        : new Queue(
              "github-webhook",
              {
                  connection,

                  defaultJobOptions: {
                      attempts: 5,

                      backoff: {
                          type: "exponential",
                          delay: 1000
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

const enqueueGithubWebhook =
    async ({
        deliveryId,
        event,
        payload,
        queueGeneration = 0,
        jobId = deliveryId
    }) => {
        return githubWebhookQueue.add(
            "process-webhook",
            {
                deliveryId,
                event,
                payload,
                queueGeneration
            },
            {
                jobId
            }
        );
    };

const closeGithubWebhookQueue =
    async () => {
        await githubWebhookQueue.close();
    };

module.exports = {
    githubWebhookQueue,
    enqueueGithubWebhook,
    closeGithubWebhookQueue
};
