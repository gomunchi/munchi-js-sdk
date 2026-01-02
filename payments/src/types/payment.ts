import type { PaymentProvider, TransactionDto } from "@munchi/core";

export type TransactionDetails = Omit<
  TransactionDto,
  "id" | "createdAt" | "provider"
>;

export enum SdkPaymentStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  ERROR = "ERROR",
}

export enum PaymentInteractionState {
  IDLE = "IDLE",
  CONNECTING = "CONNECTING",
  REQUIRES_INPUT = "REQUIRES_INPUT",
  PROCESSING = "PROCESSING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

export interface VivaOptions {
  installments?: number;
  tipAmount?: number;
  sourceCode?: string;
}

export interface NetsOptions {
  vatAmount?: number;
  operatorId?: string;
}

export interface PaymentRequest {
  orderRef: string;
  amountCents: number;
  currency: string;
  options?: VivaOptions | NetsOptions;
}

export interface PaymentTerminalConfig {
  provider: PaymentProvider;
  terminalId: string;
  storeId: string;
}

export interface PaymentResult {
  success: boolean;
  status: SdkPaymentStatus;
  orderId: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface IMessagingAdapter {
  subscribe<T>(
    channel: string,
    event: string,
    onMessage: (data: T) => void,
  ): () => void;
}
