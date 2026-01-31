/** @type {import('jest').Config} */
module.exports = {
  projects: ["<rootDir>/core", "<rootDir>/payments", "<rootDir>/react"],
  collectCoverageFrom: [
    "**/src/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/generated/**",
  ],
  coverageDirectory: "<rootDir>/coverage",
};
