"use client";

import React, { useState } from "react";
import {
  Product,
  Category,
  RawMaterial,
  ProductModifierGroup,
  ProductModifierOption,
} from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import {
  Sparkles,
  Plus,
  Trash2,
  Save,
  Edit2,
  Copy,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Utensils,
  Search,
  Zap,
  TrendingUp,
  X,
} from "lucide-react";

interface ModifiersAdminProps {
  tenantId: string;
  products: Product[];
  categories?: Category[];
  rawMaterials?: RawMaterial[];
  modifierGroups: ProductModifierGroup[];
  onSaveGroup: (group: ProductModifierGroup) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
}

export function ModifiersAdmin({
  tenantId,
  products,
  categories = [],
  rawMaterials = [],
  modifierGroups,
  onSaveGroup,
  onDeleteGroup,
}: ModifiersAdminProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterScope, setFilterScope] = useState<"ALL" | "GLOBAL" | "CATEGORY" | "PRODUCT">("ALL");
  const [editingGroup, setEditingGroup] = useState<ProductModifierGroup | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formBadge, setFormBadge] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formScopeType, setFormScopeType] = useState<"GLOBAL" | "CATEGORY" | "PRODUCT">("GLOBAL");
  const [formTargetId, setFormTargetId] = useState("");
  const [formRequired, setFormRequired] = useState(false);
  const [formMin, setFormMin] = useState(0);
  const [formMax, setFormMax] = useState(1);
  const [formOptions, setFormOptions] = useState<ProductModifierOption[]>([]);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOpenCreate = () => {
    setEditingGroup(null);
    setFormName("");
    setFormBadge("");
    setFormDescription("");
    setFormScopeType("GLOBAL");
    setFormTargetId("");
    setFormRequired(false);
    setFormMin(0);
    setFormMax(1);
    setFormOptions([
      {
        id: `opt-${Date.now()}-1`,
        name: "Papas Fritas + Bebida",
        price_adjustment_usd: 2.0,
        badge: "COMBO",
        is_upsell: true,
        is_available: true,
      },
    ]);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (group: ProductModifierGroup) => {
    setEditingGroup(group);
    setFormName(group.name);
    setFormBadge(group.badge || "");
    setFormDescription(group.description || "");
    if (group.product_id) {
      setFormScopeType("PRODUCT");
      setFormTargetId(group.product_id);
    } else if (group.category_id) {
      setFormScopeType("CATEGORY");
      setFormTargetId(group.category_id);
    } else {
      setFormScopeType("GLOBAL");
      setFormTargetId("");
    }
    setFormRequired(group.required);
    setFormMin(group.min_selectable);
    setFormMax(group.max_selectable);
    setFormOptions(group.options.map((o) => ({ ...o })));
    setIsFormOpen(true);
  };

  const handleDuplicate = (group: ProductModifierGroup) => {
    setEditingGroup(null);
    setFormName(`${group.name} (Copia)`);
    setFormBadge(group.badge || "");
    setFormDescription(group.description || "");
    setFormScopeType(group.product_id ? "PRODUCT" : group.category_id ? "CATEGORY" : "GLOBAL");
    setFormTargetId(group.product_id || group.category_id || "");
    setFormRequired(group.required);
    setFormMin(group.min_selectable);
    setFormMax(group.max_selectable);
    setFormOptions(
      group.options.map((o, idx) => ({
        ...o,
        id: `opt-${Date.now()}-${idx}`,
      }))
    );
    setIsFormOpen(true);
  };

  // Presets
  const applyPresetExtrasBurger = () => {
    setFormName("Extras & Ingredientes Adicionales");
    setFormDescription("Personaliza tu hamburguesa con tus ingredientes favoritos");
    setFormBadge("EXTRAS");
    setFormRequired(false);
    setFormMin(0);
    setFormMax(6);
    setFormOptions([
      {
        id: `opt-${Date.now()}-1`,
        name: "Queso amarillo extra",
        price_adjustment_usd: 0.5,
        badge: "EXTRA",
        is_available: true,
      },
      {
        id: `opt-${Date.now()}-2`,
        name: "Pepinillos agridulces",
        price_adjustment_usd: 0.7,
        badge: "EXTRA",
        is_available: true,
      },
      {
        id: `opt-${Date.now()}-3`,
        name: "Tocineta crujiente",
        price_adjustment_usd: 1.0,
        badge: "POPULAR",
        is_available: true,
      },
      {
        id: `opt-${Date.now()}-4`,
        name: "Carne adicional 150g",
        price_adjustment_usd: 1.5,
        badge: "TOP",
        is_available: true,
      },
    ]);
  };

  const applyPresetCombos = () => {
    setFormName("🔥 Hazlo Combo (Papas + Bebida)");
    setFormDescription("Añade papas fritas y refresco frío por un precio especial");
    setFormBadge("COMBO");
    setFormRequired(false);
    setFormMin(0);
    setFormMax(1);
    setFormOptions([
      {
        id: `opt-${Date.now()}-1`,
        name: "Combo Clásico: Papas Medianas + Refresco 355ml",
        price_adjustment_usd: 2.0,
        badge: "COMBO",
        is_upsell: true,
        is_available: true,
      },
      {
        id: `opt-${Date.now()}-2`,
        name: "Combo Brutal: Papas Cheddar & Tocineta + Refresco 355ml",
        price_adjustment_usd: 3.5,
        badge: "PROMO",
        is_upsell: true,
        is_available: true,
      },
    ]);
  };

  // Options row mutations
  const handleAddOption = () => {
    setFormOptions([
      ...formOptions,
      {
        id: `opt-${Date.now()}-${formOptions.length + 1}`,
        name: "",
        price_adjustment_usd: 0,
        badge: "",
        is_available: true,
      },
    ]);
  };

  const handleUpdateOption = (index: number, patch: Partial<ProductModifierOption>) => {
    const next = [...formOptions];
    next[index] = { ...next[index], ...patch };
    setFormOptions(next);
  };

  const handleRemoveOption = (index: number) => {
    if (formOptions.length <= 1) return;
    setFormOptions(formOptions.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showNotification("error", "El nombre del grupo es obligatorio.");
      return;
    }

    const validOptions = formOptions.filter((o) => o.name.trim().length > 0);
    if (validOptions.length === 0) {
      showNotification("error", "Debes ingresar al menos una opción o ingrediente válido.");
      return;
    }

    setIsSaving(true);
    try {
      const groupToSave: ProductModifierGroup = {
        id: editingGroup?.id || `mod-grp-${Date.now()}`,
        tenant_id: tenantId,
        product_id: formScopeType === "PRODUCT" && formTargetId ? formTargetId : null,
        category_id: formScopeType === "CATEGORY" && formTargetId ? formTargetId : null,
        name: formName.trim(),
        description: formDescription.trim() || null,
        badge: formBadge.trim() || null,
        required: formRequired,
        min_selectable: formRequired ? Math.max(1, formMin) : Math.max(0, formMin),
        max_selectable: Math.max(1, formMax),
        sort_order: editingGroup?.sort_order ?? modifierGroups.length,
        is_active: true,
        options: validOptions.map((o) => ({
          ...o,
          price_adjustment_usd: Number(o.price_adjustment_usd) || 0,
          raw_material_id: o.raw_material_id || null,
          badge: o.badge?.trim() || null,
        })),
      };

      await onSaveGroup(groupToSave);
      showNotification(
        "success",
        editingGroup ? "Modificador actualizado exitosamente" : "Nuevo grupo de extras/combos creado"
      );
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      showNotification("error", "Ocurrió un error al guardar el grupo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (groupId: string, name: string) => {
    if (!confirm(`¿Eliminar definitivamente el grupo "${name}"?`)) return;
    try {
      await onDeleteGroup(groupId);
      showNotification("success", "Grupo eliminado correctamente.");
    } catch (err) {
      console.error(err);
      showNotification("error", "Error al eliminar el grupo.");
    }
  };

  // Filter groups
  const filteredGroups = modifierGroups.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.options.some((o) => o.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;

    if (filterScope === "GLOBAL") return !g.product_id && !g.category_id;
    if (filterScope === "CATEGORY") return !!g.category_id;
    if (filterScope === "PRODUCT") return !!g.product_id;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold border transition-all animate-in slide-in-from-bottom-2 ${
            notification.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-background"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 bg-background"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Zap className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-black tracking-tight text-foreground">
              Modificadores, Extras & Combos (Up-Selling)
            </h2>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-black uppercase">
              Venta Cruzada
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Configura ingredientes adicionales (queso extra, tocineta, pepinillos) y combos dinámicos
            (papas fritas + bebida por +$2.00) para elevar el ticket promedio de tu negocio.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-xs font-black hover:bg-primary/90 transition-colors shadow-md cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Crear Grupo de Extras</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por grupo o ingrediente..."
            className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(
            [
              { id: "ALL", label: `Todos (${modifierGroups.length})` },
              { id: "GLOBAL", label: "Catálogo Completo" },
              { id: "CATEGORY", label: "Por Categoría" },
              { id: "PRODUCT", label: "Por Plato" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterScope(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterScope === tab.id
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-3xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">
              No hay grupos de modificadores configurados
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Crea tu primer grupo para permitir a tus clientes agregar ingredientes con precio
              adicional (ej. tocineta +$1.00) o combos completos (ej. papas + refresco +$2.00).
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear Modificador Ahora</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredGroups.map((group) => {
            const targetProduct = group.product_id
              ? products.find((p) => p.id === group.product_id)
              : null;
            const targetCategory = group.category_id
              ? categories.find((c) => c.id === group.category_id)
              : null;

            return (
              <div
                key={group.id}
                className="bg-card border border-border rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-border/80 transition-all"
              >
                <div className="space-y-3">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-foreground truncate">
                          {group.name}
                        </h3>
                        {group.badge && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            {group.badge}
                          </span>
                        )}
                        {group.required ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            Obligatorio (mín {group.min_selectable})
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                            Opcional
                          </span>
                        )}
                      </div>
                      {group.description && (
                        <p className="text-xs text-muted-foreground">{group.description}</p>
                      )}
                    </div>

                    {/* Scope Badge */}
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-muted text-foreground border border-border shrink-0 flex items-center gap-1">
                      {targetProduct ? (
                        <>🍔 Plato: {targetProduct.name}</>
                      ) : targetCategory ? (
                        <>📁 Categoría: {targetCategory.name}</>
                      ) : (
                        <>🌐 Todo el Catálogo</>
                      )}
                    </span>
                  </div>

                  {/* Options List Preview */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                      <span>Ingredientes / Opciones ({group.options.length}):</span>
                      <span>
                        {group.max_selectable === 1
                          ? "Selección Única"
                          : `Hasta ${group.max_selectable} opciones`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.options.map((opt) => (
                        <div
                          key={opt.id}
                          className="p-2 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-foreground truncate">
                              {opt.name}
                            </span>
                            {opt.badge && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          <span className="font-black text-amber-600 dark:text-amber-400 shrink-0">
                            {opt.price_adjustment_usd > 0
                              ? `+${formatCurrency(opt.price_adjustment_usd, "USD")}`
                              : "Gratis"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => handleDuplicate(group)}
                    className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
                    title="Duplicar grupo"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Duplicar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(group)}
                    className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(group.id, group.name)}
                    className="p-2 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer text-xs"
                    title="Eliminar grupo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-over / Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => !isSaving && setIsFormOpen(false)}
          />

          <div className="relative w-full max-w-2xl bg-card text-foreground rounded-3xl border border-border shadow-2xl flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">
                    {editingGroup ? "Editar Grupo de Extras / Combos" : "Nuevo Grupo de Modificadores"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Define ingredientes con precio o combos para elevar el ticket promedio
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsFormOpen(false)}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Presets Bar */}
            {!editingGroup && (
              <div className="px-5 py-2.5 bg-amber-500/5 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Plantillas rápidas:</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={applyPresetExtrasBurger}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-card hover:bg-amber-500/10 text-foreground border border-border cursor-pointer transition-colors"
                  >
                    🍔 Extras Hamburguesa (Queso, Tocineta, etc.)
                  </button>
                  <button
                    type="button"
                    onClick={applyPresetCombos}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-card hover:bg-amber-500/10 text-foreground border border-border cursor-pointer transition-colors"
                  >
                    🍟 Hazlo Combo (Papas + Bebida)
                  </button>
                </div>
              </div>
            )}

            {/* Form Content */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    Nombre del Grupo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej. Hazlo Combo, Extras Adicionales, Salsas..."
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Badge Destacado</label>
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    placeholder="Ej. COMBO, TOP, EXTRAS"
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Descripción o Frase de Enganche</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ej. Añade papas fritas y bebida fría por solo +$2.00"
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Scope Selection */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-muted/30 border border-border">
                <label className="text-xs font-bold text-foreground block">
                  ¿A qué productos aplica este grupo?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "GLOBAL", label: "🌐 Todo el Menú" },
                    { id: "CATEGORY", label: "📁 Por Categoría" },
                    { id: "PRODUCT", label: "🍔 Por Plato Específico" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setFormScopeType(s.id as any);
                        setFormTargetId("");
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        formScopeType === s.id
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-card border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Sub-select for category or product */}
                {formScopeType === "CATEGORY" && (
                  <div className="pt-2">
                    <select
                      value={formTargetId}
                      onChange={(e) => setFormTargetId(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-hidden"
                    >
                      <option value="">-- Selecciona una categoría --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formScopeType === "PRODUCT" && (
                  <div className="pt-2">
                    <select
                      value={formTargetId}
                      onChange={(e) => setFormTargetId(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-hidden"
                    >
                      <option value="">-- Selecciona un plato específico --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (${p.price_usd.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Selection Rules */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chkRequired"
                    checked={formRequired}
                    onChange={(e) => setFormRequired(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary cursor-pointer"
                  />
                  <label htmlFor="chkRequired" className="text-xs font-bold text-foreground cursor-pointer">
                    Selección Obligatoria
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Mínimo de opciones</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={formMin}
                    onChange={(e) => setFormMin(parseInt(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-card border border-border rounded-xl text-xs text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Máximo de opciones</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formMax}
                    onChange={(e) => setFormMax(parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 bg-card border border-border rounded-xl text-xs text-foreground"
                  />
                </div>
              </div>

              {/* Options Dynamic Table */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-primary" />
                    <span>Ingredientes, Extras & Opciones con Precio</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Opción</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {formOptions.map((opt, idx) => (
                    <div
                      key={opt.id}
                      className="p-3 rounded-2xl bg-card border border-border flex flex-col sm:flex-row items-center gap-2.5"
                    >
                      {/* Name */}
                      <div className="w-full sm:flex-1">
                        <input
                          type="text"
                          required
                          value={opt.name}
                          onChange={(e) => handleUpdateOption(idx, { name: e.target.value })}
                          placeholder="Ej. Tocineta crocante, Queso extra, Papas + Bebida"
                          className="w-full px-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-hidden"
                        />
                      </div>

                      {/* Price USD */}
                      <div className="w-full sm:w-28 flex items-center gap-1">
                        <span className="text-xs font-bold text-muted-foreground">+$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={opt.price_adjustment_usd}
                          onChange={(e) =>
                            handleUpdateOption(idx, {
                              price_adjustment_usd: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground font-black"
                        />
                      </div>

                      {/* Badge */}
                      <div className="w-full sm:w-24">
                        <input
                          type="text"
                          value={opt.badge || ""}
                          onChange={(e) => handleUpdateOption(idx, { badge: e.target.value })}
                          placeholder="COMBO"
                          className="w-full px-2 py-1.5 bg-muted/40 border border-border rounded-xl text-[11px] text-foreground font-bold uppercase text-center"
                        />
                      </div>

                      {/* Optional Raw Material mapping */}
                      {rawMaterials.length > 0 && (
                        <div className="w-full sm:w-40">
                          <select
                            value={opt.raw_material_id || ""}
                            onChange={(e) =>
                              handleUpdateOption(idx, { raw_material_id: e.target.value || null })
                            }
                            className="w-full px-2 py-1.5 bg-muted/40 border border-border rounded-xl text-[11px] text-foreground truncate"
                            title="Vincular a insumo de cocina para descontar stock"
                          >
                            <option value="">(Sin insumo vinculado)</option>
                            {rawMaterials.map((rm) => (
                              <option key={rm.id} value={rm.id}>
                                Insumo: {rm.name} ({rm.unit})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Remove Button */}
                      <button
                        type="button"
                        disabled={formOptions.length <= 1}
                        onClick={() => handleRemoveOption(idx)}
                        className="p-1.5 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors disabled:opacity-30 cursor-pointer shrink-0"
                        title="Eliminar opción"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit footer */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-bold text-foreground cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:bg-primary/90 transition-colors shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? "Guardando..." : "Guardar Modificador"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
