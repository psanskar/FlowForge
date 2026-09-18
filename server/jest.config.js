module.exports = {
    testEnvironment: "node",

    setupFiles: [
        "<rootDir>/tests/env.setup.js"
    ],

    setupFilesAfterEnv: [
        "<rootDir>/tests/setup.js"
    ]
};