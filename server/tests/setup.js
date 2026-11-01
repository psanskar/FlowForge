const mongoose = require("mongoose");

const {
    TEST_DATABASE_NAME,
    assertDedicatedTestDatabase
} = require("./testDatabaseGuard");

beforeAll(async () => {
    try {
        assertDedicatedTestDatabase(process.env.MONGO_URI);

        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 3000
        });

        if (mongoose.connection.name !== TEST_DATABASE_NAME) {
            throw new Error(
                `Refusing to run tests against '${mongoose.connection.name}'.`
            );
        }

        console.log(
            `Connected to test database: ${mongoose.connection.name}`
        );

        await mongoose.syncIndexes();
    } catch (error) {
        console.error(
            "Test MongoDB setup failed:",
            error.message
        );
        throw error;
    }
}, 10000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        if (mongoose.connection.name !== TEST_DATABASE_NAME) {
            await mongoose.connection.close();
            throw new Error(
                `Refusing to drop database '${mongoose.connection.name}' during test cleanup.`
            );
        }

        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    }
}, 10000);
