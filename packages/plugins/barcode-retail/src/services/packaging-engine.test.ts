import { describe, it, expect } from "vitest";
import {
  convertUnitsToPacks,
  calculatePackPrice,
  calculateInventoryDeduction,
  calculateInventoryReceipt,
} from "./packaging-engine";

describe("Packaging Engine (Units vs Packs vs Bultos)", () => {
  it("converts loose units into full packs and remainder units correctly", () => {
    // 50 cans with packs of 24 -> 2 packs of 24 and 2 remainder cans
    const res = convertUnitsToPacks(50, "BULTO_24", 24);
    expect(res.equivalentPacks).toBe(2);
    expect(res.remainderUnits).toBe(2);
    expect(res.totalUnits).toBe(50);
  });

  it("calculates pack price with discount savings when explicit pack price is set", () => {
    // Unit price = $1.50. Pack of 24 loose would be $36.00.
    // Wholesale pack price is $30.00 (savings of $6.00 = 16.67%)
    const pricing = calculatePackPrice(1.5, {
      units_per_pack: 24,
      price_usd: 30.0,
    });

    expect(pricing.totalPrice).toBe(30.0);
    expect(pricing.unitPrice).toBe(1.25);
    expect(pricing.savingsPercentage).toBe(16.67);
  });

  it("calculates pack price by multiplying unit price when price_usd is null", () => {
    const pricing = calculatePackPrice(2.0, {
      units_per_pack: 6,
      price_usd: null,
    });

    expect(pricing.totalPrice).toBe(12.0);
    expect(pricing.unitPrice).toBe(2.0);
    expect(pricing.savingsPercentage).toBe(0);
  });

  it("calculates accurate inventory deduction on sale", () => {
    // Selling 2 bultos of 24 units = 48 base units to deduct
    expect(calculateInventoryDeduction(2, 24)).toBe(48);
    // Selling 3 single units
    expect(calculateInventoryDeduction(3, 1)).toBe(3);
  });

  it("calculates accurate inventory receipt on inbound delivery", () => {
    // Received 15 bultos of 20 packs of Harina PAN = 300 base units to add
    expect(calculateInventoryReceipt(15, 20)).toBe(300);
  });
});
