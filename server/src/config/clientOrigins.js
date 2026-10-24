const DEFAULT_CLIENT_ORIGINS = [
    "http://localhost:5173"
];

const getClientOrigins = (
    configuredOrigins = process.env.CLIENT_URL
) => {
    if (!configuredOrigins) {
        return DEFAULT_CLIENT_ORIGINS;
    }

    return configuredOrigins
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
};

module.exports = getClientOrigins;
