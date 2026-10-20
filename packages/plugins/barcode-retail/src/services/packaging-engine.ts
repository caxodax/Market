import { ProductBarcode, PackagingConversionResult } from "@marketos/types";

/**
 * Packaging Engine: Handles unit <-> pack <-> case conversions,
 * price calculations, and inventory deduction/replenishment math.
 */

export interface PackPriceCalculation {
  unitPrice: number;
  totalPrice: number;
  savingsPercentage: number;
}

/**
 * Calculates the total units and packs from a given quantity of units.
 * Example: 50 cans with pack of 24 -> 2 packs of 24 and 2 loose units.
 */
export function convertUnitsToPacks(
  totalUnits: number,
  packName: string,
  unitsPerPack: number
): PackagingConversionResult {
  const safeUnits = Math.max(0, Math.floor(totalUnits));
  const safeUnitsPerPack = Math.max(1, Math.floor(unitsPerPack));

  const equivalentPacks = Math.floor(safeUnits / safeUnitsPerPack);
  const remainderUnits = safeUnits % safeUnitsPerPack;

  return {
    totalUnits: safeUnits,
    equivalentPacks,
    remainderUnits,
    packName,
    unitsPerPack: safeUnitsPerPack,
  };
}

/**
 * Computes price for a packaging option, comparing pack price vs loose unit price.
 */
export function calculatePackPrice(
  baseProductPriceUsd: number,
  pack: Pick<ProductBarcode, "units_per_pack" | "price_usd">
): PackPriceCalculation {
  const units = Math.max(1, pack.units_per_pack);
  const looseEquivalentPrice = baseProductPriceUsd * units;

  // If specific pack price is defined, use it; otherwise standard multiple
  const totalPrice = pack.price_usd !== null && pack.price_usd !== undefined && pack.price_usd > 0
    ? pack.price_usd
    : looseEquivalentPrice;

  const unitPrice = totalPrice / units;
  const savings = looseEquivalentPrice > totalPrice
    ? ((looseEquivalentPrice - totalPrice) / looseEquivalentPrice) * 100
    : 0;

  return {
    unitPrice: Number(unitPrice.toFixed(4)),
    totalPrice: Number(totalPrice.toFixed(2)),
    savingsPercentage: Number(savings.toFixed(2)),
  };
}

/**
 * Computes base inventory units to deduct when a sale is scanned.
 * If 1 case of 24 is sold -> returns 24.
 * If 2 cases of 24 are sold -> returns 48.
 */
export function calculateInventoryDeduction(
  quantitySold: number,
  unitsPerPack: number = 1
): number {
  const safeQty = Math.max(1, Math.floor(quantitySold));
  const safeUnitsPerPack = Math.max(1, Math.floor(unitsPerPack));
  return safeQty * safeUnitsPerPack;
}

/**
 * Computes base inventory units to add when receiving a purchase.
 * If 10 bultos of 20 units are received -> returns 200 units.
 */
export function calculateInventoryReceipt(
  packsReceived: number,
  unitsPerPack: number
): number {
  const safePacks = Math.max(0, Math.floor(packsReceived));
  const safeUnitsPerPack = Math.max(1, Math.floor(unitsPerPack));
  return safePacks * safeUnitsPerPack;
}
