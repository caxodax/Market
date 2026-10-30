"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Ponytail Ultra & ECC: Background auto-refresh hook.
 * Zero external libraries, zero open websockets.
 * Uses Next.js native router.refresh() (RSC payload diff).
 * - Debounces tab focus / visibility transitions (minimum 60s between refreshes)
 * - Skips background refresh if the user is currently typing in an input/textarea
 * - Preserves user focus, scroll position, and local cart state without flashing
 */
export function useAutoRefresh(intervalMs: number = 120000) {
  const router = useRouter();
  const lastRefreshRef = useRef<number>(Date.now());

  useEffect(() => {
    const isUserInteracting = () => {
      if (typeof document === "undefined") return false;
      const tag = document.activeElement?.tagName?.toUpperCase();
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const handleActive = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        if (isUserInteracting()) return;
        const now = Date.now();
        // Debounce: don't refresh if refreshed less than 60s ago
        if (now - lastRefreshRef.current >= 60000) {
          lastRefreshRef.current = now;
          router.refresh();
        }
      }
    };

    document.addEventListener("visibilitychange", handleActive);
    window.addEventListener("focus", handleActive);

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        if (isUserInteracting()) return;
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
