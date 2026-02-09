/** @type {import('jest').Config} */
module.exports = {
  displayName: "@munchi_oy/core",
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  moduleNameMapper: {
    "^@munchi_oy/core$": "<rootDir>/index.ts",
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
};
