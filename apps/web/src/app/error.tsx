"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MarketOS GlobalError]:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 selection:bg-primary/20">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 sm:p-8 text-center shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-5 border border-amber-500/20 shadow-xs">
          <AlertTriangle className="w-8 h-8 stroke-[1.75]" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-3">
          Error en la Aplicación
        </span>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground mb-2">
          Algo no salió como esperábamos
        </h1>

        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
          Ocurrió un error inesperado al procesar la solicitud. Tus datos y carrito se mantienen a salvo en este dispositivo.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
          <button
            onClick={() => reset()}
            className="min-h-[44px] h-11 px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-98 transition-all cursor-pointer touch-manipulation shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reintentar</span>
          </button>

          <Link
            href="/"
            className="min-h-[44px] h-11 px-4 rounded-xl border border-border bg-card text-foreground font-medium text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-muted active:scale-98 transition-all touch-manipulation"
          >
            <Home className="w-4 h-4 text-muted-foreground" />
            <span>Ir al Inicio</span>
          </Link>
        </div>
      </div>

      <p className="mt-8 text-[11px] text-muted-foreground/60 tracking-tight">
        MarketOS • Resiliencia y Recuperación de Sesión
      </p>
    </div>
  );
}
