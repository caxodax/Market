import type { CraftPricingFormula } from "@marketos/types";

/**
 * Calcula el costo unitario de un insumo a partir del precio de compra del bulto y su rendimiento.
 * Ej: 1 caja de 36 tazas a $45.00 -> $1.2500 por taza
 */
export function calculateUnitCost(packPrice: number, packQty: number): number {
  if (packQty <= 0) return 0;
  return Math.round((packPrice / packQty) * 10000) / 10000;
}

/**
 * Calcula el costo consumido por un renglón en la receta.
 */
export function calculateItemCost(unitCost: number, qtyToUse: number): number {
  return Math.round(unitCost * qtyToUse * 10000) / 10000;
}

/**
 * Costo Directo Real de Taller:
 * Direct Cost = (Suma Materiales * (1 + % Merma / 100)) + Mano de Obra / Desgaste
 */
export function calculateDirectCost(
  materialsCost: number,
  wastePercentage = 5.0,
  laborCost = 0
): number {
  const wasteMultiplier = 1 + Math.max(0, wastePercentage) / 100.0;
  const costWithWaste = materialsCost * wasteMultiplier;
  return Math.round((costWithWaste + Math.max(0, laborCost)) * 100) / 100;
}

/**
 * Calcula el precio de venta sugerido según la fórmula elegida:
 * - MARGIN (Sobre Venta): Direct Cost / (1 - Margin % / 100)
 * - MARKUP (Sobre Costo): Direct Cost * (1 + Margin % / 100)
 */
export function calculateSellingPrice(
  directCost: number,
  formula: CraftPricingFormula = "MARGIN",
  marginPercentage = 30.0
): number {
  if (directCost <= 0) return 0;

  if (formula === "MARGIN") {
    const safeMargin = Math.min(marginPercentage, 95.0) / 100.0;
    return Math.round((directCost / (1.0 - safeMargin)) * 100) / 100;
  } else {
    const markup = Math.max(0, marginPercentage) / 100.0;
    return Math.round((directCost * (1.0 + markup)) * 100) / 100;
  }
}

/**
 * Ganancia Neta Real y Margen Efectivo:
 */
export function calculateNetProfit(
  sellingPrice: number,
  directCost: number
): { profitBase: number; marginRealPercentage: number } {
  const profitBase = Math.round((sellingPrice - directCost) * 100) / 100;
  const marginRealPercentage =
    sellingPrice > 0 ? Math.round((profitBase / sellingPrice) * 1000) / 10 : 0;

  return {
    profitBase,
    marginRealPercentage,
  };
}

/**
 * Cálculo del 50% de anticipo para personalizaciones de taller y saldo restante
 */
export function calculateQuoteDeposit(
  totalBase: number,
  depositPercentage = 50.0
): {
  depositRequiredBase: number;
  pendingBalanceBase: number;
} {
  const safePct = Math.max(0, Math.min(100, depositPercentage)) / 100.0;
  const depositRequiredBase = Math.round(totalBase * safePct * 100) / 100;
  const pendingBalanceBase = Math.round((totalBase - depositRequiredBase) * 100) / 100;

  return {
    depositRequiredBase,
    pendingBalanceBase,
  };
}

/**
 * Conversión bimonetaria a moneda secundaria (VES)
 */
export function convertBimonetary(amountBase: number, exchangeRate: number): number {
  if (exchangeRate <= 0) return amountBase;
  return Math.round(amountBase * exchangeRate * 100) / 100;
}
