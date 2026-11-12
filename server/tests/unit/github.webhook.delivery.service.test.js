const mongoose = require("mongoose");

const GithubWebhookDelivery =
    require("../../src/modules/github/github.webhook.delivery.model");

const {
    getDelivery,
    recordDelivery,
    markDeliveryProcessing,
    markDeliveryProcessed,
    markDeliveryFailed,
    claimFailedDelivery,
    recoverProcessingDelivery
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

    test("records a new delivery as QUEUED", async () => {
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
            "QUEUED"
        );
    });

    test("marks a queued delivery as PROCESSING", async () => {
        await recordDelivery({
            deliveryId: "delivery-123",
            event: "push"
        });

        const result = await markDeliveryProcessing(
            "delivery-123",
            "delivery-123-0",
            0
        );

        expect(result).toBeTruthy();
        expect(result.status).toBe(
            "PROCESSING"
        );
        expect(result.failureReason).toBeNull();
        expect(result.processedAt).toBeNull();
    });

    test("marks a processing delivery as PROCESSED", async () => {
        await recordDelivery({
            deliveryId: "delivery-123",
            event: "push"
        });

        await markDeliveryProcessing("delivery-123", "delivery-123-0", 0);

        const result =
            await markDeliveryProcessed("delivery-123", "delivery-123-0", 0);

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

        await markDeliveryProcessing("delivery-123", "delivery-123-0", 0);

        const result =
            await markDeliveryFailed(
                "delivery-123",
                "Repository unavailable",
                "delivery-123-0",
                0
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

    test("claims a FAILED delivery for retry and returns it to QUEUED", async () => {
        await recordDelivery({
            deliveryId: "delivery-123",
            event: "push"
        });

        await markDeliveryProcessing("delivery-123", "delivery-123-0", 0);

        await markDeliveryFailed(
            "delivery-123",
            "Temporary GitHub failure",
            "delivery-123-0",
            0
        );

        const result =
            await claimFailedDelivery({
                deliveryId: "delivery-123",
                event: "push"
            });

        expect(result).toBeTruthy();
        expect(result.status).toBe(
            "QUEUED"
        );
        expect(result.failureReason).toBeNull();
        expect(result.processedAt).toBeNull();
        expect(result.queueGeneration).toBe(1);
    });

    test("does not claim a PROCESSED delivery", async () => {
        await recordDelivery({
            deliveryId: "delivery-123",
            event: "push"
        });

        await markDeliveryProcessing("delivery-123", "delivery-123-0", 0);

        await markDeliveryProcessed(
            "delivery-123",
            "delivery-123-0",
            0
        );

        const result =
            await claimFailedDelivery({
                deliveryId: "delivery-123",
                event: "push"
            });

        expect(result).toBeNull();
    });

    test("recovers an abandoned processing claim with a fenced next generation", async () => {
        await recordDelivery({ deliveryId: "delivery-123", event: "push" });
        await markDeliveryProcessing("delivery-123", "delivery-123-0", 0);

        const recovered = await recoverProcessingDelivery({
            deliveryId: "delivery-123",
            processingJobId: "delivery-123-0",
            queueGeneration: 0
        });

        expect(recovered.status).toBe("QUEUED");
        expect(recovered.queueGeneration).toBe(1);
        expect(recovered.processingJobId).toBeNull();

        const staleCompletion = await markDeliveryProcessed(
            "delivery-123",
            "delivery-123-0",
            0
        );
        expect(staleCompletion).toBeNull();
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
