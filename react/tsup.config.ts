import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  splitting: false,
  minify: true,
  external: ["react", "react-native", "@munchi/core", "@munchi/payments"],
});
