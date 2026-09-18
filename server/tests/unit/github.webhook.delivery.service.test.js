const mongoose = require("mongoose");

const GithubWebhookDelivery =
    require("../../src/modules/github/github.webhook.delivery.model");

const {
    getDelivery,
    recordDelivery,
    markDeliveryProcessed,
    markDeliveryFailed,
    claimFailedDelivery
} = require("../../src/modules/github/github.webhook.delivery.service");

describe("GitHub webhook delivery service", () => {
    beforeEach(async () => {
        await GithubWebhookDelivery.deleteMany({});
    });

    test("returns null when delivery does not exist", async () => {
        const result =
            await getDelivery("delivery-123");

        expect(result).toBeNull();
    });

    test("records a new delivery as PROCESSING", async () => {
        const delivery =
            await recordDelivery({
                deliveryId: "delivery-123",
                event: "push"
            });

        expect(delivery).toBeTruthy();
        expect(delivery.deliveryId).toBe(
            "delivery-123"
        );
        expect(delivery.event).toBe("push");
        expect(delivery.status).toBe(
            "PROCESSING"
        );
    });

    test("marks a processing delivery as PROCESSED", async () => {
        await recordDelivery({
            deliveryId: "delivery-123",
            event: "push"
        });

        const result =
            await markDeliveryProcessed(
                "delivery-123"
            );

        expect(result).toBeTruthy();
        expect(result.status).toBe(
            "PROCESSED"
        );
        expect(result.processedAt).toBeInstanceOf(
            Date
        );
        expect(result.failureReason).toBeNull();
    });

    test("marks a processing delivery as FAILED", async () => {
        await recordDelivery({
            deliveryId: "delivery-123",
            event: "push"
        });

        const result =
            await markDeliveryFailed(
                "delivery-123",
                "Repository unavailable"
            );

        expect(result).toBeTruthy();
        expect(result.status).toBe(
            "FAILED"
        );
        expect(result.failureReason).toBe(
            "Repository unavailable"
        );
        expect(result.processedAt).toBeNull();
    });

    test("claims a FAILED delivery for retry", async () => {
        await recordDelivery({
            deliveryId: "delivery-123",
            event: "push"
        });

        await markDeliveryFailed(
            "delivery-123",
            "Temporary GitHub failure"
        );

        const result =
            await claimFailedDelivery({
                deliveryId: "delivery-123",
                event: "push"
            });

        expect(result).toBeTruthy();
        expect(result.status).toBe(
            "PROCESSING"
        );
        expect(result.failureReason).toBeNull();
        expect(result.processedAt).toBeNull();
    });

    test("does not claim a PROCESSED delivery", async () => {
        await recordDelivery({
            deliveryId: "delivery-123",
            event: "push"
        });

        await markDeliveryProcessed(
            "delivery-123"
        );

        const result =
            await claimFailedDelivery({
                deliveryId: "delivery-123",
                event: "push"
            });

        expect(result).toBeNull();
    });

    test("returns null when recording a duplicate delivery", async () => {
        await recordDelivery({
            deliveryId: "delivery-123",
            event: "push"
        });

        const duplicate =
            await recordDelivery({
                deliveryId: "delivery-123",
                event: "push"
            });

        expect(duplicate).toBeNull();

        const count =
            await GithubWebhookDelivery.countDocuments({
                deliveryId: "delivery-123"
            });

        expect(count).toBe(1);
    });
});