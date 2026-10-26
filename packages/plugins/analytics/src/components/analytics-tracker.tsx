"use client";

import { useEffect, useRef } from "react";

interface AnalyticsTrackerProps {
  tenantId: string;
  endpointUrl?: string;
}

export function AnalyticsTracker({
  tenantId,
  endpointUrl = "/api/analytics/track",
}: AnalyticsTrackerProps) {
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !tenantId) return;

    const currentPath = window.location.pathname + window.location.search;

    // Avoid double-firing on duplicate renders for the same exact route
    if (lastTrackedPath.current === currentPath) return;
    lastTrackedPath.current = currentPath;

    // 1. Resolve or create anonymous session identifier
    let sessionId = "";
    try {
      sessionId = sessionStorage.getItem("marketos_sid") || "";
      if (!sessionId) {
        sessionId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `sid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem("marketos_sid", sessionId);
      }
    } catch {
      sessionId = `sid_${Date.now()}`;
    }

    // 2. Extract UTM parameters
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get("utm_source") || urlParams.get("ref");
    const utmMedium = urlParams.get("utm_medium");
    const utmCampaign = urlParams.get("utm_campaign");

    // 3. Screen/Device categorization
    const width = window.innerWidth;
    const deviceType =
      width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";

    const payload = {
      tenantId,
      path: window.location.pathname,
      referrer: document.referrer || null,
      utmSource: utmSource || null,
      utmMedium: utmMedium || null,
      utmCampaign: utmCampaign || null,
      sessionId,
      deviceType,
    };

    // 4. Non-blocking dispatch
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon(endpointUrl, blob);
      } else {
        fetch(endpointUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {
          // Silent catch: analytics errors should never break user UX
        });
      }
    } catch {
      // Silent catch
    }
  }, [tenantId, endpointUrl]);

  return null;
}
