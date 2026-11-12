#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { rewriteLoopbackForDocker } = require("./mongoConnection");

const TOOL_IMAGE = "mongo:8.0.30";
const REPOSITORY_ROOT = path.resolve(__dirname, "..");
for (const envPath of [
    path.join(REPOSITORY_ROOT, ".env"),
    path.join(REPOSITORY_ROOT, "server", ".env")
]) {
    if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
}

const readOption = (name) => {
    const prefix = `--${name}=`;
    const argument = process.argv.find((item) =>
        item.startsWith(prefix)
    );

    return argument ? argument.slice(prefix.length) : null;
};

const isDatabaseName = (value) =>
    typeof value === "string" &&
    /^[A-Za-z0-9_-]+$/.test(value);

const getDatabaseName = (mongoUri) => {
    let parsedUri;

    try {
        parsedUri = new URL(mongoUri);
    } catch {
        throw new Error("MONGO_URI must be a valid MongoDB connection URL.");
    }

    if (!["mongodb:", "mongodb+srv:"].includes(parsedUri.protocol)) {
        throw new Error("MONGO_URI must use mongodb:// or mongodb+srv://.");
    }

    return decodeURIComponent(
        parsedUri.pathname.replace(/^\/+/, "").split("/")[0]
    );
};

const run = () => {
    const mongoUri = process.env.MONGO_URI;
    const archiveArgument = readOption("archive");
    const sourceDatabase = readOption("source-db");
    const targetDatabase = readOption("target-db");
    const confirmTarget = readOption("confirm-target");

    if (!mongoUri) {
        throw new Error("Set MONGO_URI to the restore target.");
    }

    if (!archiveArgument) {
        throw new Error("Provide --archive=<backup-file>.");
    }

    if (!isDatabaseName(sourceDatabase)) {
        throw new Error("Provide a valid --source-db name.");
    }

    if (!isDatabaseName(targetDatabase)) {
        throw new Error("Provide a valid --target-db name.");
    }

    if (getDatabaseName(mongoUri) !== targetDatabase) {
        throw new Error(
            "The target database in MONGO_URI must match --target-db."
        );
    }

    if (confirmTarget !== targetDatabase) {
        throw new Error(
            `Restore replaces matching collections. Re-run with --confirm-target=${targetDatabase} to confirm the target.`
        );
    }

    const archivePath = path.resolve(archiveArgument);

    if (!fs.existsSync(archivePath) || !fs.statSync(archivePath).isFile()) {
        throw new Error("The backup archive does not exist.");
    }

    const archiveDirectory = path.dirname(archivePath);
    const archiveName = path.basename(archivePath);

    process.stdout.write(
        `Restoring namespaces ${sourceDatabase}.* to ${targetDatabase}.*. Matching target collections will be replaced.\n`
    );

    const result = spawnSync(
        "docker",
        [
            "run",
            "--rm",
            "--add-host=host.docker.internal:host-gateway",
            "--mount",
            `type=bind,source=${archiveDirectory},target=/backup,readonly`,
            "--env",
            "MONGO_URI",
            "--env",
            `ARCHIVE_NAME=${archiveName}`,
            "--env",
            `SOURCE_DATABASE=${sourceDatabase}`,
            "--env",
            `TARGET_DATABASE=${targetDatabase}`,
            TOOL_IMAGE,
            "sh",
            "-c",
            'mongorestore --uri="$MONGO_URI" --gzip --archive="/backup/$ARCHIVE_NAME" --nsInclude="$SOURCE_DATABASE.*" --nsFrom="$SOURCE_DATABASE.*" --nsTo="$TARGET_DATABASE.*" --drop'
        ],
        {
            stdio: "inherit",
            env: {
                ...process.env,
                MONGO_URI: rewriteLoopbackForDocker(mongoUri)
            }
        }
    );

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error("mongorestore failed. Check its output and target database.");
    }

    process.stdout.write("Restore completed successfully.\n");
};

try {
    run();
} catch (error) {
    process.stderr.write(`Restore failed: ${error.message}\n`);
    process.exitCode = 1;
}
