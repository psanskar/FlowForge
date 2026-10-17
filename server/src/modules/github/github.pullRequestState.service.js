const GithubRepository = require("./github.model");
const GithubSignal = require("./github.signal.model");
const GithubPullRequestState = require(
    "./github.pullRequestState.model"
);

const PULL_REQUEST_TYPES = [
    "PULL_REQUEST_OPENED",
    "PULL_REQUEST_MERGED",
    "PULL_REQUEST_CLOSED"
];
const NO_OPEN_PULL_REQUEST_DATE =
    new Date("9999-12-31T23:59:59.999Z");

const asLiteral = (value) => ({
    $literal: value
});

const buildStateUpdate = ({
    project,
    repository,
    githubId,
    firstOpenedAt,
    lastOpenedAt,
    latestEventAt,
    latestEventType,
    latestEventId,
    latestEventMetadata
}) => {
    const currentFirstOpenedAt = {
        $ifNull: ["$firstOpenedAt", null]
    };
    const currentLatestEventAt = {
        $ifNull: ["$latestEventAt", null]
    };
    const incomingFirstOpenedAt = asLiteral(firstOpenedAt);
    const incomingLastOpenedAt = asLiteral(lastOpenedAt);
    const incomingLatestEventAt = asLiteral(latestEventAt);
    const incomingLatestEventId = asLiteral(latestEventId);

    const shouldReplaceLatestEvent = {
        $or: [
            {
                $eq: [currentLatestEventAt, null]
            },
            {
                $gt: [
                    incomingLatestEventAt,
                    "$latestEventAt"
                ]
            },
            {
                $and: [
                    {
                        $eq: [
                            incomingLatestEventAt,
                            "$latestEventAt"
                        ]
                    },
                    {
                        $lt: [
                            incomingLatestEventId,
                            {
                                $ifNull: [
                                    "$latestEventId",
                                    "~"
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    };

    return [
        {
            $set: {
                project: asLiteral(project),
                repository: asLiteral(repository),
                githubId: asLiteral(String(githubId)),
                firstOpenedAt: {
                    $cond: [
                        {
                            $eq: [currentFirstOpenedAt, null]
                        },
                        incomingFirstOpenedAt,
                        {
                            $cond: [
                                {
                                    $and: [
                                        {
                                            $ne: [
                                                incomingFirstOpenedAt,
                                                null
                                            ]
                                        },
                                        {
                                            $lt: [
                                                incomingFirstOpenedAt,
                                                "$firstOpenedAt"
                                            ]
                                        }
                                    ]
                                },
                                incomingFirstOpenedAt,
                                "$firstOpenedAt"
                            ]
                        }
                    ]
                },
                lastOpenedAt: {
                    $cond: [
                        {
                            $eq: [
                                {
                                    $ifNull: ["$lastOpenedAt", null]
                                },
                                null
                            ]
                        },
                        incomingLastOpenedAt,
                        {
                            $cond: [
                                {
                                    $and: [
                                        {
                                            $ne: [
                                                incomingLastOpenedAt,
                                                null
                                            ]
                                        },
                                        {
                                            $gt: [
                                                incomingLastOpenedAt,
                                                "$lastOpenedAt"
                                            ]
                                        }
                                    ]
                                },
                                incomingLastOpenedAt,
                                "$lastOpenedAt"
                            ]
                        }
                    ]
                },
                latestEventAt: {
                    $cond: [
                        shouldReplaceLatestEvent,
                        incomingLatestEventAt,
                        "$latestEventAt"
                    ]
                },
                latestEventType: {
                    $cond: [
                        shouldReplaceLatestEvent,
                        asLiteral(latestEventType),
                        "$latestEventType"
                    ]
                },
                latestEventId: {
                    $cond: [
                        shouldReplaceLatestEvent,
                        incomingLatestEventId,
                        "$latestEventId"
                    ]
                },
                latestEventMetadata: {
                    $cond: [
                        shouldReplaceLatestEvent,
                        asLiteral(latestEventMetadata || {}),
                        "$latestEventMetadata"
                    ]
                }
            }
        }
    ];
};

const updatePullRequestState = async (signal) => {
    if (
        !PULL_REQUEST_TYPES.includes(signal.type) ||
        signal.metadata?.githubId === null ||
        signal.metadata?.githubId === undefined
    ) {
        return null;
    }

    const firstOpenedAt =
        signal.type === "PULL_REQUEST_OPENED"
            ? signal.occurredAt
            : null;
    const lastOpenedAt = firstOpenedAt;

    return GithubPullRequestState.updateOne(
        {
            repository: signal.repository,
            githubId: String(signal.metadata.githubId)
        },
        buildStateUpdate({
            project: signal.project,
            repository: signal.repository,
            githubId: signal.metadata.githubId,
            firstOpenedAt,
            lastOpenedAt,
            latestEventAt: signal.occurredAt,
            latestEventType: signal.type,
            latestEventId: signal._id.toString(),
            latestEventMetadata: signal.metadata
        }),
        {
            upsert: true,
            updatePipeline: true
        }
    );
};

const backfillPullRequestState = async (repository) => {
    const summaries = await GithubSignal.aggregate([
        {
            $match: {
                project: repository.project,
                repository: repository._id,
                type: {
                    $in: PULL_REQUEST_TYPES
                },
                "metadata.githubId": {
                    $exists: true,
                    $ne: null
                }
            }
        },
        {
            $group: {
                _id: {
                    $toString: "$metadata.githubId"
                },
                firstOpenedAt: {
                    $min: {
                        $cond: [
                            {
                                $eq: [
                                    "$type",
                                    "PULL_REQUEST_OPENED"
                                ]
                            },
                            "$occurredAt",
                            NO_OPEN_PULL_REQUEST_DATE
                        ]
                    }
                },
                lastOpenedAt: {
                    $max: {
                        $cond: [
                            {
                                $eq: [
                                    "$type",
                                    "PULL_REQUEST_OPENED"
                                ]
                            },
                            "$occurredAt",
                            null
                        ]
                    }
                },
                latestEvent: {
                    $top: {
                        sortBy: {
                            occurredAt: -1,
                            _id: 1
                        },
                        output: {
                            type: "$type",
                            occurredAt: "$occurredAt",
                            id: {
                                $toString: "$_id"
                            },
                            metadata: "$metadata"
                        }
                    }
                }
            }
        }
    ]).allowDiskUse(true);

    summaries.forEach((summary) => {
        if (
            summary.firstOpenedAt?.getTime() ===
            NO_OPEN_PULL_REQUEST_DATE.getTime()
        ) {
            summary.firstOpenedAt = null;
        }
    });

    if (summaries.length > 0) {
        await GithubPullRequestState.bulkWrite(
            summaries.map((summary) => ({
                updateOne: {
                    filter: {
                        repository: repository._id,
                        githubId: summary._id
                    },
                    update: buildStateUpdate({
                        project: repository.project,
                        repository: repository._id,
                        githubId: summary._id,
                        firstOpenedAt: summary.firstOpenedAt,
                        lastOpenedAt: summary.lastOpenedAt,
                        latestEventAt:
                            summary.latestEvent.occurredAt,
                        latestEventType:
                            summary.latestEvent.type,
                        latestEventId:
                            summary.latestEvent.id,
                        latestEventMetadata:
                            summary.latestEvent.metadata
                    }),
                    upsert: true
                }
            })),
            {
                ordered: false
            }
        );
    }

    await GithubRepository.updateOne(
        {
            _id: repository._id,
            pullRequestStateVersion: {
                $lt: 1
            }
        },
        {
            $set: {
                pullRequestStateVersion: 1
            }
        }
    );
};

const ensurePullRequestState = async (projectId) => {
    const repository = await GithubRepository.findOne({
        project: projectId
    })
        .select("_id project pullRequestStateVersion")
        .lean();

    if (
        !repository ||
        repository.pullRequestStateVersion >= 1
    ) {
        return repository;
    }

    await backfillPullRequestState(repository);
    return repository;
};

module.exports = {
    ensurePullRequestState,
    updatePullRequestState
};
