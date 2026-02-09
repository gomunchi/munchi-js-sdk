/** @type {import('jest').Config} */
module.exports = {
  displayName: "@munchi_oy/payments",
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__", "<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@munchi_oy/core$": "<rootDir>/../core/index.ts",
    "^@munchi_oy/payments$": "<rootDir>/index.ts",
    "^@test-helpers/(.*)$": "<rootDir>/__tests__/helpers/$1",
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/**/*.test.ts"],
};
