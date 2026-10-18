import {
  InventoryPort,
  InventoryDeductInput,
  InventoryDeductResult,
  InventoryRestoreInput,
} from "@marketos/types";
import { MarketOSRepository } from "@marketos/database";

/**
 * RecipeInventoryAdapter (Hexagonal Architecture)
 * Enchufable al puerto `InventoryPort` del Core.
 * En lugar de descontar el producto 1 a 1, descuenta los insumos de la receta
 * (panes, salchichas, queso, salsas) para la sede correspondiente.
 */
export class RecipeInventoryAdapter implements InventoryPort {
  readonly strategyId = "food_service_recipes";

  async deductStock(input: InventoryDeductInput): Promise<InventoryDeductResult> {
    let totalDeductions = 0;
    const warnings: string[] = [];

    for (const item of input.items) {
      // 1. Obtener receta base del producto
      const recipe = await MarketOSRepository.getProductRecipe(input.tenantId, item.productId);

      if (recipe && recipe.items.length > 0) {
        for (const ingredient of recipe.items) {
          const rawMaterials = await MarketOSRepository.getRawMaterials(
            input.tenantId,
            input.storeId
          );
          const rawMaterial = rawMaterials.find((r) => r.id === ingredient.raw_material_id);

          if (rawMaterial) {
            const qtyNeeded = ingredient.quantity * item.quantity;
            const newStock = Math.max(0, Number((rawMaterial.current_stock - qtyNeeded).toFixed(3)));

            await MarketOSRepository.saveRawMaterial({
              ...rawMaterial,
              current_stock: newStock,
            });

            if (newStock <= rawMaterial.min_alert_stock) {
              warnings.push(
                `[Alerta Stock Bajo] ${rawMaterial.name}: Quedan ${newStock} ${rawMaterial.unit} en sede`
              );
            }

            totalDeductions++;
          }
        }
      }

      // 2. Descontar insumos de modificadores con receta (ej. extra tocineta, extra queso)
      if (item.selectedModifiers && item.selectedModifiers.length > 0) {
        for (const mod of item.selectedModifiers) {
          if (mod.rawMaterialId) {
            const rawMaterials = await MarketOSRepository.getRawMaterials(
              input.tenantId,
              input.storeId
            );
            const rawMaterial = rawMaterials.find((r) => r.id === mod.rawMaterialId);

            if (rawMaterial) {
              const qtyNeeded = (mod.quantity || 1) * item.quantity;
              const newStock = Math.max(0, Number((rawMaterial.current_stock - qtyNeeded).toFixed(3)));

              await MarketOSRepository.saveRawMaterial({
                ...rawMaterial,
                current_stock: newStock,
              });

              totalDeductions++;
            }
          }
        }
      }
    }

    return {
      success: true,
      deductedItemsCount: totalDeductions,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  async restoreStock(input: InventoryRestoreInput): Promise<void> {
    // Si se cancela la orden, reingresa los insumos al inventario de cocina
    for (const item of input.items) {
      const recipe = await MarketOSRepository.getProductRecipe(input.tenantId, item.productId);
      if (recipe && recipe.items.length > 0) {
        for (const ingredient of recipe.items) {
          const rawMaterials = await MarketOSRepository.getRawMaterials(
            input.tenantId,
            input.storeId
          );
          const rawMaterial = rawMaterials.find((r) => r.id === ingredient.raw_material_id);
          if (rawMaterial) {
            const qtyToReturn = ingredient.quantity * item.quantity;
            await MarketOSRepository.saveRawMaterial({
              ...rawMaterial,
              current_stock: Number((rawMaterial.current_stock + qtyToReturn).toFixed(3)),
            });
          }
        }
      }
    }
  }
}
