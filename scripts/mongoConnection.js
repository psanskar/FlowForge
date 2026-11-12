const rewriteLoopbackForDocker = (mongoUri) => {
    const parsedUri = new URL(mongoUri);

    if (
        parsedUri.protocol === "mongodb:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(parsedUri.hostname)
    ) {
        parsedUri.hostname = "host.docker.internal";
    }

    return parsedUri.toString();
};

module.exports = {
    rewriteLoopbackForDocker
};
