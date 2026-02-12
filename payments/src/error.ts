export enum PaymentErrorCode {
  MISSING_CONFIG = "MISSING_CONFIG",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  NETWORK_ERROR = "NETWORK_ERROR",
  TERMINAL_OFFLINE = "TERMINAL_OFFLINE",
  TERMINAL_BUSY = "TERMINAL_BUSY",
  TIMEOUT = "TIMEOUT",
  DECLINED = "DECLINED",
  CANCELLED = "CANCELLED",
  STRATEGY_ERROR = "STRATEGY_ERROR",
  UNKNOWN = "UNKNOWN",
  HEALTH_CHECK_FAILED = "HEALTH_CHECK_FAILED",
}

export class PaymentSDKError extends Error {
  public readonly code: PaymentErrorCode;
  public readonly rawError?: unknown;

  constructor(code: PaymentErrorCode, message: string, rawError?: unknown) {
    super(message);
    this.name = "PaymentSDKError";
    this.code = code;
    this.rawError = rawError;

    Object.setPrototypeOf(this, PaymentSDKError.prototype);
  }
}
