import { PaymentFailureCode, PaymentProvider } from "@munchi_oy/core";
import type { AxiosInstance } from "axios";
import { version } from "../package.json";
import { PaymentErrorCode, PaymentSDKError } from "./error";
import type { IPaymentStrategy } from "./strategies/IPaymentStrategy";
import { NetsStrategy } from "./strategies/NetsStrategy";
import { VivaStrategy } from "./strategies/VivaStrategy";
import {
  type IMessagingAdapter,
  type IMunchiPaymentSDK,
  PaymentInteractionState,
  type PaymentResult,
  type PaymentTerminalConfig,
  type RefundRequest,
  type PaymentRequest as SdkPaymentRequest,
  SdkPaymentStatus,
  type TransactionOptions,
} from "./types/payment";
import type { ILogger, SDKOptions } from "./types/sdk";

type StateListener = (state: PaymentInteractionState) => void;

export class MunchiPaymentSDK implements IMunchiPaymentSDK {
  private strategy: IPaymentStrategy;
  private axios: AxiosInstance;
  private messaging: IMessagingAdapter;
  private timeoutMs: number;
  private logger: ILogger | undefined;
  private _currentState: PaymentInteractionState = PaymentInteractionState.IDLE;
  private _listeners: StateListener[] = [];
  private _cancellationIntent = false;
  private _currentSessionId: string | undefined;
  private _autoResetTimer: ReturnType<typeof setTimeout> | undefined;
  private autoResetOptions: SDKOptions["autoResetOnPaymentComplete"];

  private static readonly TERMINAL_STATES = [
    PaymentInteractionState.SUCCESS,
    PaymentInteractionState.FAILED,
    PaymentInteractionState.INTERNAL_ERROR,
  ];

  private static readonly RESTING_STATES = [
    PaymentInteractionState.IDLE,
    ...MunchiPaymentSDK.TERMINAL_STATES,
  ];

  constructor(
    axios: AxiosInstance,
    messaging: IMessagingAdapter,
    config: PaymentTerminalConfig,
    options: SDKOptions = {},
    strategy?: IPaymentStrategy,
  ) {
    this.axios = axios;
    this.messaging = messaging;
    this.logger = options.logger;
    this.timeoutMs = options.timeoutMs || 30000;
    this.autoResetOptions = options.autoResetOnPaymentComplete;
    this.strategy = strategy ?? this.resolveStrategy(config);
  }

  public get version() {
    return version;
  }

  public get currentState() {
    return this._currentState;
  }

  private generateErrorResult(
    orderRef: string,
    code: PaymentErrorCode,
    message: string,
  ): PaymentResult {
    return {
      success: false,
      status: SdkPaymentStatus.ERROR,
      errorCode: this.normalizeErrorCode(code),
      errorMessage: message,
      orderId: orderRef,
    };
  }

  private normalizeErrorCode(code?: string): string {
    if (!code) return PaymentFailureCode.SystemUnknown;
    if (code.includes(".")) return code;

    const map: Record<string, string> = {
      [PaymentErrorCode.CANCELLED]: PaymentFailureCode.PaymentCancelledByUser,
      [PaymentErrorCode.DECLINED]: PaymentFailureCode.PaymentDeclined,
      [PaymentErrorCode.TERMINAL_BUSY]: PaymentFailureCode.TerminalBusy,
      [PaymentErrorCode.TERMINAL_OFFLINE]: PaymentFailureCode.TerminalOffline,
      [PaymentErrorCode.TIMEOUT]: PaymentFailureCode.TerminalTimeout,
      [PaymentErrorCode.NETWORK_ERROR]: PaymentFailureCode.SystemProviderError,
      [PaymentErrorCode.STRATEGY_ERROR]: PaymentFailureCode.SystemProviderError,
      [PaymentErrorCode.MISSING_CONFIG]: PaymentFailureCode.SystemUnknown,
      [PaymentErrorCode.INVALID_AMOUNT]: PaymentFailureCode.SystemUnknown,
      [PaymentErrorCode.UNKNOWN]: PaymentFailureCode.SystemUnknown,
    };

    return map[code] ?? PaymentFailureCode.SystemUnknown;
  }

  public subscribe = (listener: StateListener): (() => void) => {
    this._listeners.push(listener);
    listener(this._currentState);

    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  };

