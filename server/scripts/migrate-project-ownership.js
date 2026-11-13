require("dotenv").config();

const mongoose = require("mongoose");

const hasApplyFlag = process.argv.includes("--apply");

const run = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is required");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const projects = mongoose.connection.collection("projects");
    let scanned = 0;
    let changed = 0;
    let ownersMissingFromMembers = 0;

    for await (const project of projects.find(
        {},
        { projection: { _id: 1, owner: 1, members: 1 } }
    )) {
        scanned++;

        const members = Array.isArray(project.members)
            ? project.members
            : [];
        const ownerId = project.owner?.toString();
        const ownerIsMember = ownerId && members.some(
            (member) => member?.user?.toString() === ownerId
        );

        if (project.owner && !ownerIsMember) {
            ownersMissingFromMembers++;
        }

        let needsUpdate = !Array.isArray(project.members);
        const normalizedMembers = members.map((member) => {
            if (!member || !Object.hasOwn(member, "role")) {
                return member;
            }

            needsUpdate = true;
            const normalized = { ...member };
            delete normalized.role;
            return normalized;
        });

        if (project.owner && !ownerIsMember) {
            normalizedMembers.push({ user: project.owner });
            needsUpdate = true;
        }

        if (needsUpdate) {
            changed++;

            if (hasApplyFlag) {
                await projects.updateOne(
                    { _id: project._id },
                    { $set: { members: normalizedMembers } }
                );
            }
        }
    }

    console.log(JSON.stringify({
        mode: hasApplyFlag ? "apply" : "dry-run",
        database: mongoose.connection.name,
        scannedProjects: scanned,
        projectsToUpdate: changed,
        projectsUpdated: hasApplyFlag ? changed : 0,
        ownersMissingFromMembers
    }, null, 2));

    if (!hasApplyFlag) {
        console.log("No database changes made. Re-run with --apply to execute this migration.");
    }
};

run()
    .catch((error) => {
        console.error("Project ownership migration failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });
