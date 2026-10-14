"use client";

import React from "react";
import type { Tenant, TenantSettings, UserProfile } from "@marketos/types";
import { AlertOctagon, MessageCircle, Mail, LogOut, ArrowLeft } from "lucide-react";
import { logoutUserAction } from "../app/login/actions";

interface SuspendedAdminScreenProps {
  tenant?: Tenant | null;
  settings?: TenantSettings | null;
  currentUser?: UserProfile | null;
}

export function SuspendedAdminScreen({
  tenant,
  settings,
  currentUser,
}: SuspendedAdminScreenProps) {
  const storeName = settings?.business_name || tenant?.name || "Tu Tienda";
  const logoUrl = settings?.logo_url || tenant?.logo_url || "/brand/logo.png";

  const handleLogout = async () => {
    await logoutUserAction();
    window.location.href = "/login";
  };

  const supportWhatsapp = "584140000000";
  const supportWhatsappLink = `https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(
    `Hola Soporte MarketOS, soy ${currentUser?.full_name || "administrador"} de la tienda "${storeName}" (${tenant?.id}). Deseo información para renovar y reactivar nuestro servicio SaaS.`
  )}`;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-rose-500/30 selection:text-rose-200">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-rose-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full border-b border-neutral-800/80 bg-neutral-900/50 backdrop-blur-md px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-lg shadow-sm tracking-tighter">
              M
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-white">
                MarketOS
              </span>
              <span className="text-[10px] text-neutral-400 block -mt-0.5">
                Plataforma de Comercio Digital
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-700 hover:border-neutral-600 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </header>

      {/* Main card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg bg-neutral-900/90 border border-neutral-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl space-y-6 text-center">
          {/* Store Identification */}
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-800 border border-neutral-700 p-2 shadow-sm flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={storeName}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div className="text-left">
              <h2 className="font-bold text-base text-white">{storeName}</h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Servicio Suspendido
              </span>
            </div>
          </div>

          <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-inner">
            <AlertOctagon className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-white">
              Acceso al Panel Temporalmente Bloqueado
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              El servicio SaaS de tu comercio ha sido pausado. Mientras este estado permanezca activo,
              tanto el acceso a la administración como el catálogo público para clientes están fuera de línea.
            </p>
          </div>

          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between text-neutral-400 border-b border-neutral-800/60 pb-2">
              <span>Usuario identificado:</span>
              <strong className="text-neutral-200">{currentUser?.email || "Usuario"}</strong>
            </div>
            <div className="flex items-center justify-between text-neutral-400 border-b border-neutral-800/60 pb-2">
              <span>Rol asignado:</span>
              <span className="font-mono text-neutral-300">{currentUser?.role}</span>
            </div>
            <div className="flex items-center justify-between text-neutral-400">
              <span>ID de Inquilino:</span>
              <span className="font-mono text-neutral-400">{tenant?.id}</span>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <p className="text-xs font-semibold text-neutral-300">
              Para reactivar tu tienda y reanudar ventas inmediatamente:
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <a
                href={supportWhatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-transform active:scale-95 shadow-lg shadow-emerald-950/60"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contactar Soporte SaaS</span>
              </a>
              <a
                href="mailto:soporte@marketos.lat"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs border border-neutral-700 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>soporte@marketos.lat</span>
              </a>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => (window.location.href = "/")}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ir a la página principal</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-5 text-center text-xs text-neutral-600 border-t border-neutral-900">
        <p>MarketOS &copy; {new Date().getFullYear()} — Plataforma de Gestión Multi-Tienda</p>
      </footer>
    </div>
  );
}
