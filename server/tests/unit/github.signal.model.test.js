const mongoose = require("mongoose");

const GithubSignal = require(
    "../../src/modules/github/github.signal.model"
);

describe("GithubSignal Model", () => {
    const repositoryId =
        new mongoose.Types.ObjectId();

    const projectId =
        new mongoose.Types.ObjectId();

    const createSignal = (overrides = {}) => ({
        project: projectId,
        repository: repositoryId,
        type: "COMMIT",
        externalId: "commit-abc123",
        occurredAt: new Date(
            "2026-09-17T12:00:00.000Z"
        ),
        actor: {
            id: 12345,
            login: "octocat"
        },
        metadata: {
            message: "Fix authentication bug"
        },
        ...overrides
    });

    test("creates a valid GitHub signal", () => {
        const signal = new GithubSignal(
            createSignal()
        );

        const validationError =
            signal.validateSync();

        expect(validationError).toBeUndefined();

        expect(signal.type).toBe("COMMIT");
        expect(signal.externalId).toBe(
            "commit-abc123"
        );
        expect(signal.actor.login).toBe(
            "octocat"
        );
    });

    test("requires project", () => {
        const signal = new GithubSignal(
            createSignal({
                project: undefined
            })
        );

        const error = signal.validateSync();

        expect(error.errors.project).toBeDefined();
    });

    test("requires repository", () => {
        const signal = new GithubSignal(
            createSignal({
                repository: undefined
            })
        );

        const error = signal.validateSync();

        expect(error.errors.repository).toBeDefined();
    });

    test("requires signal type", () => {
        const signal = new GithubSignal(
            createSignal({
                type: undefined
            })
        );

        const error = signal.validateSync();

        expect(error.errors.type).toBeDefined();
    });

    test("rejects unsupported signal type", () => {
        const signal = new GithubSignal(
            createSignal({
                type: "UNKNOWN_EVENT"
            })
        );

        const error = signal.validateSync();

        expect(error.errors.type).toBeDefined();
    });

    test("requires external ID", () => {
        const signal = new GithubSignal(
            createSignal({
                externalId: undefined
            })
        );

        const error = signal.validateSync();

        expect(
            error.errors.externalId
        ).toBeDefined();
    });

    test("requires occurredAt", () => {
        const signal = new GithubSignal(
            createSignal({
                occurredAt: undefined
            })
        );

        const error = signal.validateSync();

        expect(
            error.errors.occurredAt
        ).toBeDefined();
    });

    test("supports all defined signal types", () => {
        const signalTypes = [
            "COMMIT",
            "PULL_REQUEST_OPENED",
            "PULL_REQUEST_MERGED",
            "PULL_REQUEST_CLOSED",
            "ISSUE_OPENED",
            "ISSUE_CLOSED"
        ];

        for (const type of signalTypes) {
            const signal = new GithubSignal(
                createSignal({
                    type
                })
            );

            expect(
                signal.validateSync()
            ).toBeUndefined();
        }
    });

    test("uses default empty metadata", () => {
        const signal = new GithubSignal(
            createSignal({
                metadata: undefined
            })
        );

        expect(signal.metadata).toEqual({});
    });

    test("allows actor fields to be omitted", () => {
        const signal = new GithubSignal(
            createSignal({
                actor: {
                    id: null,
                    login: null
                }
            })
        );

        expect(
            signal.validateSync()
        ).toBeUndefined();

        expect(signal.actor.id).toBeNull();
        expect(signal.actor.login).toBeNull();
    });

    test("prevents duplicate signals for the same repository and external ID", async () => {
        const signalData = createSignal();

        await GithubSignal.create(signalData);

        const duplicateSignal =
            new GithubSignal(signalData);

        await expect(
            duplicateSignal.save()
        ).rejects.toMatchObject({
            code: 11000
        });
    });
});