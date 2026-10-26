"use client";

import React from "react";
import type {
  Store as StoreType,
  Order,
  TenantPlanLimits,
} from "@marketos/types";
import {
  Building2,
  Plus,
  Zap,
  Sparkles,
  MapPin,
  Phone,
} from "lucide-react";

export interface StoresTabProps {
  stores: StoreType[];
  orders: Order[];
  planLimitsState?: TenantPlanLimits | null;
  onOpenStoreModal: () => void;
  onTriggerUpgradeModal: (feature: "stores") => void;
  onToggleStoreStatus: (store: StoreType) => Promise<void> | void;
  onFilterStoreOrders: (storeId: string) => void;
}

export function StoresTab({
  stores,
  orders,
  planLimitsState,
  onOpenStoreModal,
  onTriggerUpgradeModal,
  onToggleStoreStatus,
  onFilterStoreOrders,
}: StoresTabProps) {
  const maxStores = planLimitsState?.plan.max_stores || 1;
  const currentStoresCount = stores.length;
  const isAtCapacity = currentStoresCount >= maxStores;
  const storeUsagePct = Math.min(100, Math.round((currentStoresCount / maxStores) * 100));

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Sucursales y Sedes de Despacho ({stores.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gestiona las sedes físicas de este comercio para zonificación de inventario y despacho de pedidos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isAtCapacity) {
              onTriggerUpgradeModal("stores");
              return;
            }
            onOpenStoreModal();
          }}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all shrink-0 ${
            isAtCapacity
              ? "bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-500/30"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
          }`}
          title={isAtCapacity ? "Cupo máximo alcanzado. Clic para actualizar plan" : "Registrar nueva sucursal"}
        >
          {isAtCapacity ? (
            <>
              <Zap className="w-4 h-4" />
              <span>Límite de Sedes Alcanzado</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>+ Registrar Nueva Sucursal</span>
            </>
          )}
        </button>
      </div>

      {/* SaaS Store Quota Card */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          isAtCapacity
            ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
            : storeUsagePct >= 80
            ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
            : "bg-card border-border text-foreground"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isAtCapacity
                  ? "bg-rose-500/20 text-rose-500"
                  : storeUsagePct >= 80
                  ? "bg-amber-500/20 text-amber-500"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-foreground">
                  Límite de Sedes Físicas ({currentStoresCount} / {maxStores} sucursales)
                </span>
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isAtCapacity
                      ? "bg-rose-500 text-white"
                      : storeUsagePct >= 80
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  }`}
                >
                  {isAtCapacity
                    ? "Límite Alcanzado (100%)"
                    : `${storeUsagePct}% En Uso`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Plan actual: <strong className="text-foreground">{planLimitsState?.plan.name || "Starter"}</strong>.
                {isAtCapacity
                  ? " Has alcanzado el límite máximo de sucursales permitido por tu suscripción actual. Actualiza a Growth o Enterprise para abrir nuevas sedes."
                  : ` Puedes registrar ${maxStores - currentStoresCount} sucursales adicionales en tu plan.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onTriggerUpgradeModal("stores")}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              isAtCapacity
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-sm hover:scale-105 active:scale-95"
                : "bg-muted hover:bg-muted/80 text-foreground border border-border"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{isAtCapacity ? "Aumentar Límite de Sedes" : "Ver Planes SaaS"}</span>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 w-full h-2 rounded-full bg-muted overflow-hidden border border-border/50">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isAtCapacity
                ? "bg-rose-500"
                : storeUsagePct >= 80
                ? "bg-amber-500"
                : "bg-gradient-to-r from-emerald-500 to-teal-500"
            }`}
            style={{ width: `${storeUsagePct}%` }}
          />
        </div>
      </div>

      {stores.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-foreground text-sm">No hay sucursales registradas aún</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Registra la primera sede física de este comercio para asociar inventario y pedidos.
          </p>
          <button
            type="button"
            onClick={() => {
              if (isAtCapacity) {
                onTriggerUpgradeModal("stores");
                return;
              }
              onOpenStoreModal();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Primera Sucursal</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((st) => {
            const branchOrdersCount = orders.filter((o) => o.store_id === st.id).length;
            return (
              <div
                key={st.id}
                className="p-4 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all flex flex-col justify-between gap-4 shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground leading-tight">
                          {st.name}
                        </h3>
                        {st.code && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            Cód: {st.code}
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        st.is_active
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                      }`}
                    >
                      {st.is_active ? "Activa" : "Inactiva"}
                    </span>
                  </div>

                  {st.address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{st.address}</span>
                    </p>
                  )}

                  {st.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>{st.phone}</span>
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <div className="text-[11px] text-muted-foreground">
                    <strong>{branchOrdersCount}</strong> {branchOrdersCount === 1 ? "pedido" : "pedidos"}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onFilterStoreOrders(st.id)}
                      className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Ver Pedidos
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleStoreStatus(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                        st.is_active
                          ? "border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                          : "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                      }`}
                    >
                      {st.is_active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
