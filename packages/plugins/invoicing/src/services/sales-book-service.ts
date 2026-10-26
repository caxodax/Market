/**
 * Official Sales Book Service (Libro de Ventas Fiscal)
 * Generates audit-ready sales books compliant with SENIAT Art. 56 / Providencia 00071
 * and SII Chile RCV format, with UTF-8 BOM CSV export for Microsoft Excel.
 */

import type {
  FiscalDocument,
  SalesBookEntry,
  SalesBookTotals,
  SalesBookReport,
} from "@marketos/types";

export interface BuildSalesBookOptions {
  period: string; // "YYYY-MM" (e.g. "2026-10")
  tenantId: string;
  emitter: {
    name: string;
    taxId: string;
    address?: string;
  };
  currency?: "USD" | "EUR" | "CLP" | "VES";
}

/**
 * Filter, sort and compile fiscal documents into an official Sales Book Report
 */
export function buildSalesBook(
  documents: FiscalDocument[],
  options: BuildSalesBookOptions
): SalesBookReport {
  const { period, tenantId, emitter, currency = "VES" } = options;

  // Filter documents by period (matching created_at YYYY-MM) and excluding draft/internal non-fiscal documents if any
  const periodDocs = documents.filter((doc) => {
    const docDate = doc.created_at ? doc.created_at.slice(0, 7) : "";
    const isFiscal = doc.document_type === "INVOICE" ||
      doc.document_type === "CREDIT_NOTE" ||
      doc.document_type === "DEBIT_NOTE";
    return docDate === period && isFiscal;
  });

  // Sort chronologically by created_at and document_number
  periodDocs.sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.document_number.localeCompare(b.document_number);
  });

  let operationCounter = 1;
  const entries: SalesBookEntry[] = [];

  let totalSales = 0;
  let totalExempt = 0;
  let totalTaxable = 0;
  let totalVat = 0;
  let totalIgtf = 0;
  let totalRetained = 0;

  for (const doc of periodDocs) {
    const isCreditNote = doc.document_type === "CREDIT_NOTE";
    const sign = isCreditNote ? -1 : 1;

    // Use total_ves if reporting in VES and available, otherwise total_amount
    const docTotal = (currency === "VES" && doc.total_ves !== undefined)
      ? doc.total_ves
      : doc.total_amount;

    const rateMultiplier = (currency === "VES" && doc.exchange_rate_applied && doc.total_ves === undefined)
      ? doc.exchange_rate_applied
      : 1;

    const exempt = (doc.subtotal_exempt || 0) * rateMultiplier;
    const taxable = (doc.subtotal_taxable || 0) * rateMultiplier;
    const vat = (doc.iva_amount || 0) * rateMultiplier;
    const igtf = (doc.igtf_amount || 0) * rateMultiplier;
    const retained = 0; // In sales book, customer retention can be noted if reported

    const entry: SalesBookEntry = {
      operation_number: operationCounter++,
      document_date: doc.created_at.slice(0, 10),
      customer_id_doc: doc.customer_id_doc,
      customer_name: doc.customer_name,
      document_type: doc.document_type,
      document_number: doc.document_number,
      control_number: doc.control_number || "-",
      affected_document_number: doc.affected_document_number || null,
      total_with_tax: Number((docTotal * sign).toFixed(2)),
      exempt_amount: Number((exempt * sign).toFixed(2)),
      taxable_base: Number((taxable * sign).toFixed(2)),
      tax_rate_percent: doc.iva_rate_percent,
      tax_amount: Number((vat * sign).toFixed(2)),
      igtf_amount: Number((igtf * sign).toFixed(2)),
      retained_vat_amount: Number((retained * sign).toFixed(2)),
      retention_voucher_number: null,
    };

    entries.push(entry);

    totalSales += entry.total_with_tax;
    totalExempt += entry.exempt_amount;
    totalTaxable += entry.taxable_base;
    totalVat += entry.tax_amount;
    totalIgtf += entry.igtf_amount;
    totalRetained += entry.retained_vat_amount;
  }

  const totals: SalesBookTotals = {
    total_sales: Number(totalSales.toFixed(2)),
    total_exempt: Number(totalExempt.toFixed(2)),
    total_taxable_base: Number(totalTaxable.toFixed(2)),
    total_vat: Number(totalVat.toFixed(2)),
    total_igtf: Number(totalIgtf.toFixed(2)),
    total_retained_vat: Number(totalRetained.toFixed(2)),
    documents_count: entries.length,
  };

  return {
    period,
    tenant_id: tenantId,
    emitter_business_name: emitter.name,
    emitter_id_doc: emitter.taxId,
    emitter_address: emitter.address,
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
export function exportSalesBookCsv(report: SalesBookReport): string {
  const lines: string[] = [];

  // UTF-8 BOM so Excel opens with proper accents and character encoding
  const BOM = "\ufeff";

  // Membrete Fiscal
  lines.push(`LIBRO DE VENTAS FISCAL`);
  lines.push(`Razón Social;${report.emitter_business_name}`);
  lines.push(`RIF / RUT;${report.emitter_id_doc}`);
  lines.push(`Período Fiscal;${report.period}`);
  lines.push(`Moneda del Reporte;${report.currency}`);
  lines.push(`Fecha de Emisión;${new Date(report.generated_at).toLocaleString("es-VE")}`);
  lines.push(``); // Empty row separator

  // Column Headers
  const headers = [
    "N° Operación",
    "Fecha Documento",
    "RIF / RUT Cliente",
    "Nombre o Razón Social Cliente",
    "Tipo Documento",
    "N° Documento",
    "N° Control",
    "Factura Afectada",
    "Total Ventas con IVA",
    "Ventas Exentas",
    "Base Imponible",
    "% Alícuota IVA",
    "Débito Fiscal IVA",
    "IGTF Percibido (3%)",
    "IVA Retenido",
  ];
  lines.push(headers.join(";"));

  // Data rows
  for (const entry of report.entries) {
    const row = [
      entry.operation_number,
      entry.document_date,
      `"${entry.customer_id_doc}"`,
      `"${entry.customer_name.replace(/"/g, '""')}"`,
      entry.document_type,
      `"${entry.document_number}"`,
      `"${entry.control_number}"`,
      entry.affected_document_number ? `"${entry.affected_document_number}"` : '""',
      formatNumberForCsv(entry.total_with_tax),
      formatNumberForCsv(entry.exempt_amount),
      formatNumberForCsv(entry.taxable_base),
      `${entry.tax_rate_percent}%`,
      formatNumberForCsv(entry.tax_amount),
      formatNumberForCsv(entry.igtf_amount),
      formatNumberForCsv(entry.retained_vat_amount),
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
    formatNumberForCsv(report.totals.total_sales),
    formatNumberForCsv(report.totals.total_exempt),
    formatNumberForCsv(report.totals.total_taxable_base),
    "",
    formatNumberForCsv(report.totals.total_vat),
    formatNumberForCsv(report.totals.total_igtf),
    formatNumberForCsv(report.totals.total_retained_vat),
  ];
  lines.push(totalsRow.join(";"));

  return BOM + lines.join("\r\n");
}
