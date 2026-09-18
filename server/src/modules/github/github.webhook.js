const crypto = require("crypto");

const createWebhookSignature = (payload, secret) => {
    if (!secret) {
        throw new Error("Webhook secret is required");
    }

    if (
        !Buffer.isBuffer(payload) &&
        typeof payload !== "string"
    ) {
        throw new TypeError(
            "Webhook payload must be a string or Buffer"
        );
    }

    const digest = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

    return `sha256=${digest}`;
};

const verifyWebhookSignature = (
    payload,
    signature,
    secret
) => {
    if (!payload || !signature || !secret) {
        return false;
    }

    if (
        !Buffer.isBuffer(payload) &&
        typeof payload !== "string"
    ) {
        return false;
    }

    if (
        typeof signature !== "string" ||
        !signature.startsWith("sha256=")
    ) {
        return false;
    }

    const expectedSignature =
        createWebhookSignature(payload, secret);

    const expectedBuffer = Buffer.from(
        expectedSignature,
        "utf8"
    );

    const receivedBuffer = Buffer.from(
        signature,
        "utf8"
    );

    if (
        expectedBuffer.length !==
        receivedBuffer.length
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        expectedBuffer,
        receivedBuffer
    );
};

module.exports = {
    createWebhookSignature,
    verifyWebhookSignature
};