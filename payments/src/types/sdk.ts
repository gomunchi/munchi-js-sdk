import type {
  PaymentInteractionState,
  PaymentResult,
  PaymentTransactionRecord,
} from "./payment";

export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}



export interface IPersistenceAdapter {
  saveTransaction(transaction: PaymentTransactionRecord): Promise<void>;
  updateTransactionStatus(
    orderRef: string,
    status: PaymentInteractionState,
    details?: Record<string, unknown>,
  ): Promise<void>;
}

export interface HealthCheckResult {
  isHealthy: boolean;
  details?: Record<string, unknown>;
}

export interface IHealthCheckAdapter {
  checkHealth(): Promise<HealthCheckResult>;
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
  /**
   * Optional adapter for persisting transaction state.
   * If provided, the SDK will call this adapter to save and update transaction records.
   */
  persistence?: IPersistenceAdapter;
  /**
   * Optional adapter for checking system health before starting a transaction.
   * If provided, the SDK will call this adapter before initiating a transaction.
   */
  healthCheck?: IHealthCheckAdapter;
}
