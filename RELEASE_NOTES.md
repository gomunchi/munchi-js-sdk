# Release Notes - v1.0.24

This release improves type flexibility and fixes export duplications.

## 🐛 Bug Fixes

### Fixed Type Compatibility
- **Nullable Provider:** `PaymentTerminalConfig` now accepts `null` for the `provider` field, accommodating API responses that may return null values.
- **Duplicate Types:** Refined module exports to prevent `PaymentInteractionState` and other types from being duplicated in the build output, resolving strict type checking errors.

**Upgrade Instructions:**
Update to `v1.0.24` and run `pnpm install`.
