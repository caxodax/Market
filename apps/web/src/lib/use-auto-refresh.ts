"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Ponytail Ultra: Background auto-refresh hook.
 * Zero external libraries, zero open websockets.
 * Uses Next.js native router.refresh() (RSC payload diff).
 * - Triggers when tab becomes visible / focused (phone unlocked, tab switched)
 * - Periodically updates (default 60s) only if document is visible
 * - Reconciles DOM changes in-place without page reload, preserving scroll & cart
 */
export function useAutoRefresh(intervalMs: number = 60000) {
  const router = useRouter();
  const lastRefreshRef = useRef<number>(Date.now());

  useEffect(() => {
    const handleActive = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        const now = Date.now();
        // Debounce: don't refresh if refreshed less than 10s ago
        if (now - lastRefreshRef.current >= 10000) {
          lastRefreshRef.current = now;
          router.refresh();
        }
      }
    };

    document.addEventListener("visibilitychange", handleActive);
    window.addEventListener("focus", handleActive);

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        lastRefreshRef.current = Date.now();
        router.refresh();
      }
    }, intervalMs);

    return () => {
      document.removeEventListener("visibilitychange", handleActive);
      window.removeEventListener("focus", handleActive);
      clearInterval(timer);
    };
  }, [router, intervalMs]);
}
