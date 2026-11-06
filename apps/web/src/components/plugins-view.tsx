"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  TenantSettings,
  TenantModuleId,
  UserProfile,
} from "@marketos/types";
import {
  Puzzle,
  Sparkles,
  CheckCircle2,
  Info,
  ExternalLink,
} from "lucide-react";
import { AVAILABLE_PLUGINS, PluginMetadata, TenantPluginsModal } from "./tenant-plugins-modal";
import { PluginDetailModal } from "./plugin-detail-modal";

interface PluginsViewProps {
  settings: TenantSettings;
  activeModuleIds: TenantModuleId[];
  currentUser: UserProfile;
}

const PLUGIN_ROUTES: Record<string, string> = {
  delivery_fleet: "/admin/delivery",
  promotions_coupons: "/admin/coupons",
  local_venezuela: "/admin/rates",
  food_service: "/admin/food-service",
  storefront_pro: "/admin/storefront-studio",
  mto_cpq: "/admin/mto-cpq",
  craft_workshop: "/admin/craft",
  printopink_calculator: "/admin/printopink-calculator",
  invoicing: "/admin/invoicing",
  purchasing_retentions: "/admin/purchasing",
  accounting: "/admin/accounting",
  pos_registers: "/admin/pos",
  push_notifications: "/admin/push",
};

export function PluginsView({
  settings,
  activeModuleIds,
  currentUser,
}: PluginsViewProps) {
  const [selectedPluginForDetail, setSelectedPluginForDetail] = useState<PluginMetadata | null>(null);
  const [isPluginsModalOpen, setIsPluginsModalOpen] = useState(false);

  const isSuperAdminOrImpersonating =
    currentUser.role === "PLATFORM_SUPER_ADMIN" || Boolean(currentUser.impersonation);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-view-enter">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 rounded-2xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
            <Puzzle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-foreground">
              Módulos y Plugins de la Tienda
            </h2>
            <p className="text-xs text-muted-foreground">
              Extensiones y capacidades especializadas para <strong className="text-foreground">{settings.business_name}</strong>.
            </p>
          </div>
        </div>

        {isSuperAdminOrImpersonating ? (
          <button
            type="button"
            onClick={() => setIsPluginsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
            title="Abrir gestor para activar o desactivar plugins"
          >
            <Sparkles className="w-4 h-4" />
            <span>Gestionar Plugins (Activar / Desactivar)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsPluginsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
            title="Ver catálogo y cotizar módulos para tu comercio"
          >
            <Puzzle className="w-4 h-4" />
            <span>Ver Catálogo Completo & Cotizar</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AVAILABLE_PLUGINS.map((plugin) => {
          const isActive = activeModuleIds.includes(plugin.id as any);
          const route = PLUGIN_ROUTES[plugin.id];

          return (
            <div
              key={plugin.id}
              onClick={() => setSelectedPluginForDetail(plugin)}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer group hover:shadow-md ${
                isActive
                  ? "bg-card border-emerald-500/40 shadow-xs hover:border-emerald-500/80 ring-1 ring-emerald-500/20"
                  : "bg-card/70 border-border hover:border-primary/50"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-muted/80 border border-border/80 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    {plugin.icon}
                  </div>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Activo
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border/60">
                      Inactivo
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider block">
                    {plugin.categoryShort}
                  </span>
                  <h3 className="font-black text-sm sm:text-base text-foreground group-hover:text-primary transition-colors leading-snug">
                    {plugin.name}
                  </h3>
                </div>
              </div>

              <div
                className="pt-3 mt-4 border-t border-border flex items-center justify-between text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setSelectedPluginForDetail(plugin)}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Ver Ficha</span>
                </button>

                {isActive && route ? (
                  <Link
                    href={route}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Abrir Módulo →</span>
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Plugin Details Modal */}
      {selectedPluginForDetail && (
        <PluginDetailModal
          plugin={selectedPluginForDetail}
          isActive={activeModuleIds.includes(selectedPluginForDetail.id as any)}
          isOpen={Boolean(selectedPluginForDetail)}
          onClose={() => setSelectedPluginForDetail(null)}
          tenantId={settings.tenant_id}
          tenantName={settings.business_name}
          supportPhone={settings.whatsapp_number || settings.phone}
          isSuperAdmin={isSuperAdminOrImpersonating}
        />
      )}

      {/* Tenant Plugins Activation Modal */}
      {isPluginsModalOpen && (
        <TenantPluginsModal
          isOpen={isPluginsModalOpen}
          onClose={() => setIsPluginsModalOpen(false)}
          tenant={{
            id: settings.tenant_id,
            name: settings.business_name,
            slug: settings.tenant_id,
            status: "active",
            logo_url: settings.logo_url || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            settings,
            stores: [],
            storesCount: 0,
            productsCount: 0,
            ordersCount: 0,
            totalRevenueUsd: 0,
          }}
          isSuperAdmin={isSuperAdminOrImpersonating}
          supportPhone={settings.whatsapp_number || settings.phone}
          onModulesUpdated={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
