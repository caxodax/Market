"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Search,
  Power,
  PowerOff,
  ChevronLeft,
  ChevronRight,
  Filter,
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
  category: "Restauración" | "Comercio Minorista" | "Finanzas Locales";
  description: string;
  icon: React.ReactNode;
  features: string[];
  themeColor: "amber" | "blue" | "emerald";
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

const ITEMS_PER_PAGE = 2;

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

  // Search & Filter & Pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [currentPage, setCurrentPage] = useState(1);

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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, statusFilter]);

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

  // Filtered plugins
  const filteredPlugins = AVAILABLE_PLUGINS.filter((plugin) => {
    const isActive = isModuleActive(plugin.id);

    // Category filter
    if (categoryFilter !== "ALL" && plugin.category !== categoryFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === "ACTIVE" && !isActive) return false;
    if (statusFilter === "INACTIVE" && isActive) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = plugin.name.toLowerCase().includes(q);
      const matchDesc = plugin.description.toLowerCase().includes(q);
      const matchCategory = plugin.category.toLowerCase().includes(q);
      const matchFeatures = plugin.features.some((f) => f.toLowerCase().includes(q));
      if (!matchName && !matchDesc && !matchCategory && !matchFeatures) {
        return false;
      }
    }

    return true;
  });

  // Pagination calculation
  const totalItems = filteredPlugins.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const paginatedPlugins = filteredPlugins.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const activeCount = AVAILABLE_PLUGINS.filter((p) => isModuleActive(p.id)).length;
  const inactiveCount = AVAILABLE_PLUGINS.length - activeCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card w-full max-w-3xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 flex items-center justify-center font-bold shrink-0">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-foreground">
                  Gestión de Plugins & Módulos
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                  {activeCount} de {AVAILABLE_PLUGINS.length} activos
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comercio: <strong className="text-foreground">{tenant.name}</strong> ({tenant.slug})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Cerrar ventana"
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

        {/* Search, Filter & Tabs Bar */}
        <div className="p-3.5 border-b border-border/70 bg-card space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar plugin por nombre, función o categoría..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-8 rounded-xl border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status pills */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl self-start sm:self-auto border border-border/60">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos ({AVAILABLE_PLUGINS.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ACTIVE")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  statusFilter === "ACTIVE"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Activos ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("INACTIVE")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  statusFilter === "INACTIVE"
                    ? "bg-muted text-foreground shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Inactivos ({inactiveCount})
              </button>
            </div>
          </div>

          {/* Category filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-0.5 scrollbar-none">
            <span className="text-muted-foreground font-semibold flex items-center gap-1 shrink-0 mr-1">
              <Filter className="w-3 h-3" /> Categoría:
            </span>
            {[
              { id: "ALL", label: "Todas" },
              { id: "Restauración", label: "Restauración & Fast Food" },
              { id: "Comercio Minorista", label: "Retail & Bodegones" },
              { id: "Finanzas Locales", label: "Finanzas & Fiscal" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer ${
                  categoryFilter === cat.id
                    ? "bg-primary/10 text-primary border border-primary/30 font-bold"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 bg-muted/10">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-semibold">Consultando módulos en base de datos...</p>
            </div>
          ) : paginatedPlugins.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-background/50 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">
                  No se encontraron plugins
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No hay plugins que coincidan con los filtros aplicados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("ALL");
                  setStatusFilter("ALL");
                }}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                Restablecer todos los filtros
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedPlugins.map((plugin) => {
                const isActive = isModuleActive(plugin.id);
                const isBusy = updatingId === plugin.id;

                return (
                  <div
                    key={plugin.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      isActive
                        ? "bg-card border-emerald-500/40 shadow-xs ring-1 ring-emerald-500/20"
                        : "bg-card border-border hover:border-border/80 opacity-95"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Left Plugin Info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-xl bg-muted/60 border border-border/80 shrink-0 mt-0.5">
                          {plugin.icon}
                        </div>
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-sm text-foreground">
                              {plugin.name}
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                              {plugin.badge}
                            </span>
                            <span className="text-[10px] font-semibold text-muted-foreground border border-border/70 px-2 py-0.5 rounded-md">
                              {plugin.category}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {plugin.description}
                          </p>

                          {/* Features list */}
                          <div className="pt-2 grid sm:grid-cols-2 gap-1.5 text-[11px] text-foreground/85 font-medium">
                            {plugin.features.map((feat, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-primary shrink-0" />
                                <span className="truncate">{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: Explicit Action Buttons & Switch */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                        {/* Status Badge */}
                        <div className="flex items-center gap-1.5">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Habilitado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-muted text-muted-foreground border border-border/60">
                              Desactivado
                            </span>
                          )}
                        </div>

                        {/* Prominent Action Button */}
                        <div className="flex items-center gap-2">
                          {isActive ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleToggleModule(plugin.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
                              title="Desactivar plugin para esta tienda"
                            >
                              {isBusy ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Guardando...</span>
                                </>
                              ) : (
                                <>
                                  <PowerOff className="w-3.5 h-3.5" />
                                  <span>Desactivar</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleToggleModule(plugin.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-sm hover:shadow"
                              title="Activar e instalar plugin para esta tienda"
                            >
                              {isBusy ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Guardando...</span>
                                </>
                              ) : (
                                <>
                                  <Power className="w-3.5 h-3.5" />
                                  <span>Activar Módulo</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Accessible Toggle Switch */}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleModule(plugin.id)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                              isActive ? "bg-emerald-600" : "bg-muted-foreground/30"
                            }`}
                            role="switch"
                            aria-checked={isActive}
                            title={isActive ? "Haga clic para desactivar" : "Haga clic para activar"}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                isActive ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination & Footer */}
        <div className="p-3.5 sm:p-4 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Pagination controls */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
            <span>
              Mostrando{" "}
              <strong className="text-foreground">
                {totalItems === 0
                  ? 0
                  : `${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(
                      currentPage * ITEMS_PER_PAGE,
                      totalItems
                    )}`}
              </strong>{" "}
              de <strong className="text-foreground">{totalItems}</strong> plugins
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1 ml-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-xs font-semibold">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-black text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
