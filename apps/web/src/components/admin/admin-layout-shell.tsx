"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UserProfile,
  TenantSettings,
  Tenant,
  TenantPlanLimits,
  TenantModuleId,
  ExchangeRate,
  Store,
} from "@marketos/types";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";
import {
  X,
  ExternalLink,
  RefreshCw,
  LogOut,
  Smartphone,
  ShieldAlert,
} from "lucide-react";
import { stopImpersonationAction } from "@/app/platform/actions";
import { logoutUserAction } from "@/app/login/actions";

interface AdminLayoutShellProps {
  children: React.ReactNode;
  currentUser: UserProfile;
  targetTenantId: string;
  targetTenant: Tenant | null;
  settings: TenantSettings;
  activeModuleIds: TenantModuleId[];
  planLimits: TenantPlanLimits | null;
  exchangeRate: ExchangeRate;
  stores: Store[];
  isSuperAdmin: boolean;
  isImpersonating: boolean;
  isSuspended: boolean;
  pendingPaymentsCount?: number;
  ordersCount?: number;
  productsCount?: number;
}

export function AdminLayoutShell({
  children,
  currentUser,
  targetTenantId,
  targetTenant,
  settings,
  activeModuleIds,
  planLimits,
  exchangeRate,
  stores,
  isSuperAdmin,
  isImpersonating,
  isSuspended,
  pendingPaymentsCount = 0,
  ordersCount = 0,
  productsCount = 0,
}: AdminLayoutShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isStoppingImpersonation, setIsStoppingImpersonation] = useState(false);
  const pathname = usePathname();

  const handleStopImpersonation = async () => {
    setIsStoppingImpersonation(true);
    try {
      const res = await stopImpersonationAction();
      if (res.success && res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        window.location.href = "/platform";
      }
    } catch {
      window.location.href = "/platform";
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col w-full max-w-full overflow-x-clip">
      {/* 1. SUSPENDED COMMERCE BANNER (Visible to Super Admin) */}
      {isSuspended && isSuperAdmin && (
        <div className="bg-rose-600 text-white text-xs font-bold px-4 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              COMERCIO SUSPENDIDO: Este comercio ({targetTenant?.name || targetTenantId}) se encuentra suspendido. Ni clientes ni empleados tienen acceso al sistema.
            </span>
          </div>
          <Link
            href="/platform"
            className="px-3 py-1 bg-white text-rose-700 rounded-lg text-xs font-bold hover:bg-neutral-100 transition-colors shadow-xs"
          >
            Gestionar en Master Platform
          </Link>
        </div>
      )}

      {/* 2. SUPPORT IMPERSONATION BANNER */}
      {isImpersonating && (
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 border-b border-purple-500/40 text-white px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-3 sticky top-0 z-40 shadow-lg text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-black uppercase tracking-wider text-purple-200">
              Modo Soporte Técnico Activo
            </span>
            <span className="text-purple-300 hidden md:inline">|</span>
            <span className="font-semibold text-purple-100 hidden md:inline">
              Comercio: <strong>{settings.business_name}</strong> ({targetTenantId})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStopImpersonation}
              disabled={isStoppingImpersonation}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isStoppingImpersonation ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Saliendo...</span>
                </>
              ) : (
                <span>🚪 Salir de Modo Soporte</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. MAIN APP SHELL: SIDEBAR + CONTENT */}
      <div className="flex-1 flex w-full max-w-full">
        {/* Desktop Sidebar */}
        <AdminSidebar
          currentUser={currentUser}
          settings={settings}
          planLimits={planLimits}
          activeModuleIds={activeModuleIds}
          pendingPaymentsCount={pendingPaymentsCount}
          ordersCount={ordersCount}
          productsCount={productsCount}
          bcvRate={exchangeRate?.value}
        />

        {/* Mobile Slide-over Drawer */}
        {isMobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
              onClick={() => setIsMobileNavOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-[85%] max-w-xs bg-card border-r border-border shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {settings.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt={settings.business_name}
                      className="h-8 w-8 object-contain rounded-lg bg-card border border-border p-0.5"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground font-black text-xs flex items-center justify-center">
                      MO
                    </div>
                  )}
                  <span className="font-black text-sm text-foreground truncate">
                    {settings.business_name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(false)}
                  className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Cerrar navegación"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Drawer Body: clone sidebar links with click-to-close */}
              <div
                className="flex-1 overflow-y-auto"
                onClick={() => setIsMobileNavOpen(false)}
              >
                <AdminSidebar
                  currentUser={currentUser}
                  settings={settings}
                  planLimits={planLimits}
                  activeModuleIds={activeModuleIds}
                  pendingPaymentsCount={pendingPaymentsCount}
                  ordersCount={ordersCount}
                  productsCount={productsCount}
                  bcvRate={exchangeRate?.value}
                />
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 max-w-full bg-background overflow-x-hidden">
          <AdminHeader
            settings={settings}
            exchangeRate={exchangeRate}
            stores={stores}
            currentUser={currentUser}
            onOpenMobileMenu={() => setIsMobileNavOpen(true)}
          />

          <main className="flex-1 min-w-0 max-w-full flex flex-col overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
