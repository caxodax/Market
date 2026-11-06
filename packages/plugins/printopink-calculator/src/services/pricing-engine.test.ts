import { describe, it, expect } from "vitest";
import {
  calculateMaterialsCost,
  calculateTotalProductionCost,
  calculateSellingPriceFromMargin,
  calculateNetProfit,
  calculateQuoteDeposit,
  convertBimonetary,
  formatPrintopinkWhatsAppQuote,
} from "./pricing-engine";
import { PRINTOPINK_FACTORY_PRESETS } from "../presets/printopink-presets";

describe("PrintoPink Pricing Engine (Pruebas Unitarias de Guía Oficial)", () => {
  it("debe calcular correctamente los costos de Etiquetas Adhesivas (Página 1 del PDF)", () => {
    const stickerPreset = PRINTOPINK_FACTORY_PRESETS.find((p) => p.id === "stickers_photo")!;
    expect(stickerPreset).toBeDefined();

    const materials = calculateMaterialsCost(stickerPreset.defaultMaterials);
    expect(materials).toBe(0.55);

    const totalCost = calculateTotalProductionCost(
      materials,
      stickerPreset.defaultMachineryCost,
      stickerPreset.defaultLaborCost,
      stickerPreset.defaultWastePercentage
    );
    expect(totalCost).toBe(1.2);

    const profit = calculateNetProfit(stickerPreset.suggestedPrice, totalCost);
    expect(profit.netProfit).toBe(0.6);
    expect(profit.marginPercentage).toBe(33.3);
  });

  it("debe calcular correctamente Impresión Negro vs Color (Página 2 del PDF)", () => {
    // Impresión Negro
    const blackPreset = PRINTOPINK_FACTORY_PRESETS.find((p) => p.id === "paper_print_black")!;
    const matBlack = calculateMaterialsCost(blackPreset.defaultMaterials);
    expect(matBlack).toBeCloseTo(0.032, 3);
    const costBlack = calculateTotalProductionCost(
      matBlack,
      blackPreset.defaultMachineryCost,
      blackPreset.defaultLaborCost
    );
    expect(costBlack).toBe(0.38);

    // Impresión Color
    const colorPreset = PRINTOPINK_FACTORY_PRESETS.find((p) => p.id === "paper_print_color")!;
    const matColor = calculateMaterialsCost(colorPreset.defaultMaterials);
    expect(matColor).toBeCloseTo(0.112, 3);
    const costColor = calculateTotalProductionCost(
      matColor,
      colorPreset.defaultMachineryCost,
      colorPreset.defaultLaborCost
    );
    expect(costColor).toBe(0.76);
  });

  it("debe calcular correctamente Plastificado Tipo Carnet (Página 2-3 del PDF)", () => {
    const badgePreset = PRINTOPINK_FACTORY_PRESETS.find((p) => p.id === "lamination_badge")!;
    const materials = calculateMaterialsCost(badgePreset.defaultMaterials);
    expect(materials).toBe(0.08);

    const totalCost = calculateTotalProductionCost(
      materials,
      badgePreset.defaultMachineryCost,
      badgePreset.defaultLaborCost
    );
    expect(totalCost).toBe(0.23);

    const profitIndividual = calculateNetProfit(badgePreset.suggestedPrice, totalCost);
    expect(profitIndividual.netProfit).toBe(0.52);

    const profitWholesale = calculateNetProfit(badgePreset.wholesalePrice!, totalCost);
    expect(profitWholesale.netProfit).toBe(0.27);
  });

  it("debe calcular correctamente Estampado Textil: Vinil vs Sublimación (Página 3 del PDF)", () => {
    // Vinil 1 lado
    const vinyl1 = PRINTOPINK_FACTORY_PRESETS.find((p) => p.id === "textile_vinyl_1side")!;
    const matVinyl1 = calculateMaterialsCost(vinyl1.defaultMaterials);
    expect(matVinyl1).toBe(2.22);
    const costVinyl1 = calculateTotalProductionCost(
      matVinyl1,
      vinyl1.defaultMachineryCost,
      vinyl1.defaultLaborCost
    );
    expect(costVinyl1).toBe(4.62);

    // Sublimación Directa 1 lado
    const direct1 = PRINTOPINK_FACTORY_PRESETS.find((p) => p.id === "textile_direct_1side")!;
    const matDirect1 = calculateMaterialsCost(direct1.defaultMaterials);
    expect(matDirect1).toBe(0.4);
    const costDirect1 = calculateTotalProductionCost(
      matDirect1,
      direct1.defaultMachineryCost,
      direct1.defaultLaborCost
    );
    expect(costDirect1).toBe(1.15);
  });

  it("debe calcular el 50% de anticipo para cotizaciones de taller", () => {
    const total = 50.0;
    const { depositRequiredBase, pendingBalanceBase } = calculateQuoteDeposit(total, 50);

    expect(depositRequiredBase).toBe(25.0);
    expect(pendingBalanceBase).toBe(25.0);
  });

  it("debe convertir bimonetario con tasa oficial BCV", () => {
    const amount = 10.0;
    const exchangeRate = 45.0;
    expect(convertBimonetary(amount, exchangeRate)).toBe(450.0);
  });

  it("debe formatear el mensaje de WhatsApp con el llamado del 50% de abono", () => {
    const msg = formatPrintopinkWhatsAppQuote({
      storeName: "PrintoPink",
      quoteNumber: "PP-001",
      customerName: "Camila Rojas",
      items: [
        { title: "Etiquetas Adhesivas A4", unitPriceBase: 1.8, quantity: 10, subtotalBase: 18.0 },
      ],
      totalBase: 18.0,
      depositRequiredBase: 9.0,
      pendingBalanceBase: 9.0,
      exchangeRate: 50.0,
    });

    expect(msg).toContain("PRESUPUESTO OFICIAL");
    expect(msg).toContain("Camila Rojas");
    expect(msg).toContain("$18.00 USD");
    expect(msg).toContain("Bs. 900.00");
    expect(msg).toContain("ANTICIPO 50% PARA INICIAR PRODUCCIÓN:* *$9.00 USD*");
  });
});
