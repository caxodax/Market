/**
 * Official Purchases Book Service (Libro de Compras Fiscal)
 * Generates audit-ready purchases books compliant with SENIAT Art. 56 / Providencia 00071
 * and SII Chile RCV / DTE 46 format, with UTF-8 BOM CSV export for Microsoft Excel.
 */

import type {
  PurchaseInvoice,
  RetentionVoucher,
  PurchasesBookEntry,
  PurchasesBookTotals,
  PurchasesBookReport,
} from "@marketos/types";

export interface BuildPurchasesBookOptions {
  period: string; // "YYYY-MM" (e.g. "2026-10")
  tenantId: string;
  buyer: {
    name: string;
    taxId: string;
    address?: string;
  };
  currency?: "USD" | "EUR" | "CLP" | "VES";
  vouchers?: RetentionVoucher[];
}

/**
 * Filter, match retentions and compile purchase invoices into an official Purchases Book Report
 */
export function buildPurchasesBook(
  invoices: PurchaseInvoice[],
  options: BuildPurchasesBookOptions
): PurchasesBookReport {
  const { period, tenantId, buyer, currency = "VES", vouchers = [] } = options;

  // Filter invoices belonging to the requested period (either invoice_date or received_date)
  const periodInvoices = invoices.filter((inv) => {
    const invDate = inv.invoice_date ? inv.invoice_date.slice(0, 7) : "";
    const recDate = inv.received_date ? inv.received_date.slice(0, 7) : "";
    return (invDate === period || recDate === period) && inv.status !== "ANNULLED";
  });

  // Sort chronologically by invoice_date
  periodInvoices.sort((a, b) => {
    const timeA = new Date(a.invoice_date).getTime();
    const timeB = new Date(b.invoice_date).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.invoice_number.localeCompare(b.invoice_number);
  });

  let operationCounter = 1;
  const entries: PurchasesBookEntry[] = [];

  let totalPurchases = 0;
  let totalExempt = 0;
  let totalTaxable = 0;
  let totalVatCredit = 0;
  let totalRetained = 0;

  for (const inv of periodInvoices) {
    // Find matching retention voucher if exists
    const matchingVoucher = vouchers.find(
      (v) => v.purchase_invoice_id === inv.id || v.id === inv.retention_voucher_id
    );

    // Multiplier for VES conversion if applicable
    const rateMultiplier = (currency === "VES" && inv.exchange_rate_applied && inv.total_ves === undefined)
      ? inv.exchange_rate_applied
      : 1;

    const invoiceTotal = (currency === "VES" && inv.total_ves !== undefined)
      ? inv.total_ves
      : inv.total_amount;

    const exempt = (inv.subtotal_exempt || 0) * rateMultiplier;
    const taxable = (inv.subtotal_taxable || 0) * rateMultiplier;
    const vat = (inv.iva_amount || 0) * rateMultiplier;
    const retained = ((inv.retained_vat_amount || matchingVoucher?.retained_amount) || 0) * rateMultiplier;

    const entry: PurchasesBookEntry = {
      operation_number: operationCounter++,
      invoice_date: inv.invoice_date.slice(0, 10),
      supplier_tax_id: inv.supplier_tax_id,
      supplier_name: inv.supplier_name,
      document_type: "FACTURA",
      invoice_number: inv.invoice_number,
      control_number: inv.control_number || "-",
      affected_document_number: null,
      total_with_tax: Number(invoiceTotal.toFixed(2)),
      exempt_amount: Number(exempt.toFixed(2)),
      taxable_base: Number(taxable.toFixed(2)),
      tax_rate_percent: inv.iva_rate_percent,
      tax_amount: Number(vat.toFixed(2)),
      retained_vat_amount: Number(retained.toFixed(2)),
      retention_voucher_number: matchingVoucher?.voucher_number || null,
      retention_voucher_date: matchingVoucher?.issue_date ? matchingVoucher.issue_date.slice(0, 10) : null,
    };

    entries.push(entry);

    totalPurchases += entry.total_with_tax;
    totalExempt += entry.exempt_amount;
    totalTaxable += entry.taxable_base;
    totalVatCredit += entry.tax_amount;
    totalRetained += entry.retained_vat_amount;
  }

  const totals: PurchasesBookTotals = {
    total_purchases: Number(totalPurchases.toFixed(2)),
    total_exempt: Number(totalExempt.toFixed(2)),
    total_taxable_base: Number(totalTaxable.toFixed(2)),
    total_vat_credit: Number(totalVatCredit.toFixed(2)),
    total_retained_vat: Number(totalRetained.toFixed(2)),
    invoices_count: entries.length,
  };

  return {
    period,
    tenant_id: tenantId,
    buyer_business_name: buyer.name,
    buyer_id_doc: buyer.taxId,
    buyer_address: buyer.address,
    currency,
    generated_at: new Date().toISOString(),
    entries,
    totals,
  };
}

