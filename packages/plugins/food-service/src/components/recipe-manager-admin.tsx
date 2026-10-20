"use client";

import React, { useState, useMemo } from "react";
import {
  Product,
  ProductRecipe,
  ProductRecipeItem,
  RawMaterial,
  RawMaterialUnit,
} from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import {
  Utensils,
  Plus,
  Trash2,
  Save,
  Scale,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Flame,
  ArrowRight,
  Calculator,
} from "lucide-react";
import { calculateRecipeCost } from "../services/recipe-cost-engine";

interface RecipeManagerAdminProps {
  tenantId: string;
  products: Product[];
  rawMaterials: RawMaterial[];
  existingRecipes: ProductRecipe[];
  onSaveRecipe: (recipe: ProductRecipe) => Promise<void>;
}

export function RecipeManagerAdmin({
  tenantId,
  products,
  rawMaterials,
  existingRecipes,
  onSaveRecipe,
}: RecipeManagerAdminProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || "");
  const [isSaving, setIsSaving] = useState(false);
  const [targetFoodCostPct, setTargetFoodCostPct] = useState<number>(30);

  const currentProduct = products.find((p) => p.id === selectedProductId);
  const currentRecipe = existingRecipes.find((r) => r.product_id === selectedProductId);

  // Local draft items for the recipe
  const [draftItems, setDraftItems] = useState<ProductRecipeItem[]>(() => {
    return currentRecipe?.items.map((i) => ({ ...i })) || [];
  });

  // Switch product
  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const found = existingRecipes.find((r) => r.product_id === productId);
    setDraftItems(found?.items.map((i) => ({ ...i })) || []);
  };

  const handleAddIngredient = () => {
    if (rawMaterials.length === 0) return;
    const defaultRaw = rawMaterials[0];
    setDraftItems([
      ...draftItems,
      {
        raw_material_id: defaultRaw.id,
        quantity: 1,
        unit: defaultRaw.unit,
        waste_percentage: 0,
      },
    ]);
  };

  const handleUpdateItem = (
    index: number,
    field: keyof ProductRecipeItem,
    val: string | number
  ) => {
    const updated = [...draftItems];
    if (field === "raw_material_id") {
      const selectedRaw = rawMaterials.find((r) => r.id === val);
      updated[index] = {
        ...updated[index],
        raw_material_id: val as string,
        unit: selectedRaw ? selectedRaw.unit : updated[index].unit,
      };
    } else if (field === "quantity") {
      updated[index] = {
        ...updated[index],
        quantity: Math.max(0.001, parseFloat(val as string) || 0.001),
      };
    } else if (field === "waste_percentage") {
      updated[index] = {
        ...updated[index],
        waste_percentage: Math.max(0, Math.min(90, parseFloat(val as string) || 0)),
      };
    } else if (field === "unit") {
      updated[index] = {
        ...updated[index],
        unit: val as RawMaterialUnit,
      };
    }
    setDraftItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setDraftItems(draftItems.filter((_, i) => i !== index));
  };

  // Recipe cost calculation using pure engine
  const calculation = useMemo(() => {
    const tempRecipe: ProductRecipe = {
      id: currentRecipe?.id || "temp",
      tenant_id: tenantId,
      product_id: selectedProductId,
      items: draftItems,
      target_food_cost_percentage: targetFoodCostPct,
      created_at: "",
      updated_at: "",
    };

    return calculateRecipeCost({
      recipe: tempRecipe,
      rawMaterials,
      productPriceUsd: currentProduct?.price_usd || 0,
      targetFoodCostPercentage: targetFoodCostPct,
    });
  }, [selectedProductId, draftItems, rawMaterials, currentProduct, targetFoodCostPct, tenantId, currentRecipe]);

  const handleSave = async () => {
    if (!selectedProductId) return;
    setIsSaving(true);
    try {
      const recipeToSave: ProductRecipe = {
        id: currentRecipe?.id || `rec-${Date.now()}`,
        tenant_id: tenantId,
        product_id: selectedProductId,
        items: draftItems.map((item, idx) => ({
          ...item,
          cost_per_portion_usd: calculation.items[idx]?.totalCostUsd || 0,
        })),
        total_cost_usd: calculation.totalIngredientCostUsd,
        target_food_cost_percentage: targetFoodCostPct,
        food_cost_percentage: calculation.foodCostPercentage,
        created_at: currentRecipe?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await onSaveRecipe(recipeToSave);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Utensils className="w-5 h-5 text-amber-500" />
            <span>Escandallo Profesional & Food Cost</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ingeniería de menús con merma de cocción, conversión métrica automática y simulador de precio objetivo.
          </p>
        </div>

        <button
          type="button"
          disabled={isSaving || draftItems.length === 0}
          onClick={handleSave}
          className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-black flex items-center gap-1.5 shadow-sm hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? "Guardando..." : "Guardar Escandallo"}</span>
        </button>
      </div>

      {/* Product Selector */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
          Platillo del Menú a Escandallar:
        </label>
        <select
          value={selectedProductId}
          onChange={(e) => handleProductChange(e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — Precio Actual: {formatCurrency(p.price_usd, "USD")}
            </option>
          ))}
        </select>
      </div>

      {/* Food Cost Financial Health HUD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Costo Total Escandallo */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Costo Insumos (BOM)</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-foreground font-mono">
              {formatCurrency(calculation.totalIngredientCostUsd, "USD")}
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Incluye merma de cocción</p>
          </div>
        </div>

        {/* Food Cost % Gauge */}
        <div
          className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${
            calculation.health === "OPTIMAL"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
              : calculation.health === "ACCEPTABLE"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
              : "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider">Food Cost %</span>
            {calculation.health === "OPTIMAL" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            )}
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono">{calculation.foodCostPercentage}%</span>
              <span className="text-[11px] font-black uppercase">
                {calculation.health === "OPTIMAL"
                  ? "ÓPTIMO (≤32%)"
                  : calculation.health === "ACCEPTABLE"
                  ? "ACEPTABLE"
                  : "CRÍTICO (>40%)"}
              </span>
            </div>
            <p className="text-[10px] opacity-80 mt-0.5">
              Margen Bruto: {calculation.grossMarginPercentage}% ({formatCurrency(calculation.grossMarginUsd, "USD")})
            </p>
          </div>
        </div>

        {/* Simulador Precio Sugerido */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Precio Sugerido</span>
            <Calculator className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-primary font-mono">
              {formatCurrency(calculation.suggestedRetailPriceUsd, "USD")}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] text-muted-foreground">Objetivo:</span>
              <input
                type="number"
                min="15"
                max="60"
                value={targetFoodCostPct}
                onChange={(e) => setTargetFoodCostPct(Math.max(15, parseInt(e.target.value) || 30))}
                className="w-12 h-5 text-[11px] font-bold px-1 rounded border border-input text-center"
              />
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        {/* PVP Actual vs Sugerido */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">PVP Carta Actual</span>
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-foreground font-mono">
              {formatCurrency(currentProduct?.price_usd || 0, "USD")}
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {currentProduct && currentProduct.price_usd < calculation.suggestedRetailPriceUsd ? (
                <span className="text-rose-500 font-semibold">
                  ⚠️ Por debajo del sugerido ({formatCurrency(calculation.suggestedRetailPriceUsd - currentProduct.price_usd, "USD")} menos)
                </span>
              ) : (
                <span className="text-emerald-500 font-semibold">
                  ✓ Precio saludable y rentable
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Recipe Ingredients Table */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-primary" />
              <span>Desglose de Insumos y Merma</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Define cantidades en gramos, litros o porciones. Las mermas de cocción se calculan automáticamente.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddIngredient}
            className="px-3 py-1.5 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir Insumo</span>
          </button>
        </div>

        {draftItems.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-xs font-semibold border border-dashed border-border rounded-xl">
            Este producto aún no tiene ingredientes asociados. Presiona "Añadir Insumo" para empezar a costearlo.
          </div>
        ) : (
          <div className="space-y-2.5">
            {draftItems.map((item, idx) => {
              const selectedRaw = rawMaterials.find((r) => r.id === item.raw_material_id);
              const breakdown = calculation.items[idx];

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
                >
                  {/* Raw Material Select */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      Insumo / Materia Prima:
                    </label>
                    <select
                      value={item.raw_material_id}
                      onChange={(e) => handleUpdateItem(idx, "raw_material_id", e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg border border-input bg-card font-bold text-xs"
                    >
                      {rawMaterials.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} (Stock almacén: {r.current_stock} {r.unit}) — {formatCurrency(r.cost_per_unit_usd, "USD")}/{r.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity & Unit */}
                  <div className="flex items-center gap-2">
                    <div className="w-24">
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                        Cantidad:
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.001"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(idx, "quantity", e.target.value)}
                        className="w-full h-8 px-2 rounded-lg border border-input bg-card font-bold text-xs"
                      />
                    </div>

                    <div className="w-24">
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                        Unidad:
                      </label>
                      <select
                        value={item.unit || selectedRaw?.unit || "UNIT"}
                        onChange={(e) => handleUpdateItem(idx, "unit", e.target.value)}
                        className="w-full h-8 px-2 rounded-lg border border-input bg-card font-bold text-xs"
                      >
                        <option value="G">G (Gramos)</option>
                        <option value="KG">KG (Kilos)</option>
                        <option value="ML">ML (Mililitros)</option>
                        <option value="L">L (Litros)</option>
                        <option value="UNIT">UNIT (Piezas)</option>
                        <option value="PORTION">PORTION</option>
                      </select>
                    </div>
                  </div>

                  {/* Waste / Shrinkage percentage */}
                  <div className="w-24">
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      % Merma:
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="90"
                        step="1"
                        value={item.waste_percentage || 0}
                        onChange={(e) => handleUpdateItem(idx, "waste_percentage", e.target.value)}
                        className="w-full h-8 px-2 rounded-lg border border-input bg-card font-bold text-xs"
                      />
                      <span className="text-[10px] font-bold text-muted-foreground">%</span>
                    </div>
                  </div>

                  {/* Effective Cost Display */}
                  <div className="w-28 text-right pt-2 lg:pt-0">
                    <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                      Costo Insumo:
                    </label>
                    <span className="text-xs font-mono font-bold text-foreground">
                      {breakdown ? formatCurrency(breakdown.totalCostUsd, "USD") : "-"}
                    </span>
                    {item.waste_percentage && item.waste_percentage > 0 ? (
                      <span className="block text-[9px] text-amber-500 font-semibold">
                        +{item.waste_percentage}% merma
                      </span>
                    ) : null}
                  </div>

                  {/* Delete Button */}
                  <div className="pt-2 lg:pt-3">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
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
      </div>
    </div>
  );
}
