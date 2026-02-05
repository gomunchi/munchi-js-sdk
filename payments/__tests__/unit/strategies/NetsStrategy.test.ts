import { PaymentApi, PaymentProvider, SimplePaymentStatus } from "@munchi/core";
import type { AxiosInstance } from "axios";
import { PaymentErrorCode, PaymentSDKError } from "../../../src/error";
import { NetsStrategy } from "../../../src/strategies/NetsStrategy";
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

// Mock the PaymentApi class
jest.mock("@munchi/core", () => {
  const actual = jest.requireActual("@munchi/core");
  return {
    ...actual,
    PaymentApi: jest.fn().mockImplementation(() => ({
      initiateNetsTerminalTransaction: jest.fn(),
      cancelNetsTerminalTransaction: jest.fn(),
      getPaymentStatus: jest.fn(),
    })),
  };
});

describe("NetsStrategy", () => {
  let mockAxios: jest.Mocked<AxiosInstance>;
  let mockMessaging: jest.Mocked<IMessagingAdapter>;
  let mockConfig: PaymentTerminalConfig;
  let strategy: NetsStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios = createMockAxios();
    mockMessaging = createMockMessaging();
    mockConfig = {
      ...createMockConfig(),
      provider: PaymentProvider.Nets,
    };
  });

  describe("processPayment", () => {
    it("should initiate transaction and wait for success via Ably", async () => {
      const mockRequestId = "connect-cloud-req-123";
      const mockInitiate = jest.fn().mockResolvedValue({
        data: { connectCloudRequestId: mockRequestId },
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation(
        (() => ({
          initiateNetsTerminalTransaction: mockInitiate,
        })) as any,
      );

      (mockMessaging.subscribe as jest.Mock).mockImplementation(
        (_channel, _event, callback) => {
          setTimeout(() => {
            callback({
              status: SimplePaymentStatus.Success,
              orderId: "order-123",
              transactionId: "trans-456",
              transaction: {}, // Mock transaction object
            });
          }, 50);
          return jest.fn();
        },
      );

      strategy = new NetsStrategy(mockAxios, mockMessaging, mockConfig);
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
      expect(result.transactionId).toBe("trans-456");
      expect(mockInitiate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          businessId: expect.any(Number),
          referenceId: "order-123",
          options: expect.objectContaining({
            transactionType: "purchase",
          }),
        }),
      );
      expect(onStateChange).toHaveBeenCalledWith(
        PaymentInteractionState.CONNECTING,
      );
      expect(onStateChange).toHaveBeenCalledWith(
        PaymentInteractionState.REQUIRES_INPUT,
        expect.objectContaining({ sessionId: mockRequestId }),
      );
    });

    it("should handle failure response via Ably", async () => {
      const mockRequestId = "connect-cloud-req-fail";

      const mockInitiate = jest.fn().mockResolvedValue({
        data: { connectCloudRequestId: mockRequestId },
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation(
        (() => ({
          initiateNetsTerminalTransaction: mockInitiate,
        })) as any,
      );

      (mockMessaging.subscribe as jest.Mock).mockImplementation(
        (_channel, _event, callback) => {
          setTimeout(() => {
            callback({
              status: SimplePaymentStatus.Failed,
              orderId: "order-fail",
              error: {
                code: "123",
                message: "Payment declined",
              },
            });
          }, 50);
          return jest.fn();
        },
      );

      strategy = new NetsStrategy(mockAxios, mockMessaging, mockConfig);

      const result = await strategy.processPayment(
        {
          orderRef: "order-fail",
          amountCents: 1000,
          currency: "EUR",
          displayId: "disp",
        },
        jest.fn(),
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("123");
      expect(result.errorMessage).toBe("Payment declined");
    });

    it("should fallback to polling on timeout and succeed", async () => {
      jest.useFakeTimers();
      const mockRequestId = "req-timeout";

      const mockGetPaymentStatus = jest.fn().mockResolvedValue({
        data: {
          status: SimplePaymentStatus.Success,
          orderId: "order-123",
          transactionId: "trans-poll-123",
          transaction: {},
        },
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation(
        (() => ({
          initiateNetsTerminalTransaction: jest.fn().mockResolvedValue({
            data: { connectCloudRequestId: mockRequestId },
          }),
          getPaymentStatus: mockGetPaymentStatus,
        })) as any,
      );

      // Subscribe does nothing (simulating no Ably message)
      (mockMessaging.subscribe as jest.Mock).mockReturnValue(jest.fn());

      strategy = new NetsStrategy(mockAxios, mockMessaging, mockConfig);

      const paymentPromise = strategy.processPayment(
        {
          orderRef: "order-123",
          amountCents: 1000,
          currency: "EUR",
          displayId: "disp",
        },
        jest.fn(),
      );

      // Allow initiate to resolve
      await Promise.resolve();
      await Promise.resolve();

      // Fast-forward time to trigger timeout (10000ms is the timeout in waitForPaymentCompletion)
      jest.advanceTimersByTime(11000);

      // We also need to advance timers for polling interval? pollOrderStatus uses 2000ms interval.
      // The first call happens immediately inside pollOrderStatus loop? No, it enters loop, checks aborted, tries api.

      const result = await paymentPromise;

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("trans-poll-123");
      expect(mockGetPaymentStatus).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it("should fallback to polling and fail if polling returns failure", async () => {
      jest.useFakeTimers();
      const mockRequestId = "req-timeout-fail";

      const mockGetPaymentStatus = jest.fn().mockResolvedValue({
        data: {
          status: SimplePaymentStatus.Failed,
          orderId: "order-123",
          error: { code: "ERR_POLL", message: "Polling failed" },
        },
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation(
        (() => ({
          initiateNetsTerminalTransaction: jest.fn().mockResolvedValue({
            data: { connectCloudRequestId: mockRequestId },
          }),
          getPaymentStatus: mockGetPaymentStatus,
        })) as any,
      );

      (mockMessaging.subscribe as jest.Mock).mockReturnValue(jest.fn());

      strategy = new NetsStrategy(mockAxios, mockMessaging, mockConfig);

      const paymentPromise = strategy.processPayment(
        {
          orderRef: "order-123",
          amountCents: 1000,
          currency: "EUR",
          displayId: "disp",
        },
        jest.fn(),
      );

      await Promise.resolve();
      await Promise.resolve();

      jest.advanceTimersByTime(11000);

      const result = await paymentPromise;

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("ERR_POLL");

      jest.useRealTimers();
    });

    it("should return CANCELLED error code if transaction is cancelled via cancelTransaction", async () => {
      const mockRequestId = "req-cancel";
      const mockInitiate = jest.fn().mockResolvedValue({
        data: { connectCloudRequestId: mockRequestId },
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation(
        (() => ({
          initiateNetsTerminalTransaction: mockInitiate,
          cancelNetsTerminalTransaction: jest.fn().mockResolvedValue({}),
        })) as any,
      );

      (mockMessaging.subscribe as jest.Mock).mockReturnValue(jest.fn());

      strategy = new NetsStrategy(mockAxios, mockMessaging, mockConfig);

      const paymentPromise = strategy.processPayment(
        {
          orderRef: "order-cancel",
          amountCents: 1000,
          currency: "EUR",
          displayId: "disp",
        },
        jest.fn(),
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      const cancelResult = await strategy.cancelTransaction(jest.fn());
      expect(cancelResult).toBe(true);

      try {
        await paymentPromise;
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentSDKError);
        expect((error as PaymentSDKError).code).toBe(
          PaymentErrorCode.CANCELLED,
        );
      }
    });

    it("should return TERMINAL_BUSY if a new transaction is started immediately after cancellation and API rejects", async () => {
      const mockRequestId1 = "req-1";
      const mockInitiate = jest
        .fn()
        .mockResolvedValueOnce({
          data: { connectCloudRequestId: mockRequestId1 },
        })
        .mockRejectedValueOnce(new Error("Terminal is busy"));

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation(
        (() => ({
          initiateNetsTerminalTransaction: mockInitiate,
          cancelNetsTerminalTransaction: jest.fn().mockResolvedValue({}),
        })) as any,
      );

      (mockMessaging.subscribe as jest.Mock).mockReturnValue(jest.fn());

      strategy = new NetsStrategy(mockAxios, mockMessaging, mockConfig);

      // 1. Start first payment
      const paymentPromise1 = strategy.processPayment(
        {
          orderRef: "order-1",
          amountCents: 1000,
          currency: "EUR",
          displayId: "disp1",
        },
        jest.fn(),
      );

      // Wait a bit to ensure it started
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 2. Cancel first payment
      await strategy.cancelTransaction(jest.fn());

      // Expect first payment to be cancelled
      try {
        await paymentPromise1;
      } catch (e) {
        expect((e as PaymentSDKError).code).toBe(PaymentErrorCode.CANCELLED);
      }

      // 3. Start second payment immediately
      try {
        await strategy.processPayment(
          {
            orderRef: "order-2",
            amountCents: 1000,
            currency: "EUR",
            displayId: "disp2",
          },
          jest.fn(),
        );
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentSDKError);
        expect((error as PaymentSDKError).code).toBe(
          PaymentErrorCode.TERMINAL_BUSY,
        );
      }
    });
  });

  describe("cancelTransaction", () => {
    it("should return false if no active request", async () => {
      strategy = new NetsStrategy(mockAxios, mockMessaging, mockConfig);
      const result = await strategy.cancelTransaction(jest.fn());
      expect(result).toBe(false);
    });

    it("should call API to cancel if active request exists", async () => {
      const mockCancel = jest.fn().mockResolvedValue({});

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation(
        (() => ({
          initiateNetsTerminalTransaction: jest
            .fn()
            .mockResolvedValue({ data: { connectCloudRequestId: "req-1" } }),
          cancelNetsTerminalTransaction: mockCancel,
          getPaymentStatus: jest.fn(),
        })) as any,
      );

      strategy = new NetsStrategy(mockAxios, mockMessaging, mockConfig);
      // Manually simulate active request via type casting "any" to set private field
      (strategy as any).currentRequestId = "req-1";

      const result = await strategy.cancelTransaction(jest.fn());

      expect(result).toBe(true);
      expect(mockCancel).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "req-1",
        }),
      );
    });
  });

  describe("refundTransaction", () => {
    it("should call initiateNetsTerminalTransaction with ReturnOfGoods and return success", async () => {
      const mockInitiate = jest.fn().mockResolvedValue({
        data: {
          connectCloudRequestId: "refund-req-123",
        },
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation(
        (() => ({
          initiateNetsTerminalTransaction: mockInitiate,
          getPaymentStatus: jest.fn(),
        })) as any,
      );

      // Mock Ably response for refund success
      (mockMessaging.subscribe as jest.Mock).mockImplementation(
        (_channel, _event, callback) => {
          setTimeout(() => {
            callback({
              status: SimplePaymentStatus.Success,
              orderId: "order-123",
              transactionId: "refund-trans-123",
              transaction: {},
            });
          }, 50);
          return jest.fn();
        },
      );

      strategy = new NetsStrategy(mockAxios, mockMessaging, mockConfig);

      const result = await strategy.refundTransaction(
        {
          amountCents: 500,
          orderRef: "order-123",
          currency: "EUR",
          displayId: "disp",
          originalTransactionId: "orig-trans-123",
        },
        jest.fn(),
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("refund-trans-123");
      expect(mockInitiate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 500,
          referenceId: "order-123",
          options: expect.objectContaining({
            transactionType: "returnOfGoods",
          }),
        }),
      );
    });

    it("should handle refund failure", async () => {
      const mockInitiate = jest.fn().mockResolvedValue({
        data: { connectCloudRequestId: "refund-req-fail" },
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation(
        (() => ({
          initiateNetsTerminalTransaction: mockInitiate,
        })) as any,
      );

      (mockMessaging.subscribe as jest.Mock).mockImplementation(
        (_channel, _event, callback) => {
          setTimeout(() => {
            callback({
              status: SimplePaymentStatus.Failed,
              orderId: "order-fail",
              error: {
                code: "REFUND_ERR",
                message: "Refund failed",
              },
            });
          }, 50);
          return jest.fn();
        },
      );

      strategy = new NetsStrategy(mockAxios, mockMessaging, mockConfig);

      const result = await strategy.refundTransaction(
        {
          amountCents: 500,
          orderRef: "order-fail",
          currency: "EUR",
          displayId: "disp",
          originalTransactionId: "orig-123",
        },
        jest.fn(),
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("REFUND_ERR");
      expect(result.errorMessage).toBe("Refund failed");
    });
  });

  describe("verifyFinalStatus", () => {
    it("should return success if API returns Success", async () => {
      const mockGetStatus = jest.fn().mockResolvedValue({
        data: {
          status: SimplePaymentStatus.Success,
          transactionId: "trans-verified",
          transaction: {},
        },
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation(
        (() => ({
          getPaymentStatus: mockGetStatus,
        })) as any,
      );

      strategy = new NetsStrategy(mockAxios, mockMessaging, mockConfig);

      const result = await strategy.verifyFinalStatus(
        {
          orderRef: "order-1",
          amountCents: 100,
          currency: "EUR",
          displayId: "d1",
        },
        "session-1",
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("trans-verified");
    });

    it("should return failure if API returns Failed", async () => {
      const mockGetStatus = jest.fn().mockResolvedValue({
        data: {
          status: SimplePaymentStatus.Failed,
          error: { code: "V_ERR", message: "Verification failed" },
        },
      });

      (PaymentApi as jest.MockedClass<typeof PaymentApi>).mockImplementation(
        (() => ({
          getPaymentStatus: mockGetStatus,
        })) as any,
      );

      strategy = new NetsStrategy(mockAxios, mockMessaging, mockConfig);

      const result = await strategy.verifyFinalStatus(
        {
          orderRef: "order-1",
          amountCents: 100,
          currency: "EUR",
          displayId: "d1",
        },
        "session-1",
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("V_ERR");
    });
  });
});
