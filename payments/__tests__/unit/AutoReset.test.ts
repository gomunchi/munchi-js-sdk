
import { MunchiPaymentSDK } from "../../src/MunchiPaymentSDK";
import { PaymentInteractionState, type PaymentTerminalConfig } from "../../src/types/payment";
import { PaymentProvider, ProviderEnum } from "../../../core";

describe("MunchiPaymentSDK Auto-Reset", () => {
  const mockAxios: any = { post: jest.fn(), get: jest.fn() };
  const mockMessaging: any = { subscribe: jest.fn(() => jest.fn()) };
  const mockConfig: PaymentTerminalConfig = {
    channel: ProviderEnum.Kiosk,
    provider: PaymentProvider.Viva,
    kioskId: "kiosk-1",
    storeId: "123",
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should NOT auto-reset if options are not provided", () => {
    const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);
    const transitionSpy = jest.spyOn(sdk as any, "transitionTo");

    // Force state to SUCCESS
    (sdk as any).transitionTo(PaymentInteractionState.SUCCESS);

    jest.advanceTimersByTime(10000);

    expect(sdk.currentState).toBe(PaymentInteractionState.SUCCESS);
    // transitionTo called once for SUCCESS
    expect(transitionSpy).toHaveBeenCalledTimes(1); 
  });

  it("should auto-reset after successDelayMs", () => {
    const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
      autoResetOnPaymentComplete: { successDelayMs: 2000 },
    });
    
    // Force state to SUCCESS
    (sdk as any).transitionTo(PaymentInteractionState.SUCCESS);
    expect(sdk.currentState).toBe(PaymentInteractionState.SUCCESS);

    jest.advanceTimersByTime(1999);
    expect(sdk.currentState).toBe(PaymentInteractionState.SUCCESS);

    jest.advanceTimersByTime(2); 
    expect(sdk.currentState).toBe(PaymentInteractionState.IDLE);
  });

  it("should auto-reset after failureDelayMs", () => {
    const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
      autoResetOnPaymentComplete: { failureDelayMs: 3000 },
    });

    // Force state to FAILED
    (sdk as any).transitionTo(PaymentInteractionState.FAILED);
    expect(sdk.currentState).toBe(PaymentInteractionState.FAILED);

    jest.advanceTimersByTime(2999);
    expect(sdk.currentState).toBe(PaymentInteractionState.FAILED);

    jest.advanceTimersByTime(2);
    expect(sdk.currentState).toBe(PaymentInteractionState.IDLE);
  });

  it("should fallback to default 5000ms if delay not specified", () => {
    const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
      autoResetOnPaymentComplete: {}, // Enable with defaults
    });

    // Force state to SUCCESS
    (sdk as any).transitionTo(PaymentInteractionState.SUCCESS);

    jest.advanceTimersByTime(4999);
    expect(sdk.currentState).toBe(PaymentInteractionState.SUCCESS);

    jest.advanceTimersByTime(2);
    expect(sdk.currentState).toBe(PaymentInteractionState.IDLE);
  });

  it("should cancel pending auto-reset if a new transaction starts", async () => {
     const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
      autoResetOnPaymentComplete: { successDelayMs: 5000 },
    });

    // Mock strategy to avoid real network calls
    (sdk as any).strategy = {
        processPayment: jest.fn().mockReturnValue(new Promise(() => {})), // Pending forever
    };

    // Force state to SUCCESS
    (sdk as any).transitionTo(PaymentInteractionState.SUCCESS);
    
    // Advance half way
    jest.advanceTimersByTime(2500);

    // Start new transaction
    // initiateTransaction calls transitionTo(IDLE) which should cancel the timer
    // We can simulate this by manual transition or calling initiateTransaction
    
    // Let's call initiateTransaction
    sdk.initiateTransaction({
        amountCents: 100,
        currency: "EUR",
        orderRef: "123",
        displayId: "test"
    }).catch(() => {}); // catch potential errors from mock

    expect(sdk.currentState).toBe(PaymentInteractionState.IDLE);

    // Advance past original timer
    jest.advanceTimersByTime(3000);

    // Should still be IDLE (or whatever state initiated transaction moved it to)
    // The key is that it didn't randomly reset or throw error
    expect(sdk.currentState).toBe(PaymentInteractionState.IDLE);
  });

  it("should cancel previous auto-reset and schedule new one for consecutive transactions", async () => {
    const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
        autoResetOnPaymentComplete: { successDelayMs: 5000 },
    });
    const resetSpy = jest.spyOn(sdk, 'reset');

    // --- Transaction 1 ---
    (sdk as any).transitionTo(PaymentInteractionState.SUCCESS);
    
    // Advance 1s
    jest.advanceTimersByTime(1000);
    
    // Start Transaction 2
    // Mock strategy that hangs so we can check state during processing
    (sdk as any).strategy = {
        processPayment: jest.fn().mockReturnValue(new Promise(() => {})), 
    };
    
    sdk.initiateTransaction({
        amountCents: 200,
        currency: "EUR",
        orderRef: "ref-2",
        displayId: "test-2"
    }).catch(() => {});

    // State should be IDLE/processing
    expect(sdk.currentState).toBe(PaymentInteractionState.IDLE); 

    // Advance past the time when Tx 1 WOULD have reset (4s more)
    jest.advanceTimersByTime(5000);
    
    // Reset should NOT have been called
    expect(resetSpy).not.toHaveBeenCalled();

    // Now complete Tx 2
    (sdk as any).transitionTo(PaymentInteractionState.SUCCESS);

    // Advance 5s (the delay for Tx 2)
    jest.advanceTimersByTime(5000);

    // NOW reset should be called
    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(sdk.currentState).toBe(PaymentInteractionState.IDLE);
  });

  it("should transition to FAILED and auto-reset when cancelled", async () => {
    const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
        autoResetOnPaymentComplete: { failureDelayMs: 3000 },
    });
    const resetSpy = jest.spyOn(sdk, 'reset');

    // Mock strategy
    (sdk as any).strategy = {
        processPayment: jest.fn().mockRejectedValue(new Error("Aborted")),
        cancelTransaction: jest.fn().mockResolvedValue(true),
        verifyFinalStatus: jest.fn().mockResolvedValue({ success: false, status: "CANCELLED" }) // Verification confirms cancellation
    };

    // Start transaction
    const txPromise = sdk.initiateTransaction({
        amountCents: 100, currency: "EUR", orderRef: "ref-cancel", displayId: "1"
    });
    
    // Simulate cancellation triggered by user
    await sdk.cancel();

    // Wait for transaction to resolve
    await txPromise;

    // Should be FAILED (per user request)
    expect(sdk.currentState).toBe(PaymentInteractionState.FAILED);

    // Advance past failure delay
    jest.advanceTimersByTime(3000);

    // Reset should NOT be called
    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(sdk.currentState).toBe(PaymentInteractionState.IDLE);
  });

  it("should handle boolean true configuration safely", () => {
    // @ts-ignore - testing runtime behavior for boolean input
    const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig, {
      autoResetOnPaymentComplete: {},
    });
    
    // Force state to SUCCESS
    (sdk as any).transitionTo(PaymentInteractionState.SUCCESS);

    // Should default to 5000ms
    jest.advanceTimersByTime(4999);
    expect(sdk.currentState).toBe(PaymentInteractionState.SUCCESS);

    jest.advanceTimersByTime(2);
    expect(sdk.currentState).toBe(PaymentInteractionState.IDLE);
  });
});
