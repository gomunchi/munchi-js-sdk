import type { AxiosInstance } from "axios";
import { PaymentProvider } from "../../core";

import { version } from "../package.json";
import { PaymentErrorCode, PaymentSDKError } from "./error";
import type { IPaymentStrategy } from "./strategies/IPaymentStrategy";
import { MockStrategy } from "./strategies/MockStrategy";
import { VivaStrategy } from "./strategies/VivaStrategy";
import {
    type IMessagingAdapter,
    PaymentInteractionState,
    type PaymentRequest,
    type PaymentResult,
    type PaymentTerminalConfig,
    SdkPaymentStatus,
    type TransactionOptions,
} from "./types/payment";
import type { ILogger, SDKOptions } from "./types/sdk";

type StateListener = (state: PaymentInteractionState) => void;

export class MunchiPaymentSDK {
  private strategy: IPaymentStrategy;
  private axios: AxiosInstance;
  private messaging: IMessagingAdapter;
  private timeoutMs: number;
  private logger: ILogger | undefined;
  private _currentState: PaymentInteractionState = PaymentInteractionState.IDLE;
  private _listeners: StateListener[] = [];
  private _cancellationIntent = false;

  constructor(
    axios: AxiosInstance,
    messaging: IMessagingAdapter,
    config: PaymentTerminalConfig,
    options: SDKOptions = {},
  ) {
    this.axios = axios;
    this.messaging = messaging;
    this.logger = options.logger;
    this.timeoutMs = options.timeoutMs || 60000;
    this.strategy = this.resolveStrategy(config);
  }

  public get version() {
    return version;
  }

  public get currentState() {
    return this._currentState;
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

    const isTerminal = [
      PaymentInteractionState.SUCCESS,
      PaymentInteractionState.FAILED,
      PaymentInteractionState.INTERNAL_ERROR,
    ].includes(this._currentState);

    if (newState === PaymentInteractionState.IDLE) {
      this._currentState = newState;
      this._listeners.forEach((l) => l(newState));
      return;
    }

    if (isTerminal) {
      const errorMsg = `Invalid State Transition: Attempted to move from terminal state ${this._currentState} to ${newState}`;
      this.logger?.error(errorMsg);

      if (this._currentState !== PaymentInteractionState.INTERNAL_ERROR) {
        this._currentState = PaymentInteractionState.INTERNAL_ERROR;
        this._listeners.forEach((l) => l(this._currentState));
      }

      throw new PaymentSDKError(PaymentErrorCode.UNKNOWN, errorMsg);
    }

    this._currentState = newState;

    this._listeners.forEach((listener) => listener(newState));
  }

  private resolveStrategy(config: PaymentTerminalConfig): IPaymentStrategy {
    switch (config.provider) {
      case PaymentProvider.Nets:
        return new MockStrategy();
      default:
        return new VivaStrategy(this.axios, this.messaging, config);
    }
  }

  public connect = async (): Promise<void> => {
    this.transitionTo(PaymentInteractionState.CONNECTING);
    try {
      await this.strategy.initialize();
      this.transitionTo(PaymentInteractionState.IDLE);
    } catch (error) {
      this.transitionTo(PaymentInteractionState.FAILED);
      throw error;
    }
  };

  public disconnect = async (): Promise<void> => {
    await this.strategy.disconnect();
    this.transitionTo(PaymentInteractionState.IDLE);
  };

  public initiateTransaction = async (
    params: PaymentRequest,
    options?: TransactionOptions,
  ): Promise<PaymentResult> => {
    const callbacks = options ?? {};
    const orderRef = params.orderRef;

    const isRestingState = [
      PaymentInteractionState.IDLE,
      PaymentInteractionState.SUCCESS,
      PaymentInteractionState.FAILED,
      PaymentInteractionState.INTERNAL_ERROR,
    ].includes(this._currentState);

    if (!isRestingState) {
      return this.generateErrorResult(
        params.orderRef,
        PaymentErrorCode.UNKNOWN,
        "A transaction is already in progress",
      );
    }

    const startTime = Date.now();
    this._cancellationIntent = false;

    this.transitionTo(PaymentInteractionState.IDLE);

    if (params.amountCents <= 0) {
      return this.generateErrorResult(
        params.orderRef,
        PaymentErrorCode.INVALID_AMOUNT,
        "Amount must be greater than 0",
      );
    }

    try {
      const internalStateCallback = (state: PaymentInteractionState) => {
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
  }

  private async handleTransactionError(
    params: PaymentRequest,
    originalError: unknown,
    callbacks: TransactionOptions = {},
  ): Promise<PaymentResult> {
    this.transitionTo(PaymentInteractionState.VERIFYING);
    this.safeFireCallback(() =>
      callbacks.onVerifying?.({ orderRef: params.orderRef }),
    );

    if (this._cancellationIntent) {
      try {
        const finalStatus = await this.strategy.verifyFinalStatus(params);
        if (finalStatus.success) {
          this.transitionTo(PaymentInteractionState.SUCCESS);
          this.safeFireCallback(() => callbacks.onSuccess?.(finalStatus));
          return finalStatus;
        }
      } catch (err) {
        this.logger?.warn(
          "Final status verification failed during cancellation",
          { err },
        );
      }

      this.transitionTo(PaymentInteractionState.IDLE);
      this.safeFireCallback(() =>
        callbacks.onCancelled?.({ orderRef: params.orderRef }),
      );
      return {
        success: false,
        status: SdkPaymentStatus.CANCELLED,
        errorCode: PaymentErrorCode.CANCELLED,
        orderId: params.orderRef,
      };
    }

    this.transitionTo(PaymentInteractionState.FAILED);
    const errorResult =
      originalError instanceof PaymentSDKError
        ? this.generateErrorResult(
            params.orderRef,
            originalError.code,
            originalError.message,
          )
        : this.generateErrorResult(
            params.orderRef,
            PaymentErrorCode.UNKNOWN,
            originalError instanceof Error
              ? originalError.message
              : "Unknown fatal error",
          );
    this.safeFireCallback(() => callbacks.onError?.(errorResult));
    return errorResult;
  }

  private fireStateCallback(
    state: PaymentInteractionState,
    callbacks: TransactionOptions,
    orderRef: string,
  ) {
    const ctx = { orderRef };
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
    this._cancellationIntent = true;

    this.transitionTo(PaymentInteractionState.VERIFYING);

    try {
      return await this.strategy.cancelTransaction(() => {});
    } catch (error) {
      this.logger?.error("Cancellation command failed", error);
      return false;
    }
  };

  private generateErrorResult(
    orderRef: string,
    code: PaymentErrorCode,
    message: string,
  ): PaymentResult {
    return {
      success: false,
      status: SdkPaymentStatus.ERROR,
      errorCode: code,
      errorMessage: message,
      orderId: orderRef,
    };
  }
}
