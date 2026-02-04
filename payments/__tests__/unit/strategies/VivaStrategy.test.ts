import { PaymentApi, PaymentMethod, PaymentProvider, type TransactionDto } from "@munchi/core";
import type { AxiosInstance } from "axios";
import { VivaStrategy } from "../../../src/strategies/VivaStrategy";
import {
  type IMessagingAdapter,
  PaymentInteractionState,
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
jest.mock("@munchi/core", () => {
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

    it("should include transactionId when available in success response", async () => {
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
              status: "SUCCESS",
              transactionId: "trans-456",
              error: null,
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

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("trans-456");
    });

    it("should include transaction object when available in success response", async () => {
      const mockCreateVivaTransaction = jest.fn().mockResolvedValue({
        data: { sessionId: "session-123", orderId: "order-123" },
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation((() => ({
        initiateTerminalTransaction: mockCreateVivaTransaction,
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
      })) as any);

      const mockTransaction: TransactionDto = {
        id: "trans-123",
        amount: 1000,
        createdAt: new Date().toISOString(),
        provider: PaymentProvider.Viva,
        referenceId: "order-viva-123",
        rawData: {},
        cardDetail: null,
        type: PaymentMethod.Card,
        label: null,
        roundingDifference: 0
      };

      (mockMessaging.subscribe as jest.Mock).mockImplementation(
        (_channel, _event, callback) => {
          setTimeout(() => {
            callback({
              orderId: "order-123",
              status: "SUCCESS",
              transaction: mockTransaction,
              error: null,
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

      expect(result.success).toBe(true);
      expect(result.transaction).toEqual(mockTransaction);
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

  describe("refundTransaction", () => {
    it("should refund successfully", async () => {
      const mockRefundTransaction = jest.fn().mockResolvedValue({
        data: {
          success: true,
          eventId: 0,
          transactionId: "refund-trans-123",
          sessionId: "session-refund",
          amount: 1000,
          terminalId: "term-1",
          cashRegisterId: "reg-1",
          currencyCode: 978, // EUR
        }
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation((() => ({
        createVivaTransactionV3: jest.fn(),
        initiateTerminalTransaction: jest.fn(),
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
        getPaymentStatus: jest.fn(),
        refundSingleVivaTransaction: mockRefundTransaction
      })) as any);

      strategy = new VivaStrategy(mockAxios, mockMessaging, mockConfig);

      const result = await strategy.refundTransaction({
        amountCents: 1000,
        orderRef: "order-123",
        currency: "EUR",
        displayId: "refund-1",
        originalTransactionId: "parent-session-123",
      }, jest.fn());

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("session-refund");
      expect(mockRefundTransaction).toHaveBeenCalledWith(expect.objectContaining({
        amount: 1000,
        businessId: 351,
        currency: "EUR",
        displayId: "test-kiosk-123",
        orderReferenceId: "order-123",
        referenceId: "parent-session-123",
      }));
    });

    it("should handle refund failure", async () => {
      const mockRefundTransaction = jest.fn().mockResolvedValue({
        data: {
          success: false,
          eventId: 1234, // Some error code
          transactionId: "refund-fail-123",
          sessionId: "session-refund-fail",
          amount: 1000,
          terminalId: "term-1",
          cashRegisterId: "reg-1",
          currencyCode: 978,
        }
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation((() => ({
        createVivaTransactionV3: jest.fn(),
        initiateTerminalTransaction: jest.fn(),
        cancelTransaction: jest.fn(),
        cancelVivaTransactionV2: jest.fn().mockResolvedValue(true),
        getPaymentStatus: jest.fn(),
        refundSingleVivaTransaction: mockRefundTransaction
      })) as any);

      strategy = new VivaStrategy(mockAxios, mockMessaging, mockConfig);

      const result = await strategy.refundTransaction({
        amountCents: 1000,
        orderRef: "order-123",
        currency: "EUR",
        displayId: "refund-1",
        originalTransactionId: "parent-session-123",
      }, jest.fn());

      expect(result.success).toBe(false);
    });
  });
});
