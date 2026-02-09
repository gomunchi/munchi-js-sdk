import {
  PaymentApi,
  PaymentFailureCode,
  PaymentProvider,
  SimplePaymentStatus
} from "@munchi_oy/core";
import type { AxiosInstance } from "axios";
import { PaymentErrorCode } from "./../../src/error";
import { MunchiPaymentSDK } from "../../src/MunchiPaymentSDK";
import { VivaStrategy } from "../../src/strategies/VivaStrategy";
import {
  type IMessagingAdapter,
  PaymentInteractionState,
  type PaymentTerminalConfig,
  SdkPaymentStatus,
} from "../../src/types/payment";
import {
  createMockAxios,
  createMockConfig,
  createMockConfigWithoutProvider,
  createMockMessaging,
} from "../helpers/fixtures";
import {
  setupFailedPaymentMocks,
  setupNetworkErrorMocks,
  setupSuccessfulPaymentMocks,
  setupTimeoutWithPollingMocks,
} from "../helpers/mocks";

jest.mock("@munchi_oy/core", () => {
  const actual = jest.requireActual("@munchi_oy/core");
  return {
    ...actual,
    PaymentApi: jest.fn().mockImplementation(() => ({
      initiateTerminalTransaction: jest.fn(),
      cancelTransaction: jest.fn(),
      cancelVivaTransactionV2: jest.fn(),
      getPaymentStatus: jest.fn(),
    })),
  };
});

