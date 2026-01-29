import {
  type CreateTransactionPayloadDto,
  type CurrencyCode,KiosksApi, PaymentApi,
  type PaymentStatusDto,SimplePaymentStatus,
  VivaCurrencyCode
} from "@munchi/core";
import type { AxiosInstance } from "axios";
import { PaymentErrorCode, PaymentSDKError } from "../error";
import {
  type IMessagingAdapter,
  PaymentInteractionState,
  type PaymentRequest,
  type PaymentResult,
  type PaymentTerminalConfig,
  SdkPaymentStatus,
} from "../types/payment";
import type { IPaymentStrategy } from "./IPaymentStrategy";

export class VivaStrategy implements IPaymentStrategy {
  private api: PaymentApi;
  private kioskApi: KiosksApi;
  private abortController: AbortController | null = null;
  private currentSessionId: string | null = null;

  constructor(
    axios: AxiosInstance,
    private messaging: IMessagingAdapter,
    private config: PaymentTerminalConfig
  ) {
    this.api = new PaymentApi(undefined, "", axios);
    this.kioskApi = new KiosksApi(undefined, "", axios);
  }

  async initialize() { }
  async disconnect() {
    this.abortController?.abort();
    this.currentSessionId = null;
  }

  async processPayment(
    request: PaymentRequest,
    onStateChange: (state: PaymentInteractionState) => void
  ): Promise<PaymentResult> {
    this.abortController = new AbortController();
    onStateChange(PaymentInteractionState.CONNECTING);

    const payload: CreateTransactionPayloadDto = {
      amount: request.amountCents,
      orderId: request.orderRef,
      orderingBusinessId: parseInt(this.config.storeId),
      currencyCode: this.mapCurrencyToViva(request.currency),
      identityId: this.config.kioskId,
    };

    try {
      const { data } = await this.api.createVivaTransactionV3(payload);
      this.currentSessionId = data.sessionId;

      if (this.abortController.signal.aborted) {
        throw new Error("Aborted");
      }

      onStateChange(PaymentInteractionState.REQUIRES_INPUT);

      const result = await this.waitForPaymentCompletion(
        data.sessionId,
        request.orderRef,
        onStateChange,
        this.abortController.signal
      );

      this.currentSessionId = null;
      return result;
    } catch (err) {
      this.currentSessionId = null;
      if (err instanceof PaymentSDKError) throw err;
      throw new PaymentSDKError(
        PaymentErrorCode.NETWORK_ERROR,
        "Failed to create Viva Intent",
        err
      );
    }
  }

  private async waitForPaymentCompletion(
    sessionId: string,
    orderRef: string,
    onStateChange: (state: PaymentInteractionState) => void,
    signal: AbortSignal
  ): Promise<PaymentResult> {
    const channelName = `viva.kiosk.requests.${sessionId}`;
    const eventName = "payment:status-changed";

    return new Promise((resolve, reject) => {
      let isResolved = false;

      const cleanup = () => {
        isResolved = true;
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
        clearTimeout(timer);
      };

      const onAbort = () => {
        cleanup();
        reject(new Error("Aborted"));
      };

      signal.addEventListener("abort", onAbort);

      const unsubscribe = this.messaging.subscribe<PaymentStatusDto>(
        channelName,
        eventName,
        (data: PaymentStatusDto) => {
          if (!isResolved) {
            cleanup();
            signal.removeEventListener("abort", onAbort);
            resolve(this.handleSuccess(data, onStateChange));
          }
        }
      );

      const timer = setTimeout(async () => {
        if (isResolved || signal.aborted) return;

        try {
          const finalResult = await this.pollOrderStatus(
            orderRef,
            this.config.storeId,
            signal
          );
          resolve(this.handleSuccess(finalResult, onStateChange));
        } catch (pollError) {
          onStateChange(PaymentInteractionState.FAILED);
          reject(
            new PaymentSDKError(
              PaymentErrorCode.TIMEOUT,
              "Payment timed out and polling failed",
              pollError
            )
          );
        } finally {
          signal.removeEventListener("abort", onAbort);
          cleanup();
        }
      }, 10000);
    });
  }

