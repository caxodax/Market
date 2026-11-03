import { describe, it, expect } from "vitest";
import {
  Product,
  ProductModifierGroup,
  ProductModifierOption,
  SelectedModifier,
} from "@marketos/types";

describe("Food Service Modifiers & Up-selling Pricing Engine", () => {
  const baseBurger = {
    id: "prod-burger",
    tenant_id: "tenant-1",
    name: "Hamburguesa Clásica",
    price_usd: 5.0,
  };

  const burgerExtrasGroup: ProductModifierGroup = {
    id: "grp-extras",
    tenant_id: "tenant-1",
    name: "Extras & Ingredientes Adicionales",
    badge: "EXTRAS",
    required: false,
    min_selectable: 0,
    max_selectable: 5,
    sort_order: 1,
    is_active: true,
    options: [
      { id: "opt-cheese", name: "Queso extra", price_adjustment_usd: 0.5 },
      { id: "opt-pickles", name: "Pepinillos agridulces", price_adjustment_usd: 0.7 },
      { id: "opt-bacon", name: "Tocineta crujiente", price_adjustment_usd: 1.0, badge: "POPULAR" },
      { id: "opt-patty", name: "Carne extra 150g", price_adjustment_usd: 1.5, badge: "TOP" },
    ],
  };

  const comboUpsellGroup: ProductModifierGroup = {
    id: "grp-combos",
    tenant_id: "tenant-1",
    name: "🔥 Hazlo Combo",
    description: "Añade papas fritas y bebida por un precio especial",
    badge: "COMBO",
    required: false,
    min_selectable: 0,
    max_selectable: 1,
    sort_order: 2,
    is_active: true,
    options: [
      {
        id: "opt-combo-std",
        name: "Combo Clásico: Papas Fritas + Bebida",
        price_adjustment_usd: 2.0,
        badge: "COMBO",
        is_upsell: true,
      },
      {
        id: "opt-combo-pro",
        name: "Combo Brutal: Papas Cheddar/Bacon + Bebida",
        price_adjustment_usd: 3.5,
        badge: "PROMO",
        is_upsell: true,
      },
    ],
  };

  it("calculates accurate total when multiple extra ingredients are added", () => {
    const selectedOptionIds = ["opt-cheese", "opt-pickles", "opt-bacon", "opt-patty"];
    let unitPrice = baseBurger.price_usd;

    for (const optId of selectedOptionIds) {
      const opt = burgerExtrasGroup.options.find((o) => o.id === optId);
      if (opt) unitPrice += opt.price_adjustment_usd;
    }

    // $5.00 base + 0.50 (queso) + 0.70 (pepinillos) + 1.00 (tocineta) + 1.50 (carne) = $8.70
    expect(Number(unitPrice.toFixed(2))).toBe(8.7);
  });

  it("calculates accurate cross-selling up-sell combo price", () => {
    let unitPrice = baseBurger.price_usd;
    const selectedCombo = comboUpsellGroup.options.find((o) => o.id === "opt-combo-std");
    expect(selectedCombo).toBeDefined();

    unitPrice += selectedCombo!.price_adjustment_usd;
    // $5.00 base + $2.00 combo = $7.00
    expect(unitPrice).toBe(7.0);
  });

  it("correctly combines combo up-sell and extra ingredients simultaneously", () => {
    let unitPrice = baseBurger.price_usd;

    // Client selects Combo (+2.00) + Extra Bacon (+1.00) + Extra Cheese (+0.50)
    const combo = comboUpsellGroup.options.find((o) => o.id === "opt-combo-std");
    const bacon = burgerExtrasGroup.options.find((o) => o.id === "opt-bacon");
    const cheese = burgerExtrasGroup.options.find((o) => o.id === "opt-cheese");

    unitPrice += combo!.price_adjustment_usd + bacon!.price_adjustment_usd + cheese!.price_adjustment_usd;

    // $5.00 base + $2.00 combo + $1.00 bacon + $0.50 cheese = $8.50
    expect(unitPrice).toBe(8.5);
  });
});
