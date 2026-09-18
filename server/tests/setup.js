const mongoose = require("mongoose");

beforeAll(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 3000
        });

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
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    }
}, 10000);