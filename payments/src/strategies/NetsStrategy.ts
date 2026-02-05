import {
  type CreateNetsTerminalPaymentDto,
  type NetsCancelPayloadDto,
  type NetsCancelTransactionDto,
  PaymentApi,
  PaymentEventType,
  PaymentProviderEnum,
  type PaymentStatusDto,
  SimplePaymentStatus,
  type TransactionDto,
  TransactionType,
} from "@munchi/core";
import type { AxiosInstance } from "axios";

import { PaymentErrorCode, PaymentSDKError } from "../error";
import {
  type IMessagingAdapter,
  PaymentInteractionState,
  type PaymentRequest,
  type PaymentResult,
  type PaymentTerminalConfig,
  type RefundRequest,
  SdkPaymentStatus,
} from "../types/payment";
import type { IPaymentStrategy } from "./IPaymentStrategy";

export class NetsStrategy implements IPaymentStrategy {
  private api: PaymentApi;
  private abortController: AbortController | null = null;
  private currentRequestId: string | null = null;
  private paymentProvider = PaymentProviderEnum.Nets;

  constructor(
    axios: AxiosInstance,
    private messaging: IMessagingAdapter,
    private config: PaymentTerminalConfig,
  ) {
    this.api = new PaymentApi(undefined, "", axios);
  }

  async processPayment(
    request: PaymentRequest,
    onStateChange: (
      state: PaymentInteractionState,
      detail?: { sessionId?: string },
    ) => void,
  ): Promise<PaymentResult> {
    this.abortController = new AbortController();
    onStateChange(PaymentInteractionState.CONNECTING);

    const purchasePayload: CreateNetsTerminalPaymentDto = {
      amount: request.amountCents,
      businessId: Number(this.config.storeId),
      referenceId: request.orderRef,
      currency: request.currency,
      displayId: request.displayId,
      options: {
        allowPinBypass: true,
        transactionType: TransactionType.Purchase,
      },
    };

    try {
      const { data } =
        await this.api.initiateNetsTerminalTransaction(purchasePayload);

      const requestId = data.connectCloudRequestId;

      if (!requestId) {
        throw new Error("connectCloudRequestId is missing from response.");
      }

      this.currentRequestId = requestId;

      if (this.abortController.signal.aborted) {
        throw new Error("Aborted");
      }

      onStateChange(PaymentInteractionState.REQUIRES_INPUT, {
        sessionId: requestId,
      });

      const result = await this.waitForPaymentCompletion(
        requestId,
        request.orderRef,
        this.abortController.signal,
      );

      this.currentRequestId = null;
      return result;
    } catch (err) {
      this.currentRequestId = null;
      if (err instanceof PaymentSDKError) throw err;

      throw new PaymentSDKError(
        PaymentErrorCode.TERMINAL_BUSY,
        "Failed to create Nets Intent",
        err,
      );
    }
  }

  private async waitForPaymentCompletion(
    requestId: string,
    orderRef: string,
    signal: AbortSignal,
  ): Promise<PaymentResult> {
    const channelName = `nets.requests.${requestId}`;
    const eventName = PaymentEventType.StatusChanged;

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
        reject(
          new PaymentSDKError(
            PaymentErrorCode.CANCELLED,
            "Transaction cancelled",
          ),
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
            resolve(this.handleSuccess(data));
          }
        },
      );

      const timer = setTimeout(async () => {
        if (isResolved || signal.aborted) return;

        try {
          const finalResult = await this.pollOrderStatus(
            requestId,
            orderRef,
            this.config.storeId,
            signal,
          );
          resolve(this.handleSuccess(finalResult));
        } catch (pollError) {
          reject(
            new PaymentSDKError(
              PaymentErrorCode.TIMEOUT,
              "Payment timed out and polling failed",
              pollError,
            ),
          );
        } finally {
          signal.removeEventListener("abort", onAbort);
          cleanup();
        }
      }, 10000);
    });
  }

  private async pollOrderStatus(
    requestId: string,
    orderRef: string,
    businessId: string,
    signal: AbortSignal,
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
        const { data } = await this.api.getPaymentStatus({
          businessId: Number(businessId),
          orderId: orderRef,
          provider: this.paymentProvider,
          referenceId: requestId,
        });

        if (data.status !== SimplePaymentStatus.Pending) return data;
      } catch (error) {
        throw new Error(
          `Payment verification failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
    throw new Error("Payment verification timed out.");
  }

  async cancelTransaction(
    _onStateChange: (state: PaymentInteractionState) => void,
  ): Promise<boolean> {
    if (!this.currentRequestId) return false;

    const payload: NetsCancelTransactionDto = {
      requestId: this.currentRequestId,
      businessId: Number(this.config.storeId),
    };

    try {
      await this.api.cancelNetsTerminalTransaction(payload);
      this.abortController?.abort();
      this.currentRequestId = null;
      return true;
    } catch (_e) {
      return false;
    }
  }

  async refundTransaction(
    request: RefundRequest,
    onStateChange: (
      state: PaymentInteractionState,
      detail?: { sessionId?: string },
    ) => void,
  ): Promise<PaymentResult> {
    try {
      this.abortController = new AbortController();

      const payload: CreateNetsTerminalPaymentDto = {
        amount: request.amountCents,
        businessId: Number(this.config.storeId),
        currency: request.currency,
        displayId: this.config.kioskId,
        referenceId: request.orderRef,
        options: {
          allowPinBypass: true,
          transactionType: TransactionType.ReturnOfGoods,
        },
      };

      const { data } = await this.api.initiateNetsTerminalTransaction(payload);

      const requestId = data.connectCloudRequestId;

      if (!requestId) {
        throw new Error("connectCloudRequestId is missing from response.");
      }

      this.currentRequestId = requestId;

      if (this.abortController.signal.aborted) {
        throw new Error("Aborted");
      }

      onStateChange(PaymentInteractionState.REQUIRES_INPUT, {
        sessionId: requestId,
      });

      const result = await this.waitForPaymentCompletion(
        requestId,
        request.orderRef,
        this.abortController.signal,
      );
      this.currentRequestId = null;

      return result;
    } catch (err) {
      this.currentRequestId = null;

      if (err instanceof PaymentSDKError) throw err;

      if (err instanceof PaymentSDKError) throw err;

      throw new PaymentSDKError(
        PaymentErrorCode.NETWORK_ERROR,
        "Failed to refund Nets transaction",
        err,
      );
    }
  }

  async verifyFinalStatus(
    request: PaymentRequest,
    sessionId: string,
  ): Promise<PaymentResult> {
    try {
      const { data } = await this.api.getPaymentStatus({
        businessId: Number(this.config.storeId),
        orderId: request.orderRef,
        provider: this.paymentProvider,
        referenceId: sessionId,
      });
      return this.handleSuccess(data);
    } catch (error) {
      throw new PaymentSDKError(
        PaymentErrorCode.NETWORK_ERROR,
        "Failed to verify final Nets status",
        error,
      );
    }
  }

  private handleSuccess(data: PaymentStatusDto): PaymentResult {
    const isSuccess = data.status === SimplePaymentStatus.Success;

    const result: PaymentResult = {
      success: isSuccess,
      status: isSuccess ? SdkPaymentStatus.SUCCESS : SdkPaymentStatus.FAILED,
      orderId: data.orderId,
      transaction: data.transaction as unknown as TransactionDto,
    };

    if (data.transactionId) {
      result.transactionId = data.transactionId;
    }

    if (data.error?.code) {
      result.errorCode = data.error.code;
    }

    if (data.error?.message) {
      result.errorMessage = data.error.message;
    }

    return result;
  }
}
