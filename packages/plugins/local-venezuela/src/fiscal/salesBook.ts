/**
 * SENIAT Libro de Ventas Export (Art. 56 Ley del IVA & Providencia Administrativa SNAT/2011/00071)
 * Generates official formatted CSV ready for accountants and SENIAT tax audits.
 */

import type { Order, TenantSettings } from "@marketos/types";

export interface SeniatSalesBookEntry {
  operationNumber: number;
  date: string;
  customerRif: string;
  customerName: string;
  documentType: "FACTURA" | "NOTA_CREDITO" | "NOTA_DEBITO";
  invoiceNumber: string;
  controlNumber: string;
  affectedInvoiceNumber: string;
  totalVes: number;
  exemptVes: number;
  taxableBaseVes: number;
  ivaVes: number;
  igtfBaseVes: number;
  igtfVes: number;
  totalUsd: number;
  exchangeRate: number;
}

export interface GenerateSalesBookOptions {
  orders: Order[];
  settings: TenantSettings;
  periodLabel?: string;
}

/**
 * Builds standard structured entries from an array of MarketOS orders
 */
export function buildSeniatSalesBookEntries(orders: Order[]): SeniatSalesBookEntry[] {
  // Only process confirmed/completed/paid orders
  const validOrders = orders
    .filter((o) =>
      ["PAYMENT_APPROVED", "PREPARING", "READY", "DELIVERING", "COMPLETED"].includes(o.status)
    )
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return validOrders.map((order, idx) => {
    const rate = order.exchange_rate_applied > 0 ? order.exchange_rate_applied : 1;
    const isExemptUsd = order.subtotal_exempt_usd || 0;
    const isTaxableUsd = order.subtotal_taxable_usd || Number((order.total_usd / 1.16).toFixed(2));
    const ivaUsd = order.iva_amount_usd || Number((order.total_usd - isTaxableUsd).toFixed(2));
    const igtfUsd = order.igtf_amount_usd || 0;

    const exemptVes = Number((isExemptUsd * rate).toFixed(2));
    const taxableBaseVes = Number((isTaxableUsd * rate).toFixed(2));
    const ivaVes = Number((ivaUsd * rate).toFixed(2));
    const igtfVes = Number((igtfUsd * rate).toFixed(2));
    const igtfBaseVes = igtfUsd > 0 ? Number((order.total_usd * rate).toFixed(2)) : 0;
    const totalVes = order.total_ves > 0 ? order.total_ves : Number((order.total_usd * rate).toFixed(2));

    const invoiceNum =
      order.physical_invoice_number ||
      order.fiscal_invoice_number ||
      `ORD-${order.order_number.replace(/^ORD-/, "")}`;

    const controlNum =
      order.physical_machine_serial
        ? `MF:${order.physical_machine_serial}`
        : order.fiscal_control_number || `00-${order.order_number.replace(/^ORD-/, "000")}`;

    // Date in Caracas DD/MM/YYYY format
    const d = new Date(order.created_at);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    return {
      operationNumber: idx + 1,
      date: formattedDate,
      customerRif: order.customer_id_number || "V-999999999",
      customerName: order.customer_name || "CONSUMIDOR FINAL",
      documentType: "FACTURA",
      invoiceNumber: invoiceNum,
      controlNumber: controlNum,
      affectedInvoiceNumber: "",
      totalVes,
      exemptVes,
      taxableBaseVes,
      ivaVes,
      igtfBaseVes,
      igtfVes,
      totalUsd: order.total_usd,
      exchangeRate: rate,
    };
  });
}

/**
 * Generates an official SENIAT Libro de Ventas CSV string
 */
export function generateSeniatSalesBookCsv(options: GenerateSalesBookOptions): string {
  const { orders, settings, periodLabel = "MES EN CURSO" } = options;
  const entries = buildSeniatSalesBookEntries(orders);

  const emitterRif = settings.billing_settings?.emitter_fiscal_data?.rif || "NO REGISTRADO";
  const emitterName = settings.billing_settings?.emitter_fiscal_data?.business_name || settings.business_name;

  const lines: string[] = [];

  // Header metadata block
  lines.push(`"LIBRO DE VENTAS E INGRESOS (Art. 56 Ley del IVA / Providencia SNAT/2011/00071)"`);
  lines.push(`"CONTRIBUYENTE:","${emitterName}"`);
  lines.push(`"RIF:","${emitterRif}"`);
  lines.push(`"PERIODO:","${periodLabel}"`);
  lines.push(`"GENERADO:","${new Date().toLocaleString("es-VE")} (America/Caracas)"`);
  lines.push(``);

  // Column definitions
  const headers = [
    "N° Operación",
    "Fecha de Emisión",
    "RIF / C.I. Adquirente",
    "Nombre o Razón Social",
    "Tipo Doc.",
    "N° Factura",
    "N° Control / Serial MF",
    "Factura Afectada",
    "Total Ventas con IVA (Bs.)",
    "Ventas Exentas (Bs.)",
    "Base Imponible 16% (Bs.)",
    "Débito Fiscal IVA 16% (Bs.)",
    "Base Sujeta IGTF 3% (Bs.)",
    "IGTF Percibido 3% (Bs.)",
    "Total Ventas ($ USD)",
    "Tasa Oficial BCV",
  ];
  lines.push(headers.map((h) => `"${h}"`).join(","));

  // Rows
  let sumTotalVes = 0;
  let sumExemptVes = 0;
  let sumTaxableVes = 0;
  let sumIvaVes = 0;
  let sumIgtfVes = 0;
  let sumTotalUsd = 0;

  for (const row of entries) {
    sumTotalVes += row.totalVes;
    sumExemptVes += row.exemptVes;
    sumTaxableVes += row.taxableBaseVes;
    sumIvaVes += row.ivaVes;
    sumIgtfVes += row.igtfVes;
    sumTotalUsd += row.totalUsd;

    const line = [
      row.operationNumber,
      `"${row.date}"`,
      `"${row.customerRif}"`,
      `"${row.customerName.replace(/"/g, '""')}"`,
      `"${row.documentType}"`,
      `"${row.invoiceNumber}"`,
      `"${row.controlNumber}"`,
      `"${row.affectedInvoiceNumber}"`,
      row.totalVes.toFixed(2),
      row.exemptVes.toFixed(2),
      row.taxableBaseVes.toFixed(2),
      row.ivaVes.toFixed(2),
      row.igtfBaseVes.toFixed(2),
      row.igtfVes.toFixed(2),
      row.totalUsd.toFixed(2),
      row.exchangeRate.toFixed(4),
    ];
    lines.push(line.join(","));
  }

  // Totals summary row
  lines.push(``);
  const totalRow = [
    `"TOTALES"`,
    `""`,
    `""`,
    `""`,
    `""`,
    `""`,
    `""`,
    `""`,
    sumTotalVes.toFixed(2),
    sumExemptVes.toFixed(2),
    sumTaxableVes.toFixed(2),
    sumIvaVes.toFixed(2),
    `""`,
    sumIgtfVes.toFixed(2),
    sumTotalUsd.toFixed(2),
    `""`,
  ];
  lines.push(totalRow.join(","));

  return lines.join("\r\n");
}
