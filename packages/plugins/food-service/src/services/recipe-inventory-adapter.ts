import {
  InventoryPort,
  InventoryDeductInput,
  InventoryDeductResult,
  InventoryRestoreInput,
  RawMaterial,
  RawMaterialUnit,
} from "@marketos/types";
import { MarketOSRepository } from "@marketos/database";
import { convertUnitQuantity } from "./recipe-cost-engine";

/**
 * RecipeInventoryAdapter (Hexagonal Architecture)
 * Enchufable al puerto `InventoryPort` del Core.
 * En lugar de descontar el producto 1 a 1, descuenta los insumos de la receta
 * (panes, salchichas, queso, salsas) para la sede correspondiente,
 * aplicando conversión estricta de unidades (KG <-> G, L <-> ML) y merma de cocción.
 */
export class RecipeInventoryAdapter implements InventoryPort {
  readonly strategyId = "food_service_recipes";

  async deductStock(input: InventoryDeductInput): Promise<InventoryDeductResult> {
    const warnings: string[] = [];

    // 1. Batch load all raw materials for this tenant & store (single query)
    const rawMaterialsList = await MarketOSRepository.getRawMaterials(
      input.tenantId,
      input.storeId
    );
    if (!rawMaterialsList || rawMaterialsList.length === 0) {
      return { success: true, deductedItemsCount: 0 };
    }

    const rawMaterialMap = new Map<string, RawMaterial>();
    for (const rm of rawMaterialsList) {
      rawMaterialMap.set(rm.id, { ...rm });
    }

    // Map of accumulated deductions: rawMaterialId -> totalStorageQuantityToDeduct
    const deductionsAccumulator = new Map<string, number>();

    // 2. Iterate items and accumulate ingredient consumption
    for (const item of input.items) {
      const recipe = await MarketOSRepository.getProductRecipe(input.tenantId, item.productId);

      if (recipe && recipe.items && recipe.items.length > 0) {
        for (const ingredient of recipe.items) {
          const rawMaterial = rawMaterialMap.get(ingredient.raw_material_id);
          if (rawMaterial) {
            const recipeUnit: RawMaterialUnit = ingredient.unit || rawMaterial.unit;
            const wastePct = Math.max(0, Math.min(90, ingredient.waste_percentage || 0));
            const shrinkageMultiplier = wastePct > 0 ? 1 / (1 - wastePct / 100) : 1;

            const effectiveRecipeQty = ingredient.quantity * item.quantity * shrinkageMultiplier;
            const storageQtyNeeded = convertUnitQuantity(recipeUnit, rawMaterial.unit, effectiveRecipeQty);

            const currentDeduction = deductionsAccumulator.get(rawMaterial.id) || 0;
            deductionsAccumulator.set(rawMaterial.id, currentDeduction + storageQtyNeeded);
          }
        }
      }

      // 3. Deduct modifier ingredients with associated raw materials
      if (item.selectedModifiers && item.selectedModifiers.length > 0) {
        for (const mod of item.selectedModifiers) {
          if (mod.rawMaterialId) {
            const rawMaterial = rawMaterialMap.get(mod.rawMaterialId);
            if (rawMaterial) {
              const modUnit: RawMaterialUnit = (mod as any).unit || rawMaterial.unit;
              const rawQty = (mod.quantity || 1) * item.quantity;
              const storageQtyNeeded = convertUnitQuantity(modUnit, rawMaterial.unit, rawQty);

              const currentDeduction = deductionsAccumulator.get(rawMaterial.id) || 0;
              deductionsAccumulator.set(rawMaterial.id, currentDeduction + storageQtyNeeded);
            }
          }
        }
      }
    }

    // 4. Apply deductions to in-memory models and persist batch
    let totalDeductions = 0;
    for (const [rawMaterialId, qtyToDeduct] of deductionsAccumulator.entries()) {
      const rawMaterial = rawMaterialMap.get(rawMaterialId);
      if (!rawMaterial) continue;

      const newStock = Math.max(0, Number((rawMaterial.current_stock - qtyToDeduct).toFixed(3)));
      const updatedMaterial: RawMaterial = {
        ...rawMaterial,
        current_stock: newStock,
        updated_at: new Date().toISOString(),
      };

      await MarketOSRepository.saveRawMaterial(updatedMaterial);
      totalDeductions++;

      // Check alert thresholds
      if (newStock <= rawMaterial.min_alert_stock) {
        warnings.push(
          `[Alerta Insumo Bajo] ${rawMaterial.name}: Quedan ${newStock} ${rawMaterial.unit} (Mín: ${rawMaterial.min_alert_stock})`
        );
      }
    }

    return {
      success: true,
      deductedItemsCount: totalDeductions,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  async restoreStock(input: InventoryRestoreInput): Promise<void> {
    // Single query pre-fetch of raw materials
    const rawMaterialsList = await MarketOSRepository.getRawMaterials(
      input.tenantId,
      input.storeId
    );
    if (!rawMaterialsList || rawMaterialsList.length === 0) return;

    const rawMaterialMap = new Map<string, RawMaterial>();
    for (const rm of rawMaterialsList) {
      rawMaterialMap.set(rm.id, { ...rm });
    }

    const restoreAccumulator = new Map<string, number>();

    for (const item of input.items) {
      const recipe = await MarketOSRepository.getProductRecipe(input.tenantId, item.productId);
      if (recipe && recipe.items && recipe.items.length > 0) {
        for (const ingredient of recipe.items) {
          const rawMaterial = rawMaterialMap.get(ingredient.raw_material_id);
          if (rawMaterial) {
            const recipeUnit: RawMaterialUnit = ingredient.unit || rawMaterial.unit;
            const wastePct = Math.max(0, Math.min(90, ingredient.waste_percentage || 0));
            const shrinkageMultiplier = wastePct > 0 ? 1 / (1 - wastePct / 100) : 1;

            const effectiveRecipeQty = ingredient.quantity * item.quantity * shrinkageMultiplier;
            const storageQtyToReturn = convertUnitQuantity(recipeUnit, rawMaterial.unit, effectiveRecipeQty);

            const currentRestored = restoreAccumulator.get(rawMaterial.id) || 0;
            restoreAccumulator.set(rawMaterial.id, currentRestored + storageQtyToReturn);
          }
        }
      }
    }

    // Persist restored stock
    for (const [rawMaterialId, qtyToReturn] of restoreAccumulator.entries()) {
      const rawMaterial = rawMaterialMap.get(rawMaterialId);
      if (!rawMaterial) continue;

      const restoredStock = Number((rawMaterial.current_stock + qtyToReturn).toFixed(3));
      await MarketOSRepository.saveRawMaterial({
        ...rawMaterial,
        current_stock: restoredStock,
        updated_at: new Date().toISOString(),
      });
    }
  }
}
