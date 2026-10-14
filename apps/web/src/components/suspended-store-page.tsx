import React from "react";
import type { Tenant, TenantSettings } from "@marketos/types";
import { MessageCircle, Phone, Mail, Clock, AlertTriangle } from "lucide-react";

interface SuspendedStorePageProps {
  tenant?: Tenant | null;
  settings?: TenantSettings | null;
}

export function SuspendedStorePage({ tenant, settings }: SuspendedStorePageProps) {
  const businessName = settings?.business_name || tenant?.name || "Comercio";
  const logoUrl = settings?.logo_url || tenant?.logo_url || "/brand/logo.png";
  const whatsappNumber = settings?.whatsapp_number;
  const phone = settings?.phone;
  const email = settings?.email;

  const whatsappLink = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hola ${businessName}, estoy visitando su catálogo digital y quisiera consultar disponibilidad.`
      )}`
    : null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200">
      {/* Subtle background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Header bar */}
      <header className="relative z-10 w-full border-b border-neutral-800/80 bg-neutral-900/40 backdrop-blur-md px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700/80 overflow-hidden flex items-center justify-center p-1.5 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={businessName}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <span className="font-bold text-sm tracking-tight text-neutral-200">
              {businessName}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Pausa Temporal</span>
          </span>
        </div>
      </header>

      {/* Main hero card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg bg-neutral-900/80 border border-neutral-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center space-y-6">
          {/* Status Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Catálogo Temporalmente No Disponible
            </h1>
            <p className="text-sm text-neutral-400 leading-relaxed max-w-md mx-auto">
              Estamos realizando labores de mantenimiento y actualización operativa en el catálogo
              digital de <strong className="text-neutral-200">{businessName}</strong>.
              Muy pronto estaremos de nuevo al aire recibiendo pedidos.
            </p>
          </div>

          {/* Contact Actions */}
          {(whatsappLink || phone || email) && (
            <div className="pt-4 border-t border-neutral-800/80 space-y-3">
              <p className="text-xs font-medium text-neutral-400">
                ¿Necesitas comunicarte directamente con el comercio?
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-transform active:scale-95 shadow-md shadow-emerald-950/50"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Contactar por WhatsApp</span>
                  </a>
                )}
                {phone && !whatsappLink && (
                  <a
                    href={`tel:${phone}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs transition-colors border border-neutral-700"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Llamar: {phone}</span>
                  </a>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs transition-colors border border-neutral-700"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Escribir por Correo</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-6 text-center text-xs text-neutral-500 border-t border-neutral-900">
        <p>
          Plataforma tecnológica provista por{" "}
          <strong className="text-neutral-400 font-bold">MarketOS</strong> &copy;{" "}
          {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
