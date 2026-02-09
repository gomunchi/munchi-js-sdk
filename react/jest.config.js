/** @type {import('jest').Config} */
module.exports = {
  displayName: "@munchi_oy/react",
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: [],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: "<rootDir>/tsconfig.json",
    }],
  },
};
