import { CpqQuote, CpqQuoteItem } from "@marketos/types";

export interface FormatWhatsAppQuoteInput {
  quote: CpqQuote;
  items?: CpqQuoteItem[];
  businessName?: string;
  currencySymbol?: string;
  customerPhone?: string;
  paymentInstructions?: string;
}

/**
 * Formats a formal MTO Quote into an attractive, high-converting WhatsApp message.
 */
export function formatWhatsAppQuoteMessage(input: FormatWhatsAppQuoteInput): string {
  const {
    quote,
    items = [],
    businessName = "Taller & Fabricación",
    currencySymbol = "$",
    paymentInstructions,
  } = input;

  const depositPct = quote.deposit_percentage || 50;
  const depositAmount = quote.deposit_amount || (quote.total_price * depositPct) / 100;
  const pendingBalance = Math.max(0, quote.total_price - depositAmount);

  const lines: string[] = [
    `📐 *PRESUPUESTO #${quote.quote_number}*`,
    `🏢 *${businessName}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
  ];

  if (quote.customer_name) {
    lines.push(`👤 *Cliente:* ${quote.customer_name}`);
  }

  lines.push(`📅 *Fecha:* ${new Date(quote.created_at || Date.now()).toLocaleDateString()}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📋 *DETALLE DE FABRICACIÓN:*`);

  if (items.length > 0) {
    items.forEach((item, idx) => {
      lines.push(`\n*${idx + 1}. ${item.product_name || "Producto a Medida"}*`);

      // Dimensions
      if (item.dimensions) {
        const d = item.dimensions;
        const u = d.unit || "cm";
        if (d.width && d.height) {
          lines.push(`   • Medidas: ${d.width} × ${d.height} ${u}`);
        } else if (d.length || d.width) {
          lines.push(`   • Longitud: ${d.length || d.width} ${u}`);
        }
      }

      // Attributes
      if (item.selected_attributes && Object.keys(item.selected_attributes).length > 0) {
        Object.entries(item.selected_attributes).forEach(([key, val]) => {
          lines.push(`   • ${key}: ${val}`);
        });
      }

      lines.push(`   • Cantidad: ${item.quantity} u.`);
      lines.push(`   • Subtotal: ${currencySymbol}${item.total_price.toFixed(2)}`);
    });
  } else {
    lines.push(`• Importe cotizado: ${currencySymbol}${quote.total_price.toFixed(2)}`);
  }

  lines.push(`\n━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`💰 *TOTAL: ${currencySymbol}${quote.total_price.toFixed(2)}*`);
  lines.push(`💳 *Anticipo requerido para iniciar (${depositPct}%): ${currencySymbol}${depositAmount.toFixed(2)}*`);
  lines.push(`📦 *Saldo contra entrega: ${currencySymbol}${pendingBalance.toFixed(2)}*`);

  if (paymentInstructions) {
    lines.push(`\n🏦 *Datos de Pago:*\n${paymentInstructions}`);
  }

  lines.push(`\n_Presupuesto válido por 7 días._`);
  lines.push(`_Para confirmar tu orden, por favor respóndenos a este mensaje con tu comprobante de anticipo._`);

  return lines.join("\n");
}

/**
 * Builds a direct wa.me link with encoded quote text.
 */
export function buildWhatsAppQuoteUrl(
  phone: string,
  input: FormatWhatsAppQuoteInput
): string {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const text = formatWhatsAppQuoteMessage(input);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export interface FormatWhatsAppBalanceReminderInput {
  orderNumber?: string;
  customerName?: string;
  businessName?: string;
  currencySymbol?: string;
  totalAmount: number;
  paidAmount: number;
  pendingBalance: number;
  paymentInstructions?: string;
}

/**
 * Formats a respectful, clear WhatsApp message requesting balance settlement before dispatch.
 */
export function formatWhatsAppBalanceReminderMessage(
  input: FormatWhatsAppBalanceReminderInput
): string {
  const {
    orderNumber,
    customerName,
    businessName = "Taller & Fabricación",
    currencySymbol = "$",
    totalAmount,
    paidAmount,
    pendingBalance,
    paymentInstructions,
  } = input;

  const lines: string[] = [
    `🔔 *NOTIFICACIÓN DE PEDIDO / LIQUIDACIÓN DE SALDO*`,
    `🏢 *${businessName}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
  ];

  if (customerName) {
    lines.push(`Hola *${customerName}*,`);
  }

  lines.push(
    `Le informamos que su pedido ${
      orderNumber ? `#${orderNumber}` : "de fabricación a medida"
    } está listo o en fase final para entrega.`
  );
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`💰 *Total Orden:* ${currencySymbol}${totalAmount.toFixed(2)}`);
  lines.push(`✅ *Anticipo Abonado:* ${currencySymbol}${paidAmount.toFixed(2)}`);
  lines.push(`📦 *Saldo Restante para Entrega:* ${currencySymbol}${pendingBalance.toFixed(2)}`);

  if (paymentInstructions) {
    lines.push(`\n🏦 *Datos para Liquidar Saldo:*\n${paymentInstructions}`);
  }

  lines.push(`\n_Por favor envíenos el comprobante de pago por este medio para autorizar el despacho inmediato._`);
  lines.push(`¡Muchas gracias por su preferencia! ✨`);

  return lines.join("\n");
}

/**
 * Builds a direct wa.me URL with encoded balance settlement reminder.
 */
export function buildWhatsAppBalanceReminderUrl(
  phone: string,
  input: FormatWhatsAppBalanceReminderInput
): string {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const text = formatWhatsAppBalanceReminderMessage(input);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

