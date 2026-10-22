"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, RefreshCw, X } from "lucide-react";

/**
 * Checks whether the user is actively filling a form or in a critical modal
 * (e.g. checkout, payment reference, address entry) to prevent jarring auto-reloads.
 */
function isUserBusy(): boolean {
  if (typeof document === "undefined") return false;

  // 1. Check for open dialogs / bottom sheets / modals
  const hasModal = document.querySelector('[role="dialog"], [aria-modal="true"]') !== null;
  if (hasModal) return true;

  // 2. Check for active form input with non-empty content
  const active = document.activeElement;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
    const input = active as HTMLInputElement | HTMLTextAreaElement;
    if (input.value && input.value.trim().length > 0) {
      return true;
    }
  }

  return false;
}

export function PwaUpdateManager() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const hasUpdateRef = useRef(false);

  const applyUpdate = () => {
    setIsUpdating(true);
    const reg = registrationRef.current;
    if (reg?.waiting) {
      reg.waiting.postMessage({ action: "skipWaiting" });
    }

    try {
      sessionStorage.setItem("marketos_last_sw_reload", Date.now().toString());
    } catch {}

    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  const handleUpdateReady = () => {
    hasUpdateRef.current = true;

    // Smart decision:
    // If user is NOT busy with checkout or forms, perform immediate silent update
    if (!isUserBusy()) {
      const lastReload = parseInt(
        sessionStorage.getItem("marketos_last_sw_reload") || "0",
        10
      );
      if (Date.now() - lastReload > 20000) {
        applyUpdate();
        return;
      }
    }

    // If user is busy, show polite non-intrusive floating pill
    setHasUpdate(true);
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let isMounted = true;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (!isMounted) return;
        registrationRef.current = reg;

        // 1. If an updated worker is already waiting in background
        if (reg.waiting) {
          handleUpdateReady();
        }

        // 2. Listen for newly discovered updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              handleUpdateReady();
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[PWA Update] Error registering service worker:", err);
      });

    // 3. Auto-check on visibility change (when unlocking phone or returning from WhatsApp/Bank)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (registrationRef.current) {
          registrationRef.current.update().catch(() => {});
        }

        // If an update was queued and user is no longer busy, apply smoothly
        if (hasUpdateRef.current && !isUserBusy()) {
          const lastReload = parseInt(
            sessionStorage.getItem("marketos_last_sw_reload") || "0",
            10
          );
          if (Date.now() - lastReload > 20000) {
            applyUpdate();
          }
        }
      }
    };

    // 4. Periodic background check every 3 minutes
    const interval = setInterval(() => {
      if (registrationRef.current) {
        registrationRef.current.update().catch(() => {});
      }
    }, 3 * 60 * 1000);

    // 5. When new worker takes control, refresh if not busy
    const handleControllerChange = () => {
      if (!isUserBusy()) {
        const lastReload = parseInt(
          sessionStorage.getItem("marketos_last_sw_reload") || "0",
          10
        );
        if (Date.now() - lastReload > 20000) {
          sessionStorage.setItem("marketos_last_sw_reload", Date.now().toString());
          window.location.reload();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  if (!hasUpdate || dismissed) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 z-[9999] max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div className="bg-slate-950/95 dark:bg-slate-900/95 text-white border border-white/10 shadow-2xl rounded-2xl p-3.5 backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/30">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight truncate">
              Nueva versión disponible
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              Mejoras listas para tu tienda
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={applyUpdate}
            disabled={isUpdating}
            className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold hover:bg-primary/90 transition-all active:scale-95 shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3 h-3 ${isUpdating ? "animate-spin" : ""}`}
            />
            <span>{isUpdating ? "Actualizando..." : "Actualizar"}</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Recordar más tarde"
            aria-label="Cerrar aviso de actualización"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
