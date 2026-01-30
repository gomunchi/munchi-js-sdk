/** @type {import('jest').Config} */
module.exports = {
  displayName: "@munchi/payments",
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__", "<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@munchi/core$": "<rootDir>/../core/index.ts",
    "^@munchi/payments$": "<rootDir>/index.ts",
    "^@test-helpers/(.*)$": "<rootDir>/__tests__/helpers/$1",
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/**/*.test.ts"],
};
