"use client";

import React from "react";
import { X, Share, PlusSquare, Smartphone, Check, BellRing } from "lucide-react";

interface IosInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: "install" | "push";
  storeName?: string;
  logoUrl?: string | null;
}

export function IosInstallGuideModal({
  isOpen,
  onClose,
  reason = "push",
  storeName = "MarketOS",
  logoUrl,
}: IosInstallGuideModalProps) {
  if (!isOpen) return null;

  const displayLogo = logoUrl || "/brand/logo.png";

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-guide-title"
        className="bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-gray-900 dark:text-gray-100 animate-in slide-in-from-bottom-8 max-h-[90vh] overflow-y-auto"
      >
        {/* Encabezado */}
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 p-1.5 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
              <img
                src={displayLogo}
                alt={storeName}
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
            <div>
              <h3
                id="ios-guide-title"
                className="font-black text-lg text-slate-900 dark:text-white leading-tight"
              >
                {reason === "push"
                  ? "Activar Alertas en iPhone"
                  : `Instalar ${storeName} en iPhone`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Guía oficial para Safari (iOS / iPadOS)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center rounded-xl transition-colors cursor-pointer"
            aria-label="Cerrar guía"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Explicación de la restricción de Apple (WebKit 16.4+) */}
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-300">
            {reason === "push" ? (
              <>
                <BellRing className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Requisito del sistema Apple (iOS 16.4+)</span>
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Instalación en dispositivos Apple</span>
              </>
            )}
          </div>
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300/90">
            {reason === "push"
              ? "Por políticas de seguridad de Apple, Safari no permite recibir notificaciones Web Push dentro de pestañas del navegador. Para habilitarlas, debes agregar la app a tu pantalla de inicio y abrirla desde allí."
              : "En iOS, Safari no admite la instalación en un solo clic. Es necesario agregar la tienda a tu pantalla de inicio manualmente siguiendo estos 4 sencillos pasos:"}
          </p>
        </div>

        {/* 4 Pasos Visuales Paso a Paso */}
        <div className="space-y-2.5">
          {/* Paso 1 */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 font-black text-xs">
              1
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 min-w-0">
              <p className="font-bold text-slate-900 dark:text-white">
                Pulsa el botón Compartir
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                En la barra inferior de Safari, busca y toca el icono de compartir{" "}
                <Share className="w-3.5 h-3.5 inline text-blue-600 dark:text-blue-400 mx-0.5" />.
              </p>
            </div>
          </div>

          {/* Paso 2 */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 font-black text-xs">
              2
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 min-w-0">
              <p className="font-bold text-slate-900 dark:text-white">
                «Agregar a pantalla de inicio»
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Desliza hacia abajo en el menú de opciones y presiona{" "}
                <PlusSquare className="w-3.5 h-3.5 inline text-slate-800 dark:text-slate-200 mx-0.5" />{" "}
                <strong>Agregar a pantalla de inicio</strong>.
              </p>
            </div>
          </div>

          {/* Paso 3 */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 font-black text-xs">
              3
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 min-w-0">
              <p className="font-bold text-slate-900 dark:text-white">
                Confirma tocando «Agregar»
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                En la esquina superior derecha de tu iPhone, presiona <strong>Agregar</strong>.
              </p>
            </div>
          </div>

          {/* Paso 4 (Clave para notificaciones Push) */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
            <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 font-black text-xs shadow-sm">
              4
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 min-w-0">
              <p className="font-bold text-emerald-950 dark:text-emerald-300">
                ¡Abre {storeName} desde tu pantalla de inicio!
              </p>
              <p className="text-emerald-800 dark:text-emerald-400 mt-0.5 font-medium leading-relaxed">
                Cierra Safari y abre el nuevo ícono de <strong>{storeName}</strong> en tu pantalla de inicio. Se ejecutará como aplicación nativa y podrás activar tus notificaciones con 1 toque.
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] w-full py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
          >
            <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>¡Entendido! La abriré desde la pantalla de inicio</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full py-2.5 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            Cerrar guía
          </button>
        </div>
      </div>
    </div>
  );
}