/**
 * Format a number as decimal string for Excel (using comma as decimal separator in Spanish locales)
 */
function formatNumberForCsv(num: number): string {
  return num.toFixed(2).replace(".", ",");
}

/**
 * Generates an Excel-ready CSV string with UTF-8 BOM (\ufeff) and semicolon delimiter
 */
export function exportPurchasesBookCsv(report: PurchasesBookReport): string {
  const lines: string[] = [];

  // UTF-8 BOM so Excel opens with proper accents and character encoding
  const BOM = "\ufeff";

  // Membrete Fiscal
  lines.push(`LIBRO DE COMPRAS FISCAL`);
  lines.push(`Razón Social Adquirente;${report.buyer_business_name}`);
  lines.push(`RIF / RUT Adquirente;${report.buyer_id_doc}`);
  lines.push(`Período Fiscal;${report.period}`);
  lines.push(`Moneda del Reporte;${report.currency}`);
  lines.push(`Fecha de Emisión;${new Date(report.generated_at).toLocaleString("es-VE")}`);
  lines.push(``); // Empty row separator

  // Column Headers
  const headers = [
    "N° Operación",
    "Fecha Factura",
    "RIF / RUT Proveedor",
    "Nombre o Razón Social Proveedor",
    "Tipo Documento",
    "N° Factura",
    "N° Control",
    "Factura Afectada",
    "Total Compras con IVA",
    "Compras Exentas",
    "Base Imponible",
    "% Alícuota IVA",
    "Crédito Fiscal IVA",
    "IVA Retenido",
    "N° Comprobante Retención",
    "Fecha Comprobante Retención",
  ];
  lines.push(headers.join(";"));

  // Data rows
  for (const entry of report.entries) {
    const row = [
      entry.operation_number,
      entry.invoice_date,
      `"${entry.supplier_tax_id}"`,
      `"${entry.supplier_name.replace(/"/g, '""')}"`,
      entry.document_type,
      `"${entry.invoice_number}"`,
      `"${entry.control_number}"`,
      entry.affected_document_number ? `"${entry.affected_document_number}"` : '""',
      formatNumberForCsv(entry.total_with_tax),
      formatNumberForCsv(entry.exempt_amount),
      formatNumberForCsv(entry.taxable_base),
      `${entry.tax_rate_percent}%`,
      formatNumberForCsv(entry.tax_amount),
      formatNumberForCsv(entry.retained_vat_amount),
      entry.retention_voucher_number ? `"${entry.retention_voucher_number}"` : '""',
      entry.retention_voucher_date || '""',
    ];
    lines.push(row.join(";"));
  }

  // Summary Totals Row
  lines.push(``);
  const totalsRow = [
    "TOTALES GENERALES",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    formatNumberForCsv(report.totals.total_purchases),
    formatNumberForCsv(report.totals.total_exempt),
    formatNumberForCsv(report.totals.total_taxable_base),
    "",
    formatNumberForCsv(report.totals.total_vat_credit),
    formatNumberForCsv(report.totals.total_retained_vat),
    "",
    "",
  ];
  lines.push(totalsRow.join(";"));

  return BOM + lines.join("\r\n");
}
