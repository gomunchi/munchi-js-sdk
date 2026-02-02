import type {
  PaymentInteractionState,
  PaymentRequest,
  PaymentResult,
} from "../types/payment";

export interface IPaymentStrategy {

  processPayment(
    request: PaymentRequest,
    onStateChange: (state: PaymentInteractionState, detail?: { sessionId?: string }) => void,
  ): Promise<PaymentResult>;
  cancelTransaction(
    onStateChange: (state: PaymentInteractionState) => void,
  ): Promise<boolean>;
  verifyFinalStatus(request: PaymentRequest, sessionId: string): Promise<PaymentResult>;
}
