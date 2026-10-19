import { describe, it, expect } from "vitest";
import {
  calculateCpqPrice,
  calculateEffectiveUnits,
  round,
} from "./pricing-engine";
import {
  CpqCostSettings,
  CpqPricingMatrix,
  CpqAttributeOption,
  CpqVolumeTier,
} from "@marketos/types";

describe("CPQ Pricing Engine", () => {
  const mockCostSettings: CpqCostSettings = {
    id: "settings-1",
    tenant_id: "tenant-1",
    default_margin_percentage: 40,
    hourly_labor_rate: 20,
    machine_cost_per_hour: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockAreaMatrix: CpqPricingMatrix = {
    id: "matrix-area-1",
    tenant_id: "tenant-1",
    name: "Lona Vinílica Gran Formato",
    calculation_type: "AREA",
    min_billable_unit: 1.0,
    base_material_cost_per_unit: 10,
    base_labor_minutes: 15,
    setup_fee: 5,
    waste_factor: 0.1, // 10% merma
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  describe("calculateEffectiveUnits", () => {
    it("should convert cm to m² for AREA type", () => {
      // 100cm x 200cm = 20,000 cm² = 2.0 m²
      const units = calculateEffectiveUnits("AREA", {
        width: 100,
        height: 200,
        unit: "cm",
      });
      expect(units).toBe(2.0);
    });

    it("should respect min_billable_unit when calculated area is lower", () => {
      // 50cm x 50cm = 0.25 m², but min_billable_unit is 1.0
      const units = calculateEffectiveUnits(
        "AREA",
        { width: 50, height: 50, unit: "cm" },
        1.0
      );
      expect(units).toBe(1.0);
    });

    it("should convert cm to linear meters for LINEAR type", () => {
      // 250cm = 2.5m
      const units = calculateEffectiveUnits("LINEAR", {
        length: 250,
        unit: "cm",
      });
      expect(units).toBe(2.5);
    });

    it("should convert cm to m³ for VOLUME type", () => {
      // 100cm x 100cm x 100cm = 1,000,000 cm³ = 1.0 m³
      const units = calculateEffectiveUnits("VOLUME", {
        width: 100,
        height: 100,
        depth: 100,
        unit: "cm",
      });
      expect(units).toBe(1.0);
    });

    it("should return 1 unit for UNITARY_CUSTOM or undefined dimensions", () => {
      expect(calculateEffectiveUnits("UNITARY_CUSTOM")).toBe(1.0);
      expect(calculateEffectiveUnits("AREA", undefined, 0)).toBe(1.0);
    });
  });

  describe("calculateCpqPrice with Area Matrix", () => {
    it("should correctly compute cost-plus production cost, waste factor, and gross margin", () => {
      // Dimensions: 100 x 200 cm = 2 m²
      // Base material: 2 m² * 10 = 20
      // Waste (10%): 20 * 0.10 = 2 -> Total materials = 22
      // Base labor: 15 min at 20/hr = (15/60)*20 = 5
      // Machine: 15 min at 10/hr = (15/60)*10 = 2.5
      // Setup fee: 5
      // Total unit cost = 22 + 5 + 2.5 + 5 = 34.50
      // Default margin: 40% -> Base price = 34.50 / (1 - 0.40) = 34.50 / 0.60 = 57.50
      // Net margin = 57.50 - 34.50 = 23.00 (40.0% of 57.50)

      const result = calculateCpqPrice({
        matrix: mockAreaMatrix,
        costSettings: mockCostSettings,
        dimensions: { width: 100, height: 200, unit: "cm" },
        quantity: 1,
      });

      expect(result.costBreakdown.materials).toBe(22.0);
      expect(result.costBreakdown.waste).toBe(2.0);
      expect(result.costBreakdown.labor).toBe(5.0);
      expect(result.costBreakdown.machine).toBe(2.5);
      expect(result.costBreakdown.setup).toBe(5.0);
      expect(result.unitCost).toBe(34.5);

      expect(result.baseUnitPrice).toBe(57.5);
      expect(result.unitPrice).toBe(57.5);
      expect(result.totalCost).toBe(34.5);
      expect(result.totalPrice).toBe(57.5);
      expect(result.netMarginAmount).toBe(23.0);
      expect(result.profitMargin).toBe(40.0);
      expect(result.discountPercentage).toBe(0);

      // Verify BOM items
      expect(result.costBreakdown.bom_items.length).toBeGreaterThanOrEqual(4);
      expect(
        result.costBreakdown.bom_items.some((b) => b.category === "MATERIAL")
      ).toBe(true);
      expect(
        result.costBreakdown.bom_items.some((b) => b.category === "LABOR")
      ).toBe(true);
      expect(
        result.costBreakdown.bom_items.some((b) => b.category === "MACHINE")
      ).toBe(true);
      expect(
        result.costBreakdown.bom_items.some((b) => b.category === "SETUP")
      ).toBe(true);
    });

    it("should allow overriding the margin percentage dynamically", () => {
      // Cost = 34.50
      // Custom margin = 50% -> Base price = 34.50 / (1 - 0.50) = 69.00
      const result = calculateCpqPrice({
        matrix: mockAreaMatrix,
        costSettings: mockCostSettings,
        dimensions: { width: 100, height: 200, unit: "cm" },
        quantity: 1,
        customMarginPercentage: 50,
      });

      expect(result.unitCost).toBe(34.5);
      expect(result.unitPrice).toBe(69.0);
      expect(result.netMarginAmount).toBe(34.5);
      expect(result.profitMargin).toBe(50.0);
    });
  });

  describe("calculateCpqPrice with Attribute Options & Volume Tiers", () => {
    const mockUnitaryMatrix: CpqPricingMatrix = {
      id: "matrix-sublimation",
      tenant_id: "tenant-1",
      name: "Taza Personalizada Sublimada",
      calculation_type: "UNITARY_CUSTOM",
      min_billable_unit: 1,
      base_material_cost_per_unit: 1.5, // Taza en blanco
      base_labor_minutes: 5, // Preparar diseño
      setup_fee: 2.0, // Calibración de prensa
      waste_factor: 0.05, // 5% merma
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockOptions: CpqAttributeOption[] = [
      {
        id: "opt-1",
        matrix_id: "matrix-sublimation",
        attribute_name: "Caja de Regalo",
        label: "Caja Kraft con Ventana",
        material_cost: 0.8,
        labor_minutes: 2,
        is_default: false,
        created_at: new Date().toISOString(),
      },
      {
        id: "opt-2",
        matrix_id: "matrix-sublimation",
        attribute_name: "Tinta",
        label: "Tinta Metalizada Oro",
        material_cost: 0.5,
        labor_minutes: 3,
        is_default: false,
        created_at: new Date().toISOString(),
      },
    ];

    const mockVolumeTiers: CpqVolumeTier[] = [
      {
        id: "tier-1",
        matrix_id: "matrix-sublimation",
        min_quantity: 1,
        max_quantity: 11,
        discount_percentage: 0,
        created_at: new Date().toISOString(),
      },
      {
        id: "tier-2",
        matrix_id: "matrix-sublimation",
        min_quantity: 12,
        max_quantity: 49,
        discount_percentage: 15,
        created_at: new Date().toISOString(),
      },
      {
        id: "tier-3",
        matrix_id: "matrix-sublimation",
        min_quantity: 50,
        max_quantity: null,
        discount_percentage: 30,
        created_at: new Date().toISOString(),
      },
    ];

    it("should include attribute options in materials and labor calculation", () => {
      // Base materials = 1.50
      // Options materials = 0.80 + 0.50 = 1.30
      // Raw materials = 2.80
      // Waste (5%): 2.80 * 0.05 = 0.14 -> Total materials = 2.94
      // Labor minutes: 5 (base) + 2 + 3 = 10 minutes
      // Labor cost: (10/60) * 20 = 3.333...
      // Machine cost: (10/60) * 10 = 1.666...
      // Setup fee: 2.0
      // Total unit cost = 2.94 + 3.333... + 1.666... + 2.0 = 9.94
      // Margin: 40% -> Base unit price = 9.94 / (1 - 0.40) = 9.94 / 0.60 = 16.57
      const result = calculateCpqPrice({
        matrix: mockUnitaryMatrix,
        costSettings: mockCostSettings,
        selectedOptions: mockOptions,
        volumeTiers: mockVolumeTiers,
        quantity: 1,
      });

      expect(result.costBreakdown.materials).toBe(2.94);
      expect(result.costBreakdown.labor).toBe(3.33);
      expect(result.costBreakdown.machine).toBe(1.67);
      expect(result.costBreakdown.setup).toBe(2.0);
      expect(result.unitCost).toBe(9.94);
      expect(result.baseUnitPrice).toBe(16.57);
      expect(result.unitPrice).toBe(16.57);
      expect(result.discountPercentage).toBe(0);
    });

    it("should apply 15% scale discount for quantity in tier 2 (12-49 units)", () => {
      // Base unit price = 16.57
      // 15% discount -> 16.57 * (1 - 0.15) = 14.0845 -> 14.08
      const qty = 20;
      const result = calculateCpqPrice({
        matrix: mockUnitaryMatrix,
        costSettings: mockCostSettings,
        selectedOptions: mockOptions,
        volumeTiers: mockVolumeTiers,
        quantity: qty,
      });

      expect(result.discountPercentage).toBe(15);
      expect(result.baseUnitPrice).toBe(16.57);
      expect(result.unitPrice).toBe(14.08);
      expect(result.totalPrice).toBe(281.63);
      expect(result.totalCost).toBe(198.8);
      expect(result.netMarginAmount).toBe(round(result.totalPrice - result.totalCost, 2));
    });

    it("should apply 30% scale discount for volume tier 3 (50+ units)", () => {
      const qty = 100;
      const result = calculateCpqPrice({
        matrix: mockUnitaryMatrix,
        costSettings: mockCostSettings,
        selectedOptions: mockOptions,
        volumeTiers: mockVolumeTiers,
        quantity: qty,
      });

      expect(result.discountPercentage).toBe(30);
      expect(result.unitPrice).toBe(round(16.57 * 0.7, 2)); // 11.60
      expect(result.totalCost).toBe(994.0);
    });
  });

  describe("Margin and Edge Cases", () => {
    it("should handle 0% margin correctly without error", () => {
      const result = calculateCpqPrice({
        matrix: mockAreaMatrix,
        costSettings: mockCostSettings,
        customMarginPercentage: 0,
      });

      expect(result.baseUnitPrice).toBe(result.unitCost);
      expect(result.profitMargin).toBe(0);
      expect(result.netMarginAmount).toBe(0);
    });

    it("should clamp extreme margin percentage to 99.9% to prevent division by zero", () => {
      const result = calculateCpqPrice({
        matrix: mockAreaMatrix,
        costSettings: mockCostSettings,
        customMarginPercentage: 100, // clamped to 99.9%
      });

      expect(Number.isFinite(result.baseUnitPrice)).toBe(true);
      expect(result.baseUnitPrice).toBeGreaterThan(result.unitCost);
    });
  });
});
