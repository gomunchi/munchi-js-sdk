import {
  CurrencyCode,
  PaymentFailureCode
} from "@munchi_oy/core";
import type { AxiosInstance } from "axios";
import {
  PaymentErrorCode,
  PaymentSDKError,
} from "../../src/error";
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

// Mock dependencies
jest.mock("@munchi_oy/core", () => {
  const actual = jest.requireActual("@munchi_oy/core");
  return {
    ...actual,
    PaymentApi: jest.fn(),
  };
});

describe("MunchiPaymentSDK Fixes Verification", () => {
  let sdk: MunchiPaymentSDK;
  let mockAxios: jest.Mocked<AxiosInstance>;
  let mockMessaging: jest.Mocked<IMessagingAdapter>;
  let config: PaymentTerminalConfig;
  let mockProcessPayment: jest.Mock;
  let mockVerifyFinalStatus: jest.Mock;

  const mockStrategy = {
    processPayment: jest.fn(),
    abort: jest.fn(),
    verifyFinalStatus: jest.fn(),
    cancelTransaction: jest.fn(),
    refundTransaction: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockAxios = createMockAxios();
    mockMessaging = createMockMessaging();
    config = createMockConfig();
    
    mockProcessPayment = jest.fn();
    mockVerifyFinalStatus = jest.fn();
    mockStrategy.processPayment = mockProcessPayment;
    mockStrategy.verifyFinalStatus = mockVerifyFinalStatus;

    // We hack the SDK to inject our mock strategy by overriding resolveStrategy
    // Since resolveStrategy is private, we can subclass or just cast to any
    sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, config);
    (sdk as any).strategy = mockStrategy;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe("Fix 4: Prevent VERIFYING transition on polling timeout", () => {
    it("should transition directly to FAILED on timeout error", async () => {
      // Setup: strategy throws Timeout error immediately (or simulating after delay)
      mockProcessPayment.mockImplementation(async () => {
        throw new PaymentSDKError(PaymentErrorCode.TIMEOUT, "Simulated Timeout");
      });

      const onVerifying = jest.fn();
      const onError = jest.fn();
      const onRequiresInput = jest.fn();

      const txPromise = sdk.initiateTransaction(
        {
          orderRef: "order-timeout-fix",
          amountCents: 1000,
          currency: CurrencyCode.Eur,
          displayId: "Display-1",
        },
        { onVerifying, onError, onRequiresInput },
      );

      // We don't need to advance timers if processPayment throws immediately, 
      // but if we were simulating delay we would.
      await txPromise;

      // Assertions
      expect(onVerifying).not.toHaveBeenCalled();
      
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        status: SdkPaymentStatus.ERROR,
        errorCode: PaymentFailureCode.TerminalTimeout // Normalized from 'TIMEOUT'
      }));
      
      expect(sdk.currentState).toBe(PaymentInteractionState.FAILED);
    });

    it("should transition directly to FAILED on SDK-level timeout", async () => {
      // Setup: strategy assumes polling hangs forever
      mockProcessPayment.mockImplementation(async () => {
        return new Promise(() => {}); // Never resolves
      });

      // Set a short timeout for the SDK
      (sdk as any).timeoutMs = 5000; 

      const onVerifying = jest.fn();
      const onError = jest.fn();

      const txPromise = sdk.initiateTransaction(
        {
          orderRef: "order-sdk-timeout",
          amountCents: 1000,
          currency: CurrencyCode.Eur,
          displayId: "Display-2",
        },
        { onVerifying, onError },
      );

      // Fast forward past the SDK timeout
      jest.advanceTimersByTime(5001);

      await txPromise;

      // Assertions
      expect(onVerifying).not.toHaveBeenCalled();
      
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        status: SdkPaymentStatus.ERROR,
        errorCode: PaymentFailureCode.TerminalTimeout
      }));

      expect(sdk.currentState).toBe(PaymentInteractionState.FAILED);
    });
  });

  // Note: Fix 5 (Empty Error Code) is in VivaStrategy, so we can't verify it 
  // with a mocked strategy easily unless we instantiate VivaStrategy directly 
  // or setup the full SDK with VivaStrategy. 
  // Since we modified VivaStrategy.ts directly, unit testing VivaStrategy is better.
});
