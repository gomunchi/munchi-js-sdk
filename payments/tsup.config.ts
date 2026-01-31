import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  splitting: false,
  minify: true,
  sourcemap: false,
  external: [
    // Don't bundle dependencies - let the consuming project install them
    "@munchi/core",
    "axios",
  ],
});
