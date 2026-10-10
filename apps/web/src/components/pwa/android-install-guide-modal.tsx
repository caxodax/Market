"use client";

import React from "react";
import { X, MoreVertical, Download, CheckCircle2, Check } from "lucide-react";

interface AndroidInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
  logoUrl?: string | null;
  onMarkInstalled?: () => void;
}

export function AndroidInstallGuideModal({
  isOpen,
  onClose,
  storeName = "MarketOS",
  logoUrl,
  onMarkInstalled,
}: AndroidInstallGuideModalProps) {
  if (!isOpen) return null;

  const displayLogo = logoUrl || "/brand/logo.png";

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="android-guide-title"
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
                id="android-guide-title"
                className="font-black text-lg text-slate-900 dark:text-white leading-tight"
              >
                Instalar {storeName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Guía rápida para Android y Chrome
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center rounded-xl transition-colors cursor-pointer"
            aria-label="Cerrar ventana"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Pasos en Android */}
        <div className="space-y-2.5">
          {/* Paso 1 */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 font-black text-xs">
              1
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 min-w-0">
              <p className="font-bold text-slate-900 dark:text-white">
                Abre el menú de opciones de Chrome
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Toca los tres puntos verticales{" "}
                <MoreVertical className="w-3.5 h-3.5 inline text-slate-800 dark:text-slate-200 mx-0.5" />{" "}
                en la esquina superior derecha del navegador.
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
                Selecciona «Instalar aplicación»
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Busca la opción <Download className="w-3.5 h-3.5 inline text-primary mx-0.5" />{" "}
                <strong>Instalar aplicación</strong> o{" "}
                <strong>Agregar a la pantalla principal</strong>.
              </p>
            </div>
          </div>

          {/* Paso 3 */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
            <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 font-black text-xs shadow-sm">
              3
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 min-w-0">
              <p className="font-bold text-emerald-950 dark:text-emerald-300">
                Confirma la instalación
              </p>
              <p className="text-emerald-800 dark:text-emerald-400 mt-0.5 font-medium leading-relaxed">
                Toca <strong>Instalar</strong> en el aviso de confirmación. Tendrás acceso directo con carga instantánea y notificaciones activas.
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="pt-2 space-y-2">
          {onMarkInstalled && (
            <button
              type="button"
              onClick={() => {
                onMarkInstalled();
                onClose();
              }}
              className="min-h-[48px] w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Ya la instalé en mi pantalla de inicio</span>
            </button>
          )}

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
