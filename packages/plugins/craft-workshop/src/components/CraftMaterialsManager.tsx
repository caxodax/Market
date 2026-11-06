"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import type {
  CraftMaterial,
  CraftMaterialCategory,
  CraftMaterialUnit,
  CreateCraftMaterialInput,
  UpdateCraftMaterialInput,
} from "@marketos/types";
import { calculateUnitCost, convertBimonetary } from "../services/craft-pricing-engine";
import {
  Boxes,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Package,
  Coffee,
  Shirt,
  Scissors,
  Tag,
  Gift,
  Sparkles,
} from "lucide-react";

export interface CraftMaterialsManagerProps {
  tenantId: string;
  materials: CraftMaterial[];
  onCreateMaterial: (input: Omit<CreateCraftMaterialInput, "tenantId">) => Promise<boolean>;
  onUpdateMaterial: (input: Omit<UpdateCraftMaterialInput, "tenantId">) => Promise<boolean>;
  onDeleteMaterial: (materialId: string) => Promise<boolean>;
  currencySymbol?: string;
  exchangeRate?: number;
}

const CATEGORIES: {
  id: CraftMaterialCategory | "all";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "all", label: "Todos los Insumos", icon: Sparkles },
  { id: "sublimacion", label: "Sublimación", icon: Coffee },
  { id: "dtf", label: "DTF Textil", icon: Shirt },
  { id: "vinil", label: "Vinil", icon: Scissors },
  { id: "papeleria", label: "Papelería & Etiquetas", icon: Tag },
  { id: "esferas", label: "Esferas Navideñas", icon: Gift },
  { id: "general", label: "General", icon: Package },
];

const UNIT_MEASURES: { id: CraftMaterialUnit; label: string }[] = [
  { id: "UNIDAD", label: "Unidad (Taza, Franela, Esfera, Gorra)" },
  { id: "HOJA", label: "Hoja (A4, A3, Tabloide)" },
  { id: "METRO", label: "Metro Lineal (Vinil, DTF Rollo)" },
  { id: "CM2", label: "Centímetro Cuadrado (cm²)" },
  { id: "ML", label: "Mililitros (Tinta, Barniz)" },
  { id: "GRAMO", label: "Gramos (Poliamida en polvo)" },
  { id: "USO", label: "Uso / Desgaste (Cinta térmica, teflón)" },
];