  private async pollOrderStatus(
    orderRef: string,
    businessId: string,
    signal: AbortSignal
  ): Promise<PaymentStatusDto> {
    const POLLING_DURATION_MS = 120000;
    const INTERVAL_MS = 2000;
    const startTime = Date.now();
    const deadline = startTime + POLLING_DURATION_MS;

    while (Date.now() < deadline) {
      if (signal.aborted) {
        throw new Error("Aborted");
      }

      try {
        const { data } = await this.kioskApi.getOrderStatus(
          orderRef,
          businessId
        );
        if (data.status !== SimplePaymentStatus.Pending) return data;
      } catch (error) {
        throw new Error("Payment verification failed.");
      }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
    throw new Error("Payment verification timed out.");
  }

  private handleSuccess(
    data: PaymentStatusDto,
    onStateChange: (state: PaymentInteractionState) => void
  ): PaymentResult {
    const isSuccess = data.status === SimplePaymentStatus.Success;
    onStateChange(
      isSuccess
        ? PaymentInteractionState.SUCCESS
        : PaymentInteractionState.FAILED
    );
    return {
      success: isSuccess,
      status: isSuccess ? SdkPaymentStatus.SUCCESS : SdkPaymentStatus.FAILED,
      orderId: data.orderId,
      errorCode: data.error?.code ?? "",
      errorMessage: data.error?.message ?? "",
    };
  }

  async cancelTransaction(
    onStateChange: (state: PaymentInteractionState) => void
  ): Promise<boolean> {
    if (!this.currentSessionId) return false;
    onStateChange(PaymentInteractionState.IDLE);
    try {
      const sessionIdToCancel = this.currentSessionId;
      this.abortController?.abort();
      this.currentSessionId = null;
      await this.api.cancelVivaTransactionV2({
        cashRegisterId: this.config.storeId,
        sessionId: sessionIdToCancel,
      });
      return true;
    } catch (error) {
      this.currentSessionId = null;
      throw new PaymentSDKError(
        PaymentErrorCode.NETWORK_ERROR,
        "Failed to cancel Viva transaction",
        error
      );
    }
  }

  async verifyFinalStatus(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const { data } = await this.kioskApi.getOrderStatus(
        request.orderRef,
        this.config.storeId
      );

      const isSuccess = data.status === SimplePaymentStatus.Success;

      return {
        success: isSuccess,
        status: isSuccess ? SdkPaymentStatus.SUCCESS : SdkPaymentStatus.FAILED,
        orderId: data.orderId,
        errorCode: data.error?.code ?? "",
        errorMessage: data.error?.message ?? "",
      };
    } catch (error) {
      throw new PaymentSDKError(
        PaymentErrorCode.NETWORK_ERROR,
        "Failed to verify final transaction status",
        error
      );
    }
  }

  private mapCurrencyToViva(currency: CurrencyCode): VivaCurrencyCode {
    const mapping: Partial<Record<CurrencyCode, VivaCurrencyCode>> = {
      EUR: VivaCurrencyCode._978,
      GBP: VivaCurrencyCode._826,
      CHF: VivaCurrencyCode._756,
      SEK: VivaCurrencyCode._752,
      NOK: VivaCurrencyCode._578,
      DKK: VivaCurrencyCode._208,
      PLN: VivaCurrencyCode._985,
      CZK: VivaCurrencyCode._203,
      HUF: VivaCurrencyCode._348,
      RON: VivaCurrencyCode._946,
      TRY: VivaCurrencyCode._949,
      RUB: VivaCurrencyCode._643,
      AED: VivaCurrencyCode._784,
    };

    const vivaCode = mapping[currency];
    if (!vivaCode) {
      throw new PaymentSDKError(
        PaymentErrorCode.NETWORK_ERROR,
        `Currency ${currency} is not supported by Viva payment terminal`,
      );
    }
    return vivaCode;
  };
}
