import { describe, it, expect } from "vitest";
import { convertUnitQuantity, calculateRecipeCost } from "./recipe-cost-engine";
import { ProductRecipe, RawMaterial } from "@marketos/types";

describe("Food Service Recipe Cost Engine", () => {
  describe("convertUnitQuantity", () => {
    it("converts grams to kilograms correctly", () => {
      expect(convertUnitQuantity("G", "KG", 250)).toBe(0.25);
      expect(convertUnitQuantity("G", "KG", 1000)).toBe(1);
    });

    it("converts kilograms to grams correctly", () => {
      expect(convertUnitQuantity("KG", "G", 1.5)).toBe(1500);
    });

    it("converts milliliters to liters correctly", () => {
      expect(convertUnitQuantity("ML", "L", 50)).toBe(0.05);
      expect(convertUnitQuantity("ML", "L", 1000)).toBe(1);
    });

    it("converts liters to milliliters correctly", () => {
      expect(convertUnitQuantity("L", "ML", 2)).toBe(2000);
    });

    it("preserves identical units without alteration", () => {
      expect(convertUnitQuantity("UNIT", "UNIT", 3)).toBe(3);
      expect(convertUnitQuantity("PORTION", "PORTION", 1)).toBe(1);
    });
  });

  describe("calculateRecipeCost", () => {
    const mockRawMaterials: RawMaterial[] = [
      {
        id: "rm-bread",
        tenant_id: "t-1",
        store_id: "s-1",
        name: "Pan Perro Caliente",
        unit: "UNIT",
        current_stock: 100,
        min_alert_stock: 20,
        cost_per_unit_usd: 0.20, // $0.20 per bread
        is_active: true,
        created_at: "",
        updated_at: "",
      },
      {
        id: "rm-sausage",
        tenant_id: "t-1",
        store_id: "s-1",
        name: "Salchicha Viena",
        unit: "UNIT",
        current_stock: 80,
        min_alert_stock: 15,
        cost_per_unit_usd: 0.40, // $0.40 per sausage
        is_active: true,
        created_at: "",
        updated_at: "",
      },
      {
        id: "rm-meat",
        tenant_id: "t-1",
        store_id: "s-1",
        name: "Carne Molida Especial",
        unit: "KG",
        current_stock: 10,
        min_alert_stock: 2,
        cost_per_unit_usd: 6.00, // $6.00 per KG
        is_active: true,
        created_at: "",
        updated_at: "",
      },
      {
        id: "rm-sauce",
        tenant_id: "t-1",
        store_id: "s-1",
        name: "Salsa de Ajo Especial",
        unit: "L",
        current_stock: 5,
        min_alert_stock: 1,
        cost_per_unit_usd: 4.00, // $4.00 per Liter
        is_active: true,
        created_at: "",
        updated_at: "",
      },
    ];

    it("calculates recipe cost with cross-unit conversion (G to KG, ML to L)", () => {
      const burgerRecipe: ProductRecipe = {
        id: "rec-burger",
        tenant_id: "t-1",
        product_id: "prod-burger",
        items: [
          { raw_material_id: "rm-bread", quantity: 1, unit: "UNIT" }, // 1 * 0.20 = 0.20
          { raw_material_id: "rm-meat", quantity: 150, unit: "G" },    // 150g = 0.150kg * $6 = 0.90
          { raw_material_id: "rm-sauce", quantity: 25, unit: "ML" },   // 25ml = 0.025L * $4 = 0.10
        ],
        created_at: "",
        updated_at: "",
      };

      const result = calculateRecipeCost({
        recipe: burgerRecipe,
        rawMaterials: mockRawMaterials,
        productPriceUsd: 4.00, // Sells for $4.00
      });

      // Total ingredient cost: 0.20 + 0.90 + 0.10 = $1.20
      expect(result.totalIngredientCostUsd).toBe(1.20);
      // Food Cost % = (1.20 / 4.00) * 100 = 30.0%
      expect(result.foodCostPercentage).toBe(30.0);
      expect(result.health).toBe("OPTIMAL");
      expect(result.grossMarginUsd).toBe(2.80);
      // Suggested price at 30% target: 1.20 / 0.30 = 4.00
      expect(result.suggestedRetailPriceUsd).toBe(4.00);
    });

    it("applies shrinkage / waste factor to ingredient calculation", () => {
      const shrinkingRecipe: ProductRecipe = {
        id: "rec-shrink",
        tenant_id: "t-1",
        product_id: "prod-steak",
        items: [
          // 200g meat with 20% cooking shrinkage -> effective = 200 / 0.8 = 250g raw = 0.25kg * $6 = $1.50
          { raw_material_id: "rm-meat", quantity: 200, unit: "G", waste_percentage: 20 },
        ],
        created_at: "",
        updated_at: "",
      };

      const result = calculateRecipeCost({
        recipe: shrinkingRecipe,
        rawMaterials: mockRawMaterials,
        productPriceUsd: 5.00,
      });

      expect(result.totalIngredientCostUsd).toBe(1.50);
      expect(result.items[0].effectiveQuantity).toBe(250);
      expect(result.items[0].wastePercentage).toBe(20);
    });

    it("flags critical food cost health when cost exceeds 40%", () => {
      const expensiveDishRecipe: ProductRecipe = {
        id: "rec-exp",
        tenant_id: "t-1",
        product_id: "prod-exp",
        items: [
          { raw_material_id: "rm-meat", quantity: 500, unit: "G" }, // 0.5kg * $6 = $3.00
        ],
        created_at: "",
        updated_at: "",
      };

      const result = calculateRecipeCost({
        recipe: expensiveDishRecipe,
        rawMaterials: mockRawMaterials,
        productPriceUsd: 5.00, // $3.00 / $5.00 = 60% Food Cost!
      });

      expect(result.foodCostPercentage).toBe(60.0);
      expect(result.health).toBe("CRITICAL");
      // Suggested retail price for 30% food cost: 3.00 / 0.30 = $10.00
      expect(result.suggestedRetailPriceUsd).toBe(10.00);
    });
  });
});
