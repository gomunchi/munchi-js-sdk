import {
  type PaymentInteractionState,
  type PaymentRequest,
  type PaymentResult,
  SdkPaymentStatus,
} from "../types/payment";
import type { IPaymentStrategy } from "./IPaymentStrategy";

export class MockStrategy implements IPaymentStrategy {
  async initialize(): Promise<void> {
    console.log("[MockSDK] Initialized");
  }

  async disconnect(): Promise<void> {
    console.log("[MockSDK] Disconnected");
  }

  async processPayment(
    request: PaymentRequest,
    _onStateChange: (state: PaymentInteractionState, detail?: { sessionId?: string }) => void,
  ): Promise<PaymentResult> {
    console.log("[MockSDK] Processing...", request);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      success: true,
      status: SdkPaymentStatus.SUCCESS,
      orderId: request.orderRef,
    };
  }

  async cancelTransaction(
    _onStateChange: (state: PaymentInteractionState) => void,
  ): Promise<boolean> {
    console.log("[MockSDK] Cancelled");
    return true;
  }

  async verifyFinalStatus(request: PaymentRequest, sessionId: string): Promise<PaymentResult> {
    return {
      success: false,
      status: SdkPaymentStatus.FAILED,
      orderId: request.orderRef,
    };
  }
}
