import { AxiosInstance } from 'axios';
import { PaymentProvider, TransactionDto } from '@munchi/core';

type TransactionDetails = Omit<TransactionDto, "id" | "createdAt" | "provider">;
declare enum SdkPaymentStatus {
    PENDING = "PENDING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED",
    ERROR = "ERROR"
}
declare enum PaymentInteractionState {
    IDLE = "IDLE",
    CONNECTING = "CONNECTING",
    REQUIRES_INPUT = "REQUIRES_INPUT",
    PROCESSING = "PROCESSING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
    INTERNAL_ERROR = "INTERNAL_ERROR"
}
interface VivaOptions {
    installments?: number;
    tipAmount?: number;
    sourceCode?: string;
}
interface NetsOptions {
    vatAmount?: number;
    operatorId?: string;
}
interface PaymentRequest {
    orderRef: string;
    amountCents: number;
    currency: string;
    options?: VivaOptions | NetsOptions;
}
interface PaymentTerminalConfig {
    provider: PaymentProvider;
    kioskId: string;
    storeId: string;
}
interface PaymentResult {
    success: boolean;
    status: SdkPaymentStatus;
    orderId: string;
    errorCode?: string;
    errorMessage?: string;
}
interface IMessagingAdapter {
    subscribe<T>(channel: string, event: string, onMessage: (data: T) => void): () => void;
}

interface ILogger {
    info(message: string, meta?: Record<string, unknown>): void;
    error(message: string, error?: unknown, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
}
interface SDKOptions {
    timeoutMs?: number;
    logger?: ILogger;
}

declare class MunchiPaymentSDK {
    private strategy;
    private config;
    private axios;
    private messaging;
    private timeoutMs;
    private logger?;
    constructor(axios: AxiosInstance, messaging: IMessagingAdapter, config: PaymentTerminalConfig, options?: SDKOptions);
    get version(): string;
    private resolveStrategy;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    initiateTransaction(params: PaymentRequest, onStateChange: (state: PaymentInteractionState) => void): Promise<PaymentResult>;
    cancel(onStateChange: (state: PaymentInteractionState) => void): Promise<boolean>;
}

declare enum AppReaderStatus {
    CONNECTING = "CONNECTING",
    CONNECTED = "CONNECTED",
    OFFLINE = "OFFLINE",
    DISCONNECTED = "DISCONNECTED"
}
interface AppReader {
    id: string;
    serialNumber: string | null;
    label: string;
    status: AppReaderStatus;
    batteryLevel?: number | null;
    providerRawData?: unknown;
}

declare const VERSION = "1.0.6";

export { type AppReader, AppReaderStatus, type ILogger, type IMessagingAdapter, MunchiPaymentSDK, type NetsOptions, PaymentInteractionState, type PaymentRequest, type PaymentResult, type PaymentTerminalConfig, type SDKOptions, SdkPaymentStatus, type TransactionDetails, VERSION, type VivaOptions };