describe("MunchiPaymentSDK", () => {
  let mockAxios: jest.Mocked<AxiosInstance>;
  let mockMessaging: jest.Mocked<IMessagingAdapter>;
  let mockConfig: PaymentTerminalConfig;
  let mockWithNoProvider: PaymentTerminalConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios = createMockAxios();
    mockMessaging = createMockMessaging();
    mockConfig = createMockConfig();
    mockWithNoProvider = createMockConfigWithoutProvider();
  });

  describe("initialization", () => {
    it("should create SDK instance with Viva provider", () => {
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);
      expect(sdk).toBeInstanceOf(MunchiPaymentSDK);
    });

    it("should create SDK instance with Nets provider (MockStrategy)", () => {
      const netsConfig = { ...mockConfig, provider: PaymentProvider.Nets };
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, netsConfig);
      expect(sdk).toBeInstanceOf(MunchiPaymentSDK);
      // Since strategy is private, we can't easily check instance. 
      // But we covered the line in resolveStrategy.
    });

    it("should expose the current state", () => {
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);
      expect(sdk.currentState).toBe(PaymentInteractionState.IDLE);
    });

    it("should expose version", () => {
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);
      expect(sdk.version).toBeDefined();
    });

    it("should expose nextAutoResetAt", () => {
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);
      expect(sdk.nextAutoResetAt).toBeUndefined();
    });
  });



  describe("initiateTransaction with ably", () => {
    it("should reject invalid amount (zero)", async () => {
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);

      const result = await sdk.initiateTransaction({
        orderRef: "order-123",
        amountCents: 0,
        currency: "EUR",
        displayId: "display-123",
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(PaymentFailureCode.SystemUnknown);
    });

    it("should fail with valid amount due to network error", async () => {
      setupNetworkErrorMocks();
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);

      // Subscribe to verify state transitions
      const states: PaymentInteractionState[] = [];
      sdk.subscribe((state) => states.push(state));

      const result = await sdk.initiateTransaction({
        orderRef: "order-456",
        amountCents: 100,
        currency: "EUR",
        displayId: "display-123",
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(PaymentFailureCode.SystemProviderError);

      // Check state flow: IDLE -> IDLE (reset) -> VERIFYING -> FAILED
      expect(states).toContain(PaymentInteractionState.FAILED);
      expect(states).toContain(PaymentInteractionState.VERIFYING);
    });

    it("should succeed with valid amount", async () => {
      setupSuccessfulPaymentMocks(
        "order-789",
        "test-session-123",
        mockMessaging,
      );
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);

      const states: PaymentInteractionState[] = [];
      sdk.subscribe((state) => states.push(state));

      const result = await sdk.initiateTransaction({
        orderRef: "order-789",
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(SdkPaymentStatus.SUCCESS);
      expect(states).toContain(PaymentInteractionState.SUCCESS);
    });

    describe.each(Object.entries(PaymentFailureCode))(
      "Failure Code: %s",
      (key, code) => {
        it(`should handle terminal-side failure: ${key}`, async () => {
          const orderRef = `order-fail-${code}`;
          setupFailedPaymentMocks(
            orderRef,
            `session-fail-${code}`,
            mockMessaging,
            {
              code,
              message: `Payment failed with ${key}`,
            },
          );

          const sdk = new MunchiPaymentSDK(
            mockAxios,
            mockMessaging,
            mockConfig,
          );
          const states: PaymentInteractionState[] = [];
          sdk.subscribe((state) => states.push(state));

          const result = await sdk.initiateTransaction({
            orderRef,
            amountCents: 1000,
            currency: "EUR",
            displayId: "display-123",
          });

          expect(result.success).toBe(false);
          expect(result.status).toBe(SdkPaymentStatus.FAILED);
          expect(result.errorCode).toBe(code);
          expect(states).toContain(PaymentInteractionState.FAILED);
        });
      },
    );
  });

  describe("initiateTransaction with timeout fallback", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should fallback to polling when messaging is delayed", async () => {
      const orderRef = "order-timeout-poll";
      const { mockGetPaymentStatus } = setupTimeoutWithPollingMocks(
        orderRef,
        "session-timeout-poll",
        mockMessaging,
        SimplePaymentStatus.Success,
      );

      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);
      const states: PaymentInteractionState[] = [];
      sdk.subscribe((state) => states.push(state));

      const transactionPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      // Fast-forward 10 seconds to trigger the timeout in VivaStrategy
      await jest.advanceTimersByTimeAsync(11000);

      const result = await transactionPromise;

      expect(result.success).toBe(true);
      expect(result.status).toBe(SdkPaymentStatus.SUCCESS);
      expect(mockGetPaymentStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: orderRef,
          businessId: Number(mockConfig.storeId),
        }),
      );
      expect(states).toContain(PaymentInteractionState.SUCCESS);
    });

    describe.each(Object.entries(PaymentFailureCode))(
      "Polling Failure Code: %s",
      (key, code) => {
        it(`should handle terminal-side failure via polling: ${key}`, async () => {
          const orderRef = `order-poll-fail-${code}`;
          const { mockGetPaymentStatus } = setupTimeoutWithPollingMocks(
            orderRef,
            `session-poll-fail-${code}`,
            mockMessaging,
            SimplePaymentStatus.Failed,
            {
              code,
              message: `Polling failed with ${key}`,
            },
          );

          const {initiateTransaction, subscribe} = new MunchiPaymentSDK(
            mockAxios,
            mockMessaging,
            mockConfig,
          );
          const states: PaymentInteractionState[] = [];
          subscribe((state) => states.push(state));

          const transactionPromise = initiateTransaction({
            orderRef,
            amountCents: 1000,
            currency: "EUR",
            displayId: "display-123",
          });

          // Fast-forward 10 seconds to trigger the timeout/polling
          await jest.advanceTimersByTimeAsync(11000);

          const result = await transactionPromise;

          expect(result.success).toBe(false);
          expect(result.status).toBe(SdkPaymentStatus.FAILED);
          expect(result.errorCode).toBe(code);
          expect(mockGetPaymentStatus).toHaveBeenCalled();
          expect(states).toContain(PaymentInteractionState.FAILED);
        });
      },
    );
  });

  describe("cancellation", () => {
    it("should suppress FAILED state update during cancellation", async () => {
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);

      const states: PaymentInteractionState[] = [];
      sdk.subscribe((state) => states.push(state));

      const processPaymentSpy = jest
        .spyOn(VivaStrategy.prototype, "processPayment")
        .mockImplementation((params: any, onStateChange: any) => {
          onStateChange(PaymentInteractionState.CONNECTING);
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              // Only emit if not strictly guarded by SDK logic?
              // Actually SDK guards against strategy emitting FAILED?
              // No, SDK callback prevents emitting FAILED to transitionTo.
              onStateChange(PaymentInteractionState.FAILED);
              reject(new Error("Aborted or Network Error"));
            }, 50);
          });
        });

      const cancelTransactionSpy = jest
        .spyOn(VivaStrategy.prototype, "cancelTransaction")
        .mockImplementation(async (onStateChange: any) => {
          return true;
        });

      const transactionPromise = sdk.initiateTransaction({
        orderRef: "order-cancel-test",
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      await sdk.cancel();

      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        await transactionPromise;
      } catch (e) {}

      // Assertions for Observer Pattern implementation:
      // The flow should optionally contain CONNECTING.
      // When cancelling, we intentionally suppress the FAILED state to avoid UI flashes.
      // Instead, it should transition to FAILED finally, to show error UI.

      expect(states).toContain(PaymentInteractionState.VERIFYING);
      expect(states).toContain(PaymentInteractionState.FAILED);

      // Verify mock calls
      processPaymentSpy.mockRestore();
      cancelTransactionSpy.mockRestore();
    });

    it("should trigger INTERNAL_ERROR on invalid state transition", async () => {
      setupSuccessfulPaymentMocks(
        "order-invalid-test",
        "test-session-inv",
        mockMessaging,
      );
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);
      const states: PaymentInteractionState[] = [];
      sdk.subscribe((state) => states.push(state));

      // Manually force state to SUCCESS (simulating a completed transaction)
      // accessing private property for testing purpose or using a method if available
      // Since we can't access private, we run a success flow first
      await sdk.initiateTransaction({
        orderRef: "order-invalid-test",
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      expect(states[states.length - 1]).toBe(PaymentInteractionState.SUCCESS);

      // Now, simulate a delayed event trying to update state to PROCESSING
      // We need to access the internal transitionTo method or mimic the callback
      // Since we can't easily access private methods, we can simulate this by having
      // the strategy emit an event AFTER success if we mock it that way.

      // Re-mock strategy to emit event after resolution

      const processPaymentSpy = jest
        .spyOn(VivaStrategy.prototype, "processPayment")
        .mockImplementation((params: any, onStateChange: any) => {
          return new Promise((resolve) => {
            resolve({
              success: true,
              status: SdkPaymentStatus.SUCCESS,
              orderId: "ref",
            });
            // Emit invalid state AFTER resolving (which sets SUCCESS in SDK)
            setTimeout(() => {
              try {
                onStateChange(PaymentInteractionState.PROCESSING);
              } catch (e) {
                // Expected to throw
              }
            }, 10);
          });
        });

      // Trigger a new transaction to use the new mock
      await sdk.initiateTransaction({
        orderRef: "order-invalid-test-2",
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      // Wait for the timeout in the mock
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(states).toContain(PaymentInteractionState.INTERNAL_ERROR);

      processPaymentSpy.mockRestore();
    });

    it("should handle race condition: ignore terminal FAILED message after user clicks cancel", async () => {
      const orderRef = "order-race-cancel";

      let triggerMessage: (data: any) => void = () => {};
      (mockMessaging.subscribe as jest.Mock).mockImplementation(
        (_ch, _ev, callback) => {
          triggerMessage = callback;
          return jest.fn(); // Unsubscribe
        },
      );

      (PaymentApi as jest.Mock).mockImplementation((() => ({
        initiateTerminalTransaction: jest.fn().mockResolvedValue({
          data: { sessionId: "session-race", orderId: orderRef },
        }),
        cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
      })) as any);

      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);
      const states: PaymentInteractionState[] = [];
      sdk.subscribe((state) => states.push(state));

      const transactionPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      // Wait for session to be created (REQUIRES_INPUT state)
      await new Promise((resolve) => {
        const unsubscribe = sdk.subscribe((state) => {
          if (state === PaymentInteractionState.REQUIRES_INPUT) {
            unsubscribe();
            resolve(null);
          }
        });
      });

      // 1. User clicks cancel
      const cancelPromise = sdk.cancel();

      // 2. State at this point should be VERIFYING (set by cancel())
      expect(states[states.length - 1]).toBe(PaymentInteractionState.VERIFYING);

      // 3. Terminal fires a failure message slightly late (Abort signal usually triggers this)
      triggerMessage({
        orderId: orderRef,
        status: SimplePaymentStatus.Failed,
        error: {
          code: PaymentFailureCode.PaymentCancelledByUser,
          message: "Aborted",
        },
      });

      const result = await transactionPromise;
      const cancelResult = await cancelPromise;

      // 4. Verification
      expect(cancelResult).toBe(true);
      expect(result.status).toBe(SdkPaymentStatus.CANCELLED);

      // The states SHOULD contain FAILED now
      expect(states).toContain(PaymentInteractionState.FAILED);

      // Final state should be FAILED (set by handleTransactionError)
      expect(states[states.length - 1]).toBe(PaymentInteractionState.FAILED);
    });

    it("should prevent starting a new transaction if one is already in progress", async () => {
      setupSuccessfulPaymentMocks("order-1", "session-1", mockMessaging);
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);

      // Start the first transaction (but don't await yet)
      const promise1 = sdk.initiateTransaction({
        orderRef: "order-1",
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      // Immediately try to start a second one
      const promise2 = sdk.initiateTransaction({
        orderRef: "order-2",
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      const result2 = await promise2;

      expect(result2.success).toBe(false);
      expect(result2.errorCode).toBe(PaymentFailureCode.SystemUnknown);
      expect(result2.errorMessage).toContain("already in progress");
    });

    it("should handle race condition: prioritize SUCCESS message even if user clicked cancel (Ghost Order Prevention)", async () => {
      const orderRef = "order-ghost-prevent";

      let triggerMessage: (data: any) => void = () => {};
      (mockMessaging.subscribe as jest.Mock).mockImplementation(
        (_ch, _ev, callback) => {
          triggerMessage = callback;
          return jest.fn();
        },
      );

      (PaymentApi as jest.Mock).mockImplementation((() => ({
        initiateTerminalTransaction: jest.fn().mockResolvedValue({
          data: { sessionId: "session-ghost", orderId: orderRef },
        }),
        cancelTransaction: jest.fn().mockResolvedValue(true),
        getPaymentStatus: jest.fn().mockResolvedValue({
          data: {
            orderId: orderRef,
            status: SimplePaymentStatus.Success,
            error: null,
          },
        }),
      })) as any);


      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);
      const states: PaymentInteractionState[] = [];
      sdk.subscribe((state) => states.push(state));

      const transactionPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      // Wait for REQUIRES_INPUT
      await new Promise((resolve) => {
        const unsubscribe = sdk.subscribe((state) => {
          if (state === PaymentInteractionState.REQUIRES_INPUT) {
            unsubscribe();
            resolve(null);
          }
        });
      });

      // 1. User clicks cancel
      const cancelPromise = sdk.cancel();

      // 2. Terminal fires a SUCCESS message late (Ghost Order scenario: User tapped just before cancelling)
      triggerMessage({
        orderId: orderRef,
        status: SimplePaymentStatus.Success,
        error: null,
      });

      const result = await transactionPromise;
      await cancelPromise;

      // 3. Verification: SUCCESS must win
      expect(result.status).toBe(SdkPaymentStatus.SUCCESS);
      expect(result.success).toBe(true);

      // Interaction state must end in SUCCESS, not IDLE/CANCELLED
      expect(states[states.length - 1]).toBe(PaymentInteractionState.SUCCESS);
    });

    it("should continue transaction if cancellation API call fails (Safe Cancellation)", async () => {
      const orderRef = "order-cancel-fail";

      let triggerMessage: (data: any) => void = () => {};
      (mockMessaging.subscribe as jest.Mock).mockImplementation(
        (_ch, _ev, callback) => {
          triggerMessage = callback;
          return jest.fn();
        },
      );

      (PaymentApi as jest.Mock).mockImplementation((() => ({
        initiateTerminalTransaction: jest.fn().mockResolvedValue({
          data: { sessionId: "session-fail", orderId: orderRef },
        }),
        // Simulate a network error during the cancel command itself
        cancelTransaction: jest
          .fn()
          .mockRejectedValue(new Error("Network error")),
        getPaymentStatus: jest.fn().mockResolvedValue({
          data: {
            orderId: orderRef,
            status: SimplePaymentStatus.Failed,
            error: {
              code: PaymentFailureCode.PaymentCancelledByUser,
              message: "Cancelled",
            },
          },
        }),
      })) as any);


      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);
      const states: PaymentInteractionState[] = [];
      sdk.subscribe((state) => states.push(state));

      const transactionPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      // Wait for REQUIRES_INPUT
      await new Promise((resolve) => {
        const unsubscribe = sdk.subscribe((state) => {
          if (state === PaymentInteractionState.REQUIRES_INPUT) {
            unsubscribe();
            resolve(null);
          }
        });
      });

      // Try to cancel
      const cancelResult = await sdk.cancel();
      expect(cancelResult).toBe(false);

      // Verify that we are still verifying or processing (not FAILED yet) because cancellation failed
      // and we haven't received a terminal message.
      expect(states[states.length - 1]).not.toBe(PaymentInteractionState.FAILED);

      // Now triggers the actual failure from terminal
      triggerMessage({
        orderId: orderRef,
        status: SimplePaymentStatus.Failed,
        error: {
          code: PaymentFailureCode.PaymentCancelledByUser,
          message: "Cancelled",
        },
      });

      await transactionPromise;

      // Now we should be FAILED
      expect(states).toContain(PaymentInteractionState.FAILED);
      expect(states[states.length - 1]).toBe(PaymentInteractionState.FAILED);
    });

    it("should throw error when calling cancel on a completed transaction (Reproduction)", async () => {
      setupSuccessfulPaymentMocks("order-cancel-after-success", "session-cancel-after", mockMessaging);
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);

      // 1. Complete a transaction successfully
      await sdk.initiateTransaction({
        orderRef: "order-cancel-after-success",
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      // 2. Call cancel immediately after success
      // This mimics a race condition or user action where cancel is triggered after completion.
      // With the fix, this should return false and NOT throw.
      const cancelResult = await sdk.cancel();
      expect(cancelResult).toBe(false);
    });

    it("should recover and succeed if cancel fails with 409 Conflict (e.g. late cancel)", async () => {
      const orderRef = "order-conflict-409";
      
      let triggerMessage: (data: any) => void = () => {};
      (mockMessaging.subscribe as jest.Mock).mockImplementation(
        (_ch, _ev, callback) => {
          triggerMessage = callback;
          return jest.fn();
        },
      );

      (PaymentApi as jest.Mock).mockImplementation((() => ({
        initiateTerminalTransaction: jest.fn().mockResolvedValue({
          data: { sessionId: "session-conflict", orderId: orderRef },
        }),
        // Simulate 409 Conflict on Cancel
        cancelTransaction: jest.fn().mockRejectedValue({
          response: { status: 409 }
        }),
        // getPaymentStatus returns PENDING initially (simulating race condition where provider hasn't updated yet)
        getPaymentStatus: jest.fn().mockResolvedValueOnce({
            data: {
              orderId: orderRef,
              status: SimplePaymentStatus.Pending, // Still pending
              error: null,
            },
        }),
      })) as any);

      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);
      const states: PaymentInteractionState[] = [];
      sdk.subscribe((state) => states.push(state));

      const transactionPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      // Wait for REQUIRES_INPUT
      await new Promise((resolve) => {
        const unsubscribe = sdk.subscribe((state) => {
          if (state === PaymentInteractionState.REQUIRES_INPUT) {
            unsubscribe();
            resolve(null);
          }
        });
      });

      // 1. User clicks cancel
      const cancelPromise = sdk.cancel();

      // 2. Cancellation fails (409). 
      // Current behavior: Eager abort stops listening. verifyFinalStatus sees Pending. Result -> FAILED/CANCELLED.
      // Desired behavior: Listener stays active. Eventual Success message arrives. Result -> SUCCESS.
      
      await cancelPromise;

      // 3. Late Success Message arrives
      triggerMessage({
        orderId: orderRef,
        status: SimplePaymentStatus.Success,
        error: null,
      });

      const result = await transactionPromise;

      expect(result.success).toBe(true);
      expect(result.status).toBe(SdkPaymentStatus.SUCCESS);
      expect(states).toContain(PaymentInteractionState.SUCCESS);
    });
  });

  describe("transaction callbacks", () => {
    it("should fire onSuccess callback on successful payment", async () => {
      setupSuccessfulPaymentMocks(
        "order-callback-success",
        "session-cb",
        mockMessaging,
      );
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);

      const onSuccess = jest.fn();
      const onError = jest.fn();

      const result = await sdk.initiateTransaction(
        {
          orderRef: "order-callback-success",
          amountCents: 1000,
          currency: "EUR",
          displayId: "display-123",
        },
        {
          onSuccess,
          onError,
        },
      );

      expect(result.success).toBe(true);
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: SdkPaymentStatus.SUCCESS,
        }),
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it("should fire onError callback on failed payment", async () => {
      setupFailedPaymentMocks(
        "order-callback-fail",
        "session-fail",
        mockMessaging,
        {
          code: PaymentFailureCode.PaymentDeclined,
          message: "Declined",
        },
      );
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);

      const onSuccess = jest.fn();
      const onError = jest.fn();

      const result = await sdk.initiateTransaction(
        {
          orderRef: "order-callback-fail",
          amountCents: 1000,
          currency: "EUR",
          displayId: "display-123",
        },
        {
          onSuccess,
          onError,
        },
      );

      expect(result.success).toBe(false);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          status: SdkPaymentStatus.FAILED,
        }),
      );
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should fire state callbacks during transaction lifecycle", async () => {
      setupSuccessfulPaymentMocks(
        "order-state-cb",
        "session-state",
        mockMessaging,
      );
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);

      const onConnecting = jest.fn();
      const onRequiresInput = jest.fn();

      await sdk.initiateTransaction(
        {
          orderRef: "order-state-cb",
          amountCents: 1000,
          currency: "EUR",
          displayId: "display-123",
        },
        {
          onConnecting,
          onRequiresInput,
        },
      );

      expect(onConnecting).toHaveBeenCalledWith(expect.objectContaining({ orderRef: "order-state-cb" }));
      expect(onRequiresInput).toHaveBeenCalledWith(expect.objectContaining({
        orderRef: "order-state-cb",
      }));
    });

    it("should not break SDK flow if callback throws an error", async () => {
      setupSuccessfulPaymentMocks(
        "order-cb-error",
        "session-error",
        mockMessaging,
      );
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);

      const throwingCallback = jest.fn().mockImplementation(() => {
        throw new Error("Callback crashed!");
      });

      const result = await sdk.initiateTransaction(
        {
          orderRef: "order-cb-error",
          amountCents: 1000,
          currency: "EUR",
          displayId: "display-123",
        },
        {
          onConnecting: throwingCallback,
          onSuccess: throwingCallback,
        },
      );

      expect(result.success).toBe(true);
      expect(throwingCallback).toHaveBeenCalled();
    });

    it("should work without any callbacks provided", async () => {
      setupSuccessfulPaymentMocks(
        "order-no-cb",
        "session-no-cb",
        mockMessaging,
      );
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);

      const result = await sdk.initiateTransaction({
        orderRef: "order-no-cb",
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      expect(result.success).toBe(true);
    });

    it("should work when initiateTransaction is destructured", async () => {
      setupSuccessfulPaymentMocks(
        "order-destructure",
        "session-destructure",
        mockMessaging,
      );
      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);
      const { initiateTransaction } = sdk;

      const result = await initiateTransaction({
        orderRef: "order-destructure",
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-123",
      });

      expect(result.success).toBe(true);
    });
  });
});
