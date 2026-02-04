import { MunchiPaymentSDK } from "../../src/MunchiPaymentSDK";
import { MockStrategy } from "../../src/strategies/MockStrategy";
import {
  type IMessagingAdapter,
  type RefundRequest,
  SdkPaymentStatus
} from "../../src/types/payment";
import { createMockAxios, createMockConfig, createMockLogger } from "../helpers/fixtures";

describe("MunchiPaymentSDK Refund", () => {
  let sdk: MunchiPaymentSDK;
  let mockStrategy: MockStrategy;
  let mockMessaging: IMessagingAdapter;

  beforeEach(() => {
    mockStrategy = new MockStrategy();
    mockMessaging = {
      publish: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}),
    } as unknown as IMessagingAdapter;

    sdk = new MunchiPaymentSDK(
      createMockAxios(),
      mockMessaging,
      createMockConfig(),
      {
        logger: createMockLogger(),
      },
      mockStrategy
    );
  });

  it("should delegate refund to strategy", async () => {
    const refundRequest: RefundRequest = {
      amountCents: 1000,
      orderRef: "order-123",
      currency: "EUR",
      displayId: "refund-1",
      originalTransactionId: "tx-123",
    };

    const mockResult = {
      success: true,
      status: SdkPaymentStatus.SUCCESS,
      orderId: "order-123",
    };

    jest.spyOn(mockStrategy, "refundTransaction").mockResolvedValue(mockResult);

    const result = await sdk.refund(refundRequest);

    expect(result).toEqual(mockResult);
    expect(mockStrategy.refundTransaction).toHaveBeenCalledWith(refundRequest, expect.any(Function));
  });

  it("should handle refund errors", async () => {
     const refundRequest: RefundRequest = {
      amountCents: 1000,
      orderRef: "order-123",
      currency: "EUR",
      displayId: "refund-1",
    };

    const error = new Error("Refund failed");
    jest.spyOn(mockStrategy, "refundTransaction").mockRejectedValue(error);

    const result = await sdk.refund(refundRequest);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Refund failed");
  });
});
