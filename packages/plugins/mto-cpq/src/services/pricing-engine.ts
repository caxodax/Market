import {
  CpqCostSettings,
  CpqPricingMatrix,
  CpqAttributeOption,
  CpqVolumeTier,
  CpqDimensions,
  CpqCalculationResult,
  CpqCostBreakdown,
  CpqBomItem,
} from "@marketos/types";

export interface CalculateCpqPriceInput {
  matrix: CpqPricingMatrix;
  costSettings: CpqCostSettings;
  dimensions?: CpqDimensions;
  selectedOptions?: CpqAttributeOption[];
  volumeTiers?: CpqVolumeTier[];
  quantity?: number;
  customMarginPercentage?: number;
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Calculates effective billable units based on matrix calculation type and dimensions.
 * Units normalized:
 * - AREA: m² (standardized from cm, mm, in, or m)
 * - LINEAR: meters (standardized from cm, mm, in, or m)
 * - VOLUME: m³ (standardized from cm, mm, in, or m)
 * - UNITARY_CUSTOM / TIERED_VOLUME: 1 unit
 */
export function calculateEffectiveUnits(
  type: CpqPricingMatrix["calculation_type"],
  dimensions?: CpqDimensions,
  minBillableUnit = 0
): number {
  if (!dimensions) return Math.max(minBillableUnit, 1);

  const unit = dimensions.unit || "cm";

  switch (type) {
    case "AREA": {
      if (dimensions.area && dimensions.area > 0) {
        return Math.max(minBillableUnit, dimensions.area);
      }
      const w = dimensions.width || 0;
      const h = dimensions.height || 0;
      if (w <= 0 || h <= 0) return Math.max(minBillableUnit, 0);

      // Convert dimensions to square meters (m²)
      const divisor =
        unit === "cm" ? 10_000 : unit === "mm" ? 1_000_000 : unit === "in" ? 1550.003 : 1;
      const rawArea = (w * h) / divisor;
      return Math.max(minBillableUnit, rawArea);
    }

    case "LINEAR": {
      const len = dimensions.length || dimensions.width || 0;
      if (len <= 0) return Math.max(minBillableUnit, 0);

      // Convert dimension to linear meters (m)
      const divisor =
        unit === "cm" ? 100 : unit === "mm" ? 1_000 : unit === "in" ? 39.3701 : 1;
      const rawLength = len / divisor;
      return Math.max(minBillableUnit, rawLength);
    }

    case "VOLUME": {
      const w = dimensions.width || 0;
      const h = dimensions.height || 0;
      const d = dimensions.depth || 0;
      if (w <= 0 || h <= 0 || d <= 0) return Math.max(minBillableUnit, 0);

      // Convert dimension to cubic meters (m³)
      const divisor =
        unit === "cm" ? 1_000_000 : unit === "mm" ? 1_000_000_000 : 1;
      const rawVolume = (w * h * d) / divisor;
      return Math.max(minBillableUnit, rawVolume);
    }

    case "UNITARY_CUSTOM":
    case "TIERED_VOLUME":
    default:
      return Math.max(minBillableUnit, 1);
  }
}

/**
 * Pure Cost-Plus CPQ Engine:
 * 1. Material Cost = (Base consumable + sum(Option consumables)) * (1 + waste_factor)
 * 2. Labor Cost = (total minutes / 60) * hourly_labor_rate
 * 3. Machine Cost = (total minutes / 60) * machine_cost_per_hour
 * 4. Production Cost = Material Cost + Labor Cost + Machine Cost + Setup Fee
 * 5. Selling Price = Production Cost / (1 - (margin_percentage / 100))
 * 6. Volume Tier Discount applied per requested quantity
 */
export function calculateCpqPrice(input: CalculateCpqPriceInput): CpqCalculationResult {
  const {
    matrix,
    costSettings,
    dimensions,
    selectedOptions = [],
    volumeTiers = [],
    quantity = 1,
    customMarginPercentage,
  } = input;

  const qty = Math.max(1, Math.floor(quantity));
  const effectiveUnits = calculateEffectiveUnits(
    matrix.calculation_type,
    dimensions,
    matrix.min_billable_unit
  );

  const bomItems: CpqBomItem[] = [];

  // 1. Material Costs
  const baseMaterialUnitCost = matrix.base_material_cost_per_unit || 0;
  const baseMaterialCost = baseMaterialUnitCost * effectiveUnits;
  if (baseMaterialCost > 0) {
    bomItems.push({
      name: `${matrix.name} (Material Base)`,
      category: "MATERIAL",
      quantity: round(effectiveUnits, 4),
      unit: matrix.calculation_type === "AREA" ? "m²" : matrix.calculation_type === "LINEAR" ? "m" : "unid",
      unit_cost: round(baseMaterialUnitCost, 4),
      total_cost: round(baseMaterialCost, 2),
    });
  }

  let optionsMaterialCost = 0;
  for (const opt of selectedOptions) {
    if (opt.material_cost > 0) {
      optionsMaterialCost += opt.material_cost;
      bomItems.push({
        name: `${opt.attribute_name}: ${opt.label}`,
        category: "MATERIAL",
        quantity: 1,
        unit: "unid",
        unit_cost: round(opt.material_cost, 2),
        total_cost: round(opt.material_cost, 2),
      });
    }
  }

  const rawMaterials = baseMaterialCost + optionsMaterialCost;
  const wasteFactor = Math.max(0, Math.min(matrix.waste_factor ?? 0.05, 1.0));
  const wasteCost = rawMaterials * wasteFactor;
  const totalMaterials = rawMaterials + wasteCost;

  if (wasteCost > 0) {
    bomItems.push({
      name: `Factor de Merma (${round(wasteFactor * 100, 1)}%)`,
      category: "MATERIAL",
      quantity: 1,
      unit: "%",
      unit_cost: round(wasteCost, 2),
      total_cost: round(wasteCost, 2),
    });
  }

  // 2. Labor Costs
  const baseMinutes = matrix.base_labor_minutes || 0;
  const optionsMinutes = selectedOptions.reduce((acc, opt) => acc + (opt.labor_minutes || 0), 0);
  const totalMinutes = baseMinutes + optionsMinutes;

  const hourlyLabor = Math.max(0, costSettings.hourly_labor_rate || 0);
  const laborCost = (totalMinutes / 60) * hourlyLabor;

  if (totalMinutes > 0 && hourlyLabor > 0) {
    bomItems.push({
      name: `Mano de Obra (${round(totalMinutes, 1)} min)`,
      category: "LABOR",
      quantity: round(totalMinutes / 60, 3),
      unit: "horas",
      unit_cost: round(hourlyLabor, 2),
      total_cost: round(laborCost, 2),
    });
  }

  // 3. Machine Costs
  const machineRate = Math.max(0, costSettings.machine_cost_per_hour || 0);
  const machineCost = (totalMinutes / 60) * machineRate;

  if (totalMinutes > 0 && machineRate > 0) {
    bomItems.push({
      name: `Uso / Depreciación de Máquina (${round(totalMinutes, 1)} min)`,
      category: "MACHINE",
      quantity: round(totalMinutes / 60, 3),
      unit: "horas",
      unit_cost: round(machineRate, 2),
      total_cost: round(machineCost, 2),
    });
  }

  // 4. Setup Fee
  const setupFee = Math.max(0, matrix.setup_fee || 0);
  if (setupFee > 0) {
    bomItems.push({
      name: `Costo Fijo de Arranque / Matriz (Setup Fee)`,
      category: "SETUP",
      quantity: 1,
      unit: "evento",
      unit_cost: round(setupFee, 2),
      total_cost: round(setupFee, 2),
    });
  }

  // Total Unit Production Cost
  const unitCost = totalMaterials + laborCost + machineCost + setupFee;

  // 5. Merchant Margin Calculation: Price = Cost / (1 - Margin%)
  const rawMargin = customMarginPercentage ?? costSettings.default_margin_percentage ?? 45;
  const clampedMargin = Math.max(0, Math.min(rawMargin, 99.9));
  const marginDivisor = 1 - clampedMargin / 100;
  const baseUnitPrice = marginDivisor > 0 ? unitCost / marginDivisor : unitCost;

  // 6. Tiered Volume Scale Discount
  let discountPercentage = 0;
  if (volumeTiers.length > 0) {
    const matchedTier = volumeTiers.find(
      (t) => qty >= t.min_quantity && (t.max_quantity === null || qty <= t.max_quantity)
    );
    if (matchedTier && matchedTier.discount_percentage > 0) {
      discountPercentage = Math.min(100, Math.max(0, matchedTier.discount_percentage));
    }
  }

  const unitPrice = discountPercentage > 0
    ? baseUnitPrice * (1 - discountPercentage / 100)
    : baseUnitPrice;

  const totalCost = unitCost * qty;
  const totalPrice = unitPrice * qty;
  const netMarginAmount = totalPrice - totalCost;
  const profitMargin = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0;

  const costBreakdown: CpqCostBreakdown = {
    materials: round(totalMaterials, 2),
    labor: round(laborCost, 2),
    machine: round(machineCost, 2),
    setup: round(setupFee, 2),
    waste: round(wasteCost, 2),
    total_cost: round(unitCost, 2),
    bom_items: bomItems,
  };

  const productionNotes: string[] = [];
  if (effectiveUnits > 0) {
    productionNotes.push(`Unidades calculadas: ${round(effectiveUnits, 2)} (${matrix.calculation_type})`);
  }
  if (wasteFactor > 0) {
    productionNotes.push(`Merma aplicada: ${round(wasteFactor * 100, 1)}%`);
  }
  if (totalMinutes > 0) {
    productionNotes.push(`Tiempo de operador estimado: ${round(totalMinutes, 1)} minutos`);
  }
  if (discountPercentage > 0) {
    productionNotes.push(`Descuento por escala (${qty} unid): -${round(discountPercentage, 1)}%`);
  }

  // 7. Configurable Advance Deposit
  const rawDepositPct =
    matrix.deposit_percentage ?? costSettings.default_deposit_percentage ?? 50;
  const depositPercentage = Math.max(0, Math.min(rawDepositPct, 100));
  const depositAmount = round((totalPrice * depositPercentage) / 100, 2);

  return {
    unitCost: round(unitCost, 2),
    baseUnitPrice: round(baseUnitPrice, 2),
    unitPrice: round(unitPrice, 2),
    quantity: qty,
    totalCost: round(totalCost, 2),
    totalPrice: round(totalPrice, 2),
    profitMargin: round(profitMargin, 2),
    netMarginAmount: round(netMarginAmount, 2),
    discountPercentage: round(discountPercentage, 2),
    depositPercentage: round(depositPercentage, 2),
    depositAmount: round(depositAmount, 2),
    costBreakdown,
    productionNotes,
  };
}

/**
 * Sanitizes calculation result for public storefront or non-admin clients,
 * ensuring internal cost breakdowns and profit margins are never leaked.
 */
export function sanitizeCalculationForClient(calc: CpqCalculationResult): import("@marketos/types").SanitizedCpqCalculationResult {
  const { unitCost, totalCost, profitMargin, netMarginAmount, costBreakdown, ...safeData } = calc;
  return safeData;
}
