import type { AxiosInstance } from "axios";
import {
  type CreateTerminalPaymentDto,
    PaymentApi,
    PaymentProviderEnum,
    type PaymentStatusDto,
    SimplePaymentStatus,
    type TransactionDto,
} from "../../../core";

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
  private abortController: AbortController | null = null;
  private currentSessionId: string | null = null;
  private paymentProvider = PaymentProviderEnum.Viva;
  constructor(
    axios: AxiosInstance,
    private messaging: IMessagingAdapter,
    private config: PaymentTerminalConfig,
  ) {
    this.api = new PaymentApi(undefined, "", axios);
  }



  async processPayment(
    request: PaymentRequest,
    onStateChange: (state: PaymentInteractionState, detail?: { sessionId?: string }) => void,
  ): Promise<PaymentResult> {
    this.abortController = new AbortController();
    onStateChange(PaymentInteractionState.CONNECTING);

    const payload: CreateTerminalPaymentDto = {
      amount: request.amountCents,
      referenceId: request.orderRef,
      businessId: parseInt(this.config.storeId),
      currency: request.currency,
      displayId: request.displayId,
      showReceipt: true,
      showTransactionResult: true,
    };

    try {
      const { data } = await this.api.initiateTerminalTransaction(payload);
      this.currentSessionId = data.sessionId;

      if (this.abortController.signal.aborted) {
        throw new Error("Aborted");
      }

      onStateChange(PaymentInteractionState.REQUIRES_INPUT, { sessionId: data.sessionId });

      const result = await this.waitForPaymentCompletion(
        data.sessionId,
        request.orderRef,
        this.abortController.signal,
      );

      this.currentSessionId = null;
      return result;
    } catch (err) {
      this.currentSessionId = null;
      if (err instanceof PaymentSDKError) throw err;
      throw new PaymentSDKError(
        PaymentErrorCode.NETWORK_ERROR,
        "Failed to create Viva Intent",
        err,
      );
    }
  }

  private async waitForPaymentCompletion(
    sessionId: string,
    orderRef: string,
    signal: AbortSignal,
  ): Promise<PaymentResult> {
    const channel = this.config.channel.toLowerCase()
    const channelName = `viva.${channel}.requests.${sessionId}`;
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
            resolve(this.handleSuccess(data));
          }
        },
      );

      const timer = setTimeout(async () => {
        if (isResolved || signal.aborted) return;

        try {
          const finalResult = await this.pollOrderStatus(
            sessionId,
            orderRef,
            this.config.storeId,
            signal,
          );
          resolve(this.handleSuccess(finalResult));
        } catch (pollError) {
          // SDK handles the FAILED state when we reject
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
    sessionId: string,
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
        const { data } = await this.api.getPaymentStatus(
          {
            businessId: Number(businessId),
            orderId: orderRef,
            provider: this.paymentProvider,
            referenceId: sessionId,
          }
        );
        if (data.status !== SimplePaymentStatus.Pending) return data;
      } catch (error) {
        throw new Error(`Payment verification failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
    throw new Error("Payment verification timed out.");
  }

  private handleSuccess(
    data: PaymentStatusDto,
  ): PaymentResult {
    const isSuccess = data.status === SimplePaymentStatus.Success;
    
    const result: PaymentResult = {
      success: isSuccess,
      status: isSuccess ? SdkPaymentStatus.SUCCESS : SdkPaymentStatus.FAILED,
      orderId: data.orderId,
      errorCode: data.error?.code ?? "",
      errorMessage: data.error?.message ?? "",
    };

    if (data.transactionId) {
      result.transactionId = data.transactionId;
    }

    if (data.error?.referenceError) {
      result.errorReference = data.error.referenceError;
    }

    if (data.transaction) {
      result.transaction = data.transaction as unknown as TransactionDto;
    }

    return result;
  }

  async cancelTransaction(
    _onStateChange: (state: PaymentInteractionState) => void,
  ): Promise<boolean> {
    if (!this.currentSessionId) {
      return false;
    }

    try {
      const sessionIdToCancel = this.currentSessionId;
      this.currentSessionId = null;
      await this.api.cancelVivaTransactionV2({
        cashRegisterId: this.config.storeId,
        sessionId: sessionIdToCancel,
      });
      this.abortController?.abort();
      return true;
    } catch (error) {
      // If we failed to cancel (e.g. 409 Conflict), we should NOT abort the controller
      // because the transaction might still be valid/processing.
      this.currentSessionId = null;
      throw new PaymentSDKError(
        PaymentErrorCode.NETWORK_ERROR,
        "Failed to cancel Viva transaction",
        error,
      );
    }
  }

  async verifyFinalStatus(request: PaymentRequest, sessionId: string): Promise<PaymentResult> {
    try {
      const { data } = await this.api.getPaymentStatus(
        {
          businessId: Number(this.config.storeId),
          orderId: request.orderRef,
          provider: this.paymentProvider,
          referenceId: sessionId,
        }
      );

      const isSuccess = data.status === SimplePaymentStatus.Success;

      const result: PaymentResult = {
        success: isSuccess,
        status: isSuccess ? SdkPaymentStatus.SUCCESS : SdkPaymentStatus.FAILED,
        orderId: data.orderId,
        errorCode: data.error?.code ?? "",
        errorMessage: data.error?.message ?? "",
      };

      if (data.transactionId) {
        result.transactionId = data.transactionId;
      }

      if (data.error?.referenceError) {
        result.errorReference = data.error.referenceError;
      }

      if (data.transaction) {
        result.transaction = data.transaction as unknown as TransactionDto;
      }

      return result;
    } catch (error) {
      throw new PaymentSDKError(
        PaymentErrorCode.NETWORK_ERROR,
        "Failed to verify final transaction status",
        error,
      );
    }
  }
}
