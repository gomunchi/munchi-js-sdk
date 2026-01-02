#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read package.json from parent directory (core)
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8")
);

// Create version.ts content
const versionFileContent = `// This file is auto-generated. Do not edit manually.
// Run 'pnpm version:sync' to update this file.
export const VERSION = "${packageJson.version}";
`;

// Write to version.ts in the src directory
writeFileSync(
  join(__dirname, "..", "src", "version.ts"),
  versionFileContent,
  "utf-8"
);

console.log(`✓ Version synced: ${packageJson.version}`);
