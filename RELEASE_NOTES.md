# Release Notes - v1.0.18

This release addresses critical build and resolution issues for the root `@munchi/sdk` package.

## 🐛 Bug Fixes

### Fixed Root Package Resolution (`InternalError Metro has encountered an error`)
- **Added Root Build Configuration:** The root package `@munchi/sdk` now includes a `tsup` configuration to properly build and bundle the entry point into `dist/index.js`.
- **Updated `package.json`:** configured headers (`main`, `module`, `types`) to correctly point to the generated `dist` files instead of non-existent files.
- **Strictness Adjustment:** Relaxed `exactOptionalPropertyTypes` in the root configuration to allow successful bundling of generated core definitions.

This ensures that consumers installing the root package will find the expected `index.js` entry point, resolving the "module could not be resolved" errors in Metro/React Native.