  private transitionTo(newState: PaymentInteractionState) {
    if (this._currentState === newState) return;

    if (newState === PaymentInteractionState.IDLE) {
      this.cancelAutoReset();
      this._currentState = newState;
      this._listeners.forEach((l) => l(newState));
      return;
    }

    const isOldStateTerminal = MunchiPaymentSDK.TERMINAL_STATES.includes(
      this._currentState,
    );

    if (isOldStateTerminal) {
      const errorMsg = `Invalid State Transition: Attempted to move from terminal state ${this._currentState} to ${newState}`;
      this.logger?.error(errorMsg);

      if (this._currentState !== PaymentInteractionState.INTERNAL_ERROR) {
        this._currentState = PaymentInteractionState.INTERNAL_ERROR;
        this._listeners.forEach((l) => l(this._currentState));
      }

      throw new PaymentSDKError(PaymentErrorCode.UNKNOWN, errorMsg);
    }

    this._currentState = newState;

    if (MunchiPaymentSDK.TERMINAL_STATES.includes(newState)) {
      this.scheduleAutoReset(newState);
    }

    this._listeners.forEach((listener) => listener(newState));
  }

  private _resetScheduledAt: number | undefined;

  public get nextAutoResetAt(): number | undefined {
    return this._resetScheduledAt;
  }

  private cancelAutoReset() {
    if (this._autoResetTimer) {
      clearTimeout(this._autoResetTimer);
      this._autoResetTimer = undefined;
    }
    this._resetScheduledAt = undefined;
  }

  private scheduleAutoReset(state: PaymentInteractionState) {
    // If not configured, auto-reset is DISABLED
    if (!this.autoResetOptions) {
      return;
    }

    const isSuccess = state === PaymentInteractionState.SUCCESS;
    const delay = isSuccess
      ? (this.autoResetOptions.successDelayMs ?? 5000)
      : (this.autoResetOptions.failureDelayMs ?? 5000);

    this.logger?.info(`Scheduling auto-reset to IDLE in ${delay}ms`);

    this._resetScheduledAt = Date.now() + delay;

    this._autoResetTimer = setTimeout(() => {
      this.logger?.info("Auto-reset triggered");
      this.reset();
    }, delay);
  }

  private resolveStrategy(config: PaymentTerminalConfig): IPaymentStrategy {
    switch (config.provider) {
      case PaymentProvider.Nets:
        return new NetsStrategy(this.axios, this.messaging, config);

      default:
        return new VivaStrategy(this.axios, this.messaging, config);
    }
  }

