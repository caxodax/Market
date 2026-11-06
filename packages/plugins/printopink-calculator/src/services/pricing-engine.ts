import type { PrintopinkMaterialItem } from "@marketos/types";

/**
 * Calcula la suma de materiales directos.
 */
export function calculateMaterialsCost(materials: readonly PrintopinkMaterialItem[]): number {
  const sum = materials.reduce((acc, it) => {
    const qty = it.qty !== undefined ? it.qty : 1;
    const sub = it.subtotal !== undefined ? it.subtotal : it.cost * qty;
    return acc + sub;
  }, 0);
  return Math.round(sum * 10000) / 10000;
}

/**
 * Calcula el Costo Total de Producción según la Tríada del Documento PrintoPink:
 * Total = (Materiales × (1 + % Merma / 100)) + Desgaste de Maquinaria + Mano de Obra
 */
export function calculateTotalProductionCost(
  materialsCost: number,
  machineryCost: number,
  laborCost: number,
  wastePercentage = 0
): number {
  const wasteMultiplier = 1 + Math.max(0, wastePercentage) / 100;
  const materialsWithWaste = materialsCost * wasteMultiplier;
  const total = materialsWithWaste + Math.max(0, machineryCost) + Math.max(0, laborCost);
  return Math.round(total * 100) / 100;
}

/**
 * Calcula el PVP sugerido a partir de un margen de ganancia comercial sobre venta:
 * PVP = Costo / (1 - Margen % / 100)
 */
export function calculateSellingPriceFromMargin(
  totalCost: number,
  marginPercentage = 35
): number {
  if (totalCost <= 0) return 0;
  const safeMargin = Math.min(Math.max(0, marginPercentage), 95) / 100;
  if (safeMargin >= 1) return totalCost;
  return Math.round((totalCost / (1 - safeMargin)) * 100) / 100;
}

/**
 * Calcula la Ganancia Neta Libre y el porcentaje de margen real efectivo:
 * Ganancia Neta = PVP - Costo Total de Producción
 */
export function calculateNetProfit(
  sellingPrice: number,
  totalCost: number
): { netProfit: number; marginPercentage: number } {
  const netProfit = Math.round((sellingPrice - totalCost) * 100) / 100;
  const marginPercentage =
    sellingPrice > 0 ? Math.round((netProfit / sellingPrice) * 1000) / 10 : 0;

  return {
    netProfit,
    marginPercentage,
  };
}

/**
 * Calcula los totales de una cotización y el 50% de anticipo reglamentario para taller.
 */
export function calculateQuoteDeposit(
  totalBase: number,
  depositPercentage = 50
): {
  depositRequiredBase: number;
  pendingBalanceBase: number;
} {
  const safePct = Math.max(0, Math.min(100, depositPercentage)) / 100;
  const depositRequiredBase = Math.round(totalBase * safePct * 100) / 100;
  const pendingBalanceBase = Math.round((totalBase - depositRequiredBase) * 100) / 100;

  return {
    depositRequiredBase,
    pendingBalanceBase,
  };
}

/**
 * Conversión bimonetaria a Bolívares (Tasa BCV oficial)
 */
export function convertBimonetary(amountBase: number, exchangeRate: number): number {
  if (exchangeRate <= 0) return amountBase;
  return Math.round(amountBase * exchangeRate * 100) / 100;
}

/**
 * Formatea el mensaje oficial de cotización para WhatsApp con llamado al 50% de abono.
 */
export function formatPrintopinkWhatsAppQuote(params: {
  storeName?: string;
  quoteNumber: string;
  customerName?: string;
  items: { title: string; unitPriceBase: number; quantity: number; subtotalBase: number }[];
  totalBase: number;
  depositRequiredBase: number;
  pendingBalanceBase: number;
  exchangeRate?: number;
}): string {
  const {
    storeName = "PrintoPink Taller Creativo",
    quoteNumber,
    customerName,
    items,
    totalBase,
    depositRequiredBase,
    pendingBalanceBase,
    exchangeRate,
  } = params;

  const lines: string[] = [];
  lines.push(`✨ *PRESUPUESTO OFICIAL — ${storeName.toUpperCase()}* ✨`);
  lines.push(`📋 *Cotización:* \`#${quoteNumber}\``);
  if (customerName?.trim()) {
    lines.push(`👤 *Cliente:* ${customerName.trim()}`);
  }
  lines.push("");
  lines.push("📝 *DETALLE DE TU PEDIDO:*");

  items.forEach((it, idx) => {
    lines.push(
      `${idx + 1}. *${it.title}* x ${it.quantity} ud(s) — $${it.subtotalBase.toFixed(2)}`
    );
  });

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push(`💰 *TOTAL GENERAL:* *$${totalBase.toFixed(2)} USD*`);
  if (exchangeRate && exchangeRate > 0) {
    const totalVes = convertBimonetary(totalBase, exchangeRate);
    lines.push(`🇻🇪 *Equivalente en Bs. (BCV):* Bs. ${totalVes.toFixed(2)}`);
  }

  lines.push("");
  lines.push(
    `🔒 *ANTICIPO 50% PARA INICIAR PRODUCCIÓN:* *$${depositRequiredBase.toFixed(2)} USD*`
  );
  if (exchangeRate && exchangeRate > 0) {
    const depVes = convertBimonetary(depositRequiredBase, exchangeRate);
    lines.push(`   *(Bs. ${depVes.toFixed(2)})*`);
  }
  lines.push(
    `💵 *Saldo restante a la entrega:* $${pendingBalanceBase.toFixed(2)} USD`
  );

  lines.push("");
  lines.push("⏳ *Condiciones de Taller:*");
  lines.push("• Los tiempos de entrega corren a partir de la confirmación del abono.");
  lines.push("• Diseños personalizados requieren aprobación final antes de imprimir.");
  lines.push("");
  lines.push("¿Deseas confirmar los datos de pago para apartar tu cupo en producción? 😊");

  return lines.join("\n");
}
