import React from "react";
import Link from "next/link";
import { Store, ArrowLeft, ShieldAlert } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 selection:bg-primary/20">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 sm:p-8 text-center shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-5 border border-destructive/20 shadow-xs">
          <Store className="w-8 h-8 stroke-[1.75]" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground mb-3">
          Error 404 • No Encontrado
        </span>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground mb-2">
          Comercio o Página Inexistente
        </h1>

        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
          El enlace al que intentas acceder no corresponde a ningún comercio activo en la plataforma o la ruta solicitada no existe.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
          <Link
            href="/"
            className="min-h-[44px] h-11 px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-98 transition-all touch-manipulation shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Catálogo</span>
          </Link>

          <Link
            href="/login"
            className="min-h-[44px] h-11 px-4 rounded-xl border border-border bg-card text-foreground font-medium text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-muted active:scale-98 transition-all touch-manipulation"
          >
            <ShieldAlert className="w-4 h-4 text-muted-foreground" />
            <span>Acceso Personal</span>
          </Link>
        </div>
      </div>

      <p className="mt-8 text-[11px] text-muted-foreground/60 tracking-tight">
        MarketOS • Infraestructura de Comercio Electrónico Multi-inquilino
      </p>
    </div>
  );
}
