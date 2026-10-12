"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  BellRing,
  Send,
  Smartphone,
  Radio,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Tag,
  Zap,
  Truck,
  Package,
  History,
  Apple,
} from "lucide-react";
import {
  sendPushBroadcastAction,
  getPushStatsAction,
  getPushLogsAction,
  savePushSubscriptionAction,
} from "@/app/admin/push-actions";
import { urlBase64ToUint8Array } from "@/lib/pushClient";
import type {
  TenantSettings,
  PushStats,
  PushNotificationLog,
} from "@marketos/types";

interface PushNotificationsManagerProps {
  tenantId: string;
  settings: TenantSettings;
  adminEmail?: string;
}

interface NotificationPreset {
  id: string;
  label: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  url: string;
}

export function PushNotificationsManager({
  tenantId,
  settings,
  adminEmail,
}: PushNotificationsManagerProps) {
  // Stats & Logs state
  const [stats, setStats] = useState<PushStats>({
    subscriberCount: 0,
    totalSentCount: 0,
    lastSentAt: null,
  });
  const [logs, setLogs] = useState<PushNotificationLog[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Broadcast Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetUrl, setTargetUrl] = useState("/");
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Live Simulator View: "ios" or "android"
  const [previewDevice, setPreviewDevice] = useState<"ios" | "android">("ios");

  // Load initial data
  const refreshData = async () => {
    setLoadingStats(true);
    try {
      const [fetchedStats, fetchedLogs] = await Promise.all([
        getPushStatsAction(tenantId),
        getPushLogsAction(tenantId),
      ]);
      setStats(fetchedStats);
      setLogs(fetchedLogs);
    } catch (err) {
      console.error("Error refreshing push data:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [tenantId]);

  // Preset templates
  const presets: NotificationPreset[] = [
    {
      id: "coupon",
      label: "Cupón de Descuento",
      icon: <Tag className="w-3.5 h-3.5 text-purple-500" />,
      title: `🎟️ ¡Cupón Exclusivo en ${settings.business_name}!`,
      body: "Aprovecha hoy 10% de descuento en tu compra con el código PROMO10. ¡Válido por tiempo limitado!",
      url: "/",
    },
    {
      id: "flash_deal",
      label: "Oferta Relámpago",
      icon: <Zap className="w-3.5 h-3.5 text-amber-500" />,
      title: "⚡ ¡Oferta Relámpago de Hoy!",
      body: "Precios especiales en artículos seleccionados solo por las próximas horas. ¡Haz tu pedido ahora!",
      url: "/",
    },
    {
      id: "free_delivery",
      label: "Delivery Gratis",
      icon: <Truck className="w-3.5 h-3.5 text-emerald-500" />,
      title: "🛵 ¡Delivery Gratis Activado!",
      body: "Pide tus productos favoritos y recibe entrega sin costo adicional directo a tu puerta.",
      url: "/",
    },
    {
      id: "restock",
      label: "Nuevos Productos",
      icon: <Package className="w-3.5 h-3.5 text-blue-500" />,
      title: `✨ ¡Novedades en ${settings.business_name}!`,
      body: "Acabamos de surtir nuevos productos en nuestro catálogo. ¡Entra a ver lo nuevo disponible!",
      url: "/",
    },
  ];

  const applyPreset = (preset: NotificationPreset) => {
    setTitle(preset.title);
    setBody(preset.body);
    setTargetUrl(preset.url);
    setFeedback({
      type: "info",
      text: `Plantilla «${preset.label}» aplicada al borrador.`,
    });
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setFeedback({
        type: "error",
        text: "Por favor indica un título y cuerpo para la notificación.",
      });
      return;
    }

    if (stats.subscriberCount === 0) {
      const confirmSend = window.confirm(
        "Aún no hay suscriptores registrados para esta tienda. ¿Deseas registrar la campaña de todos modos?"
      );
      if (!confirmSend) return;
    } else {
      const confirmSend = window.confirm(
        `¿Estás seguro de enviar esta notificación a ${stats.subscriberCount} dispositivo(s) suscriptores de ${settings.business_name}?`
      );
      if (!confirmSend) return;
    }

    setIsSending(true);
    setFeedback(null);

    try {
      const result = await sendPushBroadcastAction({
        tenantId,
        title: title.trim(),
        body: body.trim(),
        url: targetUrl.trim() || "/",
        icon: settings.logo_url || "/brand/logo.png",
        badge: settings.logo_url || "/brand/logo.png",
        createdBy: adminEmail || "Admin",
      });

      if (result.success) {
        setFeedback({
          type: "success",
          text: `¡Difusión enviada con éxito! Se transmitió a ${result.sentCount} de ${result.totalTargeted} dispositivo(s).`,
        });
        // Reset form
        setTitle("");
        setBody("");
        // Refresh metrics
        await refreshData();
      } else {
        setFeedback({
          type: "error",
          text:
            ("error" in result ? (result as any).error : result.message) ||
            "Ocurrió un error al enviar la notificación.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Fallo inesperado de conexión con el servidor.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleSendTestPush = async () => {
    setIsSendingTest(true);
    setFeedback(null);
    try {
      if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        if (!sub) {
          const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidPublicKey) {
            throw new Error("Clave VAPID pública no configurada.");
          }
          const perm = await Notification.requestPermission();
          if (perm !== "granted") {
            throw new Error("Permiso de notificaciones denegado en este navegador.");
          }
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
          });
          const subJson = sub.toJSON();
          if (subJson.endpoint && subJson.keys) {
            await savePushSubscriptionAction({
              tenantId,
              endpoint: subJson.endpoint,
              p256dh: subJson.keys.p256dh,
              auth: subJson.keys.auth,
              userAgent: navigator.userAgent,
            });
          }
        }
      }

      const result = await sendPushBroadcastAction({
        tenantId,
        title: `🔔 Prueba: ${settings.business_name}`,
        body: "¡Excelente! Tu dispositivo está recibiendo alertas Web Push en tiempo real.",
        url: "/admin",
        createdBy: adminEmail || "Admin (Prueba)",
      });

      if (result.success) {
        setFeedback({
          type: "success",
          text: `¡Notificación de prueba enviada con éxito! Revisa la pantalla o barra de notificaciones de tu dispositivo.`,
        });
        await refreshData();
      } else {
        setFeedback({
          type: "error",
          text:
            ("error" in result ? (result as any).error : result.message) ||
            "Error al enviar la notificación de prueba.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Error al solicitar o enviar prueba push.",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const storeLogo = settings.logo_url || "/brand/logo.png";

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Encabezado del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <BellRing className="w-6 h-6 text-primary" />
              <span>Notificaciones Push Web</span>
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
              Multi-Tenant
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Comunica ofertas, novedades y recordatorios directamente a los teléfonos de tus clientes en iPhone y Android sin pagar SMS.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshData}
          disabled={loadingStats}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-bold text-foreground transition-all cursor-pointer shadow-xs disabled:opacity-50 self-start sm:self-auto"
          title="Actualizar métricas"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? "animate-spin" : ""}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Tarjetas de Métricas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* KPI 1: Suscriptores Activos */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Dispositivos Activos
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl sm:text-3xl font-black text-foreground">
              {stats.subscriberCount}
            </span>
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Suscritos a {settings.business_name}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Clientes que han aceptado alertas en esta tienda.
          </p>
        </div>

        {/* KPI 2: Total Difusiones */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Difusiones Enviadas
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl sm:text-3xl font-black text-foreground">
              {stats.totalSentCount}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              impactos totales
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Mensajes emitidos desde la apertura de la tienda.
          </p>
        </div>

        {/* KPI 3: Último Envío */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Última Campaña
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-1">
            <span className="text-sm sm:text-base font-bold text-foreground block truncate">
              {stats.lastSentAt
                ? new Date(stats.lastSentAt).toLocaleString("es-VE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Sin envíos recientes"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Fecha y hora de la última notificación emitida.
          </p>
        </div>
      </div>

      {/* Alerta informativa si no hay suscriptores */}
      {stats.subscriberCount === 0 && !loadingStats && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Aún no hay dispositivos suscritos en esta tienda</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              Cuando tus clientes visiten la tienda desde su teléfono, verán el aviso inferior con la guía para iPhone y Android. Al tocar <strong>Activar Alertas</strong>, su dispositivo se conectará automáticamente y aparecerá contabilizado aquí.
            </p>
          </div>
        </div>
      )}

      {/* Grid Principal: Formulario de Composición + Simulador Móvil en Vivo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Formulario de Redacción y Plantillas (7 cols) */}
        <div className="lg:col-span-7 bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              <span>Nueva Campaña de Difusión</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Redacta el mensaje o selecciona una plantilla predeterminada.
            </p>
          </div>

          {/* Plantillas Rápidas en 1 Clic */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Plantillas Rápidas:</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/70 hover:bg-muted border border-border text-xs font-semibold text-foreground transition-all cursor-pointer active:scale-95"
                >
                  {preset.icon}
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-medium border flex items-start gap-2.5 ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                  : feedback.type === "error"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200"
                  : "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200"
              }`}
            >
              {feedback.type === "success" && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              {feedback.type === "error" && (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              {feedback.type === "info" && (
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{feedback.text}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSendBroadcast} className="space-y-4">
            {/* Título de la Notificación */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="push-title"
                  className="text-xs font-bold text-foreground"
                >
                  Título de la Notificación <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {title.length}/60
                </span>
              </div>
              <input
                id="push-title"
                type="text"
                maxLength={60}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. 🔥 ¡20% Descuento solo por hoy!"
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all"
                required
              />
            </div>

            {/* Cuerpo del Mensaje */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="push-body"
                  className="text-xs font-bold text-foreground"
                >
                  Mensaje / Contenido <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {body.length}/140
                </span>
              </div>
              <textarea
                id="push-body"
                rows={3}
                maxLength={140}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Ej. Usa el cupón BIENVENIDO20 en el carrito y ahorra en todas nuestras categorías. ¡No te lo pierdas!"
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all resize-none"
                required
              />
            </div>

            {/* URL de destino al hacer clic */}
            <div className="space-y-1.5">
              <label
                htmlFor="push-url"
                className="text-xs font-bold text-foreground"
              >
                Enlace de destino al pulsar (URL)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="push-url"
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="/"
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-foreground text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Usa <code>/</code> para abrir la portada del catálogo, o la ruta de un producto específico.
              </p>
            </div>

            {/* Botón de Enviar Broadcast */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isSending || !title.trim() || !body.trim()}
                className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Transmitiendo a dispositivos conectados...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 shrink-0" />
                    <span>
                      Enviar Push a {stats.subscriberCount}{" "}
                      {stats.subscriberCount === 1 ? "Dispositivo" : "Dispositivos"}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSendTestPush}
                disabled={isSendingTest || isSending}
                className="w-full min-h-[42px] py-2.5 px-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
              >
                {isSendingTest ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>Enviando prueba a este dispositivo...</span>
                  </>
                ) : (
                  <>
                    <BellRing className="w-3.5 h-3.5 shrink-0" />
                    <span>Enviar Notificación de Prueba a Mi Dispositivo</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Columna Derecha: Simulador de Notificación Móvil en Vivo (5 cols) */}
        <div className="lg:col-span-5 bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-foreground">
                Vista Previa Móvil
              </h3>
              <p className="text-xs text-muted-foreground">
                Simula cómo lo verá el cliente en su pantalla.
              </p>
            </div>

            {/* Selector de Dispositivo (iOS vs Android) */}
            <div className="inline-flex rounded-xl p-1 bg-muted border border-border">
              <button
                type="button"
                onClick={() => setPreviewDevice("ios")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  previewDevice === "ios"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Apple className="w-3.5 h-3.5" />
                <span>iPhone</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("android")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  previewDevice === "android"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android</span>
              </button>
            </div>
          </div>

          {/* Maqueta del Teléfono */}
          <div className="bg-slate-950 p-4 sm:p-5 rounded-3xl text-white shadow-xl relative overflow-hidden border border-slate-800">
            {/* Decoración superior (Dynamic Island / Notch) */}
            <div className="w-24 h-4 bg-black rounded-full mx-auto mb-4 border border-slate-800 flex items-center justify-end px-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
            </div>

            {/* Tarjeta de Notificación según Sistema Operativo */}
            {previewDevice === "ios" ? (
              /* Estilo iOS Lockscreen Banner */
              <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 shadow-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-white/15 p-0.5 overflow-hidden flex items-center justify-center shrink-0">
                      <img
                        src={storeLogo}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-[11px] font-bold text-white/90 uppercase tracking-tight">
                      {settings.business_name}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">ahora</span>
                </div>

                <div className="space-y-0.5 text-left">
                  <p className="text-xs font-bold text-white leading-snug">
                    {title || "Título de la notificación..."}
                  </p>
                  <p className="text-[11px] text-slate-300 leading-snug break-words">
                    {body || "El contenido de la notificación aparecerá aquí..."}
                  </p>
                </div>
              </div>
            ) : (
              /* Estilo Android Material You Banner */
              <div className="bg-slate-900 rounded-2xl p-3.5 border border-slate-700 shadow-2xl space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/20 p-0.5 overflow-hidden flex items-center justify-center shrink-0 border border-primary/40">
                      <img
                        src={storeLogo}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-200">
                      {settings.business_name}
                    </span>
                    <span className="text-[10px] text-slate-400">• ahora</span>
                  </div>
                  <span className="text-[10px] text-slate-400">▼</span>
                </div>

                <div className="space-y-0.5 pl-1">
                  <p className="text-xs font-bold text-white leading-snug">
                    {title || "Título de la notificación..."}
                  </p>
                  <p className="text-[11px] text-slate-300 leading-snug break-words">
                    {body || "El contenido de la notificación aparecerá aquí..."}
                  </p>
                </div>

                {/* Acciones Android */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                  <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-sm bg-primary/10">
                    VER
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5">
                    CERRAR
                  </span>
                </div>
              </div>
            )}

            {/* Fondo simulado de pantalla bloqueada */}
            <div className="text-center pt-8 pb-3 space-y-1 opacity-70">
              <p className="text-2xl font-light tracking-widest text-white/80 font-mono">
                {new Date().toLocaleTimeString("es-VE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                {new Date().toLocaleDateString("es-VE", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground space-y-1 bg-muted/40 p-3 rounded-2xl border border-border">
            <p className="font-semibold text-foreground flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Garantía de entrega y privacidad</span>
            </p>
            <p>
              Las notificaciones se entregan a través de los servidores oficiales de Apple (APNs) y Google (FCM). Las suscripciones inactivas o revocadas son eliminadas automáticamente.
            </p>
          </div>
        </div>
      </div>

      {/* Bitácora / Historial de Difusiones */}
      <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <span>Historial de Difusiones ({logs.length})</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Registro cronológico de campañas enviadas a los clientes.
            </p>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-2xl bg-muted/20">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold text-foreground">
              Aún no hay notificaciones en la bitácora
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Las campañas que envíes quedarán guardadas aquí con sus métricas.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-muted/30 transition-colors space-y-1.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      {log.title}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      {log.sent_count} {log.sent_count === 1 ? "entrega" : "entregas"}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {new Date(log.created_at).toLocaleString("es-VE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {log.body}
                </p>

                <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
                  <span>
                    Destino: <code className="text-foreground">{log.url}</code>
                  </span>
                  <span>•</span>
                  <span>
                    Emitido por:{" "}
                    <strong className="text-foreground">
                      {log.created_by || "Admin"}
                    </strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
