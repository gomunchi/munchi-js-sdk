
import {
  CurrencyCode,
  PaymentFailureCode
} from "@munchi_oy/core";
import { type AxiosInstance } from "axios";
import { MunchiPaymentSDK } from "../../src/MunchiPaymentSDK";
import {
  type PaymentRequest,
  SdkPaymentStatus,
  PaymentInteractionState,
} from "../../src/types/payment";
import type {
  IHealthCheckAdapter,
  IPersistenceAdapter,
} from "../../src/types/sdk";
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

describe("MunchiPaymentSDK Persistence and Health Check", () => {
  let sdk: MunchiPaymentSDK;
  let mockAxios: jest.Mocked<AxiosInstance>;
  let mockMessaging: any;
  let config: any;
  
  let mockHealthCheck: jest.Mocked<IHealthCheckAdapter>;
  let mockPersistence: jest.Mocked<IPersistenceAdapter>;

  const mockStrategy = {
    processPayment: jest.fn(),
    abort: jest.fn(),
    verifyFinalStatus: jest.fn(),
    cancelTransaction: jest.fn(),
    refundTransaction: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockAxios = createMockAxios();
    mockMessaging = createMockMessaging();
    config = createMockConfig();

    mockHealthCheck = {
      checkHealth: jest.fn(),
    };

    mockPersistence = {
      saveTransaction: jest.fn().mockResolvedValue(undefined),
      updateTransactionStatus: jest.fn().mockResolvedValue(undefined),
    };

    // Instantiate SDK with mocks
    sdk = new MunchiPaymentSDK(
      mockAxios, 
      mockMessaging, 
      config,
      {
        healthCheck: mockHealthCheck,
        persistence: mockPersistence,
        logger: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        }
      }
    );
    // Inject mock strategy
    (sdk as any).strategy = mockStrategy;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  const validRequest: PaymentRequest = {
    orderRef: "order-123",
    amountCents: 1000,
    currency: CurrencyCode.Eur,
    displayId: "Disp-123",
  };

  describe("Health Check", () => {
    it("should block initiateTransaction if health check fails", async () => {
      mockHealthCheck.checkHealth.mockResolvedValue({
        isHealthy: false,
        details: { reason: "Backend unreachable" },
      });

      const result = await sdk.initiateTransaction(validRequest);

      expect(mockHealthCheck.checkHealth).toHaveBeenCalled();
      expect(result.success).toBe(false);
        // We mapped HEALTH_CHECK_FAILED to SystemProviderError in normalizeErrorCode
      expect(result.errorCode).toBe(PaymentFailureCode.SystemProviderError); 
      expect(result.errorMessage).toContain("System is offline or unhealthy");
      
      // Should NOT proceed to strategy
      expect(mockStrategy.processPayment).not.toHaveBeenCalled();
      // Should NOT persist start
      expect(mockPersistence.saveTransaction).not.toHaveBeenCalled();
    });

    it("should proceed if health check passes", async () => {
      mockHealthCheck.checkHealth.mockResolvedValue({ isHealthy: true });
      mockStrategy.processPayment.mockResolvedValue({ success: true, status: SdkPaymentStatus.SUCCESS });

      const result = await sdk.initiateTransaction(validRequest);

      expect(mockHealthCheck.checkHealth).toHaveBeenCalled();
      expect(mockStrategy.processPayment).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should block if health check throws exception", async () => {
        mockHealthCheck.checkHealth.mockRejectedValue(new Error("Network Error"));
  
        const result = await sdk.initiateTransaction(validRequest);
  
        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain("Health check error");
        expect(mockStrategy.processPayment).not.toHaveBeenCalled();
    });
  });

  describe("Persistence", () => {
    beforeEach(() => {
        mockHealthCheck.checkHealth.mockResolvedValue({ isHealthy: true });
    });

    it("should save transaction start", async () => {
        mockStrategy.processPayment.mockReturnValue(new Promise(() => {})); // Hangs to keep state

        sdk.initiateTransaction(validRequest);

        // Wait for async operations in initiateTransaction (health check match)
        await Promise.resolve(); 
        await Promise.resolve();

        expect(mockPersistence.saveTransaction).toHaveBeenCalledWith(expect.objectContaining({
            orderRef: validRequest.orderRef,
            amountCents: validRequest.amountCents,
            status: PaymentInteractionState.IDLE,
        }));
    });

    it("should update transaction status on state transitions", async () => {
        // Setup strategy to trigger a state change
        mockStrategy.processPayment.mockImplementation((req, onStateChange) => {
            onStateChange(PaymentInteractionState.PROCESSING);
            return Promise.resolve({ success: true, status: SdkPaymentStatus.SUCCESS });
        });

        await sdk.initiateTransaction(validRequest);

        // Initial IDLE
        expect(mockPersistence.saveTransaction).toHaveBeenCalled();
        
        // Update to PROCESSING
        expect(mockPersistence.updateTransactionStatus).toHaveBeenCalledWith(
            validRequest.orderRef,
            PaymentInteractionState.PROCESSING
        );

        // Update to SUCCESS (SDK logic)
        expect(mockPersistence.updateTransactionStatus).toHaveBeenCalledWith(
            validRequest.orderRef,
            PaymentInteractionState.SUCCESS
        );
    });

    it("should log warning but not fail if persistence fails", async () => {
        mockPersistence.saveTransaction.mockRejectedValue(new Error("DB Error"));
        mockStrategy.processPayment.mockResolvedValue({ success: true, status: SdkPaymentStatus.SUCCESS });

        const result = await sdk.initiateTransaction(validRequest);

        // Should still succeed
        expect(result.success).toBe(true);
    });
  });

  describe("Recovery", () => {
    const recoveryRecord = {
      orderRef: "rec-123",
      amountCents: 500,
      currency: CurrencyCode.Eur,
      status: PaymentInteractionState.PROCESSING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionId: "sess-123",
      provider: "VIVA",
    };

    it("should successfully recover a completed transaction", async () => {
      mockStrategy.verifyFinalStatus.mockResolvedValue({
        success: true,
        status: SdkPaymentStatus.SUCCESS,
        orderId: recoveryRecord.orderRef,
      });

      const result = await sdk.recoverTransaction(recoveryRecord);

      expect(mockStrategy.verifyFinalStatus).toHaveBeenCalledWith(
        expect.objectContaining({ orderRef: recoveryRecord.orderRef }),
        recoveryRecord.sessionId,
      );
      expect(result.success).toBe(true);
      expect(mockPersistence.updateTransactionStatus).toHaveBeenCalledWith(
        recoveryRecord.orderRef,
        PaymentInteractionState.SUCCESS,
        expect.any(Object),
      );
    });

    it("should fail recovery if session ID is missing", async () => {
      const invalidRecord = { ...recoveryRecord, sessionId: undefined };
      const result = await sdk.recoverTransaction(invalidRecord);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("Cannot recover transaction without session ID");
      expect(mockStrategy.verifyFinalStatus).not.toHaveBeenCalled();
      
      // Should mark as FAILED in persistence
      expect(mockPersistence.updateTransactionStatus).toHaveBeenCalledWith(
        invalidRecord.orderRef,
        PaymentInteractionState.FAILED,
        expect.any(Object),
      );
    });

    it("should handle provider verification failure", async () => {
      mockStrategy.verifyFinalStatus.mockRejectedValue(new Error("Provider Error"));

      const result = await sdk.recoverTransaction(recoveryRecord);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("Provider Error");
    });
  });
});
