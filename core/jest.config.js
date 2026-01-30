/** @type {import('jest').Config} */
module.exports = {
  displayName: "@munchi/core",
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  moduleNameMapper: {
    "^@munchi/core$": "<rootDir>/index.ts",
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
};
