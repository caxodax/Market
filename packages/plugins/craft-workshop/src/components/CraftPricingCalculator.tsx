"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import type {
  CraftMaterial,
  CraftRecipe,
  WorkshopTechnique,
  CraftPricingFormula,
} from "@marketos/types";
import {
  calculateDirectCost,
  calculateSellingPrice,
  calculateNetProfit,
  calculateUnitCost,
  convertBimonetary,
} from "../services/craft-pricing-engine";
import {
  Calculator,
  Plus,
  Trash2,
  Percent,
  DollarSign,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Globe,
  Tag,
  Scissors,
  Shirt,
  Coffee,
  Gift,
  Package,
  Wrench,
  Info,
  Check,
} from "lucide-react";

export interface CraftPricingCalculatorProps {
  tenantId: string;
  materials: CraftMaterial[];
  initialRecipe?: CraftRecipe | null;
  onSaveRecipe: (payload: any) => Promise<boolean>;
  onCancel?: () => void;
  currencySymbol?: string;
  exchangeRate?: number;
}

interface EditableRecipeItem {
  id?: string;
  materialId?: string | null;
  customName: string;
  packQtySnapshot: number;
  packPriceSnapshot: number;
  unitCostSnapshot: number;
  qtyToUse: number;
  isChecked: boolean;
}

const TECHNIQUES: {
  id: WorkshopTechnique;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "sublimacion", label: "Sublimación", icon: Coffee },
  { id: "dtf", label: "DTF Textil", icon: Shirt },
  { id: "vinil", label: "Vinil", icon: Scissors },
  { id: "papeleria", label: "Papelería", icon: Tag },
  { id: "esferas", label: "Esferas", icon: Gift },
  { id: "general", label: "General", icon: Package },
];

