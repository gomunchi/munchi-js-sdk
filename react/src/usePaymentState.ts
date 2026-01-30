import { useEffect, useState } from "react";
import type { PaymentInteractionState } from "../../payments";
import { usePayments } from "./useMunchi";

/**
 * Hook to access the current payment interaction state.
 * Subscribes to SDK state changes and causes re-renders when state updates.
 */
export const usePaymentState = (): PaymentInteractionState => {
  const sdk = usePayments();
  const [state, setState] = useState<PaymentInteractionState>(sdk.currentState);

  useEffect(() => {
    // Update local state in case it changed before subscription
    if (sdk.currentState !== state) {
      setState(sdk.currentState);
    }

    const unsubscribe = sdk.subscribe((newState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, [sdk, state]);

  return state;
};
