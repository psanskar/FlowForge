const crypto = require("crypto");

const unauthorized = (res) => res.status(401).json({
    success: false,
    error: {
        code: "OPERATIONS_KEY_INVALID",
        message: "A valid operations key is required"
    }
});

const requireOperationsKey = (req, res, next) => {
    const configuredKey = process.env.OPERATIONS_API_KEY;

    if (!configuredKey) {
        return res.status(503).json({
            success: false,
            error: {
                code: "OPERATIONS_KEY_NOT_CONFIGURED",
                message: "Operations access is not configured"
            }
        });
    }

    const supplied = Buffer.from(req.get("X-FlowForge-Ops-Key") || "");
    const configured = Buffer.from(configuredKey);

    if (configured.length !== supplied.length || !crypto.timingSafeEqual(configured, supplied)) {
        return unauthorized(res);
    }

    return next();
};

module.exports = requireOperationsKey;
