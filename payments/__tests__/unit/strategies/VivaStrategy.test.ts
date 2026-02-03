import type { AxiosInstance } from "axios";
import { PaymentApi } from "../../../../core";
import { VivaStrategy } from "../../../src/strategies/VivaStrategy";
import {
  PaymentInteractionState,
  type IMessagingAdapter,
  type PaymentTerminalConfig,
} from "../../../src/types/payment";
import {
  createMockAxios,
  createMockConfig,
  createMockMessaging,
} from "../../helpers/fixtures";
import {
  setupNetworkErrorMocks,
  setupSuccessfulPaymentMocks,
} from "../../helpers/mocks";

// Mock the PaymentApi class
jest.mock("../../../../core", () => {
  const actual = jest.requireActual("@munchi/core");
  return {
    ...actual,
    PaymentApi: jest.fn().mockImplementation(() => ({
      createVivaTransactionV3: jest.fn(),
      initiateTerminalTransaction: jest.fn(),
      cancelTransaction: jest.fn(),
      cancelVivaTransactionV2: jest.fn().mockResolvedValue(true), // Default to resolved for cancellation
      getPaymentStatus: jest.fn()
    })),
    KiosksApi: jest.fn().mockImplementation(() => ({
      getOrderStatus: jest.fn(),
    })),
  };
});

describe("VivaStrategy", () => {
  let mockAxios: jest.Mocked<AxiosInstance>;
  let mockMessaging: jest.Mocked<IMessagingAdapter>;
  let mockConfig: PaymentTerminalConfig;
  let strategy: VivaStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios = createMockAxios();
    mockMessaging = createMockMessaging();
    mockConfig = createMockConfig();
  });

  describe("processPayment", () => {
    it("should initiate transaction and wait for success", async () => {
      const mockApi = setupSuccessfulPaymentMocks(
        "order-123",
        "session-123",
        mockMessaging,
      );

      // Re-initialize strategy to pick up the newly mocked PaymentApi
      strategy = new VivaStrategy(mockAxios, mockMessaging, mockConfig);

      const onStateChange = jest.fn();

      const result = await strategy.processPayment(
        {
          orderRef: "order-123",
          amountCents: 1000,
          currency: "EUR",
          displayId: "display-123",
        },
        onStateChange,
      );

      expect(result.success).toBe(true);
      expect(result.orderId).toBe("order-123");
      expect(mockApi).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          businessId: 351,
          currency: "EUR",
          displayId: "display-123",
          referenceId: "order-123",
          showReceipt: true,
          showTransactionResult: true,
        }),
      );

      // Should transition through states
      expect(onStateChange).toHaveBeenCalledWith(
        PaymentInteractionState.CONNECTING,
      );
    });

    it("should handle network errors during initiation", async () => {
      setupNetworkErrorMocks();
      // Re-initialize strategy to pick up the newly mocked PaymentApi
      strategy = new VivaStrategy(mockAxios, mockMessaging, mockConfig);

      const onStateChange = jest.fn();

      try {
        await strategy.processPayment(
          {
            orderRef: "order-123",
            amountCents: 1000,
            currency: "EUR",
            displayId: "display-123",
          },
          onStateChange,
        );
        fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("NETWORK_ERROR");
      }
    });
  });

  describe("errorReference handling", () => {
    it("should include errorReference when present in error response", async () => {
      const mockCreateVivaTransaction = jest.fn().mockResolvedValue({
        data: { sessionId: "session-123", orderId: "order-123" },
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation((() => ({
        initiateTerminalTransaction: mockCreateVivaTransaction,
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
      })) as any);

      (mockMessaging.subscribe as jest.Mock).mockImplementation(
        (_channel, _event, callback) => {
          setTimeout(() => {
            callback({
              orderId: "order-123",
              status: "FAILED",
              error: {
                code: "CARD_DECLINED",
                message: "Card was declined",
                referenceError: "EVT-12345-ABC",
              },
            });
          }, 100);
          return jest.fn();
        },
      );

      strategy = new VivaStrategy(mockAxios, mockMessaging, mockConfig);
      const result = await strategy.processPayment(
        {
          orderRef: "order-123",
          amountCents: 1000,
          currency: "EUR",
          displayId: "display-123",
        },
        jest.fn(),
      );

      expect(result.success).toBe(false);
      expect(result.errorReference).toBe("EVT-12345-ABC");
      expect(result.errorCode).toBe("CARD_DECLINED");
      expect(result.errorMessage).toBe("Card was declined");
    });

    it("should not include errorReference when absent in error response", async () => {
      const mockCreateVivaTransaction = jest.fn().mockResolvedValue({
        data: { sessionId: "session-123", orderId: "order-123" },
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation((() => ({
        initiateTerminalTransaction: mockCreateVivaTransaction,
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
      })) as any);

      (mockMessaging.subscribe as jest.Mock).mockImplementation(
        (_channel, _event, callback) => {
          setTimeout(() => {
            callback({
              orderId: "order-123",
              status: "FAILED",
              error: {
                code: "TIMEOUT",
                message: "Transaction timed out",
              },
            });
          }, 100);
          return jest.fn();
        },
      );

      strategy = new VivaStrategy(mockAxios, mockMessaging, mockConfig);
      const result = await strategy.processPayment(
        {
          orderRef: "order-123",
          amountCents: 1000,
          currency: "EUR",
          displayId: "display-123",
        },
        jest.fn(),
      );

      expect(result.success).toBe(false);
      expect(result.errorReference).toBeUndefined();
      expect(result.errorCode).toBe("TIMEOUT");
      expect(result.errorMessage).toBe("Transaction timed out");
    });
  });

  describe("lifecycle", () => {
      it("should return false when cancelling without an active session", async () => {
          strategy = new VivaStrategy(mockAxios, mockMessaging, mockConfig);
          const result = await strategy.cancelTransaction(jest.fn());
          expect(result).toBe(false);
      });

     it("should cancel successfully with active session", async () => {
          strategy = new VivaStrategy(mockAxios, mockMessaging, mockConfig);
          
          // Manually set private property currentSessionId to simulate an active session
          (strategy as any).currentSessionId = "session-123";
          
          // Execute cancellation
          // The mock for cancelVivaTransactionV2 is set in the jest.mock factory to resolve true by default
          const result = await strategy.cancelTransaction(jest.fn());
          
          expect(result).toBe(true);
          expect((strategy as any).currentSessionId).toBeNull();
      });
  });
});
