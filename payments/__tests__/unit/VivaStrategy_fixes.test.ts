import {
  CurrencyCode,
  PaymentApi,
  PaymentFailureCode,
  SimplePaymentStatus
} from "@munchi_oy/core";
import type { AxiosInstance } from "axios";
import { VivaStrategy } from "../../src/strategies/VivaStrategy";
import type { IMessagingAdapter } from "../../src/types/payment";
import {
  createMockAxios,
  createMockConfig,
  createMockMessaging,
} from "../helpers/fixtures";

// Mock dependencies
jest.mock("@munchi_oy/core", () => {
  const actual = jest.requireActual("@munchi_oy/core");
  return {
    ...actual,
    PaymentApi: jest.fn(),
  };
});

describe("VivaStrategy Fixes Verification", () => {
  let strategy: VivaStrategy;
  let mockAxios: jest.Mocked<AxiosInstance>;
  let mockMessaging: jest.Mocked<IMessagingAdapter>;
  let mockPaymentApi: {
    getPaymentStatus: jest.Mock;
    initiateTerminalTransaction: jest.Mock;
    cancelVivaTransactionV2: jest.Mock;
    refundSingleVivaTransaction: jest.Mock;
  };

  beforeEach(() => {
    mockAxios = createMockAxios();
    mockMessaging = createMockMessaging();
    const config = createMockConfig();
    
    mockPaymentApi = {
      getPaymentStatus: jest.fn(),
      initiateTerminalTransaction: jest.fn(),
      cancelVivaTransactionV2: jest.fn(),
      refundSingleVivaTransaction: jest.fn(),
    };
    (PaymentApi as unknown as jest.Mock).mockImplementation(() => mockPaymentApi);

    strategy = new VivaStrategy(mockAxios, mockMessaging, config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Fix 5: Enhance Strategy Error Mapping", () => {
    it("should fallback to SystemUnknown error code when API returns FAILED without error details", async () => {
      // Mock API returning FAILED status but no error object
      mockPaymentApi.getPaymentStatus.mockResolvedValue({
        data: {
          status: "Failed",
          orderId: "order-fail-empty",
          // error: undefined // Simulating missing error
        },
      });

      const params = {
        orderRef: "order-fail-empty",
        amountCents: 1000,
        currency: CurrencyCode.Eur,
        displayId: "Display-1",
      };

      const result = await strategy.verifyFinalStatus(params, "session-123");

      expect(result.success).toBe(false);
      // Validate the fallback logic
      expect(result.errorCode).toBe(PaymentFailureCode.SystemUnknown);
      expect(result.errorMessage).toBe("Transaction failed without error details");
    });

    it("should preserve actual error details if present", async () => {
      // Mock API returning FAILED status WITH error object
      mockPaymentApi.getPaymentStatus.mockResolvedValue({
        data: {
          status: "Failed",
          orderId: "order-fail-explicit",
          error: {
            code: "terminal.timeout",
            message: "Terminal timed out explicitly",
          },
        },
      });

      const params = {
        orderRef: "order-fail-explicit",
        amountCents: 1000,
        currency: CurrencyCode.Eur,
        displayId: "Display-1",
      };

      const result = await strategy.verifyFinalStatus(params, "session-123");

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("terminal.timeout");
      expect(result.errorMessage).toBe("Terminal timed out explicitly");
    });

    it("should return TerminalTimeout error when payment status is Pending", async () => {
      mockPaymentApi.getPaymentStatus.mockResolvedValue({
        data: {
          status: SimplePaymentStatus.Pending,
          orderId: "order-pending",
        },
      });

      const params = {
        orderRef: "order-pending",
        amountCents: 1000,
        currency: CurrencyCode.Eur,
        displayId: "Display-1",
      };

      const result = await strategy.verifyFinalStatus(params, "session-123");

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(PaymentFailureCode.TerminalTimeout);
      expect(result.errorMessage).toBe("Payment was not completed within the allowed time");
    });
  });
});