  public initiateTransaction = async (
    params: SdkPaymentRequest,
    options?: TransactionOptions,
  ): Promise<PaymentResult> => {
    const callbacks = options ?? {};
    const orderRef = params.orderRef;

    const isRestingState = MunchiPaymentSDK.RESTING_STATES.includes(
      this._currentState,
    );

    if (!isRestingState) {
      return this.generateErrorResult(
        params.orderRef,
        PaymentErrorCode.UNKNOWN,
        "A transaction is already in progress",
      );
    }

    const startTime = Date.now();
    this._cancellationIntent = false;
    // Prevent stale session IDs from previous transactions affecting new flows.
    this._currentSessionId = undefined;

    this.transitionTo(PaymentInteractionState.IDLE);

    if (params.amountCents <= 0) {
      return this.generateErrorResult(
        params.orderRef,
        PaymentErrorCode.INVALID_AMOUNT,
        "Amount must be greater than 0",
      );
    }

    try {
      const internalStateCallback = (
        state: PaymentInteractionState,
        detail?: { sessionId?: string },
      ) => {
        if (detail?.sessionId) {
          this._currentSessionId = detail.sessionId;
        }
        if (state !== PaymentInteractionState.FAILED) {
          this.transitionTo(state);
          this.fireStateCallback(state, callbacks, orderRef);
        }
      };

      const transactionPromise = this.strategy.processPayment(
        params,
        internalStateCallback,
      );

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new PaymentSDKError(
              PaymentErrorCode.TIMEOUT,
              "Transaction timed out",
            ),
          );
        }, this.timeoutMs);
      });

      const result = await Promise.race([transactionPromise, timeoutPromise]);

      if (result.success) {
        this.transitionTo(PaymentInteractionState.SUCCESS);
        this.safeFireCallback(() => callbacks.onSuccess?.(result));
      } else if (this._cancellationIntent) {
        return await this.handleTransactionError(
          params,
          new Error("Aborted after resolution"),
          callbacks,
        );
      } else {
        this.transitionTo(PaymentInteractionState.FAILED);
        this.safeFireCallback(() => callbacks.onError?.(result));
      }

      this.logger?.info("Transaction completed successfully", {
        orderId: params.orderRef,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error: unknown) {
      this.logger?.warn("Transaction interrupted. Handling final status...", {
        error,
      });

      return await this.handleTransactionError(params, error, callbacks);
    }
  };

  private async handleTransactionError(
    params: SdkPaymentRequest,
    originalError: unknown,
    callbacks: TransactionOptions = {},
  ): Promise<PaymentResult> {
    if (!this._cancellationIntent) {
      this.transitionTo(PaymentInteractionState.VERIFYING);
      this.safeFireCallback(() =>
        callbacks.onVerifying?.({
          orderRef: params.orderRef,
          refPaymentId: this._currentSessionId,
        }),
      );
    }

    if (this._cancellationIntent) {
      try {
        if (this._currentSessionId) {
          const finalStatus = await this.verifyWithRetry(
            params,
            this._currentSessionId,
          );
          if (finalStatus.success) {
            this.transitionTo(PaymentInteractionState.SUCCESS);
            this.safeFireCallback(() => callbacks.onSuccess?.(finalStatus));
            return finalStatus;
          }
        }
      } catch (err) {
        this.logger?.warn(
          "Final status verification failed during cancellation",
          { err },
        );
      }

      this.transitionTo(PaymentInteractionState.FAILED);
      // Removed cancelAutoReset() to allow the auto-reset timer (scheduled by FAILED state) to persist.

      this.safeFireCallback(() =>
        callbacks.onCancelled?.({
          orderRef: params.orderRef,
          refPaymentId: this._currentSessionId,
        }),
      );
      return {
        success: false,
        status: SdkPaymentStatus.CANCELLED,
        errorCode: this.normalizeErrorCode(PaymentErrorCode.CANCELLED),
        orderId: params.orderRef,
        ...(this._currentSessionId
          ? { transactionId: this._currentSessionId }
          : {}),
      };
    }

    let errorResult: PaymentResult;

    if (this._currentSessionId) {
      try {
        const finalStatus = await this.verifyWithRetry(
          params,
          this._currentSessionId,
        );

        if (finalStatus.success) {
          this.transitionTo(PaymentInteractionState.SUCCESS);
          this.safeFireCallback(() => callbacks.onSuccess?.(finalStatus));
          return finalStatus;
        }

        errorResult = finalStatus;
      } catch (verifyErr) {
        this.logger?.warn(
          "Failed to get detailed error from verifyFinalStatus",
          { verifyErr },
        );
        errorResult = this.buildErrorResultFromException(
          params.orderRef,
          verifyErr,
        );
      }
    } else {
      errorResult = this.buildErrorResultFromException(
        params.orderRef,
        originalError,
      );
    }

    this.transitionTo(PaymentInteractionState.FAILED);
    this.safeFireCallback(() => callbacks.onError?.(errorResult));
    return errorResult;
  }

  private static readonly VERIFY_TIMEOUT_MS = 10000;
  private static readonly VERIFY_MAX_RETRIES = 3;

  private async verifyWithRetry(
    params: SdkPaymentRequest,
    sessionId: string,
  ): Promise<PaymentResult> {
    let lastError: unknown;
    let allTimeouts = true;

    for (let attempt = 1; attempt <= MunchiPaymentSDK.VERIFY_MAX_RETRIES; attempt++) {
      try {
        const result = await Promise.race([
          this.strategy.verifyFinalStatus(params, sessionId),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Verify timed out")),
              MunchiPaymentSDK.VERIFY_TIMEOUT_MS,
            ),
          ),
        ]);
        return result;
      } catch (err) {
        lastError = err;
        const isTimeout = err instanceof Error && err.message === "Verify timed out";
        if (!isTimeout) allTimeouts = false;

        this.logger?.warn(
          `verifyFinalStatus attempt ${attempt}/${MunchiPaymentSDK.VERIFY_MAX_RETRIES} failed`,
          { err },
        );
      }
    }

    const message = lastError instanceof Error ? lastError.message : "Verify retries exhausted";
    const code = allTimeouts
      ? PaymentFailureCode.PaymentTimeout
      : PaymentFailureCode.PaymentUnknown;

    throw new PaymentSDKError(code as unknown as PaymentErrorCode, message);
  }

  private buildErrorResultFromException(
    orderRef: string,
    error: unknown,
  ): PaymentResult {
    return error instanceof PaymentSDKError
      ? this.generateErrorResult(orderRef, error.code, error.message)
      : this.generateErrorResult(
          orderRef,
          PaymentErrorCode.UNKNOWN,
          error instanceof Error ? error.message : "Unknown fatal error",
        );
  }

  private fireStateCallback(
    state: PaymentInteractionState,
    callbacks: TransactionOptions,
    orderRef: string,
  ) {
    const ctx = {
      orderRef,
      refPaymentId: this._currentSessionId,
    };
    switch (state) {
      case PaymentInteractionState.CONNECTING:
        this.safeFireCallback(() => callbacks.onConnecting?.(ctx));
        break;
      case PaymentInteractionState.REQUIRES_INPUT:
        this.safeFireCallback(() => callbacks.onRequiresInput?.(ctx));
        break;
      case PaymentInteractionState.PROCESSING:
        this.safeFireCallback(() => callbacks.onProcessing?.(ctx));
        break;
    }
  }

  private safeFireCallback(callback: () => void) {
    try {
      callback();
    } catch (error) {
      this.logger?.warn("Callback execution failed", { error });
    }
  }

  public cancel = async (): Promise<boolean> => {
    this.logger?.info("Attempting cancellation");

    if (MunchiPaymentSDK.TERMINAL_STATES.includes(this._currentState)) {
      this.logger?.warn(
        "Cannot cancel: Transaction already in terminal state",
        {
          state: this._currentState,
        },
      );
      return false;
    }

    this._cancellationIntent = true;

    this.transitionTo(PaymentInteractionState.VERIFYING);

    try {
      const result = await this.strategy.cancelTransaction((state) =>
        this.transitionTo(state),
      );

      // If cancellation failed (e.g. no active session) AND we are just verifying,
      // we should probably revert to IDLE or FAILED to avoid getting stuck.
      if (!result && this._currentState === PaymentInteractionState.VERIFYING) {
        this.transitionTo(PaymentInteractionState.IDLE);
      }
      return result;
    } catch (error) {
      this.logger?.error("Cancellation command failed", error);
      // Do NOT set internal error here.
      // If cancellation failed, the main initiateTransaction loop will likely catch the error
      // (or the abort signal) and handle the flow via handleTransactionError.
      // Setting terminal state here causes a race condition.
      return false;
    }
  };

  public reset = (): void => {
    if (MunchiPaymentSDK.TERMINAL_STATES.includes(this._currentState)) {
      this.transitionTo(PaymentInteractionState.IDLE);
    }
  };

  public refund = async (
    params: RefundRequest,
    options?: TransactionOptions,
  ): Promise<PaymentResult> => {
    const callbacks = options ?? {};
    this.logger?.info("Initiating refund", { orderRef: params.orderRef });
    // Clear any stale session before starting a new refund flow.
    this._currentSessionId = undefined;

    // Ensure we are in a valid state to start a refund
    const isRestingState = MunchiPaymentSDK.RESTING_STATES.includes(
      this._currentState,
    );

    if (!isRestingState) {
      return this.generateErrorResult(
        params.orderRef,
        PaymentErrorCode.UNKNOWN,
        "A transaction is already in progress",
      );
    }

    this.transitionTo(PaymentInteractionState.IDLE);

    try {
      const internalStateCallback = (
        state: PaymentInteractionState,
        detail?: { sessionId?: string },
      ) => {
        if (detail?.sessionId) {
          this._currentSessionId = detail.sessionId;
        }
        if (state !== PaymentInteractionState.FAILED) {
          this.transitionTo(state);
          this.fireStateCallback(state, callbacks, params.orderRef);
        }
      };

      const result = await this.strategy.refundTransaction(
        params,
        internalStateCallback,
      );

      if (result.success) {
        this.transitionTo(PaymentInteractionState.SUCCESS);
        this.safeFireCallback(() => callbacks.onSuccess?.(result));
      } else {
        this.transitionTo(PaymentInteractionState.FAILED);
        this.safeFireCallback(() => callbacks.onError?.(result));
      }

      this.logger?.info("Refund completed", {
        success: result.success,
        orderRef: params.orderRef,
      });
      return result;
    } catch (error) {
      this.logger?.error("Refund failed", error);

      this.transitionTo(PaymentInteractionState.FAILED);

      const errorResult = this.generateErrorResult(
        params.orderRef,
        PaymentErrorCode.UNKNOWN,
        error instanceof Error ? error.message : "Refund failed",
      );
      this.safeFireCallback(() => callbacks.onError?.(errorResult));
      return errorResult;
    }
  };
}
