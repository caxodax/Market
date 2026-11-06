"use client";

import React, { useState } from "react";
import {
  TenantSettings,
  Store,
  Product,
  Category,
  RawMaterial,
  ProductRecipe,
  ProductModifierGroup,
} from "@marketos/types";
import {
  RawMaterialsAdmin,
  RecipeManagerAdmin,
  ModifiersAdmin,
} from "@marketos/plugin-food-service";
import {
  saveRawMaterialAction,
  deleteRawMaterialAction,
  saveProductRecipeAction,
  saveProductModifierGroupAction,
  deleteProductModifierGroupAction,
} from "@/app/admin/actions";
import { toast } from "sonner";
import {
  Utensils,
  ChefHat,
  Sparkles,
} from "lucide-react";

interface FoodServiceViewProps {
  settings: TenantSettings;
  stores: Store[];
  products: Product[];
  categories: Category[];
  initialRawMaterials: RawMaterial[];
  initialRecipes: ProductRecipe[];
  initialModifierGroups: ProductModifierGroup[];
}

export function FoodServiceView({
  settings,
  stores,
  products,
  categories,
  initialRawMaterials,
  initialRecipes,
  initialModifierGroups,
}: FoodServiceViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"MATERIALS" | "RECIPES" | "MODIFIERS">("MATERIALS");
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(initialRawMaterials);
  const [recipes, setRecipes] = useState<ProductRecipe[]>(initialRecipes);
  const [modifierGroups, setModifierGroups] = useState<ProductModifierGroup[]>(initialModifierGroups);

  const handleSaveRawMaterial = async (
    material: Partial<RawMaterial> & { tenant_id: string; store_id: string; name: string }
  ) => {
    try {
      const res = await saveRawMaterialAction(material);
      if (res?.success && res.rawMaterial) {
        setRawMaterials((prev) => {
          const idx = prev.findIndex((m) => m.id === res.rawMaterial!.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = res.rawMaterial!;
            return next;
          }
          return [res.rawMaterial!, ...prev];
        });
        toast.success(`Insumo "${res.rawMaterial.name}" guardado`);
      } else {
        toast.error(res?.error || "Error al guardar insumo");
      }
    } catch {
      toast.error("Error de comunicación al guardar insumo");
    }
  };

  const handleDeleteRawMaterial = async (id: string) => {
    try {
      const res = await deleteRawMaterialAction(settings.tenant_id, id);
      if (res?.success) {
        setRawMaterials((prev) => prev.filter((m) => m.id !== id));
        toast.success("Insumo eliminado de la cocina");
      } else {
        toast.error(res?.error || "Error al eliminar insumo");
      }
    } catch {
      toast.error("Error de comunicación al eliminar insumo");
    }
  };

  const handleSaveRecipe = async (recipe: ProductRecipe) => {
    try {
      const res = await saveProductRecipeAction(recipe);
      if (res?.success && res.recipe) {
        setRecipes((prev) => {
          const idx = prev.findIndex(
            (r) => r.id === res.recipe!.id || r.product_id === res.recipe!.product_id
          );
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = res.recipe!;
            return next;
          }
          return [...prev, res.recipe!];
        });
        toast.success("Ficha técnica y receta guardadas");
      } else {
        toast.error(res?.error || "Error al guardar receta");
      }
    } catch {
      toast.error("Error de comunicación al guardar receta");
    }
  };

  const handleSaveModifierGroup = async (group: ProductModifierGroup) => {
    try {
      const res = await saveProductModifierGroupAction(group);
      if (res?.success && res.modifierGroup) {
        setModifierGroups((prev) => {
          const idx = prev.findIndex((g) => g.id === res.modifierGroup!.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = res.modifierGroup!;
            return next;
          }
          return [...prev, res.modifierGroup!];
        });
        toast.success("Grupo de modificadores guardado");
      } else {
        toast.error(res?.error || "Error al guardar modificador");
      }
    } catch {
      toast.error("Error de comunicación al guardar modificador");
    }
  };

  const handleDeleteModifierGroup = async (groupId: string) => {
    try {
      const res = await deleteProductModifierGroupAction(settings.tenant_id, groupId);
      if (res?.success) {
        setModifierGroups((prev) => prev.filter((g) => g.id !== groupId));
        toast.success("Modificador eliminado");
      } else {
        toast.error(res?.error || "Error al eliminar modificador");
      }
    } catch {
      toast.error("Error de comunicación al eliminar modificador");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-view-enter">
      {/* Sub-tab switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-muted/60 border border-border w-fit max-w-full overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab("MATERIALS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "MATERIALS"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Utensils className="w-4 h-4 text-amber-500" />
          <span>Insumos ({rawMaterials.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("RECIPES")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "RECIPES"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ChefHat className="w-4 h-4 text-orange-500" />
          <span>Fichas & Recetas ({recipes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("MODIFIERS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "MODIFIERS"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-500" />
          <span>Modificadores & Combos ({modifierGroups.length})</span>
        </button>
      </div>

      {/* Sub-tab view */}
      {activeSubTab === "MATERIALS" && (
        <RawMaterialsAdmin
          tenantId={settings.tenant_id}
          stores={stores}
          rawMaterials={rawMaterials}
          onSaveRawMaterial={handleSaveRawMaterial}
          onDeleteRawMaterial={handleDeleteRawMaterial}
        />
      )}

      {activeSubTab === "RECIPES" && (
        <RecipeManagerAdmin
          tenantId={settings.tenant_id}
          products={products}
          rawMaterials={rawMaterials}
          existingRecipes={recipes}
          onSaveRecipe={handleSaveRecipe}
        />
      )}

      {activeSubTab === "MODIFIERS" && (
        <ModifiersAdmin
          tenantId={settings.tenant_id}
          products={products}
          categories={categories}
          rawMaterials={rawMaterials}
          modifierGroups={modifierGroups}
          onSaveGroup={handleSaveModifierGroup}
          onDeleteGroup={handleDeleteModifierGroup}
        />
      )}
    </div>
  );
}
