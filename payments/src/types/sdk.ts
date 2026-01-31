import type { PaymentResult } from "./payment";

export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

export interface PaymentCallbacks {
  onConnecting?: (ctx: { orderRef: string }) => void;
  onRequiresInput?: (ctx: { orderRef: string }) => void;
  onProcessing?: (ctx: { orderRef: string }) => void;
  onVerifying?: (ctx: { orderRef: string }) => void;
  onSuccess?: (result: PaymentResult) => void;
  onError?: (result: PaymentResult) => void;
  onCancelled?: (ctx: { orderRef: string }) => void;
}

export interface AutoResetOptions {
  /**
   * Delay in milliseconds before resetting to IDLE after a successful transaction.
   * Defaults to 5000ms if not specified.
   */
  successDelayMs?: number;

  /**
   * Delay in milliseconds before resetting to IDLE after a failed transaction.
   * Defaults to 5000ms if not specified.
   */
  failureDelayMs?: number;
}

export interface SDKOptions {
  timeoutMs?: number;
  logger?: ILogger;
  /**
   * Configuration for automatically resetting the SDK state to IDLE.
   * If provided (even as an empty object), auto-reset is enabled.
   */
  autoResetOnPaymentComplete?: AutoResetOptions;
}
