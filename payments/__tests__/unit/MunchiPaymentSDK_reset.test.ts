import { PaymentProvider, ProviderEnum } from "../../../core";
import { MunchiPaymentSDK } from "../../src/MunchiPaymentSDK";
import { PaymentInteractionState } from "../../src/types/payment";
import { createMockAxios, createMockMessaging } from "../helpers/fixtures";

describe("MunchiPaymentSDK Reset Binding", () => {
  let mockAxios: ReturnType<typeof createMockAxios>;
  let mockMessaging: ReturnType<typeof createMockMessaging>;

  beforeEach(() => {
    mockAxios = createMockAxios();
    mockMessaging = createMockMessaging();
  });
  it("should maintain 'this' context when reset is destructured", () => {
    const sdk = new MunchiPaymentSDK(mockAxios, mockMessaging, {
      kioskId: "test-kiosk",
      storeId: "test-store",
      channel: ProviderEnum.MunchiKiosk,
      provider: PaymentProvider.Viva,
    });

    // Mock transitionTo to verify it's called
    // We need to cast to any because transitionTo is private
    const transitionSpy = jest.spyOn(sdk as any, "transitionTo");

    // Force state to SUCCESS so reset() actually triggers a transition
    // (reset only checks if current state is a TERMINAL_STATE)
    (sdk as any)._currentState = PaymentInteractionState.SUCCESS;

    const { reset } = sdk;

    // This call would throw "Cannot read property '_currentState' of undefined" if not bound
    expect(() => reset()).not.toThrow();

    expect(transitionSpy).toHaveBeenCalledWith(PaymentInteractionState.IDLE);
  });
});
