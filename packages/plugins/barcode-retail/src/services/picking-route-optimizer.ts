import { PickingItem, WarehouseLocation } from "@marketos/types";

/**
 * Standardizes location coordinate string for display (e.g. "01-B-03").
 */
export function formatLocationCode(loc?: Partial<WarehouseLocation> | null): string {
  if (!loc) return "GENERAL";
  const aisle = (loc.aisle || "01").padStart(2, "0");
  const shelf = (loc.shelf || "A").toUpperCase();
  const bin = (loc.bin || "01").padStart(2, "0");
  return `${aisle}-${shelf}-${bin}`;
}

/**
 * Compares two warehouse locations for sorting.
 * Natural sort: Aisle (numeric) -> Shelf (alphabetical) -> Bin (numeric).
 */
export function compareWarehouseLocations(
  a?: Partial<WarehouseLocation> | null,
  b?: Partial<WarehouseLocation> | null
): number {
  if (!a && !b) return 0;
  if (!a) return 1; // Unassigned goes to end
  if (!b) return -1;

  // 1. Compare Aisle numerically if possible
  const aisleA = parseInt(a.aisle || "999", 10);
  const aisleB = parseInt(b.aisle || "999", 10);
  if (!isNaN(aisleA) && !isNaN(aisleB) && aisleA !== aisleB) {
    return aisleA - aisleB;
  }
  const strAisleA = a.aisle || "ZZ";
  const strAisleB = b.aisle || "ZZ";
  if (strAisleA !== strAisleB) {
    return strAisleA.localeCompare(strAisleB);
  }

  // 2. Compare Shelf alphabetically
  const shelfA = a.shelf || "Z";
  const shelfB = b.shelf || "Z";
  if (shelfA !== shelfB) {
    return shelfA.localeCompare(shelfB);
  }

  // 3. Compare Bin numerically
  const binA = parseInt(a.bin || "999", 10);
  const binB = parseInt(b.bin || "999", 10);
  if (!isNaN(binA) && !isNaN(binB) && binA !== binB) {
    return binA - binB;
  }
  const strBinA = a.bin || "ZZ";
  const strBinB = b.bin || "ZZ";
  return strBinA.localeCompare(strBinB);
}

export interface OptimizedPickingSheet {
  totalItems: number;
  totalUnits: number;
  distinctAislesCount: number;
  items: PickingItem[];
}

/**
 * Optimizes an order picking list by sorting items according to the optimal
 * warehouse traversal path, eliminating backtracking through aisles.
 */
export function optimizePickingRoute(items: PickingItem[]): OptimizedPickingSheet {
  if (!items || items.length === 0) {
    return {
      totalItems: 0,
      totalUnits: 0,
      distinctAislesCount: 0,
      items: [],
    };
  }

  // Clone and sort
  const sorted = [...items].sort((itemA, itemB) => {
    return compareWarehouseLocations(itemA.location, itemB.location);
  });

  const totalUnits = sorted.reduce((sum, it) => sum + (it.quantity || 1), 0);
  const distinctAisles = new Set(sorted.map((it) => it.location?.aisle || "GENERAL"));

  return {
    totalItems: sorted.length,
    totalUnits,
    distinctAislesCount: distinctAisles.size,
    items: sorted,
  };
}
