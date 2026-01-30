import type { FC, ReactNode } from "react";
import { createContext, useMemo } from "react";
import type { MunchiPaymentSDK } from "../../payments";

export interface SdkContextType {
  sdk: MunchiPaymentSDK;
}

export const SdkContext = createContext<SdkContextType | undefined>(undefined);

export interface SdkContainerProps {
  children: ReactNode;
  sdk: MunchiPaymentSDK;
}

/**
 * SdkContainer provides the Munchi SDK instances to the application via context.
 * Works in React and React Native.
 */
export const SdkContainer: FC<SdkContainerProps> = ({ children, sdk }) => {
  const value = useMemo(() => ({ sdk }), [sdk]);

  return <SdkContext.Provider value={value}>{children}</SdkContext.Provider>;
};
