import { describe, it, expect } from "vitest";
import {
  formatWhatsAppQuoteMessage,
  buildWhatsAppQuoteUrl,
  formatWhatsAppBalanceReminderMessage,
  buildWhatsAppBalanceReminderUrl,
} from "./quote-sharing";
import { CpqQuote, CpqQuoteItem } from "@marketos/types";


describe("WhatsApp Quote Message Formatter", () => {
  const mockQuote: CpqQuote = {
    id: "q-1",
    tenant_id: "t-1",
    quote_number: "COT-2026-0042",
    customer_name: "Carlos Mendoza",
    customer_phone: "+584121234567",
    status: "DRAFT",
    total_cost: 45.0,
    total_price: 120.0,
    net_margin_amount: 75.0,
    deposit_percentage: 40.0, // 40% custom deposit!
    deposit_amount: 48.0,
  };

  const mockItems: CpqQuoteItem[] = [
    {
      id: "it-1",
      quote_id: "q-1",
      product_id: "p-1",
      product_name: "Letrero Acrílico 3D",
      dimensions: { width: 120, height: 60, unit: "cm" },
      selected_attributes: { Material: "Acrílico 5mm", Iluminación: "LED Neón Blanco" },
      cost_breakdown: {} as any,
      unit_cost: 45.0,
      unit_price: 120.0,
      quantity: 1,
      total_price: 120.0,
    },
  ];

  it("formats quote with custom configurable deposit percentage (e.g. 40%)", () => {
    const msg = formatWhatsAppQuoteMessage({
      quote: mockQuote,
      items: mockItems,
      businessName: "Acrílicos del Centro",
    });

    expect(msg).toContain("PRESUPUESTO #COT-2026-0042");
    expect(msg).toContain("Acrílicos del Centro");
    expect(msg).toContain("Carlos Mendoza");
    expect(msg).toContain("Medidas: 120 × 60 cm");
    expect(msg).toContain("Material: Acrílico 5mm");
    expect(msg).toContain("TOTAL: $120.00");
    expect(msg).toContain("Anticipo requerido para iniciar (40%): $48.00");
    expect(msg).toContain("Saldo contra entrega: $72.00");
  });

  it("builds a valid wa.me URL with properly encoded message", () => {
    const url = buildWhatsAppQuoteUrl("+58 412 123 4567", {
      quote: mockQuote,
      items: mockItems,
    });

    expect(url.startsWith("https://wa.me/584121234567?text=")).toBe(true);
    expect(url).toContain(encodeURIComponent("COT-2026-0042"));
  });

  it("formats balance reminder message and builds valid reminder URL", () => {
    const reminderMsg = formatWhatsAppBalanceReminderMessage({

      orderNumber: "ORD-9981",
      customerName: "Carlos Mendoza",
      businessName: "Acrílicos del Centro",
      totalAmount: 120.0,
      paidAmount: 48.0,
      pendingBalance: 72.0,
      paymentInstructions: "Pago Móvil Banesco 04121234567 CI 12345678",
    });

    expect(reminderMsg).toContain("LIQUIDACIÓN DE SALDO");
    expect(reminderMsg).toContain("ORD-9981");

    expect(reminderMsg).toContain("Carlos Mendoza");
    expect(reminderMsg).toContain("*Total Orden:* $120.00");
    expect(reminderMsg).toContain("*Anticipo Abonado:* $48.00");
    expect(reminderMsg).toContain("*Saldo Restante para Entrega:* $72.00");
    expect(reminderMsg).toContain("Pago Móvil");


    const reminderUrl = buildWhatsAppBalanceReminderUrl("+58 412 123 4567", {
      orderNumber: "ORD-9981",
      totalAmount: 120.0,
      paidAmount: 48.0,
      pendingBalance: 72.0,
    });
    expect(reminderUrl.startsWith("https://wa.me/584121234567?text=")).toBe(true);
    expect(reminderUrl).toContain(encodeURIComponent("ORD-9981"));
  });
});

