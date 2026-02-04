
import { PaymentProvider, ProviderEnum } from "@munchi/core";
import type { AxiosInstance } from "axios";
import type {
    IMessagingAdapter,
    PaymentTerminalConfig,
} from "../../src/types/payment";
import type { ILogger } from "../../src/types/sdk";

/**
 * Creates a mock AxiosInstance for testing
 */
export function createMockAxios(): jest.Mocked<AxiosInstance> {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<AxiosInstance>;
}

/**
 * Creates a mock IMessagingAdapter for testing
 */
export function createMockMessaging(): jest.Mocked<IMessagingAdapter> {
  return {
    send: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    publish: jest.fn(),
  } as jest.Mocked<IMessagingAdapter>;
}

/**
 * Creates a mock PaymentTerminalConfig with Viva provider
 */
export function createMockConfig(): PaymentTerminalConfig {
  return {
    channel: ProviderEnum.MunchiKiosk,
    provider: PaymentProvider.Viva,
    kioskId: "test-kiosk-123",
    storeId: "351",
  };
}

/**
 * Creates a mock PaymentTerminalConfig without provider (uses default)
 */
export function createMockConfigWithoutProvider(): PaymentTerminalConfig {
  return {
    channel: ProviderEnum.MunchiKiosk,
    kioskId: "test-kiosk-123",
    storeId: "351",
  };
}

/**
 * Creates a mock ILogger for testing
 */
export function createMockLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
