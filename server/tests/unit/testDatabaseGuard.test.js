const {
    assertDedicatedTestDatabase
} = require("../testDatabaseGuard");

describe("test database safety guard", () => {
    test("accepts the dedicated test database", () => {
        expect(
            assertDedicatedTestDatabase(
                "mongodb://127.0.0.1:27018/flowforge_test"
            )
        ).toBe("flowforge_test");
    });

    test.each([
        undefined,
        "mongodb://127.0.0.1:27017/flowforge",
        "mongodb://127.0.0.1:27017/flowforge_dev",
        "mongodb://127.0.0.1:27017",
        "mongodb://example.mongodb.net/flowforge_test"
    ])("rejects unsafe or missing database URI: %s", (uri) => {
        expect(() => assertDedicatedTestDatabase(uri)).toThrow();
    });
});
