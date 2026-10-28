import type {
  RawMaterial,
  ProductRecipe,
  ProductModifierGroup,
  Order,
  OrderItem,
} from "@marketos/types";
import { convertUnitQuantity } from "@marketos/types";
import { state } from "../mock-data.ts";
import { getSupabase, generateUuid, isLiveDatabaseConfigured } from "./base.ts";
import { AuditRepository } from "./audit.repository.ts";

export class FoodServiceRepository {

/**
   * Get raw materials / ingredients for a store
   */
  static async getRawMaterials(
    tenantId: string,
    storeId?: string
  ): Promise<RawMaterial[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase
          .from("raw_materials")
          .select("*")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .order("name", { ascending: true });

        if (storeId) {
          query = query.eq("store_id", storeId);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data as RawMaterial[];
        }
      } catch (err) {
        console.warn("[MarketOS] Could not fetch raw materials from Supabase:", err);
      }
    }

    if (isLiveDatabaseConfigured()) return [];
    return (state.rawMaterials || []).filter(
      (r) =>
        r.tenant_id === tenantId &&
        (!storeId || r.store_id === storeId) &&
        !r.deleted_at
    );
  }

/**
   * Create or update a raw material / ingredient
   */
  static async saveRawMaterial(
    input: Partial<RawMaterial> & {
      tenant_id: string;
      store_id: string;
      name: string;
    }
  ): Promise<RawMaterial> {
    const now = new Date().toISOString();
    const id = input.id || `raw-${Date.now()}`;
    const rawRecord: RawMaterial = {
      id,
      tenant_id: input.tenant_id,
      store_id: input.store_id,
      name: input.name,
      sku: input.sku || null,
      unit: input.unit || "UNIT",
      current_stock: input.current_stock ?? 0,
      min_alert_stock: input.min_alert_stock ?? 5,
      cost_per_unit_usd: input.cost_per_unit_usd ?? 0,
      is_active: input.is_active ?? true,
      created_at: input.created_at || now,
      updated_at: now,
      deleted_at: input.deleted_at || null,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("raw_materials")
          .upsert(rawRecord)
          .select()
          .single();

        if (!error && data) {
          return data as RawMaterial;
        }
      } catch (err) {
        console.warn("[MarketOS] Could not save raw material to Supabase:", err);
      }
    }

    if (!state.rawMaterials) state.rawMaterials = [];
    const idx = state.rawMaterials.findIndex((r) => r.id === id);
    if (idx >= 0) {
      state.rawMaterials[idx] = rawRecord;
    } else {
      state.rawMaterials.push(rawRecord);
    }
    return rawRecord;
  }

/**
   * Soft-delete a raw material (Preserves history & audit integrity)
   */
  static async deleteRawMaterial(tenantId: string, id: string): Promise<void> {
    const now = new Date().toISOString();
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from("raw_materials")
          .update({ deleted_at: now, is_active: false })
          .eq("id", id)
          .eq("tenant_id", tenantId);
      } catch (err) {
        console.warn("[MarketOS] Could not soft delete raw material in Supabase:", err);
      }
    }

    const item = (state.rawMaterials || []).find(
      (r) => r.id === id && r.tenant_id === tenantId
    );
    if (item) {
      item.deleted_at = now;
      item.is_active = false;
    }
  }

/**
   * Get recipe for a specific product
   */
  static async getProductRecipe(
    tenantId: string,
    productId: string
  ): Promise<ProductRecipe | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("product_recipes")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("product_id", productId)
          .single();

        if (!error && data) {
          return data as ProductRecipe;
        }
      } catch (err) {
        console.warn("[MarketOS] Could not fetch product recipe from Supabase:", err);
      }
    }

    return (
      (state.recipes || []).find(
        (r) => r.tenant_id === tenantId && r.product_id === productId
      ) || null
    );
  }

/**
   * Get all product recipes for a tenant
   */
  static async getProductRecipes(tenantId: string): Promise<ProductRecipe[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("product_recipes")
          .select("*")
          .eq("tenant_id", tenantId);

        if (!error && data) {
          return data as ProductRecipe[];
        }
      } catch (err) {
        console.warn("[MarketOS] Could not fetch product recipes from Supabase:", err);
      }
    }

    if (isLiveDatabaseConfigured()) return [];
    return (state.recipes || []).filter((r) => r.tenant_id === tenantId);
  }

