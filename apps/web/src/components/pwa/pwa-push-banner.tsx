"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  Bell,
  X,
  Share,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  urlBase64ToUint8Array,
  getDevicePwaStatus,
  registerServiceWorker,
} from "@/lib/pushClient";
import { savePushSubscriptionAction } from "@/app/admin/push-actions";
import { IosInstallGuideModal } from "./ios-install-guide-modal";
import { AndroidInstallGuideModal } from "./android-install-guide-modal";
import { useCart } from "../../context/cart-context";

interface PwaPushBannerProps {
  tenantId: string;
  storeName: string;
  logoUrl?: string | null;
}

export function PwaPushBanner({
  tenantId,
  storeName,
  logoUrl,
}: PwaPushBannerProps) {
  const [mounted, setMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [pushGranted, setPushGranted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [iosGuideReason, setIosGuideReason] = useState<"install" | "push">("install");
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);

    // 1. Registrar Service Worker en segundo plano
    registerServiceWorker();

    // 2. Detectar características del dispositivo y modo standalone
    const status = getDevicePwaStatus();
    setIsIos(status.isIos);
    setIsStandalone(status.isStandalone);

    // 3. Comprobar estado de instalación
    const installStorageKey = `marketos_pwa_installed_${tenantId}`;
    if (status.isIos) {
      if (status.isStandalone) {
        setIsInstalled(true);
        try {
          localStorage.setItem(installStorageKey, "true");
        } catch {}
      } else {
        setIsInstalled(false);
      }
    } else {
      const storedInstalled =
        typeof window !== "undefined" &&
        localStorage.getItem(installStorageKey) === "true";
      if (status.isStandalone || storedInstalled) {
        setIsInstalled(true);
      }
    }

    // 4. Comprobar notificaciones Push activas
    const pushStorageKey = `marketos_push_active_${tenantId}`;
    const storedPush =
      typeof window !== "undefined" &&
      localStorage.getItem(pushStorageKey) === "true";
    const permGranted =
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted";

    if (storedPush || permGranted) {
      setPushGranted(true);
    }

    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready
        .then(async (reg) => {
          try {
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
              setPushGranted(true);
              try {
                localStorage.setItem(pushStorageKey, "true");
              } catch {}
            }
          } catch (err) {
            console.warn("[MarketOS PWA] Error verificando PushManager:", err);
          }
        })
        .catch(() => {});
    }

    // 5. Capturar evento nativo de instalación en Android/Chrome/Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      try {
        localStorage.setItem(installStorageKey, "true");
      } catch {}
      setDeferredPrompt(null);
      setStatusMessage({
        type: "success",
        text: `¡${storeName} instalada en tu pantalla de inicio!`,
      });
    };

    const handleOpenBanner = () => {
      setIsDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("open-marketos-pwa-banner", handleOpenBanner);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("open-marketos-pwa-banner", handleOpenBanner);
    };
  }, [tenantId, storeName]);

  // Si no está montado en cliente
  if (!mounted) {
    return null;
  }

  // Si ambos servicios ya están listos (instalada y notificaciones concedidas)
  if (isInstalled && pushGranted) {
    return null;
  }

  const markAsInstalled = () => {
    setIsInstalled(true);
    try {
      localStorage.setItem(`marketos_pwa_installed_${tenantId}`, "true");
    } catch {}
    setShowAndroidGuide(false);
    setStatusMessage({
      type: "success",
      text: "¡Instalación registrada con éxito!",
    });
  };

  const handleInstallClick = async () => {
    if (isIos) {
      setIosGuideReason("install");
      setShowIosGuide(true);
      return;
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          markAsInstalled();
        }
      } catch (err) {
        console.error("[MarketOS PWA] Error lanzando prompt de instalación:", err);
      } finally {
        setDeferredPrompt(null);
      }
    } else {
      setShowAndroidGuide(true);
    }
  };

  const handleEnablePush = async () => {
    const status = getDevicePwaStatus();

    // Regla estricta Apple iOS 16.4+:
    // Debe estar en modo standalone (agregada a pantalla de inicio)
    if (status.isIos && !status.isStandalone) {
      setIosGuideReason("push");
      setShowIosGuide(true);
      setStatusMessage({
        type: "info",
        text: "En iPhone, primero agrega la app a tu inicio y ábrela desde allí para activar alertas.",
      });
      return;
    }

    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setStatusMessage({
        type: "error",
        text: "Tu navegador o dispositivo no soporta notificaciones Web Push.",
      });
      return;
    }

    setIsSubscribingPush(true);
    setStatusMessage(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatusMessage({
          type: "error",
          text: status.isIos
            ? "Permiso denegado. Ve a Ajustes > Safari > Notificaciones para permitir alertas."
            : "Permiso denegado. Puedes activarlo en los ajustes del navegador.",
        });
        setIsSubscribingPush(false);
        return;
      }

      setPushGranted(true);
      try {
        localStorage.setItem(`marketos_push_active_${tenantId}`, "true");
      } catch {}

      const reg = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        throw new Error("Clave pública VAPID no encontrada en la configuración.");
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
      });

      const storedPhone =
        typeof window !== "undefined"
          ? localStorage.getItem(`marketos_customer_phone_${tenantId}`) ||
            localStorage.getItem("marketos_customer_phone")
          : null;

      const subJson = subscription.toJSON();
      if (subJson.endpoint && subJson.keys) {
        await savePushSubscriptionAction({
          tenantId,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
          customerId: storedPhone || undefined,
          userAgent: navigator.userAgent,
        });
      }

      setStatusMessage({
        type: "success",
        text: status.isIos
          ? "¡Notificaciones activadas en tu iPhone! 🔔"
          : "¡Notificaciones activadas en tu dispositivo! 🔔",
      });
    } catch (err: any) {
      console.error("[MarketOS PWA] Error suscribiendo Web Push:", err);
      if (err.name === "NotAllowedError") {
        setStatusMessage({
          type: "error",
          text: "Permiso bloqueado en el navegador.",
        });
      } else if (status.isIos && !status.isStandalone) {
        setIosGuideReason("push");
        setShowIosGuide(true);
      } else {
        setStatusMessage({
          type: "error",
          text: err.message || "Error al completar la suscripción push.",
        });
      }
    } finally {
      setIsSubscribingPush(false);
    }
  };

  const { totalItems } = useCart();
  const displayLogo = logoUrl || "/brand/logo.png";
  const bottomOffsetClass = totalItems > 0 ? "bottom-20 sm:bottom-4" : "bottom-4";

  // Si el usuario descartó el banner principal, dejamos una píldora discreta no intrusiva
  if (isDismissed) {
    return (
      <>
        <aside
          aria-label="Abrir instalador de la app"
          className={`fixed ${bottomOffsetClass} right-3 z-40 animate-in fade-in zoom-in-95`}
        >
          <button
            type="button"
            onClick={() => setIsDismissed(false)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-950/90 text-white hover:bg-slate-900 border border-white/20 shadow-xl backdrop-blur-md text-xs font-bold transition-transform active:scale-95 cursor-pointer group"
            title="Instalar App o Activar Alertas"
          >
            <Download className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
            <span>📲 Instalar App</span>
          </button>
        </aside>

        <IosInstallGuideModal
          isOpen={showIosGuide}
          onClose={() => setShowIosGuide(false)}
          reason={iosGuideReason}
          storeName={storeName}
          logoUrl={logoUrl}
        />

        <AndroidInstallGuideModal
          isOpen={showAndroidGuide}
          onClose={() => setShowAndroidGuide(false)}
          storeName={storeName}
          logoUrl={logoUrl}
          onMarkInstalled={markAsInstalled}
        />
      </>
    );
  }

  return (
    <>
      {/* Banner flotante inferior con soporte de áreas seguras y mobile first */}
      <aside
        aria-label={`Notificaciones y PWA de ${storeName}`}
        className={`fixed ${bottomOffsetClass} inset-x-3 sm:inset-x-auto sm:right-6 sm:w-[420px] z-50 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 pb-[env(safe-area-inset-bottom,0px)]`}
      >
        <div className="bg-slate-950/95 text-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-[0_16px_50px_rgba(0,0,0,0.5)] border border-white/15 backdrop-blur-xl relative overflow-hidden">
          {/* Acento sutil de gradiente de marca */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-2.5 relative z-10">
            {/* Encabezado */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/10 border border-white/15 p-0.5 shadow-md flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src={displayLogo}
                    alt={storeName}
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-extrabold text-xs sm:text-sm text-white tracking-tight truncate">
                      {storeName}
                    </h4>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-primary/30 text-primary-foreground border border-primary/40 shrink-0">
                      App Oficial
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 truncate mt-0.5">
                    {isIos && !isStandalone
                      ? "Agrega la app al inicio para ofertas"
                      : !isInstalled && !pushGranted
                      ? "Instala la app y recibe ofertas exclusivas"
                      : !isInstalled
                      ? "Agrega el acceso a tu pantalla de inicio"
                      : "Activa alertas de pedidos y cupones"}
                  </p>
                </div>
              </div>

              {/* Botón de cerrar (X) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDismissed(true);
                }}
                className="h-8 w-8 text-white/60 hover:text-white p-1 hover:bg-white/10 rounded-xl transition-colors cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
                title="Cerrar aviso"
                aria-label="Cerrar aviso de instalación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mensaje de feedback temporal */}
            {statusMessage && (
              <div
                className={`text-[11px] font-medium px-2.5 py-1 rounded-xl border ${
                  statusMessage.type === "success"
                    ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                    : statusMessage.type === "error"
                    ? "bg-rose-950/60 border-rose-500/40 text-rose-300"
                    : "bg-blue-950/60 border-blue-500/40 text-blue-300"
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            {/* Acciones principales: Instalar y Activar Notificaciones (2 Columnas siempre) */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              {/* Botón de Instalación */}
              {!isInstalled ? (
                <div className="flex flex-col min-w-0">
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="min-h-[40px] w-full px-2.5 py-2 rounded-xl bg-primary text-primary-foreground font-black text-xs transition-all shadow-md hover:brightness-110 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    {isIos ? (
                      <>
                        <Share className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Agregar App</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Instalar App</span>
                      </>
                    )}
                  </button>
                  {isIos ? (
                    <span className="text-[9px] text-slate-400 text-center py-0.5 truncate">
                      Ver pasos Safari
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={markAsInstalled}
                      className="text-[9px] text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors cursor-pointer text-center py-0.5 truncate"
                    >
                      ¿Ya instalada?
                    </button>
                  )}
                </div>
              ) : (
                <div className="min-h-[40px] px-2 py-2 rounded-xl bg-white/10 border border-white/15 text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Instalada</span>
                </div>
              )}

              {/* Botón de Notificaciones Push */}
              {!pushGranted ? (
                <div className="flex flex-col min-w-0">
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    disabled={isSubscribingPush}
                    className="min-h-[40px] w-full px-2.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-black text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {isSubscribingPush ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span className="truncate">Conectando...</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span className="truncate">Alertas</span>
                      </>
                    )}
                  </button>
                  {isIos && !isStandalone && (
                    <span className="text-[9px] text-amber-300/80 text-center py-0.5 truncate">
                      Abrir desde inicio
                    </span>
                  )}
                </div>
              ) : (
                <div className="min-h-[40px] px-2 py-2 rounded-xl bg-white/10 border border-white/15 text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Alertas ON</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Modal Guía Apple Safari (iOS / iPadOS) */}
      <IosInstallGuideModal
        isOpen={showIosGuide}
        onClose={() => setShowIosGuide(false)}
        reason={iosGuideReason}
        storeName={storeName}
        logoUrl={logoUrl}
      />

      {/* Modal Guía Android / Chrome */}
      <AndroidInstallGuideModal
        isOpen={showAndroidGuide}
        onClose={() => setShowAndroidGuide(false)}
        storeName={storeName}
        logoUrl={logoUrl}
        onMarkInstalled={markAsInstalled}
      />
    </>
  );
}
