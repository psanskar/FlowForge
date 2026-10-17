const mongoose = require("mongoose");

const {
    closeGithubWebhookQueue
} = require("../../src/queues/githubWebhook.queue");

const {
    shutdownServer
} = require("../../src/server");

jest.mock("../../src/queues/githubWebhook.queue", () => ({
    closeGithubWebhookQueue: jest.fn()
}));

describe("API server shutdown", () => {
    let disconnectSpy;

    beforeEach(() => {
        closeGithubWebhookQueue.mockReset();
        closeGithubWebhookQueue.mockResolvedValue();
        disconnectSpy = jest
            .spyOn(mongoose, "disconnect")
            .mockResolvedValue();
    });

    afterEach(() => {
        disconnectSpy.mockRestore();
    });

    test("closes Socket.IO, the webhook queue, and MongoDB", async () => {
        const calls = [];
        const httpServer = {
            io: {
                close: jest.fn((callback) => {
                    calls.push("socket");
                    callback();
                })
            }
        };

        closeGithubWebhookQueue.mockImplementation(async () => {
            calls.push("queue");
        });
        disconnectSpy.mockImplementation(async () => {
            calls.push("mongodb");
        });

        await shutdownServer(httpServer);

        expect(calls).toEqual([
            "socket",
            "queue",
            "mongodb"
        ]);
    });

    test("disconnects MongoDB even if the webhook queue fails to close", async () => {
        const error = new Error("Queue close failed");
        const httpServer = {
            io: {
                close: jest.fn((callback) => callback())
            }
        };
        closeGithubWebhookQueue.mockRejectedValue(error);

        await expect(
            shutdownServer(httpServer)
        ).rejects.toBe(error);

        expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });
});
