const mongoose = require("mongoose");

const GithubWebhookDelivery =
    require(
        "../../src/modules/github/github.webhook.delivery.model"
    );

describe("GithubWebhookDelivery model", () => {
    test("requires a delivery ID", () => {
        const delivery =
            new GithubWebhookDelivery({
                event: "issues"
            });

        const error =
            delivery.validateSync();

        expect(error).toBeDefined();

        expect(
            error.errors.deliveryId
        ).toBeDefined();
    });

    test("requires an event", () => {
        const delivery =
            new GithubWebhookDelivery({
                deliveryId: "delivery-123"
            });

        const error =
            delivery.validateSync();

        expect(error).toBeDefined();

        expect(
            error.errors.event
        ).toBeDefined();
    });

    test("accepts a valid delivery", () => {
        const delivery =
            new GithubWebhookDelivery({
                deliveryId: "delivery-123",
                event: "issues"
            });

        const error =
            delivery.validateSync();

        expect(error).toBeUndefined();
    });

    test("defines deliveryId as unique", () => {
        const index =
            GithubWebhookDelivery.schema.indexes()
                .find(
                    ([fields, options]) =>
                        fields.deliveryId === 1 &&
                        options.unique === true
                );

        expect(index).toBeDefined();
    });

    test("uses Date for receivedAt", () => {
        const delivery =
            new GithubWebhookDelivery({
                deliveryId: "delivery-123",
                event: "issues"
            });

        expect(
            delivery.schema.path("receivedAt").instance
        ).toBe("Date");
    });
});