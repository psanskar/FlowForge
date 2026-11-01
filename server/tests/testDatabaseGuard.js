const TEST_DATABASE_NAME = "flowforge_test";

const assertDedicatedTestDatabase = (uri) => {
    if (!uri) {
        throw new Error(
            "MONGO_URI is required and must point to the dedicated flowforge_test database"
        );
    }

    let parsedUri;
    let databaseName;

    try {
        parsedUri = new URL(uri);
        databaseName = decodeURIComponent(
            parsedUri.pathname.replace(/^\/+/, "").split("/")[0]
        );
    } catch {
        throw new Error("MONGO_URI must be a valid MongoDB connection URL");
    }

    if (
        parsedUri.protocol !== "mongodb:" ||
        !["127.0.0.1", "localhost", "[::1]"].includes(
            parsedUri.hostname
        )
    ) {
        throw new Error(
            "MONGO_URI for tests must point to a local MongoDB service"
        );
    }

    if (databaseName !== TEST_DATABASE_NAME) {
        throw new Error(
            `Refusing to run tests against '${databaseName || "an unspecified database"}'. ` +
            `Tests may only use '${TEST_DATABASE_NAME}'.`
        );
    }

    return databaseName;
};

module.exports = {
    TEST_DATABASE_NAME,
    assertDedicatedTestDatabase
};
