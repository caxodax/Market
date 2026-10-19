"use client";

import React, { useEffect } from "react";
import { PluginMetadata } from "./tenant-plugins-modal";
import {
  X,
  Sparkles,
  CheckCircle2,
  Power,
  PowerOff,
  Loader2,
  ExternalLink,
  MessageCircle,
  Building2,
  ShieldCheck,
  ChevronRight,
  Info,
} from "lucide-react";

export interface PluginDetailModalProps {
  plugin: PluginMetadata | null;
  isOpen: boolean;
  onClose: () => void;
  isActive: boolean;
  isSuperAdmin?: boolean;
  isBusy?: boolean;
  onToggleStatus?: (pluginId: PluginMetadata["id"]) => void;
  onNavigateToModule?: (pluginId: PluginMetadata["id"]) => void;
  supportPhone?: string;
  tenantName?: string;
  tenantId?: string;
}

export function PluginDetailModal({
  plugin,
  isOpen,
  onClose,
  isActive,
  isSuperAdmin = false,
  isBusy = false,
  onToggleStatus,
  onNavigateToModule,
  supportPhone = "584120000000",
  tenantName = "Tu Comercio",
  tenantId,
}: PluginDetailModalProps) {
  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !plugin) return null;

  const cleanPhone = (supportPhone || "584120000000").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `Hola Soporte MarketOS, soy administrador del comercio "${tenantName}"${
      tenantId ? ` (${tenantId})` : ""
    }. Deseo consultar información, cotización y activación del módulo "${plugin.name}" (${plugin.id}).`
  )}`;

  const themeBorderClasses: Record<PluginMetadata["themeColor"], string> = {
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plugin-detail-title"
        className="relative z-10 w-full max-w-2xl bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border/70 bg-muted/20 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  themeBorderClasses[plugin.themeColor] || "bg-muted border-border text-foreground"
                }`}
              >
                {plugin.icon}
              </div>

              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    {plugin.badge}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground border border-border/70 px-2 py-0.5 rounded-full">
                    {plugin.category}
                  </span>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Activo en tu tienda
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-muted border border-border/60 px-2.5 py-0.5 rounded-full">
                      Módulo No Habilitado
                    </span>
                  )}
                </div>

                <h2
                  id="plugin-detail-title"
                  className="text-base sm:text-xl font-black text-foreground tracking-tight leading-snug"
                >
                  {plugin.name}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-muted transition-colors cursor-pointer shrink-0"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body (Full Details, No Truncation) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* Section: Overview / Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary" />
              <span>Descripción General del Módulo</span>
            </h3>
            <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-line bg-muted/30 p-4 rounded-2xl border border-border/60">
              {plugin.description}
            </p>
          </div>

          {/* Section: Full Features List (Uncut) */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Funcionalidades y Capacidades Incluidas</span>
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              {plugin.features.map((feature, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-colors"
                >
                  <div className="p-1 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground text-xs sm:text-sm leading-snug block">
                      {feature}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Target Audience / Business Profile */}
          {plugin.targetAudience && (
            <div className="p-4 rounded-2xl border border-border/80 bg-muted/40 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Building2 className="w-4 h-4 text-primary" />
                <span>¿Para qué tipo de comercios está recomendado?</span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {plugin.targetAudience}
              </p>
            </div>
          )}

          {/* Section: Operational Note */}
          <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 text-xs text-muted-foreground flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {isSuperAdmin
                ? "Como Super Administrador, al activar o desactivar este plugin los cambios toman efecto de inmediato en la tienda del comercio sin requerir reinicios."
                : "Este módulo opera de forma modular e independiente. Solo se activará en tu comercio tras la habilitación por parte de la Administración de Plataforma."}
            </p>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 sm:p-5 border-t border-border/70 bg-muted/10 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors cursor-pointer"
          >
            Volver al Catálogo
          </button>

          <div className="w-full sm:w-auto flex items-center justify-end gap-2.5">
            {isSuperAdmin ? (
              isActive ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onToggleStatus && onToggleStatus(plugin.id)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 text-destructive font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Actualizando...</span>
                    </>
                  ) : (
                    <>
                      <PowerOff className="w-4 h-4" />
                      <span>Desactivar Plugin para esta Tienda</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onToggleStatus && onToggleStatus(plugin.id)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Actualizando...</span>
                    </>
                  ) : (
                    <>
                      <Power className="w-4 h-4" />
                      <span>Activar Módulo Ahora</span>
                    </>
                  )}
                </button>
              )
            ) : isActive ? (
              onNavigateToModule && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToModule(plugin.id);
                    onClose();
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-all cursor-pointer shadow-sm"
                >
                  <span>Abrir Configuración del Módulo</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              )
            ) : (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Cotizar / Solicitar Activación</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
