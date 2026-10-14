module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  // We use our custom scripts to spin up the Memory DB
  globalSetup: "<rootDir>/tests/jest.setup.js",
  globalTeardown: "<rootDir>/tests/jest.teardown.js",
  setupFilesAfterEnv: ["<rootDir>/tests/jest.env.js"]
};
