import type {
  PaymentInteractionState,
  PaymentRequest,
  PaymentResult,
  RefundRequest,
} from "../types/payment";

export interface IPaymentStrategy {

  processPayment(
    request: PaymentRequest,
    onStateChange: (state: PaymentInteractionState, detail?: { sessionId?: string }) => void,
  ): Promise<PaymentResult>;
  cancelTransaction(
    onStateChange: (state: PaymentInteractionState) => void,
  ): Promise<boolean>;
  refundTransaction(
    request: RefundRequest,
    onStateChange: (state: PaymentInteractionState, detail?: { sessionId?: string }) => void,
  ): Promise<PaymentResult>;
  verifyFinalStatus(request: PaymentRequest, sessionId: string): Promise<PaymentResult>;
  abort(): void;
}
