const Project =
    require("../modules/projects/project.model");

const {
    healthSnapshotQueue,
    enqueueHealthSnapshot
} = require("./healthSnapshot.queue");

const getSnapshotDate = (date = new Date()) => {
    const parts =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        ).formatToParts(date);

    const values = Object.fromEntries(
        parts
            .filter(
                (part) =>
                    part.type !== "literal"
            )
            .map(
                (part) => [
                    part.type,
                    part.value
                ]
            )
    );

    return `${values.year}-${values.month}-${values.day}`;
};

const dispatchHealthSnapshots = async ({
    now = new Date()
} = {}) => {
    const snapshotDate =
        getSnapshotDate(now);

    const projects = await Project.find({
        status: {
            $in: [
                "planning",
                "active"
            ]
        }
    })
        .select("_id")
        .lean();

    let queued = 0;

    for (const project of projects) {
        const projectId =
            project._id.toString();

        await enqueueHealthSnapshot({
            projectId,
            snapshotDate,
            jobId:
                `health:${projectId}:${snapshotDate}`
        });

        queued++;
    }

    return {
        snapshotDate,
        projectsFound:
            projects.length,
        queued
    };
};

const startHealthSnapshotScheduler =
    async () => {
        await healthSnapshotQueue.upsertJobScheduler(
            "daily-health-snapshot-dispatch",
            {
                pattern: "0 0 0 * * *",
                tz: "Asia/Kolkata"
            },
            {
                name:
                    "dispatch-health-snapshots",
                data: {},
                opts: {
                    attempts: 3,
                    removeOnComplete: {
                        age:
                            24 * 60 * 60,
                        count: 100
                    },
                    removeOnFail: {
                        age:
                            7 * 24 * 60 * 60,
                        count: 1000
                    }
                }
            }
        );

        console.log(
            "FlowForge daily health snapshot scheduler running at 00:00 Asia/Kolkata"
        );
    };

const closeHealthSnapshotScheduler =
    async () => {
        await healthSnapshotQueue.close();
    };

module.exports = {
    getSnapshotDate,
    dispatchHealthSnapshots,
    startHealthSnapshotScheduler,
    closeHealthSnapshotScheduler
};