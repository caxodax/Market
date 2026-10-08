"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUserAction } from "./actions";
import {
  Store,
  ShieldCheck,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  ArrowRight,
  UserCheck,
  KeyRound,
  Server,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export default function UnifiedLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await loginUserAction(email, password);
      if (result.success && result.redirectTo) {
        router.push(result.redirectTo);
        router.refresh();
      } else {
        setError(result.error || "Credenciales inválidas.");
      }
    } catch (err) {
      setError("Error inesperado al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (presetEmail: string, presetPass = "MarketOS2026*") => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Back to store link */}
      <div className="absolute top-6 left-6 z-20">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al Catálogo</span>
        </Link>
      </div>

      <div className="w-full max-w-md relative z-10 my-8">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-xl shadow-emerald-500/20 mb-4 border border-emerald-400/30">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            MarketOS • Portal de Acceso
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Ingreso único para Dueños, Personal y Plataforma
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            <ShieldCheck className="w-3.5 h-3.5" /> Enrutamiento Inteligente por Rol
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-sm flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@shopmarket.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Contraseña
                </label>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Cifrada
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/30 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validando Credenciales...
                </>
              ) : (
                <>
                  Ingresar al Sistema
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick preset selector for testing convenience */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              Acceso Rápido de Prueba:
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill("owner@shopmarket.com")}
                className="w-full text-left p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <span className="text-xs font-semibold text-white group-hover:text-emerald-400 flex items-center gap-1">
                    👑 Dueño General (Luis Montes)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    owner@shopmarket.com ➔ Panel Tienda (/admin)
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Dueño
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("gerente@shopmarket.com")}
                className="w-full text-left p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-teal-500/50 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <span className="text-xs font-semibold text-white group-hover:text-teal-400 flex items-center gap-1">
                    🏢 Encargada Sucursal (María R.)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    gerente@shopmarket.com ➔ Panel Tienda (/admin)
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-teal-950 text-teal-400 border border-teal-800">
                  Gerencia
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("caja@shopmarket.com")}
                className="w-full text-left p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <span className="text-xs font-semibold text-white group-hover:text-blue-400 flex items-center gap-1">
                    💳 Operador / Caja (Carlos P.)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    caja@shopmarket.com ➔ Validación Pagos (/admin)
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                  Caja
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("superadmin@marketos.com", "PlatformMaster2026*")}
                className="w-full text-left p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <span className="text-xs font-semibold text-white group-hover:text-indigo-400 flex items-center gap-1">
                    🛡️ Super Admin Plataforma
                  </span>
                  <span className="text-[11px] text-slate-400">
                    superadmin@marketos.com ➔ Consola SaaS (/platform)
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                  Master
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-500">
          <p>MarketOS Suite • Aislamiento Multi-Tenant con Supabase Auth</p>
        </div>
      </div>
    </div>
  );
}
