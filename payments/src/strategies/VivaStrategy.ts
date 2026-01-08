import type {
  CreateTransactionPayloadDto,
  PaymentStatusDto,
} from "@munchi/core";
import { KiosksApi, PaymentApi, SimplePaymentStatus } from "@munchi/core";
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

  async initialize() {}
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
      currencyCode: "978",
      identityId: this.config.kioskId,
    };

    try {
      const { data } = await this.api.createVivaTransactionV3(payload);
      this.currentSessionId = data.sessionId;

      if (this.abortController.signal.aborted) {
        throw new PaymentSDKError(
          PaymentErrorCode.CANCELLED,
          "Payment cancelled during setup"
        );
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
        unsubscribe();
        clearTimeout(timer);
      };

      const onAbort = () => {
        cleanup();
        reject(
          new PaymentSDKError(
            PaymentErrorCode.CANCELLED,
            "User cancelled the operation"
          )
        );
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
        throw new PaymentSDKError(
          PaymentErrorCode.CANCELLED,
          "Polling aborted by user"
        );
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
      await this.api.cancelTransaction({
        cashRegisterId: this.config.storeId,
        sessionId: sessionIdToCancel,
      });
      return true;
    } catch (error) {
      throw new PaymentSDKError(
        PaymentErrorCode.NETWORK_ERROR,
        "Failed to cancel Viva transaction",
        error
      );
    } finally {
      onStateChange(PaymentInteractionState.FAILED);
    }
  }
}
