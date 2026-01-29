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

export interface SDKOptions {
  timeoutMs?: number;
  logger?: ILogger;
}
