import {
  PaymentApi,
  PaymentFailureCode,
  PaymentProviderEnum,
  SimplePaymentStatus,
} from "@munchi_oy/core";
import type { AxiosInstance } from "axios";
import { MunchiPaymentSDK } from "../../src/MunchiPaymentSDK";
import {
  PaymentInteractionState,
  SdkPaymentStatus,
  type IMessagingAdapter,
  type PaymentTerminalConfig,
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
    PaymentApi: jest.fn(),
  };
});

describe("MunchiPaymentSDK Verify Retry Logic", () => {
  let mockAxios: jest.Mocked<AxiosInstance>;
  let mockMessaging: jest.Mocked<IMessagingAdapter>;
  let mockConfig: PaymentTerminalConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios = createMockAxios();
    mockMessaging = createMockMessaging();
    mockConfig = createMockConfig();
  });

  const flushPromises = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  };

  it("should remain in REQUIRES_INPUT state during retries and eventually SUCCESS", async () => {
    jest.useFakeTimers();
    try {
      const orderRef = "order-retry-success";
      const sessionId = "session-retry-success";
      const successResponse = { 
        data: { 
          status: SimplePaymentStatus.Success, 
          transactionId: sessionId,
          orderId: orderRef,
          transaction: { amount: 1200 }
        }
      };

      let verifyCallCount = 0;

      const mockGetPaymentStatus = jest.fn().mockImplementation(async () => {
        verifyCallCount++;
        if (verifyCallCount === 1) {
             return new Promise(() => {}); // Attempt 1 Hangs
        }
        if (verifyCallCount === 2) {
             await new Promise(resolve => setTimeout(resolve, 500));
             return successResponse;
        }
        return { data: { status: SimplePaymentStatus.Pending, transactionId: sessionId } };
      });

      (PaymentApi as jest.Mock).mockImplementation(() => ({
        initiateTerminalTransaction: jest.fn().mockResolvedValue({ 
          data: { sessionId, orderId: orderRef } 
        }),
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
        getPaymentStatus: mockGetPaymentStatus,
      }));

      mockMessaging.subscribe.mockReturnValue(jest.fn());

      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
        timeoutMs: 5000,
      });

      const txPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1200,
        currency: "EUR",
        displayId: "display-retry-success",
      });

      await flushPromises();
      expect(sdk.currentState).toBe(PaymentInteractionState.REQUIRES_INPUT);

      // 1. SDK timeout fires at 5s (before VivaStrategy's 10s polling start)
      jest.advanceTimersByTime(5000);
      await flushPromises();

      // SDK stays in REQUIRES_INPUT (no VERIFYING transition on timeout)
      expect(sdk.currentState).toBe(PaymentInteractionState.REQUIRES_INPUT);

      // 2. Verify Attempt 1 hangs -> 10s verify timeout
      jest.advanceTimersByTime(10000);
      await flushPromises();

      expect(sdk.currentState).toBe(PaymentInteractionState.REQUIRES_INPUT);

      // 3. Verify Attempt 2 resolves after 500ms delay
      jest.advanceTimersByTime(501);
      await flushPromises();

      expect(sdk.currentState).toBe(PaymentInteractionState.SUCCESS);

      const result = await txPromise;
      expect(result.success).toBe(true);
      expect(result.status).toBe(SdkPaymentStatus.SUCCESS);
      
    } finally {
      jest.useRealTimers();
    }
  }, 10000);

  it("should remain in REQUIRES_INPUT state during retries and eventually FAIL", async () => {
    jest.useFakeTimers();
    try {
      const orderRef = "order-retry-fail";
      const sessionId = "session-retry-fail";
      const failResponse = { 
        data: { 
          status: SimplePaymentStatus.Failed,
          transactionId: sessionId,
          orderId: orderRef,
          error: { code: "some.error", message: "Declined" }
        }
      };

      let verifyCallCount = 0;

      const mockGetPaymentStatus = jest.fn().mockImplementation(async () => {
        verifyCallCount++;
        if (verifyCallCount === 1) {
             return new Promise(() => {}); // Attempt 1 Hangs
        }
        if (verifyCallCount === 2) {
             await new Promise(resolve => setTimeout(resolve, 500));
             return failResponse;
        }
        return { data: { status: SimplePaymentStatus.Pending, transactionId: sessionId } };
      });

      (PaymentApi as jest.Mock).mockImplementation(() => ({
        initiateTerminalTransaction: jest.fn().mockResolvedValue({ 
          data: { sessionId, orderId: orderRef } 
        }),
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
        getPaymentStatus: mockGetPaymentStatus,
      }));

      mockMessaging.subscribe.mockReturnValue(jest.fn());

      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
        timeoutMs: 5000,
      });

      const txPromise = sdk.initiateTransaction({
        orderRef,
        amountCents: 1200,
        currency: "EUR",
        displayId: "display-retry-fail",
      });

      await flushPromises();
      expect(sdk.currentState).toBe(PaymentInteractionState.REQUIRES_INPUT);

      // 1. SDK timeout fires at 5s (before VivaStrategy's 10s polling start)
      jest.advanceTimersByTime(5000);
      await flushPromises();

      expect(sdk.currentState).toBe(PaymentInteractionState.REQUIRES_INPUT);

      // 2. Verify Attempt 1 hangs -> 10s verify timeout
      jest.advanceTimersByTime(10000);
      await flushPromises();

      expect(sdk.currentState).toBe(PaymentInteractionState.REQUIRES_INPUT);

      // 3. Verify Attempt 2 resolves after 500ms delay with fail
      jest.advanceTimersByTime(501);
      await flushPromises();

      expect(sdk.currentState).toBe(PaymentInteractionState.FAILED);

      const result = await txPromise;
      expect(result.success).toBe(false);
      
    } finally {
      jest.useRealTimers();
    }
  }, 10000);
});
