import {
  KiosksApi,
  PaymentApi,
  PaymentProvider,
  type PaymentStatusDto,
  SimplePaymentStatus,
  type VivaCreatePaymentDto,
} from "@munchi/core";
import type { AxiosInstance } from "axios";
import { PaymentErrorCode, PaymentSDKError } from "../error";
import {
  type IMessagingAdapter,
  PaymentInteractionState,
  type PaymentRequest,
  type PaymentResult,
  SdkPaymentStatus,
} from "../types/payment";
import type { IPaymentStrategy } from "./IPaymentStrategy";

export class VivaStrategy implements IPaymentStrategy {
  private api: PaymentApi;
  private kioskApi: KiosksApi;
  constructor(
    axios: AxiosInstance,
    private messaging: IMessagingAdapter,
    private config: { terminalId: string; businessId: string },
  ) {
    this.api = new PaymentApi(undefined, "", axios);
    this.kioskApi = new KiosksApi(undefined, "", axios);
  }

  async initialize() { }
  async disconnect() { }

  async processPayment(
    request: PaymentRequest,
    onStateChange: (state: PaymentInteractionState) => void,
  ): Promise<PaymentResult> {
    onStateChange(PaymentInteractionState.CONNECTING);

    const payload: VivaCreatePaymentDto = {
      amount: request.amountCents,
      cartId: request.orderRef,
      orderingBusinessId: parseInt(this.config.businessId),
      terminalId: this.config.terminalId,
      provider: PaymentProvider.Viva,
      currencyCode: request.currency === "EUR" ? "978" : "978",
    };

    let sessionData: { sessionId: string };

    try {
      const { data } = await this.api.createVivaPaymentV3(payload);
      sessionData = data;
    } catch (err) {
      throw new PaymentSDKError(
        PaymentErrorCode.NETWORK_ERROR,
        "Failed to create Viva Intent",
        err,
      );
    }

    onStateChange(PaymentInteractionState.REQUIRES_INPUT);

    return this.waitForPaymentCompletion(
      sessionData.sessionId,
      request.orderRef,
      onStateChange,
    );
  }

  private async waitForPaymentCompletion(
    sessionId: string,
    orderRef: string,
    onStateChange: (state: PaymentInteractionState) => void,
  ): Promise<PaymentResult> {
    const channelName = `viva.kiosk.requests.${sessionId}`;
    const eventName = "payment:status-changed";

    return new Promise((resolve, reject) => {
      let isResolved = false;

      const unsubscribe = this.messaging.subscribe<PaymentStatusDto>(
        channelName,
        eventName,
        (data: PaymentStatusDto) => {
          if (!isResolved) {
            cleanup();
            resolve(this.handleSuccess(data, onStateChange));
          }
        },
      );

      const cleanup = () => {
        isResolved = true;
        unsubscribe();
        clearTimeout(timer);
      };

      const timer = setTimeout(async () => {
        if (isResolved) return;

        try {
          const finalResult = await this.pollOrderStatus(
            orderRef,
            this.config.businessId,
          );

          cleanup();
          resolve(this.handleSuccess(finalResult, onStateChange));
        } catch (pollError) {
          cleanup();
          onStateChange(PaymentInteractionState.FAILED);
          reject(
            new PaymentSDKError(
              PaymentErrorCode.TIMEOUT,
              "Payment timed out and polling failed",
              pollError,
            ),
          );
        }
      }, 10000);
    });
  }

  private async pollOrderStatus(
    orderRef: string,
    businessId: string,
  ): Promise<PaymentStatusDto> {
    const POLLING_DURATION_MS = 2 * 60 * 1000;
    const INTERVAL_MS = 2000;
    const startTime = Date.now();
    const deadline = startTime + POLLING_DURATION_MS;

    while (Date.now() < deadline) {
      try {
        const { data } = await this.kioskApi.getOrderStatus(orderRef, businessId);

        if (data.status !== SimplePaymentStatus.Pending) {
          return data;
        }
      } catch (error) {
        throw new Error("Payment verification timed out after 2 minutes. Please check with staff.");
      }

      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }

    throw new Error("Payment verification timed out after 2 minutes. Please check with staff.");
  }

  private handleSuccess(data: PaymentStatusDto, onStateChange: (state: PaymentInteractionState) => void,): PaymentResult {
    const isSuccess = data.status === SimplePaymentStatus.Success;
    let status = PaymentInteractionState.IDLE;
    if (isSuccess) {
      status = PaymentInteractionState.SUCCESS
    } else {
      status = PaymentInteractionState.FAILED
    }

    onStateChange(status)

    return {
      success: isSuccess,
      status: isSuccess ? SdkPaymentStatus.SUCCESS : SdkPaymentStatus.FAILED,
      orderId: data.orderId,
      errorCode: data.error?.code ?? "",
      errorMessage: data.error?.message ?? "",
    };
  }

  async cancelTransaction(id: string): Promise<boolean> {
    await this.api.cancelTransaction({
      cashRegisterId: this.config.businessId ?? "0",
      sessionId: id,
    });
    return true;
  }
}
