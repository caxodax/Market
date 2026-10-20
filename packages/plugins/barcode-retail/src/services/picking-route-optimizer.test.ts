import { describe, it, expect } from "vitest";
import {
  formatLocationCode,
  compareWarehouseLocations,
  optimizePickingRoute,
} from "./picking-route-optimizer";
import { PickingItem } from "@marketos/types";

describe("Warehouse Picking Route Optimizer", () => {
  it("formats location codes with uniform zero-padded strings", () => {
    expect(formatLocationCode({ aisle: "3", shelf: "b", bin: "4" })).toBe("03-B-04");
    expect(formatLocationCode(null)).toBe("GENERAL");
  });

  it("sorts items by aisle, then shelf, then bin sequentially", () => {
    const items: PickingItem[] = [
      {
        orderItemId: "1",
        productId: "p1",
        productName: "Arroz Blanco",
        quantity: 2,
        location: { aisle: "03", shelf: "A", bin: "01" },
      },
      {
        orderItemId: "2",
        productId: "p2",
        productName: "Aceite Vegetal",
        quantity: 1,
        location: { aisle: "01", shelf: "B", bin: "02" },
      },
      {
        orderItemId: "3",
        productId: "p3",
        productName: "Harina PAN",
        quantity: 3,
        location: { aisle: "01", shelf: "A", bin: "05" },
      },
      {
        orderItemId: "4",
        productId: "p4",
        productName: "Sin Ubicación",
        quantity: 1,
        location: null as any,
      },
    ];

    const result = optimizePickingRoute(items);

    expect(result.totalItems).toBe(4);
    expect(result.totalUnits).toBe(7);
    // Correct order:
    // 1st: Aisle 01, Shelf A, Bin 05 (Harina PAN)
    // 2nd: Aisle 01, Shelf B, Bin 02 (Aceite)
    // 3rd: Aisle 03, Shelf A, Bin 01 (Arroz)
    // 4th: Unassigned (Sin Ubicación)
    expect(result.items[0]!.productName).toBe("Harina PAN");
    expect(result.items[1]!.productName).toBe("Aceite Vegetal");
    expect(result.items[2]!.productName).toBe("Arroz Blanco");
    expect(result.items[3]!.productName).toBe("Sin Ubicación");
  });
});