/**
   * Save recipe for a product
   */
  static async saveProductRecipe(recipe: ProductRecipe): Promise<ProductRecipe> {
    const now = new Date().toISOString();
    const record: ProductRecipe = {
      ...recipe,
      updated_at: now,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("product_recipes")
          .upsert(record)
          .select()
          .single();

        if (!error && data) {
          return data as ProductRecipe;
        }
      } catch (err) {
        console.warn("[MarketOS] Could not save product recipe to Supabase:", err);
      }
    }

    if (!state.recipes) state.recipes = [];
    const idx = state.recipes.findIndex(
      (r) => r.tenant_id === recipe.tenant_id && r.product_id === recipe.product_id
    );
    if (idx >= 0) {
      state.recipes[idx] = record;
    } else {
      state.recipes.push(record);
    }
    return record;
  }

/**
   * Get modifier groups (sauces, extras, toppings) for a product or category
   */
  static async getProductModifierGroups(
    tenantId: string,
    productId?: string,
    categoryId?: string
  ): Promise<ProductModifierGroup[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase
          .from("product_modifier_groups")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        const { data, error } = await query;
        if (!error && data) {
          return (data as ProductModifierGroup[]).filter((g) => {
            if (g.product_id && productId && g.product_id === productId) return true;
            if (g.category_id && categoryId && g.category_id === categoryId) return true;
            if (!g.product_id && !g.category_id) return true;
            return false;
          });
        }
      } catch (err) {
        console.warn("[MarketOS] Could not fetch modifier groups from Supabase:", err);
      }
    }

    if (isLiveDatabaseConfigured()) return [];
    return (state.modifierGroups || [])
      .filter((g) => g.tenant_id === tenantId && g.is_active)
      .filter((g) => {
        if (g.product_id && productId && g.product_id === productId) return true;
        if (g.category_id && categoryId && g.category_id === categoryId) return true;
        if (!g.product_id && !g.category_id) return true;
        return false;
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  }

/**
   * Save a product modifier group
   */
  static async saveProductModifierGroup(
    group: ProductModifierGroup
  ): Promise<ProductModifierGroup> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("product_modifier_groups")
          .upsert(group)
          .select()
          .single();

        if (!error && data) {
          return data as ProductModifierGroup;
        }
      } catch (err) {
        console.warn("[MarketOS] Could not save modifier group to Supabase:", err);
      }
    }

    if (!state.modifierGroups) state.modifierGroups = [];
    const idx = state.modifierGroups.findIndex((g) => g.id === group.id);
    if (idx >= 0) {
      state.modifierGroups[idx] = group;
    } else {
      state.modifierGroups.push(group);
    }
    return group;
  }

/**
   * Automatically deduct raw material stock when a gastronomy order is processed
   * (e.g. 1 Hot dog sold = -1 Bread, -1 Sausage, etc.)
   * Applies unit conversion (KG <-> G, L <-> ML) and cooking shrinkage factor.
   */
  static async deductRecipeInventoryForOrder(
    order: Order
  ): Promise<{ success: boolean; deductedItemsCount: number }> {
    if (!order.items || order.items.length === 0) {
      return { success: true, deductedItemsCount: 0 };
    }

    const rawMaterialsList = await this.getRawMaterials(order.tenant_id, order.store_id);
    if (!rawMaterialsList || rawMaterialsList.length === 0) {
      return { success: true, deductedItemsCount: 0 };
    }

    const rawMaterialMap = new Map<string, RawMaterial>();
    for (const rm of rawMaterialsList) {
      rawMaterialMap.set(rm.id, { ...rm });
    }

    const deductionsAccumulator = new Map<string, number>();

    for (const item of order.items) {
      // 1. Deduct Base Recipe
      const recipe = await this.getProductRecipe(order.tenant_id, item.product_id);
      if (recipe && recipe.items && recipe.items.length > 0) {
        for (const ingredient of recipe.items) {
          const rawMaterial = rawMaterialMap.get(ingredient.raw_material_id);
          if (rawMaterial) {
            const recipeUnit = ingredient.unit || rawMaterial.unit;
            const wastePct = Math.max(0, Math.min(90, ingredient.waste_percentage || 0));
            const shrinkageMultiplier = wastePct > 0 ? 1 / (1 - wastePct / 100) : 1;

            const effectiveRecipeQty = ingredient.quantity * item.quantity * shrinkageMultiplier;
            const storageQtyNeeded = convertUnitQuantity(recipeUnit, rawMaterial.unit, effectiveRecipeQty);

            const currentDeduction = deductionsAccumulator.get(rawMaterial.id) || 0;
            deductionsAccumulator.set(rawMaterial.id, currentDeduction + storageQtyNeeded);
          }
        }
      }

      // 2. Deduct Extra Modifiers (e.g. Extra Bacon, Extra Cheese)
      if (item.selected_modifiers && item.selected_modifiers.length > 0) {
        for (const mod of item.selected_modifiers) {
          if (mod.raw_material_id) {
            const rawMaterial = rawMaterialMap.get(mod.raw_material_id);
            if (rawMaterial) {
              const modUnit = mod.raw_material_unit || rawMaterial.unit;
              const rawQty = (mod.raw_material_quantity || 1) * item.quantity;
              const storageQtyNeeded = convertUnitQuantity(modUnit, rawMaterial.unit, rawQty);

              const currentDeduction = deductionsAccumulator.get(rawMaterial.id) || 0;
              deductionsAccumulator.set(rawMaterial.id, currentDeduction + storageQtyNeeded);
            }
          }
        }
      }
    }

    let totalDeductions = 0;
    for (const [rawMaterialId, qtyToDeduct] of deductionsAccumulator.entries()) {
      const rawMaterial = rawMaterialMap.get(rawMaterialId);
      if (!rawMaterial) continue;

      const newStock = Math.max(0, Number((rawMaterial.current_stock - qtyToDeduct).toFixed(3)));
      await this.saveRawMaterial({
        ...rawMaterial,
        current_stock: newStock,
        updated_at: new Date().toISOString(),
      });
      totalDeductions++;
    }

    return { success: true, deductedItemsCount: totalDeductions };
  }

