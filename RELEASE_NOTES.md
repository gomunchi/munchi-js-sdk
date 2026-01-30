# Release Notes - v1.0.23

This release resolves type compatibility issues and introduces new state management capabilities for React/React Native.

## 🐛 Bug Fixes

### Fixed `Type 'MunchiPaymentSDK$1' is not assignable to type 'MunchiPaymentSDK'`
- **Refactored to Interface-Based Typing:** The SDK and `SdkContainer` now rely on the `IMunchiPaymentSDK` interface instead of the concrete class. This resolves nominal typing conflicts caused by bundler-generated duplicates (`MunchiPaymentSDK$1`), ensuring smooth type resolution in your application.

## ✨ New Features

### Exposed SDK State
- **`currentState` Property:** The `IMunchiPaymentSDK` interface now includes a readonly `currentState` property (e.g., `IDLE`, `CONNECTING`, `PROCESSING`), allowing synchronous access to the SDK's status.
- **`usePaymentState()` Hook:** Added a new React hook `@munchi/react/usePaymentState` that automatically subscribes to SDK state changes.
  ```typescript
  import { usePaymentState, PaymentInteractionState } from '@munchi/react';

  const MyComponent = () => {
    const status = usePaymentState();

    if (status === PaymentInteractionState.PROCESSING) {
       return <Spinner />;
    }
    return <View />;
  }
  ```

**Upgrade Instructions:**
Update to `v1.0.22` and run `pnpm install`.
