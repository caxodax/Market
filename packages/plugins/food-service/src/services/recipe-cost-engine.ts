import {
  RawMaterialUnit,
  RawMaterial,
  ProductRecipe,
  RecipeCostCalculation,
  RecipeCostItemBreakdown,
  FoodCostHealth,
} from "@marketos/types";

/**
 * Normalizes raw material units into standard mass, volume or discrete count.
 * Returns the multiplier to convert from `sourceUnit` into `targetUnit`.
 * e.g. convertUnitQuantity("G", "KG", 150) -> 0.150
 *      convertUnitQuantity("KG", "G", 2.5) -> 2500
 *      convertUnitQuantity("ML", "L", 50) -> 0.050
 */
export function convertUnitQuantity(
  sourceUnit: RawMaterialUnit,
  targetUnit: RawMaterialUnit,
  quantity: number
): number {
  if (sourceUnit === targetUnit) return quantity;

  // Mass Family: KG <-> G
  if (sourceUnit === "G" && targetUnit === "KG") return quantity / 1000;
  if (sourceUnit === "KG" && targetUnit === "G") return quantity * 1000;

  // Volume Family: ML <-> L
  if (sourceUnit === "ML" && targetUnit === "L") return quantity / 1000;
  if (sourceUnit === "L" && targetUnit === "ML") return quantity * 1000;

  // Cross-family fallback (e.g. PORTION to UNIT or unconvertible)
  // Preserves inventory safety without crash
  return quantity;
}

export interface CalculateRecipeCostOptions {
  recipe: ProductRecipe;
  rawMaterials: RawMaterial[];
  productPriceUsd?: number;
  targetFoodCostPercentage?: number;
}

/**
 * Computes exact Recipe Escandallo (BOM Cost-Plus), shrinkage factor,
 * Food Cost % benchmark and suggested retail selling price.
 */
export function calculateRecipeCost(options: CalculateRecipeCostOptions): RecipeCostCalculation {
  const {
    recipe,
    rawMaterials,
    productPriceUsd = 0,
    targetFoodCostPercentage = recipe.target_food_cost_percentage || 30.0,
  } = options;

  const rawMaterialMap = new Map<string, RawMaterial>();
  for (const rm of rawMaterials) {
    rawMaterialMap.set(rm.id, rm);
  }

  let totalIngredientCost = 0;
  const items: RecipeCostItemBreakdown[] = [];

  for (const item of recipe.items || []) {
    const rawMaterial = rawMaterialMap.get(item.raw_material_id);
    const rawName = rawMaterial?.name || item.raw_material_name || "Insumo";
    const storageUnit: RawMaterialUnit = rawMaterial?.unit || item.unit || "UNIT";
    const recipeUnit: RawMaterialUnit = item.unit || storageUnit;
    const wastePct = Math.max(0, Math.min(90, item.waste_percentage || 0));

    // Factor de rendimiento gastronómico / merma
    // ej. Si 100g de carne encogen 20% al cocinar, se necesitan 100 / 0.8 = 125g crudos
    const shrinkageMultiplier = wastePct > 0 ? 1 / (1 - wastePct / 100) : 1;
    const effectiveQty = item.quantity * shrinkageMultiplier;

    // Convert recipe unit to storage inventory unit
    const convertedStorageQty = convertUnitQuantity(recipeUnit, storageUnit, effectiveQty);
    const unitCost = rawMaterial ? rawMaterial.cost_per_unit_usd : 0;
    const lineCost = convertedStorageQty * unitCost;

    totalIngredientCost += lineCost;

    items.push({
      raw_material_id: item.raw_material_id,
      raw_material_name: rawName,
      recipeQuantity: item.quantity,
      recipeUnit,
      storageUnit,
      effectiveQuantity: Number(effectiveQty.toFixed(3)),
      unitCostUsd: unitCost,
      totalCostUsd: Number(lineCost.toFixed(4)),
      wastePercentage: wastePct,
    });
  }

  const roundedTotalCost = Number(totalIngredientCost.toFixed(2));
  const foodCostPct =
    productPriceUsd > 0
      ? Number(((roundedTotalCost / productPriceUsd) * 100).toFixed(1))
      : 0;

  // Food Cost Health Benchmark
  let health: FoodCostHealth = "OPTIMAL";
  if (foodCostPct > 40.0) {
    health = "CRITICAL";
  } else if (foodCostPct > 32.0) {
    health = "ACCEPTABLE";
  }

  const grossMarginUsd = Math.max(0, Number((productPriceUsd - roundedTotalCost).toFixed(2)));
  const grossMarginPct =
    productPriceUsd > 0
      ? Number(((grossMarginUsd / productPriceUsd) * 100).toFixed(1))
      : 0;

  // Suggested Retail Price for Target Food Cost %
  const targetPct = Math.max(1, targetFoodCostPercentage);
  const suggestedPrice = Number((roundedTotalCost / (targetPct / 100)).toFixed(2));

  return {
    recipeId: recipe.id,
    productId: recipe.product_id,
    productPriceUsd,
    totalIngredientCostUsd: roundedTotalCost,
    foodCostPercentage: foodCostPct,
    health,
    grossMarginUsd,
    grossMarginPercentage: grossMarginPct,
    suggestedRetailPriceUsd: suggestedPrice,
    items,
  };
}
