import { PaymentSDKError, PaymentErrorCode } from "../../src/error";

describe("PaymentErrorCode", () => {
  it("should have all expected error codes", () => {
    expect(PaymentErrorCode.MISSING_CONFIG).toBe("MISSING_CONFIG");
    expect(PaymentErrorCode.INVALID_AMOUNT).toBe("INVALID_AMOUNT");
    expect(PaymentErrorCode.NETWORK_ERROR).toBe("NETWORK_ERROR");
    expect(PaymentErrorCode.TERMINAL_OFFLINE).toBe("TERMINAL_OFFLINE");
    expect(PaymentErrorCode.TERMINAL_BUSY).toBe("TERMINAL_BUSY");
    expect(PaymentErrorCode.TIMEOUT).toBe("TIMEOUT");
    expect(PaymentErrorCode.DECLINED).toBe("DECLINED");
    expect(PaymentErrorCode.CANCELLED).toBe("CANCELLED");
    expect(PaymentErrorCode.STRATEGY_ERROR).toBe("STRATEGY_ERROR");
    expect(PaymentErrorCode.UNKNOWN).toBe("UNKNOWN");
  });
});

describe("PaymentSDKError", () => {
  it("should create error with code and message", () => {
    const error = new PaymentSDKError(
      PaymentErrorCode.INVALID_AMOUNT,
      "Amount must be positive",
    );

    expect(error.message).toBe("Amount must be positive");
    expect(error.code).toBe(PaymentErrorCode.INVALID_AMOUNT);
    expect(error.name).toBe("PaymentSDKError");
  });

  it("should be instance of Error", () => {
    const error = new PaymentSDKError(PaymentErrorCode.UNKNOWN, "Test error");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PaymentSDKError);
  });

  it("should store raw error when provided", () => {
    const rawError = new Error("Original error");
    const error = new PaymentSDKError(
      PaymentErrorCode.NETWORK_ERROR,
      "Network failed",
      rawError,
    );

    expect(error.rawError).toBe(rawError);
  });

  it("should have undefined rawError when not provided", () => {
    const error = new PaymentSDKError(PaymentErrorCode.TIMEOUT, "Timed out");

    expect(error.rawError).toBeUndefined();
  });

  it("should maintain proper prototype chain", () => {
    const error = new PaymentSDKError(
      PaymentErrorCode.DECLINED,
      "Card declined",
    );

    expect(Object.getPrototypeOf(error)).toBe(PaymentSDKError.prototype);
  });
});
