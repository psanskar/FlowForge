const mongoose = require("mongoose");

describe("MongoDB test environment", () => {
    test("connects to the test database", () => {
        expect(mongoose.connection.readyState).toBe(1);
        expect(mongoose.connection.name).toBe("flowforge_test");
    });
});