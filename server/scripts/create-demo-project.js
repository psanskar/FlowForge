require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Project = require("../src/modules/projects/project.model");
const User = require("../src/modules/users/user.model");

const isSafeDemoDatabase = (name) =>
    /^flowforge[-_](demo|dev|test)([-_]|$)/i.test(name);

const run = async () => {
    const { MONGO_URI, DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD } = process.env;

    if (!MONGO_URI || !DEMO_OWNER_EMAIL || !DEMO_OWNER_PASSWORD) {
        throw new Error(
            "Set MONGO_URI, DEMO_OWNER_EMAIL, and DEMO_OWNER_PASSWORD before creating a demo project"
        );
    }

    if (DEMO_OWNER_PASSWORD.length < 12) {
        throw new Error("DEMO_OWNER_PASSWORD must contain at least 12 characters");
    }

    await mongoose.connect(MONGO_URI);

    if (!isSafeDemoDatabase(mongoose.connection.name)) {
        throw new Error(
            `Refusing to create demo data in '${mongoose.connection.name}'. Use a flowforge_demo database.`
        );
    }

    const email = DEMO_OWNER_EMAIL.trim().toLowerCase();
    let owner = await User.findOne({ email });

    if (!owner) {
        owner = await User.create({
            name: "FlowForge Demo Owner",
            email,
            passwordHash: await bcrypt.hash(DEMO_OWNER_PASSWORD, 12)
        });
    }

    let project = await Project.findOne({
        owner: owner._id,
        name: "FlowForge Demo"
    });

    if (!project) {
        const now = new Date();
        project = await Project.create({
            name: "FlowForge Demo",
            description: "Disposable project for FlowForge demonstrations and performance checks.",
            owner: owner._id,
            members: [{ user: owner._id, role: "owner" }],
            status: "active",
            startDate: now,
            targetDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
        });
    }

    console.log(JSON.stringify({
        database: mongoose.connection.name,
        email,
        projectId: project._id.toString(),
        projectName: project.name
    }, null, 2));
};

run()
    .catch((error) => {
        console.error("Demo project creation failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });
