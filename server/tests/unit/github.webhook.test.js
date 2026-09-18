const {
    createWebhookSignature,
    verifyWebhookSignature
} = require(
    "../../src/modules/github/github.webhook"
);

describe("GitHub webhook signature verification", () => {
    const secret = "test-webhook-secret";
    const payload = JSON.stringify({
        action: "opened",
        repository: {
            id: 12345
        }
    });

    test("creates a GitHub-compatible signature", () => {
        const signature =
            createWebhookSignature(
                payload,
                secret
            );

        expect(signature).toMatch(
            /^sha256=[a-f0-9]{64}$/
        );
    });

    test("accepts a valid signature", () => {
        const signature =
            createWebhookSignature(
                payload,
                secret
            );

        expect(
            verifyWebhookSignature(
                payload,
                signature,
                secret
            )
        ).toBe(true);
    });

    test("rejects an invalid signature", () => {
        expect(
            verifyWebhookSignature(
                payload,
                "sha256=invalid",
                secret
            )
        ).toBe(false);
    });

    test("rejects a signature generated with the wrong secret", () => {
        const signature =
            createWebhookSignature(
                payload,
                "wrong-secret"
            );

        expect(
            verifyWebhookSignature(
                payload,
                signature,
                secret
            )
        ).toBe(false);
    });

    test("rejects a missing signature", () => {
        expect(
            verifyWebhookSignature(
                payload,
                undefined,
                secret
            )
        ).toBe(false);
    });

    test("rejects a malformed signature", () => {
        expect(
            verifyWebhookSignature(
                payload,
                "invalid-signature",
                secret
            )
        ).toBe(false);
    });

    test("rejects a missing secret", () => {
        const signature =
            createWebhookSignature(
                payload,
                secret
            );

        expect(
            verifyWebhookSignature(
                payload,
                signature,
                undefined
            )
        ).toBe(false);
    });

    test("supports Buffer payloads", () => {
        const buffer = Buffer.from(payload);

        const signature =
            createWebhookSignature(
                buffer,
                secret
            );

        expect(
            verifyWebhookSignature(
                buffer,
                signature,
                secret
            )
        ).toBe(true);
    });
});