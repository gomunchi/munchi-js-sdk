import type {
    CurrencyCode,
    PaymentProvider,
    ProviderEnum,
    TransactionDto,
} from "@munchi/core";

export type TransactionDetails = Omit<
  TransactionDto,
  "id" | "createdAt" | "provider"
>;

export enum SdkPaymentStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  APPROVED = "APPROVED",
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
  INTERNAL_ERROR = "INTERNAL_ERROR",
  VERIFYING = "VERIFYING",
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

export interface VivaRefundOptions extends VivaOptions {
  // Viva specific extensions if needed
}

export interface NetsRefundOptions extends NetsOptions {
  allowPinBypass?: boolean;
}

export interface PaymentRequest {
  orderRef: string;
  amountCents: number;
  currency: CurrencyCode;
  displayId: string;
  options?: VivaOptions | NetsOptions;
}

export interface RefundRequest {
  amountCents: number;
  orderRef: string;
  currency: CurrencyCode;
  displayId: string;
  /**
   * The ID of the original payment transaction.
   * Maps to:
   * - Viva: parentSessionId
   * - Nets: preAuthorizationInfo (or reference)
   */
  originalTransactionId: string;
  options?: VivaRefundOptions | NetsRefundOptions;
}

export interface PaymentTerminalConfig {
  channel: ProviderEnum,
  provider?: PaymentProvider | null;
  kioskId: string;
  storeId: string;
}

export interface PaymentResult {
  success: boolean;
  status: SdkPaymentStatus;
  orderId: string;
  transactionId?: string;
  errorReference?: string;
  errorCode?: string;
  errorMessage?: string;
  transaction?: TransactionDto;
}

export interface TransactionOptions {
  onConnecting?: (ctx: { orderRef: string; refPaymentId?: string | undefined }) => void;
  onRequiresInput?: (ctx: { orderRef: string; refPaymentId?: string | undefined }) => void;
  onProcessing?: (ctx: { orderRef: string; refPaymentId?: string | undefined }) => void;
  onVerifying?: (ctx: { orderRef: string; refPaymentId?: string | undefined }) => void;
  onSuccess?: (result: PaymentResult) => void;
  onError?: (result: PaymentResult) => void;
  onCancelled?: (ctx: { orderRef: string; refPaymentId?: string | undefined }) => void;
}

export interface IMessagingAdapter {
  subscribe<T>(
    channel: string,
    event: string,
    onMessage: (data: T) => void,
  ): () => void;
}

export interface IMunchiPaymentSDK {
  readonly version: string;
  readonly currentState: PaymentInteractionState;
  readonly nextAutoResetAt: number | undefined;
  subscribe(listener: (state: PaymentInteractionState) => void): () => void;
  initiateTransaction(
    params: PaymentRequest,
    options?: TransactionOptions,
  ): Promise<PaymentResult>;
  cancel(): Promise<boolean>;
  refund(params: RefundRequest, options?: TransactionOptions): Promise<PaymentResult>;
  reset(): void;
}
