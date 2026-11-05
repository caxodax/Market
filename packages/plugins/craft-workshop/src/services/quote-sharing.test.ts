import { describe, it, expect } from "vitest";
import { formatWhatsAppQuoteMessage, buildWhatsAppLink } from "./quote-sharing";
import type { CraftQuote } from "@marketos/types";

describe("Quote Sharing Service", () => {
  const mockQuote: CraftQuote = {
    id: "quote-1",
    tenant_id: "printopink",
    quote_number: "COT-2026-0001",
    customer_name: "María Gómez",
    customer_phone: "+58 412 1234567",
    subtotal_base: 50.0,
    shipping_cost_base: 5.0,
    shipping_notes: "Envío express a Chacao con Yummy",
    total_base: 55.0,
    base_currency: "USD",
    exchange_rate_applied: 45.0,
    total_secondary: 2475.0,
    deposit_percentage: 50.0,
    deposit_required_base: 27.5,
    status: "draft",
    items: [
      {
        recipe_id: "rec-1",
        name: "Taza Personalizada Sublimada 11oz",
        quantity: 2,
        unit_price_base: 15.0,
        subtotal_base: 30.0,
        is_free_item: false,
        notes: "Diseño con foto y nombre dorado",
      },
      {
        name: "Caja de Regalo con Moño Kraft",
        quantity: 2,
        unit_price_base: 10.0,
        subtotal_base: 20.0,
        is_free_item: false,
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  describe("formatWhatsAppQuoteMessage", () => {
    it("should format quote with customer name, items, 50% deposit and bimonetary totals", () => {
      const message = formatWhatsAppQuoteMessage({
        quote: mockQuote,
        businessName: "Printopink Taller Creativo",
        currencySymbol: "$",
        bankDetails: "Pago Móvil: Banesco 0134 - 04121234567 - V-12345678",
      });

      expect(message).toContain("PRINTOPINK TALLER CREATIVO");
      expect(message).toContain("N° de Cotización:* COT-2026-0001");
      expect(message).toContain("Cliente:* María Gómez");
      expect(message).toContain("Taza Personalizada Sublimada 11oz");
      expect(message).toContain("Diseño con foto y nombre dorado");
      expect(message).toContain("Subtotal:* $50.00");
      expect(message).toContain("Envío / Empaque:* $5.00");
      expect(message).toContain("TOTAL GENERAL:* *$55.00* (Bs. 2475.00)");
      expect(message).toContain("ANTICIPO REQUERIDO (50%):* *$27.50* (Bs. 1237.50)");
      expect(message).toContain("Saldo restante al retirar:* $27.50");
      expect(message).toContain("Pago Móvil: Banesco 0134");
    });

    it("should flag courtesy free items", () => {
      const quoteWithFreeItem: CraftQuote = {
        ...mockQuote,
        items: [
          {
            name: "Llavero Acrílico Obsequio",
            quantity: 1,
            unit_price_base: 0,
            subtotal_base: 0,
            is_free_item: true,
          },
        ],
      };

      const message = formatWhatsAppQuoteMessage({
        quote: quoteWithFreeItem,
      });

      expect(message).toContain("(🎁 CORTESÍA)");
    });
  });

  describe("buildWhatsAppLink", () => {
    it("should clean phone number formatting and produce valid wa.me url", () => {
      const link = buildWhatsAppLink("+58 (412) 123-4567", "Hola taller");
      expect(link).toBe("https://wa.me/584121234567?text=Hola%20taller");
    });

    it("should build universal link if phone is empty", () => {
      const link = buildWhatsAppLink("", "Hola taller");
      expect(link).toBe("https://wa.me/?text=Hola%20taller");
    });
  });
});
