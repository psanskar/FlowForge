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

    const databaseName = decodeURIComponent(
        parsedUri.pathname.replace(/^\/+/, "").split("/")[0]
    );

    if (!databaseName || !/^[A-Za-z0-9_-]+$/.test(databaseName)) {
        throw new Error("MONGO_URI must include a simple database name.");
    }

    return databaseName;
};

const run = () => {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        throw new Error("Set MONGO_URI before creating a backup.");
    }

    const databaseName = getDatabaseName(mongoUri);
    const backupDirectory = path.resolve(
        process.env.FLOWFORGE_BACKUP_DIR ||
            path.join(REPOSITORY_ROOT, "backups")
    );
    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-");
    const archiveName =
        `flowforge-${databaseName}-${timestamp}.archive.gz`;
    const archivePath = path.join(
        backupDirectory,
        archiveName
    );

    fs.mkdirSync(backupDirectory, {
        recursive: true
    });

    const result = spawnSync(
        "docker",
        [
            "run",
            "--rm",
            "--add-host=host.docker.internal:host-gateway",
            "--mount",
            `type=bind,source=${backupDirectory},target=/backup`,
            "--env",
            "MONGO_URI",
            "--env",
            `ARCHIVE_NAME=${archiveName}`,
            TOOL_IMAGE,
            "sh",
            "-c",
            'mongodump --uri="$MONGO_URI" --gzip --archive="/backup/$ARCHIVE_NAME"'
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
        fs.rmSync(archivePath, { force: true });
        throw new Error("mongodump failed; the incomplete archive was removed.");
    }

    const stats = fs.statSync(archivePath);

    if (stats.size === 0) {
        fs.rmSync(archivePath, { force: true });
        throw new Error("mongodump produced an empty archive.");
    }

    process.stdout.write(
        `Backup created: ${archivePath} (${stats.size} bytes)\n`
    );
};

try {
    run();
} catch (error) {
    process.stderr.write(`Backup failed: ${error.message}\n`);
    process.exitCode = 1;
}