/**
   * Revert / Return raw material stock when a gastronomy order is cancelled
   */
  static async restoreRecipeInventoryForOrder(
    order: Order
  ): Promise<{ success: boolean; restoredItemsCount: number }> {
    if (!order.items || order.items.length === 0) {
      return { success: true, restoredItemsCount: 0 };
    }

    const rawMaterialsList = await this.getRawMaterials(order.tenant_id, order.store_id);
    if (!rawMaterialsList || rawMaterialsList.length === 0) {
      return { success: true, restoredItemsCount: 0 };
    }

    const rawMaterialMap = new Map<string, RawMaterial>();
    for (const rm of rawMaterialsList) {
      rawMaterialMap.set(rm.id, { ...rm });
    }

    const restoreAccumulator = new Map<string, number>();

    for (const item of order.items) {
      const recipe = await this.getProductRecipe(order.tenant_id, item.product_id);
      if (recipe && recipe.items && recipe.items.length > 0) {
        for (const ingredient of recipe.items) {
          const rawMaterial = rawMaterialMap.get(ingredient.raw_material_id);
          if (rawMaterial) {
            const recipeUnit = ingredient.unit || rawMaterial.unit;
            const wastePct = Math.max(0, Math.min(90, ingredient.waste_percentage || 0));
            const shrinkageMultiplier = wastePct > 0 ? 1 / (1 - wastePct / 100) : 1;

            const effectiveRecipeQty = ingredient.quantity * item.quantity * shrinkageMultiplier;
            const storageQtyToReturn = convertUnitQuantity(recipeUnit, rawMaterial.unit, effectiveRecipeQty);

            const currentRestored = restoreAccumulator.get(rawMaterial.id) || 0;
            restoreAccumulator.set(rawMaterial.id, currentRestored + storageQtyToReturn);
          }
        }
      }

      if (item.selected_modifiers && item.selected_modifiers.length > 0) {
        for (const mod of item.selected_modifiers) {
          if (mod.raw_material_id) {
            const rawMaterial = rawMaterialMap.get(mod.raw_material_id);
            if (rawMaterial) {
              const modUnit = mod.raw_material_unit || rawMaterial.unit;
              const rawQty = (mod.raw_material_quantity || 1) * item.quantity;
              const storageQtyToReturn = convertUnitQuantity(modUnit, rawMaterial.unit, rawQty);

              const currentRestored = restoreAccumulator.get(rawMaterial.id) || 0;
              restoreAccumulator.set(rawMaterial.id, currentRestored + storageQtyToReturn);
            }
          }
        }
      }
    }

    let totalRestored = 0;
    for (const [rawMaterialId, qtyToReturn] of restoreAccumulator.entries()) {
      const rawMaterial = rawMaterialMap.get(rawMaterialId);
      if (!rawMaterial) continue;

      const restoredStock = Number((rawMaterial.current_stock + qtyToReturn).toFixed(3));
      await this.saveRawMaterial({
        ...rawMaterial,
        current_stock: restoredStock,
        updated_at: new Date().toISOString(),
      });
      totalRestored++;
    }

    return { success: true, restoredItemsCount: totalRestored };
  }
}
