import { createContext, useMemo } from "react";
import type { ReactNode, FC } from "react";
import type { MunchiPaymentSDK } from "@munchi/payments";

export interface SdkContextType {
  payments: MunchiPaymentSDK;
}

export const SdkContext = createContext<SdkContextType | undefined>(undefined);

export interface SdkContainerProps {
  children: ReactNode;
  payments: MunchiPaymentSDK;
}

/**
 * SdkContainer provides the Munchi SDK instances to the application via context.
 * Works in React and React Native.
 */
export const SdkContainer: FC<SdkContainerProps> = ({ children, payments }) => {
  const value = useMemo(() => ({ payments }), [payments]);

  return <SdkContext.Provider value={value}>{children}</SdkContext.Provider>;
};
