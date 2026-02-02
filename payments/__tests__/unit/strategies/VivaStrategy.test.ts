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
