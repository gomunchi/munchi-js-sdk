import { useEffect, useState } from "react";
import { useSdk } from "./useMunchi";

/**
 * Hook that returns the milliseconds remaining until the SDK auto-resets.
 * Returns null if no auto-reset is scheduled.
 * 
 * Useful for showing progress bars or countdown timers on Success/Failure screens.
 */
export const usePaymentCountdown = () => {
  const sdk = useSdk();
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);

  useEffect(() => {
    let animationFrameId: number;

    const checkTimer = () => {
      const resetTime = sdk.nextAutoResetAt;

      if (!resetTime) {
        setTimeLeftMs(null);
        return;
      }

      const now = Date.now();
      const remaining = Math.max(0, resetTime - now);
      
      setTimeLeftMs(remaining);

      if (remaining > 0) {
        animationFrameId = requestAnimationFrame(checkTimer);
      }
    };

    // Initial check
    checkTimer();

    // Subscribe to state changes to trigger re-checks (e.g. when entering SUCCESS state)
    const unsubscribe = sdk.subscribe(() => {
      checkTimer();
    });

    return () => {
      unsubscribe();
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [sdk]);

  return timeLeftMs;
};
