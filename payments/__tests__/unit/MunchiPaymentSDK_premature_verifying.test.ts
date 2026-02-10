import { PaymentApi, SimplePaymentStatus } from "@munchi_oy/core";
import type { AxiosInstance } from "axios";
import { MunchiPaymentSDK } from "../../src/MunchiPaymentSDK";
import {
  PaymentInteractionState,
  type IMessagingAdapter,
  type PaymentTerminalConfig,
} from "../../src/types/payment";
import {
  createMockAxios,
  createMockConfig,
  createMockMessaging,
} from "../helpers/fixtures";

jest.mock("@munchi_oy/core", () => {
  const actual = jest.requireActual("@munchi_oy/core");
  return {
    ...actual,
    PaymentApi: jest.fn().mockImplementation(() => ({
      initiateTerminalTransaction: jest.fn(),
      cancelTransaction: jest.fn(),
      cancelVivaTransactionV2: jest.fn(),
      getPaymentStatus: jest.fn(),
    })),
  };
});

describe("MunchiPaymentSDK Premature VERIFYING Reproduction", () => {
  let mockAxios: jest.Mocked<AxiosInstance>;
  let mockMessaging: jest.Mocked<IMessagingAdapter>;
  let mockConfig: PaymentTerminalConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios = createMockAxios();
    mockMessaging = createMockMessaging();
    mockConfig = createMockConfig();
  });

  const waitForState = (sdk: MunchiPaymentSDK, targetState: PaymentInteractionState) =>
    new Promise<void>((resolve) => {
      let unsubscribe = sdk.subscribe((state) => {
        if (state === targetState) {
          unsubscribe();
          resolve();
        }
      });
    });

  it("should transition to VERIFYING if strategy polling fails after 10s wait (repro)", async () => {
    jest.useFakeTimers();
    try {
      const orderRef = "order-premature-verifying";
      const sessionId = "session-premature-verifying";

      // 1. Mock API calls
      const mockGetPaymentStatus = jest.fn()
        .mockRejectedValueOnce(new Error("Network Error during polling"));

      (PaymentApi as jest.Mock).mockImplementation(() => ({
        initiateTerminalTransaction: jest.fn().mockResolvedValue({ 
          data: { sessionId, orderId: orderRef } 
        }),
        getPaymentStatus: mockGetPaymentStatus,
        // Need to mock verifyFinalStatus so it doesn't hang the test later
        verifyFinalStatus: jest.fn().mockResolvedValue({ success: false }) 
      }));

      const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, mockConfig);

      const states: PaymentInteractionState[] = [];
      sdk.subscribe((s) => states.push(s));

      void sdk.initiateTransaction({
        orderRef,
        amountCents: 1000,
        currency: "EUR",
        displayId: "display-1",
      });

      await waitForState(sdk, PaymentInteractionState.REQUIRES_INPUT);
      // 2. Advance 10s to trigger polling
      await jest.advanceTimersByTimeAsync(11000);

      // 3. The strategy polling should retry. It should NOT be in VERIFYING yet.
      await Promise.resolve();
      expect(sdk.currentState).toBe(PaymentInteractionState.REQUIRES_INPUT);

      // 4. Advance more time to reach polling deadline (120s + 10s initial)
      await jest.advanceTimersByTimeAsync(130000);
      await Promise.resolve();

      // Now it should have hit VERIFYING at least once because polling exhausted
      expect(states).toContain(PaymentInteractionState.VERIFYING);
    } finally {
      jest.useRealTimers();
    }
  });
});
