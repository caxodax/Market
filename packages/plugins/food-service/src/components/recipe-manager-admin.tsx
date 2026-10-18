"use client";

import React, { useState } from "react";
import { Product, ProductRecipe, RawMaterial } from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import { Utensils, Plus, Trash2, Save, Sparkles, Scale } from "lucide-react";

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

  const currentProduct = products.find((p) => p.id === selectedProductId);
  const currentRecipe = existingRecipes.find((r) => r.product_id === selectedProductId);

  // Local draft items for the recipe
  const [draftItems, setDraftItems] = useState<
    Array<{ raw_material_id: string; quantity: number }>
  >(() => {
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
    setDraftItems([
      ...draftItems,
      { raw_material_id: rawMaterials[0].id, quantity: 1 },
    ]);
  };

  const handleUpdateItem = (
    index: number,
    field: "raw_material_id" | "quantity",
    val: string | number
  ) => {
    const updated = [...draftItems];
    if (field === "raw_material_id") {
      updated[index].raw_material_id = val as string;
    } else {
      updated[index].quantity = Math.max(0.001, parseFloat(val as string) || 0.01);
    }
    setDraftItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setDraftItems(draftItems.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedProductId) return;
    setIsSaving(true);
    try {
      const recipeToSave: ProductRecipe = {
        id: currentRecipe?.id || `rec-${Date.now()}`,
        tenant_id: tenantId,
        product_id: selectedProductId,
        items: draftItems,
        created_at: currentRecipe?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await onSaveRecipe(recipeToSave);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate estimated ingredient cost for this dish
  const estimatedCostUsd = draftItems.reduce((sum, item) => {
    const raw = rawMaterials.find((r) => r.id === item.raw_material_id);
    return sum + (raw ? raw.cost_per_unit_usd * item.quantity : 0);
  }, 0);

  const profitMarginPercent = currentProduct && currentProduct.price_usd > 0
    ? Math.round(((currentProduct.price_usd - estimatedCostUsd) / currentProduct.price_usd) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
            <Utensils className="w-5 h-5 text-amber-500" />
            <span>Escandallo y Recetas de Cocina</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configura los insumos que gasta cada platillo para que el inventario se descuente automáticamente al vender.
          </p>
        </div>

        <button
          type="button"
          disabled={isSaving || draftItems.length === 0}
          onClick={handleSave}
          className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-black flex items-center gap-1.5 shadow-xs hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? "Guardando..." : "Guardar Receta"}</span>
        </button>
      </div>

      {/* Product Selector Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex-1 min-w-0">
          <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
            Platillo del Menú:
          </label>
          <select
            value={selectedProductId}
            onChange={(e) => handleProductChange(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — Precio: {formatCurrency(p.price_usd, "USD")}
              </option>
            ))}
          </select>
        </div>

        {/* Cost & Profit Mini KPI */}
        <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-border pt-3 sm:pt-0 sm:pl-4">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Costo Insumos:
            </span>
            <span className="text-sm font-black text-amber-600 dark:text-amber-400">
              {formatCurrency(estimatedCostUsd, "USD")}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Margen Bruto:
            </span>
            <span
              className={`text-sm font-black ${
                profitMarginPercent >= 50 ? "text-emerald-500" : "text-foreground"
              }`}
            >
              {profitMarginPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Recipe Ingredients List */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-primary" />
            <span>Ingredientes que componen este platillo:</span>
          </h3>

          <button
            type="button"
            onClick={handleAddIngredient}
            className="px-3 py-1.5 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir Ingrediente</span>
          </button>
        </div>

        {draftItems.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs font-semibold border border-dashed border-border rounded-xl">
            Este producto aún no tiene una receta configurada. Añade los insumos que consume.
          </div>
        ) : (
          <div className="space-y-2">
            {draftItems.map((item, idx) => {
              const selectedRaw = rawMaterials.find((r) => r.id === item.raw_material_id);

              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                      Insumo / Materia Prima:
                    </label>
                    <select
                      value={item.raw_material_id}
                      onChange={(e) => handleUpdateItem(idx, "raw_material_id", e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg border border-input bg-card font-bold text-xs"
                    >
                      {rawMaterials.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.unit}) — Stock: {r.current_stock} {r.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-32">
                    <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                      Cantidad ({selectedRaw?.unit || "unidad"}):
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(idx, "quantity", e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg border border-input bg-card font-black text-xs"
                    />
                  </div>

                  <div className="w-24 text-right pt-2 sm:pt-3">
                    <span className="text-[11px] font-mono font-bold text-muted-foreground">
                      {selectedRaw ? formatCurrency(selectedRaw.cost_per_unit_usd * item.quantity, "USD") : "-"}
                    </span>
                  </div>

                  <div className="pt-2 sm:pt-3">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                      title="Eliminar de la receta"
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
