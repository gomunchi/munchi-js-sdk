/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { createElement } from "react";
import { SdkContainer } from "../src/SdkContainer";
import { usePaymentState } from "../src/useMunchi";

describe("usePaymentState Memory Leak Test", () => {
    let mockSdk: any;
    let unsubscribeMock: jest.Mock;
    let subscribeMock: jest.Mock;
    
    beforeEach(() => {
        unsubscribeMock = jest.fn();
        subscribeMock = jest.fn().mockReturnValue(unsubscribeMock);
        
        mockSdk = {
            currentState: "IDLE",
            subscribe: subscribeMock,
        };
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => 
        createElement(SdkContainer, { sdk: mockSdk }, children);

    it("should unsubscribe when component unmounts", () => {
        const { unmount } = renderHook(() => usePaymentState(), { wrapper });
        
        expect(subscribeMock).toHaveBeenCalledTimes(1);
        
        unmount();
        
        expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });

    it("should not re-subscribe if sdk reference stays same", () => {
        const { rerender } = renderHook(() => usePaymentState(), { wrapper });
        
        rerender();
        rerender();
        
        expect(subscribeMock).toHaveBeenCalledTimes(1);
    });
});
