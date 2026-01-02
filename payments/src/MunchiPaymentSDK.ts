import type { AxiosInstance } from "axios";
import dayjs from "dayjs";
import { version } from "../package.json";
import { PaymentErrorCode, PaymentSDKError } from "./error";
import { PaymentProvider } from "@munchi/core";
import type { IPaymentStrategy } from "./strategies/IPaymentStrategy";
import { MockStrategy } from "./strategies/MockStrategy";
import { VivaStrategy } from "./strategies/VivaStrategy";
import {
  type IMessagingAdapter,
  type PaymentInteractionState,
  type PaymentRequest,
  type PaymentResult,
  type PaymentTerminalConfig,
  SdkPaymentStatus,
} from "./types/payment";
import type { ILogger, SDKOptions } from "./types/sdk";
// import { NetsStrategy } from "./strategies/NetsStrategy";

export class MunchiPaymentSDK {
  private strategy: IPaymentStrategy;
  private config: PaymentTerminalConfig;
  private axios: AxiosInstance;
  private messaging: IMessagingAdapter;
  private timeoutMs: number;
  private logger?: ILogger | undefined;

  constructor(
    axios: AxiosInstance,
    messaging: IMessagingAdapter,
    config: PaymentTerminalConfig,
    options: SDKOptions = {},
  ) {
    this.axios = axios;
    this.messaging = messaging;
    this.config = config;
    this.logger = options.logger;
    this.timeoutMs = options.timeoutMs || 60000;
    this.strategy = this.resolveStrategy(config);
  }

  public get version() {
    return version;
  }

  private resolveStrategy(config: PaymentTerminalConfig): IPaymentStrategy {
    const strategyConfig = {
      terminalId: config.terminalId,
      businessId: config.storeId || this.config.storeId || "0",
    };
    switch (config.provider) {
      case PaymentProvider.Nets:
        return new MockStrategy();
      case PaymentProvider.Viva:
        return new VivaStrategy(this.axios, this.messaging, strategyConfig);
      default:
        return new MockStrategy();
    }
  }

  public async connect(): Promise<void> {
    await this.strategy.initialize();
  }

  public async disconnect(): Promise<void> {
    await this.strategy.disconnect();
  }

  public async initiateTransaction(
    params: PaymentRequest,
    onStateChange: (state: PaymentInteractionState) => void,
  ): Promise<PaymentResult> {
    const startTime = dayjs();

    if (params.amountCents <= 0) {
      return {
        orderId: params.orderRef,
        success: false,
        status: SdkPaymentStatus.ERROR,
        errorCode: PaymentErrorCode.INVALID_AMOUNT,
        errorMessage: "Amount must be greater than 0",
      };
    }

    try {
      const transactionPromise = this.strategy.processPayment(
        params,
        onStateChange,
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
      const duration = dayjs().diff(startTime, "millisecond");
      this.logger?.info("Transaction completed successfully", {
        orderId: params.orderRef,
        durationMs: duration,
      });

      return result;
    } catch (error: unknown) {
      if (error instanceof PaymentSDKError) {
        return {
          success: false,
          status:
            error.code === PaymentErrorCode.DECLINED
              ? SdkPaymentStatus.FAILED
              : SdkPaymentStatus.ERROR,
          errorCode: error.code,
          errorMessage: error.message,
          orderId: params.orderRef,
        };
      }

      return {
        success: false,
        status: SdkPaymentStatus.ERROR,
        errorCode: PaymentErrorCode.UNKNOWN,
        errorMessage:
          error instanceof Error ? error.message : "Unknown fatal error",
        orderId: params.orderRef,
      };
    }
  }

  public async cancel(transactionId: string): Promise<boolean> {
    this.logger?.info("Attempting cancellation", { transactionId });
    try {
      const result = await this.strategy.cancelTransaction(transactionId);
      return result;
    } catch (error) {
      this.logger?.error("Cancellation failed", error, { transactionId });
      return false;
    }
  }
}
