import { PaymentProvider } from '@munchi/core';
import type { AxiosInstance } from 'axios';
import type { IMessagingAdapter, PaymentTerminalConfig } from '../../src/types/payment';

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
    } as jest.Mocked<IMessagingAdapter>;
}

/**
 * Creates a mock PaymentTerminalConfig with Viva provider
 */
export function createMockConfig(): PaymentTerminalConfig {
    return {
        provider: PaymentProvider.Viva,
        kioskId: "test-kiosk-123",
        storeId: "351"
    };
}

/**
 * Creates a mock PaymentTerminalConfig without provider (uses default)
 */
export function createMockConfigWithoutProvider(): PaymentTerminalConfig {
    return {
        kioskId: "test-kiosk-123",
        storeId: "351"
    };
}
