const REQUIRED_BY_PROCESS = {
    api: [
        "MONGO_URI",
        "REDIS_URL",
        "JWT_SECRET",
        "GITHUB_WEBHOOK_SECRET"
    ],
    worker: [
        "MONGO_URI",
        "REDIS_URL"
    ],
    scheduler: [
        "REDIS_URL"
    ]
};

const validateEnvironment = (
    processType,
    env = process.env
) => {
    const required = REQUIRED_BY_PROCESS[processType];

    if (!required) {
        throw new Error(
            `Unknown process type for environment validation: ${processType}`
        );
    }

    const errors = required
        .filter((name) => !env[name]?.trim())
        .map((name) => `${name} is required`);

    if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
        errors.push("JWT_SECRET must contain at least 32 characters");
    }

    if (
        env.GITHUB_WEBHOOK_SECRET &&
        env.GITHUB_WEBHOOK_SECRET.length < 32
    ) {
        errors.push(
            "GITHUB_WEBHOOK_SECRET must contain at least 32 characters"
        );
    }

    if (env.PORT !== undefined) {
        const port = Number(env.PORT);

        if (
            !Number.isInteger(port) ||
            port < 1 ||
            port > 65535
        ) {
            errors.push("PORT must be an integer between 1 and 65535");
        }
    }

    if (env.CLIENT_URL !== undefined) {
        const origins = env.CLIENT_URL.split(",").map((origin) => origin.trim());

        if (origins.length === 0 || origins.some((origin) => !origin)) {
            errors.push("CLIENT_URL must contain valid comma-separated origins");
        } else {
            for (const origin of origins) {
                try {
                    const parsed = new URL(origin);

                    if (
                        !["http:", "https:"].includes(parsed.protocol) ||
                        parsed.origin !== origin.replace(/\/$/, "") ||
                        parsed.username ||
                        parsed.password
                    ) {
                        errors.push(
                            "CLIENT_URL entries must be HTTP or HTTPS origins without paths or credentials"
                        );
                        break;
                    }
                } catch {
                    errors.push("CLIENT_URL must contain valid comma-separated origins");
                    break;
                }
            }
        }
    }

    for (const name of ["MONGO_URI", "REDIS_URL"]) {
        const value = env[name];

        if (!value) {
            continue;
        }

        try {
            const url = new URL(value);
            const allowedProtocols = name === "MONGO_URI"
                ? ["mongodb:", "mongodb+srv:"]
                : ["redis:", "rediss:"];

            if (!allowedProtocols.includes(url.protocol)) {
                errors.push(
                    `${name} must use ${allowedProtocols.join(" or ")}`
                );
            }
        } catch {
            errors.push(`${name} must be a valid connection URL`);
        }
    }

    if (
        env.NODE_ENV === "production" &&
        (env.JWT_SECRET === "replace-with-a-long-random-secret" ||
            env.GITHUB_WEBHOOK_SECRET ===
                "replace-with-your-github-webhook-secret")
    ) {
        errors.push("Replace example secrets before starting in production");
    }

    if (errors.length > 0) {
        throw new Error(
            `Invalid ${processType} environment:\n- ${errors.join("\n- ")}`
        );
    }
};

module.exports = validateEnvironment;
