"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Store as StoreType,
  Order,
  TenantPlanLimits,
  TenantSettings,
} from "@marketos/types";
import { StoresTab } from "./stores-tab";
import { PlanUpgradeModal } from "./plan-upgrade-modal";
import { createStoreAction, updateStoreAction } from "@/app/admin/actions";
import { toast } from "sonner";
import {
  Building2,
  X,
  Loader2,
} from "lucide-react";

interface StoresViewProps {
  initialStores: StoreType[];
  initialOrders: Order[];
  settings: TenantSettings;
  planLimits: TenantPlanLimits | null;
}

export function StoresView({
  initialStores,
  initialOrders,
  settings,
  planLimits,
}: StoresViewProps) {
  const router = useRouter();
  const [stores, setStores] = useState<StoreType[]>(initialStores);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre de la sucursal es obligatorio.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await createStoreAction({
        tenantId: settings.tenant_id,
        name: name.trim(),
        code: code.trim().toUpperCase() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        isActive: true,
      });

      if (res?.success && res.store) {
        setStores((prev) => [...prev, res.store!]);
        setIsStoreModalOpen(false);
        setName("");
        setCode("");
        setAddress("");
        setPhone("");
        toast.success(`Sucursal ${res.store.name} creada exitosamente`);
      } else {
        toast.error(res?.error || "Error al crear sucursal");
      }
    } catch {
      toast.error("Error de comunicación al crear sucursal");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStoreStatus = async (store: StoreType) => {
    try {
      const res = await updateStoreAction(store.id, {
        is_active: !store.is_active,
      });
      if (res?.success && res.store) {
        setStores((prev) =>
          prev.map((s) => (s.id === store.id ? res.store! : s))
        );
        toast.success(`Sucursal ${store.name} actualizada`);
      } else {
        toast.error(res?.error || "Error al modificar estado de la sucursal");
      }
    } catch {
      toast.error("Error de comunicación al actualizar sucursal");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-view-enter space-y-6">
      <StoresTab
        stores={stores}
        orders={initialOrders}
        planLimitsState={planLimits}
        onOpenStoreModal={() => setIsStoreModalOpen(true)}
        onTriggerUpgradeModal={() => setIsUpgradeModalOpen(true)}
        onToggleStoreStatus={handleToggleStoreStatus}
        onFilterStoreOrders={(storeId) => {
          router.push(`/admin/orders?store=${storeId}`);
        }}
      />

      {/* Create Store Modal */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Nueva Sucursal
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Punto de retiro o sede física
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStoreModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="p-4 space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  Nombre de la Sede *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sede Chacao / Tienda Principal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  Código Interno
                </label>
                <input
                  type="text"
                  placeholder="Ej. SUC-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary uppercase font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  Dirección Física
                </label>
                <input
                  type="text"
                  placeholder="Ej. Av. Francisco de Miranda, Edif. Centro"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  Teléfono de Contacto
                </label>
                <input
                  type="tel"
                  placeholder="Ej. 0412-1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSaving ? "Creando..." : "Crear Sucursal"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Upgrade Modal */}
      {isUpgradeModalOpen && planLimits && (
        <PlanUpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          tenantName={settings.business_name}
          tenantId={settings.tenant_id}
          planLimits={planLimits}
          quotaType="stores"
        />
      )}
    </div>
  );
}
