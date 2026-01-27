import type {
  PaymentInteractionState,
  PaymentRequest,
  PaymentResult,
} from "../types/payment";

export interface IPaymentStrategy {
  initialize(): Promise<void>;
  disconnect(): Promise<void>;
  processPayment(
    request: PaymentRequest,
    onStateChange: (state: PaymentInteractionState) => void
  ): Promise<PaymentResult>;
  cancelTransaction(
    onStateChange: (state: PaymentInteractionState) => void
  ): Promise<boolean>;
  verifyFinalStatus(request: PaymentRequest): Promise<PaymentResult>;
}
