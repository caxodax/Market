"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { loginSuperAdminAction } from "./actions";
import {
  ShieldCheck,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  ArrowRight,
  Server,
  Layers,
  KeyRound,
  Sparkles,
} from "lucide-react";

export default function SuperAdminLoginPage() {
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
      const result = await loginSuperAdminAction(email, password);
      if (result.success) {
        router.push("/");
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

  const handleQuickFill = () => {
    setEmail("superadmin@marketos.com");
    setPassword("PlatformMaster2026*");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-rose-500 shadow-xl shadow-indigo-500/20 mb-4 border border-indigo-400/30">
            <Server className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            MarketOS Control Plane
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestión Global de Tenants & Monitoreo de Infraestructura
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
            <ShieldCheck className="w-3.5 h-3.5" /> Acceso Restringido: PLATFORM_SUPER_ADMIN
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-sm flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Correo Maestro de Super Admin
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
                  placeholder="superadmin@marketos.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Contraseña Maestra
                </label>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Cifrado 256-bit
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
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-semibold text-sm shadow-lg shadow-indigo-950/50 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando Permisos Globales...
                </>
              ) : (
                <>
                  Ingresar a la Consola
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick preset selector for testing convenience */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Acceso Rápido Maestro (Demo Super Admin):
            </p>
            <button
              type="button"
              onClick={handleQuickFill}
              className="w-full text-left p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-white group-hover:text-indigo-400 flex items-center gap-1">
                  🛡️ Super Administrador Global
                </span>
                <span className="text-[11px] text-slate-400">
                  superadmin@marketos.com • Control Plane Multi-Tenant
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                Master
              </span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-500">
          <p>MarketOS Infrastructure & Core Platform Management</p>
        </div>
      </div>
    </div>
  );
}