export function CraftPricingCalculator({
  tenantId,
  materials,
  initialRecipe,
  onSaveRecipe,
  onCancel,
  currencySymbol = "$",
  exchangeRate = 1,
}: CraftPricingCalculatorProps) {
  const [name, setName] = useState(initialRecipe?.name || "");
  const [sku, setSku] = useState(initialRecipe?.sku || "");
  const [technique, setTechnique] = useState<WorkshopTechnique>(initialRecipe?.technique || "sublimacion");
  const [categoryName, setCategoryName] = useState(initialRecipe?.category_name || "General");
  const [wastePercentage, setWastePercentage] = useState<number>(
    initialRecipe?.waste_percentage !== undefined ? initialRecipe.waste_percentage : 5.0
  );
  const [laborCostBase, setLaborCostBase] = useState<number>(
    initialRecipe?.labor_cost_base !== undefined ? initialRecipe.labor_cost_base : 1.5
  );
  const [pricingFormula, setPricingFormula] = useState<CraftPricingFormula>(
    initialRecipe?.pricing_formula || "MARGIN"
  );
  const [marginPercentage, setMarginPercentage] = useState<number>(
    initialRecipe?.margin_percentage !== undefined ? initialRecipe.margin_percentage : 35.0
  );
  const [wholesalePriceBase, setWholesalePriceBase] = useState<string>(
    initialRecipe?.wholesale_price_base ? String(initialRecipe.wholesale_price_base) : ""
  );
  const [isPublished, setIsPublished] = useState<boolean>(initialRecipe?.is_published || false);
  const [notes, setNotes] = useState(initialRecipe?.notes || "");
  const [isSaving, setIsSaving] = useState(false);

  // Inicializar renglones a partir de materiales existentes o receta
  const [items, setItems] = useState<EditableRecipeItem[]>(() => {
    if (initialRecipe?.items && initialRecipe.items.length > 0) {
      return initialRecipe.items.map((it) => ({
        id: it.id,
        materialId: it.material_id,
        customName: it.custom_name,
        packQtySnapshot: it.pack_qty_snapshot,
        packPriceSnapshot: it.pack_price_snapshot,
        unitCostSnapshot: it.unit_cost_snapshot,
        qtyToUse: it.qty_to_use,
        isChecked: it.is_checked,
      }));
    }

    // Sugerencia inicial para nueva receta
    return materials
      .filter((m) => m.category === technique || m.category === "general")
      .map((m) => ({
        materialId: m.id,
        customName: m.name,
        packQtySnapshot: m.pack_quantity,
        packPriceSnapshot: m.pack_price_base,
        unitCostSnapshot: m.unit_cost_base,
        qtyToUse: 1,
        isChecked: false,
      }));
  });

  const handleTechniqueChange = (newTech: WorkshopTechnique) => {
    setTechnique(newTech);
    if (!initialRecipe) {
      const checkedItems = items.filter((it) => it.isChecked);
      if (checkedItems.length === 0) {
        setItems(
          materials
            .filter((m) => m.category === newTech || m.category === "general")
            .map((m) => ({
              materialId: m.id,
              customName: m.name,
              packQtySnapshot: m.pack_quantity,
              packPriceSnapshot: m.pack_price_base,
              unitCostSnapshot: m.unit_cost_base,
              qtyToUse: 1,
              isChecked: false,
            }))
        );
      }
    }
  };

  const handleAddMaterialFromCatalog = (mat: CraftMaterial) => {
    const existing = items.find((it) => it.materialId === mat.id);
    if (existing) {
      setItems(items.map((it) => (it.materialId === mat.id ? { ...it, isChecked: true } : it)));
    } else {
      setItems([
        ...items,
        {
          materialId: mat.id,
          customName: mat.name,
          packQtySnapshot: mat.pack_quantity,
          packPriceSnapshot: mat.pack_price_base,
          unitCostSnapshot: mat.unit_cost_base,
          qtyToUse: 1,
          isChecked: true,
        },
      ]);
    }
  };

  const handleAddCustomItem = () => {
    setItems([
      ...items,
      {
        materialId: null,
        customName: "Nuevo Insumo Personalizado",
        packQtySnapshot: 1,
        packPriceSnapshot: 1.0,
        unitCostSnapshot: 1.0,
        qtyToUse: 1,
        isChecked: true,
      },
    ]);
  };

  const handleToggleItem = (index: number) => {
    setItems(items.map((it, idx) => (idx === index ? { ...it, isChecked: !it.isChecked } : it)));
  };

  const handleUpdateItem = (index: number, field: keyof EditableRecipeItem, value: any) => {
    setItems(
      items.map((it, idx) => {
        if (idx !== index) return it;
        const updated = { ...it, [field]: value };
        if (field === "packPriceSnapshot" || field === "packQtySnapshot") {
          const price = field === "packPriceSnapshot" ? Number(value) : it.packPriceSnapshot;
          const qty = field === "packQtySnapshot" ? Number(value) : it.packQtySnapshot;
          updated.unitCostSnapshot = calculateUnitCost(price, qty);
        }
        return updated;
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Cálculos matemáticos reactivos
  const calculations = useMemo(() => {
    let materialsSum = 0;
    items.forEach((it) => {
      if (it.isChecked) {
        materialsSum += (it.unitCostSnapshot || 0) * (it.qtyToUse || 0);
      }
    });

    const directCost = calculateDirectCost(materialsSum, wastePercentage, laborCostBase);
    const suggestedPrice = calculateSellingPrice(directCost, pricingFormula, marginPercentage);
    const profit = calculateNetProfit(suggestedPrice, directCost);
    const priceVes = convertBimonetary(suggestedPrice, exchangeRate);
    const costVes = convertBimonetary(directCost, exchangeRate);

    return {
      materialsSum: Math.round(materialsSum * 100) / 100,
      directCost,
      costVes,
      suggestedPrice,
      priceVes,
      profitBase: profit.profitBase,
      marginRealPercentage: profit.marginRealPercentage,
    };
  }, [items, wastePercentage, laborCostBase, pricingFormula, marginPercentage, exchangeRate]);

  const checkedCount = items.filter((it) => it.isChecked).length;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      toast.warning("Por favor ingresa el nombre del producto o trabajo");
      return;
    }

    const checkedItems = items.filter((it) => it.isChecked);
    if (checkedItems.length === 0) {
      toast.warning("Por favor marca o agrega al menos un insumo activo para la receta");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        recipeId: initialRecipe?.id,
        tenantId,
        name: name.trim(),
        sku: sku.trim() || undefined,
        technique,
        categoryName: categoryName.trim() || "General",
        wastePercentage,
        laborCostBase,
        pricingFormula,
        marginPercentage,
        sellingPriceBase: calculations.suggestedPrice,
        wholesalePriceBase: wholesalePriceBase ? parseFloat(wholesalePriceBase) : null,
        isPublished,
        notes: notes.trim() || undefined,
        items: checkedItems.map((it, idx) => ({
          materialId: it.materialId || null,
          customName: it.customName,
          packQtySnapshot: Number(it.packQtySnapshot),
          packPriceSnapshot: Number(it.packPriceSnapshot),
          unitCostSnapshot: Number(it.unitCostSnapshot),
          qtyToUse: Number(it.qtyToUse),
          isChecked: true,
          sortOrder: idx,
        })),
      };

      await onSaveRecipe(payload);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-28">
      {/* 1. Header Compacto de Ficha: Identificación & Técnica */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                {initialRecipe ? "Editar Ficha de Costeo" : "Calculadora de Costeo & Escandallo"}
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Define el producto, sus insumos y el margen comercial deseado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-xl border border-border">
              BCV: Bs. {exchangeRate.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Datos Principales (Nombre, SKU y Técnica en bloque unificado) */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-center">
          <div className="sm:col-span-8 space-y-1">
            <label className="text-xs font-bold text-foreground block">
              Nombre del Producto o Trabajo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Taza Mágica Sublimada 11oz"
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-foreground text-sm font-semibold focus:ring-2 focus:ring-primary outline-none transition placeholder:text-muted-foreground/60"
            />
          </div>

          <div className="sm:col-span-4 space-y-1">
            <label className="text-xs font-bold text-foreground block">
              SKU / Referencia <span className="text-muted-foreground font-normal">(Opcional)</span>
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Ej: TAZ-01"
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-foreground font-mono text-sm font-semibold focus:ring-2 focus:ring-primary outline-none transition placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Selector de Técnica: Barra de 6 Píldoras Horizontales Simétricas */}
        <div className="pt-2">
          <label className="text-xs font-bold text-foreground block mb-2">
            Técnica de Taller
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {TECHNIQUES.map((tech) => {
              const isSelected = technique === tech.id;
              const IconComp = tech.icon;
              return (
                <button
                  key={tech.id}
                  type="button"
                  onClick={() => handleTechniqueChange(tech.id)}
                  className={`py-2 px-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 font-bold"
                      : "border-border bg-background hover:bg-muted text-foreground"
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  <span className="text-xs font-bold tracking-tight truncate w-full">
                    {tech.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. LAYOUT SIMÉTRICO 50% / 50% (Columna Izquierda = Insumos | Columna Derecha = Finanzas) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* COLUMNA IZQUIERDA (50%): Insumos & Materia Prima */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Insumos & Materia Prima ({checkedCount})
                </h3>
              </div>
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Insumo Libre</span>
              </button>
            </div>

            {/* Lista Compacta de Insumos */}
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {items.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-muted/20 space-y-1.5">
                  <p className="text-xs sm:text-sm font-bold text-foreground">
                    No hay insumos agregados para {technique}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Elige uno abajo o añade un insumo libre para calcular el costo.
                  </p>
                </div>
              ) : (
                items.map((it, idx) => {
                  const subtotalItem = (it.unitCostSnapshot || 0) * (it.qtyToUse || 0);
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                        it.isChecked
                          ? "bg-card border-primary/40 shadow-xs"
                          : "bg-muted/20 border-border opacity-50"
                      }`}
                    >
                      {/* Cabecera del Insumo */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={it.isChecked}
                            onChange={() => handleToggleItem(idx)}
                            className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer accent-primary shrink-0"
                          />
                          <input
                            type="text"
                            value={it.customName}
                            onChange={(e) => handleUpdateItem(idx, "customName", e.target.value)}
                            placeholder="Nombre del insumo..."
                            className="text-xs sm:text-sm font-bold text-foreground bg-transparent outline-none border-b border-transparent focus:border-primary w-full px-1"
                          />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs sm:text-sm font-black text-foreground font-mono">
                            {currencySymbol}{subtotalItem.toFixed(3)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer transition"
                            title="Quitar insumo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Desglose en 1 Sola Línea Compacta y Clara */}
                      {it.isChecked && (
                        <div className="pt-2 border-t border-border/50 flex flex-wrap items-center gap-2 text-xs">
                          {/* Bulto */}
                          <div className="flex items-center gap-1 bg-muted/40 px-2 py-1 rounded-lg border border-border/50">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase">Bulto:</span>
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              value={it.packQtySnapshot}
                              onChange={(e) => handleUpdateItem(idx, "packQtySnapshot", parseFloat(e.target.value) || 1)}
                              className="w-12 h-6 px-1 rounded bg-background border border-border text-center font-bold text-xs"
                              title="Cantidad en el paquete"
                            />
                            <span className="text-[10px] text-muted-foreground">por $</span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={it.packPriceSnapshot}
                              onChange={(e) => handleUpdateItem(idx, "packPriceSnapshot", parseFloat(e.target.value) || 0)}
                              className="w-14 h-6 px-1 rounded bg-background border border-border text-center font-bold text-xs"
                              title="Precio de compra del paquete"
                            />
                            <span className="text-[10px] text-primary font-mono font-bold">
                              (${it.unitCostSnapshot.toFixed(3)}/ud)
                            </span>
                          </div>

                          <span className="text-muted-foreground font-bold">➔</span>

                          {/* Consumo */}
                          <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg border border-primary/25">
                            <span className="text-[10px] text-primary font-bold uppercase">Usar:</span>
                            <input
                              type="number"
                              step="any"
                              min="0.0001"
                              value={it.qtyToUse}
                              onChange={(e) => handleUpdateItem(idx, "qtyToUse", parseFloat(e.target.value) || 0)}
                              className="w-14 h-6 px-1 rounded bg-background border-2 border-primary/50 text-center font-bold text-xs text-primary"
                              title="Cantidad a consumir en una pieza"
                            />
                            <span className="text-[10px] text-primary font-bold">ud</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Insumos frecuentes del almacén */}
          {materials.length > 0 && (
            <div className="pt-3 border-t border-border space-y-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                + Agregar rápido desde almacén:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {materials.map((m) => {
                  const isAlreadyIn = items.some((it) => it.materialId === m.id && it.isChecked);
                  if (isAlreadyIn) return null;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleAddMaterialFromCatalog(m)}
                      className="px-2.5 py-1 rounded-xl bg-muted/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border text-xs font-semibold text-foreground transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-primary" />
                      <span>{m.name}</span>
                      <span className="text-muted-foreground font-mono">(${m.unit_cost_base.toFixed(2)})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA (50%): Costos Operativos, Margen & Cierre Financiero */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-foreground">
                  Parámetros de Costeo & Margen
                </h3>
              </div>
              <span className="text-xs font-bold text-muted-foreground">
                Taller Printopink
              </span>
            </div>

            {/* Bloque Simétrico 2 Columnas: Merma + Mano de Obra */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Merma Técnica */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-amber-500" />
                    Merma Técnica
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-black">
                    {wastePercentage}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="0.5"
                  value={wastePercentage}
                  onChange={(e) => setWastePercentage(parseFloat(e.target.value) || 0)}
                  className="w-full h-1.5 bg-muted rounded-lg accent-amber-500 cursor-pointer"
                />
                <span className="text-[10px] text-muted-foreground block leading-tight">
                  Cubre fallos de calor, tazas rotas o vinil arrugado.
                </span>
              </div>

              {/* Mano de Obra */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                    Mano de Obra
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-black font-mono">
                    ${laborCostBase.toFixed(2)}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={laborCostBase}
                    onChange={(e) => setLaborCostBase(parseFloat(e.target.value) || 0)}
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-bold outline-none"
                  />
                  <span className="absolute right-2 top-1.5 text-[10px] text-muted-foreground font-bold">USD/ud</span>
                </div>
                <span className="text-[10px] text-muted-foreground block leading-tight">
                  Electricidad, desgaste de cuchilla/teflón y tiempo.
                </span>
              </div>
            </div>

            {/* Margen de Ganancia */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-foreground">
                    Margen de Ganancia
                  </span>
                </div>

                <div className="flex bg-muted p-0.5 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setPricingFormula("MARGIN")}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      pricingFormula === "MARGIN"
                        ? "bg-background text-foreground shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    s/Venta
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingFormula("MARKUP")}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      pricingFormula === "MARKUP"
                        ? "bg-background text-foreground shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    s/Costo
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Porcentaje aplicado:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-black">
                    {marginPercentage}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="1"
                  value={marginPercentage}
                  onChange={(e) => setMarginPercentage(parseFloat(e.target.value) || 0)}
                  className="w-full h-1.5 bg-muted rounded-lg accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Precio al Mayor Opcional */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs">
                <span className="text-muted-foreground font-medium">Precio al Mayor (+12 uds):</span>
                <div className="relative w-28">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={wholesalePriceBase}
                    onChange={(e) => setWholesalePriceBase(e.target.value)}
                    placeholder="Opcional"
                    className="w-full h-7 px-2 rounded-lg border border-border bg-background text-foreground text-xs font-bold outline-none"
                  />
                  <span className="absolute right-2 top-1 text-[10px] text-muted-foreground font-bold">$</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. TICKET FINANCIERO DE TALLER (Cierre Simétrico) */}
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border/60">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Costo Insumos</span>
                <span className="text-sm font-black text-foreground font-mono">
                  {currencySymbol}{calculations.materialsSum.toFixed(2)}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Costo Directo Real</span>
                <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                  {currencySymbol}{calculations.directCost.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-[10px] uppercase font-bold text-primary block">PVP Sugerido</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight font-mono">
                    {currencySymbol}{calculations.suggestedPrice.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono font-bold">
                    (Bs. {calculations.priceVes.toFixed(2)})
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Ganancia Neta</span>
                <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono block">
                  +{currencySymbol}{calculations.profitBase.toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground font-bold">
                  {calculations.marginRealPercentage}% margen real
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/60 flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
                <Globe className="w-3.5 h-3.5 text-primary" />
                <span>Publicar en Catálogo Online</span>
              </label>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isPublished
                  ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/20"
                  : "bg-muted text-muted-foreground"
              }`}>
                {isPublished ? "Visible" : "Solo Taller"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Barra Flotante Inferior Slim (No tapa contenido y siempre al alcance) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-xl p-3 sm:p-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
          {/* Métricas rápidas */}
          <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-start">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Costo Directo</span>
              <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                {currencySymbol}{calculations.directCost.toFixed(2)}
              </span>
            </div>

            <div className="h-6 w-[1px] bg-border" />

            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">PVP Sugerido</span>
              <span className="text-base sm:text-lg font-black text-foreground font-mono">
                {currencySymbol}{calculations.suggestedPrice.toFixed(2)}{" "}
                <span className="text-xs text-muted-foreground font-normal">(Bs. {calculations.priceVes.toFixed(2)})</span>
              </span>
            </div>

            <div className="h-6 w-[1px] bg-border" />

            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Ganancia</span>
              <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                +{currencySymbol}{calculations.profitBase.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-border text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-bold shadow-md shadow-primary/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Calculator className="w-4 h-4" />
              <span>{isSaving ? "Guardando..." : initialRecipe ? "Actualizar Ficha" : "Guardar Ficha Técnica"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
