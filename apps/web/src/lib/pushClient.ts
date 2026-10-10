// ==============================================================================
// UTILIDADES CLIENTE: WEB PUSH & DETECCIÓN PWA STANDALONE MULTI-DISPOSITIVO
// ==============================================================================

import type { DevicePwaStatus } from "@marketos/types";

/**
 * Convierte una clave VAPID pública codificada en Base64 URL Safe a Uint8Array
 * para que el PushManager del navegador pueda procesarla.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registra el Service Worker de MarketOS de forma idempotente.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.error("[MarketOS PWA] Error registrando /sw.js:", err);
    return null;
  }
}

/**
 * Detección integral del dispositivo, modo PWA standalone y soporte de Web Push.
 * Incluye la validación de Apple WebKit (iOS 16.4+) donde Safari exige
 * que la app esté instalada en la pantalla de inicio para admitir notificaciones.
 */
export function getDevicePwaStatus(): DevicePwaStatus {
  if (typeof window === "undefined") {
    return {
      isIos: false,
      isStandalone: false,
      hasNativePushApis: false,
      canSubscribePush: false,
    };
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const isIos =
    (/iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) &&
    !(window as any).MSStream;

  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  const hasNativePushApis =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // En iOS (WebKit 16.4+), Apple exige estrictamente que la aplicación esté instalada
  // en la pantalla de inicio y ejecutándose en modo standalone para admitir notificaciones Push.
  // En pestañas normales de Safari, PushManager no está disponible o lanza NotAllowedError.
  const canSubscribePush = isIos
    ? hasNativePushApis && isStandalone
    : hasNativePushApis;

  return {
    isIos,
    isStandalone,
    hasNativePushApis,
    canSubscribePush,
  };
}
