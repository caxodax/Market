import type { CraftQuote } from "@marketos/types";

export interface FormatWhatsAppQuoteOptions {
  quote: CraftQuote;
  businessName?: string;
  businessPhone?: string;
  currencySymbol?: string;
  bankDetails?: string;
}

/**
 * Genera el texto formateado para WhatsApp con alta conversión visual y desglose del 50% de anticipo.
 */
export function formatWhatsAppQuoteMessage(options: FormatWhatsAppQuoteOptions): string {
  const { quote, businessName = "Taller Creativo", currencySymbol = "$", bankDetails } = options;

  const totalBase = quote.total_base.toFixed(2);
  const totalSec = quote.total_secondary.toFixed(2);
  const depositBase = quote.deposit_required_base.toFixed(2);
  const depositSec = (quote.deposit_required_base * quote.exchange_rate_applied).toFixed(2);
  const pendingBase = (quote.total_base - quote.deposit_required_base).toFixed(2);

  const lines: string[] = [];

  lines.push(`🎨 *${businessName.toUpperCase()}* | *PRESUPUESTO DE TALLER*`);
  lines.push(`📄 *N° de Cotización:* ${quote.quote_number}`);
  if (quote.customer_name) {
    lines.push(`👤 *Cliente:* ${quote.customer_name}`);
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("📋 *DETALLE DE TU PEDIDO:*");

  quote.items.forEach((item, idx) => {
    lines.push(
      `${idx + 1}. *${item.name}*` +
        (item.is_free_item ? " (🎁 CORTESÍA)" : "")
    );
    lines.push(
      `   Cant: ${item.quantity} | Unit: ${currencySymbol}${item.unit_price_base.toFixed(2)} | Subtotal: *${currencySymbol}${item.subtotal_base.toFixed(2)}*`
    );
    if (item.notes) {
      lines.push(`   _Nota: ${item.notes}_`);
    }
  });

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`💵 *Subtotal:* ${currencySymbol}${quote.subtotal_base.toFixed(2)}`);

  if (quote.shipping_cost_base > 0) {
    lines.push(`🚚 *Envío / Empaque:* ${currencySymbol}${quote.shipping_cost_base.toFixed(2)}`);
  }

  if (quote.shipping_notes) {
    lines.push(`📍 *Destino:* ${quote.shipping_notes}`);
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`⭐ *TOTAL GENERAL:* *${currencySymbol}${totalBase}* (Bs. ${totalSec})`);
  lines.push(`📈 *Tasa aplicada:* ${quote.exchange_rate_applied.toFixed(2)} Bs/$`);
  lines.push("");
  lines.push(`🔒 *ANTICIPO REQUERIDO (50%):* *${currencySymbol}${depositBase}* (Bs. ${depositSec})`);
  lines.push(`📦 *Saldo restante al retirar:* ${currencySymbol}${pendingBase}`);
  lines.push("");
  lines.push("⚠️ _Los trabajos personalizados requieren el 50% de abono para dar inicio al diseño e impresión de taller._");

  if (bankDetails) {
    lines.push("");
    lines.push("💳 *DATOS DE PAGO:*");
    lines.push(bankDetails);
  }

  lines.push("");
  lines.push("¿Deseas confirmar este pedido para apartar tus materiales en taller?");

  return lines.join("\n");
}

/**
 * Genera el enlace wa.me para abrir la conversación de WhatsApp con el mensaje prellenado.
 */
export function buildWhatsAppLink(phone: string, text: string): string {
  const cleanPhone = phone.replace(/\D/g, "");
  const encodedText = encodeURIComponent(text);

  if (!cleanPhone) {
    return `https://wa.me/?text=${encodedText}`;
  }

  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}
