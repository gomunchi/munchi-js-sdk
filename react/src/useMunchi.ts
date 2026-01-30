import { useContext } from "react";
import { SdkContext } from "./SdkContainer";

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
export const usePayments = () => {
  const { sdk } = useMunchi();
  return sdk;
};
