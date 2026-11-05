import { describe, it, expect } from "vitest";
import {
  calculateUnitCost,
  calculateItemCost,
  calculateDirectCost,
  calculateSellingPrice,
  calculateNetProfit,
  calculateQuoteDeposit,
  convertBimonetary,
} from "./craft-pricing-engine";

describe("Craft Workshop Pricing Engine", () => {
  describe("calculateUnitCost", () => {
    it("should calculate exact unit cost with 4 decimal places", () => {
      // 1 caja de 36 tazas a $45.00 => $1.2500 por taza
      const unitCost = calculateUnitCost(45, 36);
      expect(unitCost).toBe(1.25);
    });

    it("should handle odd divisions with 4 decimal rounding", () => {
      // 1 resma de 100 hojas de sublimación a $12.50 => $0.1250 por hoja
      const unitCost = calculateUnitCost(12.5, 100);
      expect(unitCost).toBe(0.125);
    });

    it("should return 0 when pack quantity is 0 or negative", () => {
      expect(calculateUnitCost(45, 0)).toBe(0);
      expect(calculateUnitCost(45, -5)).toBe(0);
    });
  });

  describe("calculateItemCost", () => {
    it("should multiply unit cost by quantity consumed", () => {
      // 2 hojas a $0.1250 => $0.2500
      expect(calculateItemCost(0.125, 2)).toBe(0.25);
    });

    it("should return 0 when quantity is 0", () => {
      expect(calculateItemCost(1.25, 0)).toBe(0);
    });
  });

  describe("calculateDirectCost", () => {
    it("should apply waste percentage and labor cost correctly", () => {
      // Materiales = $10.00, Merma = 5%, Mano de obra = $2.00
      // 10 * 1.05 = 10.50 + 2.00 = 12.50
      const cost = calculateDirectCost(10, 5, 2);
      expect(cost).toBe(12.5);
    });

    it("should handle default 5% waste and 0 labor", () => {
      // 10 * 1.05 = 10.50
      expect(calculateDirectCost(10)).toBe(10.5);
    });

    it("should prevent negative waste or negative labor", () => {
      expect(calculateDirectCost(10, -10, -5)).toBe(10);
    });
  });

  describe("calculateSellingPrice", () => {
    it("should calculate price based on MARGIN (on selling price)", () => {
      // Direct Cost = $12.50, Margin = 30%
      // 12.50 / (1 - 0.30) = 12.50 / 0.70 = 17.857... => 17.86
      const price = calculateSellingPrice(12.5, "MARGIN", 30);
      expect(price).toBe(17.86);
    });

    it("should calculate price based on MARKUP (on cost)", () => {
      // Direct Cost = $12.50, Markup = 30%
      // 12.50 * 1.30 = 16.25
      const price = calculateSellingPrice(12.5, "MARKUP", 30);
      expect(price).toBe(16.25);
    });

    it("should cap extreme margin at 95% to avoid division by zero", () => {
      const price = calculateSellingPrice(10, "MARGIN", 100);
      // 10 / (1 - 0.95) = 10 / 0.05 = 200
      expect(price).toBe(200);
    });

    it("should return 0 when direct cost is 0 or negative", () => {
      expect(calculateSellingPrice(0, "MARGIN", 30)).toBe(0);
      expect(calculateSellingPrice(-5, "MARKUP", 30)).toBe(0);
    });
  });

  describe("calculateNetProfit", () => {
    it("should calculate profit base and actual margin percentage", () => {
      const profit = calculateNetProfit(20, 12);
      expect(profit.profitBase).toBe(8);
      // 8 / 20 = 40%
      expect(profit.marginRealPercentage).toBe(40);
    });

    it("should handle zero selling price without NaN", () => {
      const profit = calculateNetProfit(0, 10);
      expect(profit.profitBase).toBe(-10);
      expect(profit.marginRealPercentage).toBe(0);
    });
  });

  describe("calculateQuoteDeposit", () => {
    it("should calculate exactly 50% deposit and remaining balance", () => {
      const deposit = calculateQuoteDeposit(100, 50);
      expect(deposit.depositRequiredBase).toBe(50);
      expect(deposit.pendingBalanceBase).toBe(50);
    });

    it("should round cents correctly for odd totals", () => {
      // Total $35.75 -> 50% is 17.875 => $17.88 deposit, $17.87 balance
      const deposit = calculateQuoteDeposit(35.75, 50);
      expect(deposit.depositRequiredBase).toBe(17.88);
      expect(deposit.pendingBalanceBase).toBe(17.87);
      expect(deposit.depositRequiredBase + deposit.pendingBalanceBase).toBe(35.75);
    });
  });

  describe("convertBimonetary", () => {
    it("should convert USD base to secondary currency (VES)", () => {
      const ves = convertBimonetary(10, 45.5);
      expect(ves).toBe(455.0);
    });

    it("should return base amount if exchange rate is invalid or zero", () => {
      expect(convertBimonetary(10, 0)).toBe(10);
      expect(convertBimonetary(10, -1)).toBe(10);
    });
  });
});
