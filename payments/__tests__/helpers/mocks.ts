import { PaymentApi, SimplePaymentStatus } from "@munchi/core";
import type { IMessagingAdapter } from "../../src/types/payment";

// Type assertion to access mock methods
const MockedPaymentApi = PaymentApi as jest.MockedClass<typeof PaymentApi>;

/**
 * Sets up mocks for a successful payment flow
 * @param orderId - The order ID to use in the mock
 * @param sessionId - The session ID to return from the API
 * @param mockMessaging - The mocked messaging adapter
 * @returns The mocked createVivaTransactionV3 function for assertions
 */
export function setupSuccessfulPaymentMocks(
  orderId: string,
  sessionId: string,
  mockMessaging: jest.Mocked<IMessagingAdapter>,
) {
  const mockCreateVivaTransaction = jest.fn().mockResolvedValue({
    data: { sessionId, orderId },
  });

  MockedPaymentApi.mockImplementation((() => ({
    initiateTerminalTransaction: mockCreateVivaTransaction,
    cancelTransaction: jest.fn(),
    cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
  })) as any);

  (mockMessaging.subscribe as jest.Mock).mockImplementation(
    (channel, event, callback) => {
      setTimeout(() => {
        callback({
          orderId,
          status: SimplePaymentStatus.Success,
          error: null,
        });
      }, 100);
      return jest.fn();
    },
  );

  return mockCreateVivaTransaction;
}

/**
 * Sets up mocks for a failed payment scenario
 */
export function setupFailedPaymentMocks(
  orderId: string,
  sessionId: string,
  mockMessaging: jest.Mocked<IMessagingAdapter>,
  error?: { code: string; message: string },
) {
  const mockCreateVivaTransaction = jest.fn().mockResolvedValue({
    data: { sessionId, orderId },
  });

  MockedPaymentApi.mockImplementation((() => ({
    initiateTerminalTransaction: mockCreateVivaTransaction,
    cancelTransaction: jest.fn(),
    cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
  })) as any);

  (mockMessaging.subscribe as jest.Mock).mockImplementation(
    (channel, event, callback) => {
      setTimeout(() => {
        callback({
          orderId,
          status: SimplePaymentStatus.Failed,
          error: error || {
            code: "payment.failed",
            message: "Payment failed",
          },
        });
      }, 100);
      return jest.fn();
    },
  );

  return mockCreateVivaTransaction;
}

/**
 * Sets up mocks for a network error scenario
 */
export function setupNetworkErrorMocks() {
  MockedPaymentApi.mockImplementation((() => ({
    initiateTerminalTransaction: jest
      .fn()
      .mockRejectedValue(new Error("Network error")),
    cancelTransaction: jest.fn(),
    cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
  })) as any);
}

/**
 * Sets up mocks for a timeout scenario that falls back to polling
 */
export function setupTimeoutWithPollingMocks(
  orderId: string,
  sessionId: string,
  mockMessaging: jest.Mocked<IMessagingAdapter>,
  pollStatus: SimplePaymentStatus,
  error?: { code: string; message: string },
) {
  const mockCreateVivaTransaction = jest.fn().mockResolvedValue({
    data: { sessionId, orderId },
  });

  const mockGetPaymentStatus = jest.fn().mockResolvedValue({
    data: {
      orderId,
      status: pollStatus,
      error: error || null,
    },
  });

  MockedPaymentApi.mockImplementation((() => ({
    initiateTerminalTransaction: mockCreateVivaTransaction,
    cancelTransaction: jest.fn(),
    cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
    getPaymentStatus: mockGetPaymentStatus,
  })) as any);

  // Messaging does nothing
  (mockMessaging.subscribe as jest.Mock).mockReturnValue(jest.fn());

  return { mockCreateVivaTransaction, mockGetPaymentStatus };
}