export function CraftMaterialsManager({
  tenantId,
  materials,
  onCreateMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
  currencySymbol = "$",
  exchangeRate = 1,
}: CraftMaterialsManagerProps) {
  const [selectedCategory, setSelectedCategory] = useState<CraftMaterialCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<CraftMaterial | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<CraftMaterialCategory>("sublimacion");
  const [formSku, setFormSku] = useState("");
  const [formPackQty, setFormPackQty] = useState("1");
  const [formPackPrice, setFormPackPrice] = useState("0");
  const [formUnitMeasure, setFormUnitMeasure] = useState<CraftMaterialUnit>("UNIDAD");
  const [formStockPacks, setFormStockPacks] = useState("5");
  const [formMinStockPacks, setFormMinStockPacks] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreateModal = () => {
    setEditingMaterial(null);
    setFormName("");
    setFormCategory(selectedCategory === "all" ? "sublimacion" : selectedCategory);
    setFormSku("");
    setFormPackQty("1");
    setFormPackPrice("0");
    setFormUnitMeasure("UNIDAD");
    setFormStockPacks("5");
    setFormMinStockPacks("1");
    setIsModalOpen(true);
  };

  const openEditModal = (mat: CraftMaterial) => {
    setEditingMaterial(mat);
    setFormName(mat.name);
    setFormCategory(mat.category);
    setFormSku(mat.sku || "");
    setFormPackQty(String(mat.pack_quantity));
    setFormPackPrice(String(mat.pack_price_base));
    setFormUnitMeasure(mat.unit_measure);
    setFormStockPacks(String(mat.stock_packs));
    setFormMinStockPacks(String(mat.min_stock_packs));
    setIsModalOpen(true);
  };

  const calculatedPreviewUnitCost = useMemo(() => {
    const qty = parseFloat(formPackQty) || 1;
    const price = parseFloat(formPackPrice) || 0;
    return calculateUnitCost(price, qty);
  }, [formPackQty, formPackPrice]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.sku && m.sku.toLowerCase().includes(q));

      const matchesCategory =
        selectedCategory === "all" || m.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [materials, search, selectedCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.warning("Por favor ingresa el nombre del insumo");
      return;
    }

    const packQty = parseFloat(formPackQty) || 1;
    const packPrice = parseFloat(formPackPrice) || 0;
    const stockPacks = parseFloat(formStockPacks) || 0;
    const minStockPacks = parseFloat(formMinStockPacks) || 1;

    setIsSubmitting(true);
    try {
      if (editingMaterial) {
        const ok = await onUpdateMaterial({
          materialId: editingMaterial.id,
          name: formName.trim(),
          category: formCategory,
          sku: formSku.trim() || undefined,
          packQuantity: packQty,
          packPriceBase: packPrice,
          unitMeasure: formUnitMeasure,
          stockPacks,
          minStockPacks,
        });
        if (ok) setIsModalOpen(false);
      } else {
        const ok = await onCreateMaterial({
          name: formName.trim(),
          category: formCategory,
          sku: formSku.trim() || undefined,
          packQuantity: packQty,
          packPriceBase: packPrice,
          unitMeasure: formUnitMeasure,
          stockPacks,
          minStockPacks,
        });
        if (ok) setIsModalOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtros & Acciones */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Buscador */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar insumos por nombre o SKU..."
            className="w-full h-11 pl-11 pr-4 rounded-xl border border-border bg-background text-foreground text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition placeholder:text-muted-foreground/60"
          />
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="w-full md:w-auto h-11 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-primary/20 transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Insumo por Bulto</span>
        </button>
      </div>

      {/* Píldoras de Categorías */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          const IconComp = cat.icon;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-2xs ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                  : "bg-card border border-border text-foreground hover:bg-muted"
              }`}
            >
              <IconComp className="w-4 h-4" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grid de Insumos */}
      {filteredMaterials.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-12 sm:p-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
            <Boxes className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              No hay insumos registrados en esta categoría
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Registra compras por caja, fardo o resma para calcular el costo unitario de cada personalización.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-primary text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow cursor-pointer"
          >
            Registrar Primer Insumo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMaterials.map((mat) => {
            const isLowStock = mat.stock_packs <= mat.min_stock_packs;
            const unitVes = convertBimonetary(mat.unit_cost_base, exchangeRate);

            return (
              <div
                key={mat.id}
                className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold uppercase tracking-wider inline-block">
                      {mat.category}
                    </span>
                    {isLowStock ? (
                      <span className="px-2.5 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-black rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Stock Bajo
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-full">
                        Stock OK
                      </span>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                    {mat.name}
                  </h3>
                  {mat.sku && (
                    <span className="text-xs text-muted-foreground font-mono font-semibold block">
                      SKU: {mat.sku}
                    </span>
                  )}
                </div>

                {/* Métricas del Insumo */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5">
                  <div className="grid grid-cols-2 gap-3 pb-2.5 border-b border-border/60">
                    <div>
                      <span className="text-[11px] uppercase font-bold text-muted-foreground block">Compra Bulto</span>
                      <span className="text-sm font-bold text-foreground">
                        {currencySymbol}{mat.pack_price_base.toFixed(2)} por {mat.pack_quantity} {mat.unit_measure.toLowerCase()}s
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] uppercase font-bold text-primary block">Costo Unitario</span>
                      <div className="flex flex-col">
                        <span className="text-lg sm:text-xl font-black text-foreground font-mono">
                          {currencySymbol}{mat.unit_cost_base.toFixed(4)}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-muted-foreground">
                          Bs. {unitVes.toFixed(2)} / ud
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs sm:text-sm pt-0.5">
                    <span className="text-muted-foreground font-medium">Existencia en Taller:</span>
                    <span className="font-bold text-foreground">
                      {mat.stock_packs} paquetes ({Math.round(mat.stock_packs * mat.pack_quantity)} {mat.unit_measure.toLowerCase()}s)
                    </span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => openEditModal(mat)}
                    className="p-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition cursor-pointer"
                    title="Editar insumo"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Desactivar insumo ${mat.name}?`)) {
                        onDeleteMaterial(mat.id);
                      }
                    }}
                    className="p-2.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                    title="Eliminar insumo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Registrar / Editar Insumo */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                {editingMaterial ? "Editar Insumo Maestro" : "Registrar Insumo por Bulto"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-muted cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-foreground block">
                  Nombre del Insumo / Materia Prima <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Taza Blanca 11oz AAA (Caja 36 uds)"
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-bold text-foreground block">
                    Categoría
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as CraftMaterialCategory)}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-xs sm:text-sm font-semibold outline-none cursor-pointer"
                  >
                    <option value="sublimacion">Sublimación</option>
                    <option value="dtf">DTF Textil</option>
                    <option value="vinil">Vinil</option>
                    <option value="papeleria">Papelería</option>
                    <option value="esferas">Esferas Navideñas</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-bold text-foreground block">
                    Unidad de Medida
                  </label>
                  <select
                    value={formUnitMeasure}
                    onChange={(e) => setFormUnitMeasure(e.target.value as CraftMaterialUnit)}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-xs sm:text-sm font-semibold outline-none cursor-pointer"
                  >
                    {UNIT_MEASURES.map((u) => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bulto y Rendimiento */}
              <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground block">
                      Cant. por Bulto / Paquete *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      required
                      value={formPackQty}
                      onChange={(e) => setFormPackQty(e.target.value)}
                      placeholder="36"
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs sm:text-sm font-bold outline-none"
                    />
                    <span className="text-[10px] text-muted-foreground block">Ej: 36 tazas, 100 hojas</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground block">
                      Precio Total del Bulto ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formPackPrice}
                      onChange={(e) => setFormPackPrice(e.target.value)}
                      placeholder="45.00"
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs sm:text-sm font-bold outline-none"
                    />
                    <span className="text-[10px] text-muted-foreground block">Costo de la caja o paquete</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-primary/20 flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    Costo Unitario Resultante:
                  </span>
                  <span className="text-base font-black text-primary font-mono">
                    {currencySymbol}{calculatedPreviewUnitCost.toFixed(4)} por {formUnitMeasure.toLowerCase()}
                  </span>
                </div>
              </div>

              {/* Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">
                    Stock en Paquetes
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formStockPacks}
                    onChange={(e) => setFormStockPacks(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs sm:text-sm font-semibold outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">
                    Alerta de Stock Mínimo
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formMinStockPacks}
                    onChange={(e) => setFormMinStockPacks(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs sm:text-sm font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl shadow cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Guardando..." : editingMaterial ? "Guardar Cambios" : "Registrar Insumo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
