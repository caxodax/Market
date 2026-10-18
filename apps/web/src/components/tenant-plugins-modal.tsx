"use client";

import React, { useState, useEffect } from "react";
import { TenantWithDetails, TenantModule, TenantModuleId } from "@marketos/types";
import {
  getTenantModulesAction,
  setTenantModuleStatusAction,
} from "../app/actions";
import {
  Puzzle,
  Utensils,
  ScanBarcode,
  Landmark,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
} from "lucide-react";

interface TenantPluginsModalProps {
  tenant: TenantWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onModulesUpdated?: () => void;
}

interface PluginMetadata {
  id: TenantModuleId;
  name: string;
  badge: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  themeColor: string;
}

const AVAILABLE_PLUGINS: PluginMetadata[] = [
  {
    id: "food_service",
    name: "Gastronomía, Fast Food & Restaurantes",
    badge: "v1.0.0 • Cocina & Menú",
    category: "Restauración",
    description:
      "Diseñado para locales de comida rápida, hamburgueserías y perros calientes. Añade control de insumos (BOM), escandallo de costos y personalización de salsas/extras en el catálogo.",
    icon: <Utensils className="w-5 h-5 text-amber-500" />,
    features: [
      "Insumos de Cocina: Control de inventario en gramos, ml y unidades",
      "Recetas & Escandallo: Fichas técnicas, costo unitario y margen bruto",
      "Descarte en Tiempo Real: Reducción automática de stock al validar pedidos",
      "Modal de Salsas & Extras: Personalización interactiva para el cliente",
    ],
    themeColor: "amber",
  },
  {
    id: "barcode_retail",
    name: "Retail, Supermercados & Bodegones",
    badge: "v1.0.0 • Punto de Venta",
    category: "Comercio Minorista",
    description:
      "Optimizado para supermercados y minimarkets de alta rotación con códigos de barra estándar y venta por unidad física.",
    icon: <ScanBarcode className="w-5 h-5 text-blue-500" />,
    features: [
      "Lectura rápida de códigos de barra (EAN-13, UPC)",
      "Control de existencias por empaque y unidad sellada",
      "Gestión de pasillos, estantes y reposición masiva",
      "Búsqueda instantánea de productos por código",
    ],
    themeColor: "blue",
  },
  {
    id: "local_venezuela",
    name: "Localización Oficial Venezuela",
    badge: "v1.0.0 • Fiscal & Bancario",
    category: "Finanzas Locales",
    description:
      "Integración de pasarelas bancarias locales venezolanas, monitor automático de tasa oficial BCV y facturación fiscal.",
    icon: <Landmark className="w-5 h-5 text-emerald-500" />,
    features: [
      "Sincronización automatizada con la tasa oficial BCV",
      "Módulo de validación de Pago Móvil y cuentas bancarias",
      "Doble display de precios en USD y Bolívares (VES)",
      "Cálculo legal de IGTF (3%) y comprobantes de retención",
    ],
    themeColor: "emerald",
  },
];

export function TenantPluginsModal({
  tenant,
  isOpen,
  onClose,
  onModulesUpdated,
}: TenantPluginsModalProps) {
  const [modules, setModules] = useState<TenantModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<TenantModuleId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch tenant modules
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getTenantModulesAction(tenant.id);
        if (isMounted) {
          if (res.success && res.modules) {
            setModules(res.modules);
          } else {
            setError(res.error || "No se pudieron obtener los módulos.");
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Error al conectar con la base de datos.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [isOpen, tenant.id]);

  if (!isOpen) return null;

  const isModuleActive = (moduleId: TenantModuleId): boolean => {
    const mod = modules.find((m) => m.module_id === moduleId);
    return mod ? mod.is_active : false;
  };

  const handleToggleModule = async (moduleId: TenantModuleId) => {
    const currentEnabled = isModuleActive(moduleId);
    const nextEnabled = !currentEnabled;

    setUpdatingId(moduleId);
    setError(null);
    setSuccessMessage(null);

    // Optimistic update
    setModules((prev) => {
      const exists = prev.some((m) => m.module_id === moduleId);
      if (exists) {
        return prev.map((m) =>
          m.module_id === moduleId ? { ...m, is_active: nextEnabled, updated_at: new Date().toISOString() } : m
        );
      } else {
        return [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            tenant_id: tenant.id,
            module_id: moduleId,
            is_active: nextEnabled,
            installed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      }
    });

    try {
      const res = await setTenantModuleStatusAction(tenant.id, moduleId, nextEnabled);
      if (res.success) {
        const plugin = AVAILABLE_PLUGINS.find((p) => p.id === moduleId);
        setSuccessMessage(
          `Módulo "${plugin?.name || moduleId}" ${nextEnabled ? "activado" : "desactivado"} exitosamente.`
        );
        if (onModulesUpdated) onModulesUpdated();
      } else {
        // Revert
        setModules((prev) =>
          prev.map((m) =>
            m.module_id === moduleId ? { ...m, is_active: currentEnabled } : m
          )
        );
        setError(res.error || "No se pudo actualizar el estado del módulo.");
      }
    } catch (err: any) {
      // Revert
      setModules((prev) =>
        prev.map((m) =>
          m.module_id === moduleId ? { ...m, is_active: currentEnabled } : m
        )
      );
      setError(err.message || "Error inesperado al guardar cambios.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 flex items-center justify-center font-bold">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Gestión de Plugins & Módulos
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full border border-purple-500/20">
                  Arquitectura Modular
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Comercio: <strong className="text-foreground">{tenant.name}</strong> ({tenant.slug})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border/60 flex items-start gap-2.5 text-xs text-muted-foreground">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Como <strong>Super Admin</strong>, puedes encender o apagar plugins según el giro comercial de cada cliente. La tienda cargará dinámicamente sus paneles de control sin afectar a otros comercios.
          </p>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-xs font-semibold">Consultando módulos instalados...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {AVAILABLE_PLUGINS.map((plugin) => {
                const isActive = isModuleActive(plugin.id);
                const isBusy = updatingId === plugin.id;

                return (
                  <div
                    key={plugin.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive
                        ? "bg-card border-border shadow-xs ring-1 ring-primary/20"
                        : "bg-muted/20 border-border/70 opacity-90"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-xl bg-muted/60 border border-border/80 shrink-0 mt-0.5">
                          {plugin.icon}
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-foreground">
                              {plugin.name}
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                              {plugin.badge}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {plugin.description}
                          </p>

                          {/* Features list */}
                          <div className="pt-2 grid sm:grid-cols-2 gap-1.5 text-[11px] text-foreground/80 font-medium">
                            {plugin.features.map((feat, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-primary shrink-0" />
                                <span className="truncate">{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right toggle button */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0 pt-1">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleModule(plugin.id)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                            isActive ? "bg-emerald-600" : "bg-muted-foreground/30"
                          }`}
                          role="switch"
                          aria-checked={isActive}
                          title={isActive ? "Desactivar plugin" : "Activar plugin"}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              isActive ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>

                        <div className="text-[10px] font-bold">
                          {isBusy ? (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Guardando...
                            </span>
                          ) : isActive ? (
                            <span className="text-emerald-600">Activo</span>
                          ) : (
                            <span className="text-muted-foreground">Inactivo</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-border bg-muted/20 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Los cambios se aplican inmediatamente en el catálogo y en el panel de la tienda.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
