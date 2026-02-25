import {
  PaymentApi,
  PaymentFailureCode,
  PaymentProviderEnum,
  SimplePaymentStatus,
} from "@munchi_oy/core";
import type { AxiosInstance } from "axios";
import { MunchiPaymentSDK } from "../../src/MunchiPaymentSDK";
import {
  type IMessagingAdapter,
  PaymentInteractionState,
  type PaymentTerminalConfig,
  SdkPaymentStatus,
} from "../../src/types/payment";
import {
  createMockAxios,
  createMockConfig,
  createMockMessaging,
} from "../helpers/fixtures";

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

describe("MunchiPaymentSDK Hanging Scenarios", () => {
  let mockAxios: jest.Mocked<AxiosInstance>;
  let mockMessaging: jest.Mocked<IMessagingAdapter>;
  let mockConfig: PaymentTerminalConfig;

  const waitForState = (
    sdk: MunchiPaymentSDK,
    targetState: PaymentInteractionState,
  ) =>
    new Promise<void>((resolve) => {
      let unsubscribe = () => {};
      unsubscribe = sdk.subscribe((state) => {
        if (state === targetState) {
          unsubscribe();
          resolve();
        }
      });
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios = createMockAxios();
    mockMessaging = createMockMessaging();
    mockConfig = createMockConfig();
  });

  it("should remain pending in VERIFYING when verifyFinalStatus never resolves after cancel (repro)", async () => {
    jest.useFakeTimers();
    try {
      const orderRef = "order-timeout-verify-hang";
      const sessionId = "session-timeout-verify-hang";

      const mockGetPaymentStatus = jest.fn(() => new Promise(() => {}));

      (PaymentApi as jest.Mock).mockImplementation(() => ({
        initiateTerminalTransaction: jest
          .fn()
          .mockResolvedValue({ data: { sessionId, orderId: orderRef } }),
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
        getPaymentStatus: mockGetPaymentStatus,
      }));

      mockMessaging.subscribe.mockReturnValue(jest.fn());

      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
        timeoutMs: 60000,
      });

      let settled = false;
      const txPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1200,
        currency: "EUR",
        displayId: "display-verify-hang",
      });

      txPromise.finally(() => {
        settled = true;
      });

      await waitForState(sdk, PaymentInteractionState.REQUIRES_INPUT);
      await sdk.cancel();
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();

      expect(sdk.currentState).toBe(PaymentInteractionState.VERIFYING);
      expect(mockGetPaymentStatus).toHaveBeenCalled();
      expect(settled).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it("should remain pending if polling never resolves and timeout triggers verifyFinalStatus (repro)", async () => {
    jest.useFakeTimers();
    try {
      const orderRef = "order-timeout-poll-hang";
      const sessionId = "session-timeout-poll-hang";

      const mockGetPaymentStatus = jest.fn(() => new Promise(() => {}));

      (PaymentApi as jest.Mock).mockImplementation(() => ({
        initiateTerminalTransaction: jest
          .fn()
          .mockResolvedValue({ data: { sessionId, orderId: orderRef } }),
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
        getPaymentStatus: mockGetPaymentStatus,
      }));

      mockMessaging.subscribe.mockReturnValue(jest.fn());

      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
        timeoutMs: 20000,
      });

      let settled = false;
      const txPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1200,
        currency: "EUR",
        displayId: "display-poll-hang",
      });

      txPromise.finally(() => {
        settled = true;
      });

      // Trigger VivaStrategy polling (waitForPaymentCompletion timeout is 10s)
      await jest.advanceTimersByTimeAsync(11000);
      expect(mockGetPaymentStatus).toHaveBeenCalled();

      // Trigger SDK timeout (20s total)
      await jest.advanceTimersByTimeAsync(9000);
      await Promise.resolve();

      expect(sdk.currentState).toBe(PaymentInteractionState.REQUIRES_INPUT);
      expect(settled).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it("should leave cancel() pending if cancelVivaTransactionV2 never resolves (repro)", async () => {
    jest.useFakeTimers();
    try {
      const orderRef = "order-cancel-hang";
      const sessionId = "session-cancel-hang";

      const mockGetPaymentStatus = jest.fn().mockResolvedValue({
        data: {
          status: SimplePaymentStatus.Failed,
          orderId: orderRef,
        },
      });

      (PaymentApi as jest.Mock).mockImplementation(() => ({
        initiateTerminalTransaction: jest
          .fn()
          .mockResolvedValue({ data: { sessionId, orderId: orderRef } }),
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn(() => new Promise(() => {})),
        getPaymentStatus: mockGetPaymentStatus,
      }));

      mockMessaging.subscribe.mockReturnValue(jest.fn());

      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);

      const txPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1200,
        currency: "EUR",
        displayId: "display-cancel-hang",
      });

      await waitForState(sdk, PaymentInteractionState.REQUIRES_INPUT);

      let cancelSettled = false;
      const cancelPromise = sdk.cancel();
      cancelPromise.finally(() => {
        cancelSettled = true;
      });

      // 1. Trigger VivaStrategy polling (waits 10s)
      await jest.advanceTimersByTimeAsync(11000);

      const txResult = await txPromise;
      expect(txResult.status).toBe(SdkPaymentStatus.CANCELLED);
      expect(sdk.currentState).toBe(PaymentInteractionState.FAILED);
      expect(cancelSettled).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it("should return a timeout error if initiateTerminalTransaction never resolves", async () => {
    jest.useFakeTimers();
    try {
      const orderRef = "order-initiate-hang";

      (PaymentApi as jest.Mock).mockImplementation(() => ({
        initiateTerminalTransaction: jest.fn(() => new Promise(() => {})),
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn(),
        getPaymentStatus: jest.fn(),
      }));

      mockMessaging.subscribe.mockReturnValue(jest.fn());

      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
        timeoutMs: 1000,
      });

      const txPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1200,
        currency: "EUR",
        displayId: "display-initiate-hang",
      });

      await jest.advanceTimersByTimeAsync(1000);
      const result = await txPromise;

      expect(result.status).toBe(SdkPaymentStatus.ERROR);
      expect(result.errorCode).toBe(PaymentFailureCode.TerminalTimeout);
      expect(sdk.currentState).toBe(PaymentInteractionState.FAILED);
    } finally {
      jest.useRealTimers();
    }
  });

  it("should recover to FAILED when init succeeds but no messaging and no polling response (production repro)", async () => {
    jest.useFakeTimers();
    try {
      const orderRef = "order-no-response";
      const sessionId = "session-no-response";

      const mockGetPaymentStatus = jest.fn(() => new Promise(() => {}));

      (PaymentApi as jest.Mock).mockImplementation(() => ({
        initiateTerminalTransaction: jest
          .fn()
          .mockResolvedValue({ data: { sessionId, orderId: orderRef } }),
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
        getPaymentStatus: mockGetPaymentStatus,
      }));

      mockMessaging.subscribe.mockReturnValue(jest.fn());

      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
        timeoutMs: 30000,
      });

      const states: PaymentInteractionState[] = [];
      sdk.subscribe((s) => states.push(s));

      let settled = false;
      const txPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1200,
        currency: "EUR",
        displayId: "display-no-response",
      });

      txPromise.then(() => {
        settled = true;
      });

      await waitForState(sdk, PaymentInteractionState.REQUIRES_INPUT);

      expect(states).toContain(PaymentInteractionState.CONNECTING);
      expect(states).toContain(PaymentInteractionState.REQUIRES_INPUT);

      // Phase 1: 10s passes — VivaStrategy starts polling (no Ably message received)
      await jest.advanceTimersByTimeAsync(10000);
      expect(mockGetPaymentStatus).toHaveBeenCalled();
      expect(sdk.currentState).toBe(PaymentInteractionState.REQUIRES_INPUT);
      expect(settled).toBe(false);

      // Phase 2: SDK timeout fires at 30s — enters VERIFYING, starts verifyWithRetry
      await jest.advanceTimersByTimeAsync(20000);
      await Promise.resolve();
      await Promise.resolve();

      expect(sdk.currentState).toBe(PaymentInteractionState.REQUIRES_INPUT);
      expect(states).toContain(PaymentInteractionState.REQUIRES_INPUT);

      // Phase 3: verifyWithRetry retries 3x with 10s timeout each
      // plus 2 retry delays of 1500ms each = 33s max
      await jest.advanceTimersByTimeAsync(33000);
      await Promise.resolve();
      await Promise.resolve();

      // FIX VERIFICATION: SDK recovers to FAILED instead of hanging forever
      expect(sdk.currentState).toBe(PaymentInteractionState.FAILED);
      expect(settled).toBe(true);

      const result = await txPromise;
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(PaymentFailureCode.PaymentTimeout);
    } finally {
      jest.useRealTimers();
    }
  });

  it("should return payment.unknown when verifyFinalStatus fails with non-timeout errors", async () => {
    jest.useFakeTimers();
    try {
      const orderRef = "order-unknown-error";
      const sessionId = "session-unknown-error";

      const mockGetPaymentStatus = jest.fn()
        .mockRejectedValue(new Error("500 Internal Server Error"));

      (PaymentApi as jest.Mock).mockImplementation(() => ({
        initiateTerminalTransaction: jest
          .fn()
          .mockResolvedValue({ data: { sessionId, orderId: orderRef } }),
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
        getPaymentStatus: mockGetPaymentStatus,
      }));

      mockMessaging.subscribe.mockReturnValue(jest.fn());

      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
        timeoutMs: 30000,
      });

      const txPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1200,
        currency: "EUR",
        displayId: "display-unknown-error",
      });

      await waitForState(sdk, PaymentInteractionState.REQUIRES_INPUT);

      // Advance past VivaStrategy 10s wait + SDK 30s timeout
      await jest.advanceTimersByTimeAsync(30000);
      await Promise.resolve();
      await Promise.resolve();

      // verifyWithRetry attempts all fail immediately (rejected, not timed out)
      // but now waits for 2 retry delays of 1500ms each before final failure.
      await jest.advanceTimersByTimeAsync(3000);
      await Promise.resolve();
      await Promise.resolve();

      expect(sdk.currentState).toBe(PaymentInteractionState.FAILED);

      const result = await txPromise;
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(PaymentFailureCode.PaymentUnknown);
      expect(result.errorMessage).toBe("Failed to verify final transaction status");
    } finally {
      jest.useRealTimers();
    }
  });

  it("should stop polling after SDK timeout and failure", async () => {
    jest.useFakeTimers();
    try {
      const orderRef = "order-stop-polling";
      const sessionId = "session-stop-polling";

      // Mock getPaymentStatus to always return Pending (simulate infinite polling)
      const mockGetPaymentStatus = jest.fn().mockResolvedValue({
        data: {
          status: SimplePaymentStatus.Pending,
          paymentMethod: PaymentProviderEnum.Viva,
          transactionId: sessionId,
        },
      });

      (PaymentApi as jest.Mock).mockImplementation(() => ({
        initiateTerminalTransaction: jest
          .fn()
          .mockResolvedValue({ data: { sessionId, orderId: orderRef } }),
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
        getPaymentStatus: mockGetPaymentStatus,
      }));

      mockMessaging.subscribe.mockReturnValue(jest.fn());

      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
        timeoutMs: 30000,
      });

      const txPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1200,
        currency: "EUR",
        displayId: "display-stop-polling",
      });

      await waitForState(sdk, PaymentInteractionState.REQUIRES_INPUT);

      // 1. Advance 10s -> Start polling
      await jest.advanceTimersByTimeAsync(10000);
      expect(mockGetPaymentStatus).toHaveBeenCalled();

      // 2. Advance 30s -> SDK timeout -> VerifyWithRetry starts
      await jest.advanceTimersByTimeAsync(30000);
      await Promise.resolve();

      // 3. Advance 30s -> Verify retries exhaust -> FAILED
      await jest.advanceTimersByTimeAsync(30000);
      await Promise.resolve();
      await Promise.resolve();

      expect(sdk.currentState).toBe(PaymentInteractionState.FAILED);

      // Reset mock to check if it's still being called
      mockGetPaymentStatus.mockClear();

      // 4. Advance another 60s (VivaStrategy polling loop would normally continue for 120s total)
      // If abort() works, this should NOT trigger any new calls
      await jest.advanceTimersByTimeAsync(60000);

      expect(mockGetPaymentStatus).not.toHaveBeenCalled();

      try {
        await txPromise;
      } catch (_e) {
        // Ignore expected failure
      }
    } finally {
      jest.useRealTimers();
    }
  });
});
