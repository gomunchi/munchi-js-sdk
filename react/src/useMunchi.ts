import { useContext, useEffect, useState } from "react";
import { SdkContext } from "./SdkContainer";
import type { PaymentInteractionState } from "@munchi/payments";

/**
 * Hook to access all Munchi SDK instances.
 */
export const useMunchi = () => {
  const context = useContext(SdkContext);
  if (!context) {
    throw new Error("useMunchi must be used within a SdkContainer");
  }
  return context;
};

/**
 * Hook to access the Munchi Payment SDK instance.
 */
export const useSdk = () => {
  const { sdk } = useMunchi();
  return sdk;
};

/**
 * @deprecated Use useSdk instead
 */
export const usePayments = useSdk;

/**
 * Hook to access the current state of the Payment SDK reactively.
 */
export const usePaymentState = (): PaymentInteractionState => {
  const sdk = useSdk();
  const [state, setState] = useState(sdk.currentState);

  useEffect(() => {
    return sdk.subscribe((newState) => {
      setState(newState);
    });
  }, [sdk]);

  return state;
};
