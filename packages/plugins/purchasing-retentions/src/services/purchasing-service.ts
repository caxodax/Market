import type {
  CreatePurchaseInvoiceInput,
  PurchaseInvoice,
  PurchaseInvoiceItem,
  RetentionVoucher,
  TenantSettings,
  SeniatRetentionTxtRow,
  SeniatIslrXmlRow,
  CreateRetentionVoucherInput,
} from "@marketos/types";
import { resolveRetentionAdapter } from "../adapters/retention-adapter.ts";
import { OFFICIAL_ISLR_CONCEPTS } from "../constants/islr-concepts.ts";

export interface PreparePurchaseInvoiceResult {
  invoice: PurchaseInvoice;
  retentionVoucher?: RetentionVoucher;
  islrRetentionVoucher?: RetentionVoucher;
}

export function preparePurchaseInvoice(options: {
  input: CreatePurchaseInvoiceInput;
  settings: TenantSettings;
  existingCount: number;
  activeModuleIds?: string[];
  actorName?: string;
  defaultIvaRate?: number;
}): PreparePurchaseInvoiceResult {
  const { input, settings, existingCount, activeModuleIds = [], actorName, defaultIvaRate = 16.0 } = options;
  const adapter = resolveRetentionAdapter(undefined, activeModuleIds);

  let subtotalExempt = 0;
  let subtotalTaxable = 0;

  const items: PurchaseInvoiceItem[] = input.items.map((it, idx) => {
    const lineTotal = Number((it.quantity * it.unit_price).toFixed(2));
    if (it.is_exempt) {
      subtotalExempt += lineTotal;
    } else {
      subtotalTaxable += lineTotal;
    }
    return {
      id: `pitem-${Date.now()}-${idx}`,
      name: it.name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total_price: lineTotal,
      is_exempt: Boolean(it.is_exempt),
      tax_rate_percent: it.tax_rate_percent ?? (it.is_exempt ? 0 : defaultIvaRate),
    };
  });

  const ivaRate = defaultIvaRate;
  const ivaAmount = Number(((subtotalTaxable * ivaRate) / 100).toFixed(2));
  const totalAmount = Number((subtotalExempt + subtotalTaxable + ivaAmount).toFixed(2));
  const rate = input.exchange_rate_applied || 1;
  const totalVes = Number((totalAmount * rate).toFixed(2));

  const invoiceId = `pinv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const taxPeriod = input.invoice_date.slice(0, 7).replace("-", ""); // YYYYMM

  let retentionVoucher: RetentionVoucher | undefined = undefined;
  let retainedVatAmount = 0;

  if (input.auto_generate_retention && ivaAmount > 0) {
    const retentionRate = input.retention_rate_percent ?? adapter.defaultVatRetentionRate;
    const { vatRetainedAmount } = adapter.calculateVatRetention(ivaAmount, retentionRate);
    retainedVatAmount = vatRetainedAmount;

    const voucherNumber = adapter.formatVoucherNumber(existingCount + 1, taxPeriod);

    retentionVoucher = {
      id: `ret_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: settings.tenant_id,
      voucher_type: input.retention_type || "VAT",
      voucher_number: voucherNumber,
      tax_period: taxPeriod,
      issue_date: input.invoice_date,

      agent_business_name:
        settings.billing_settings?.emitter_fiscal_data?.business_name || settings.business_name,
      agent_tax_id:
        settings.billing_settings?.emitter_fiscal_data?.rif || "J-00000000-0",
      agent_fiscal_address:
        settings.billing_settings?.emitter_fiscal_data?.fiscal_address || settings.address || "Sede Principal",

      supplier_id: `sup_${input.supplier_tax_id.replace(/[^A-Za-z0-9]/g, "")}`,
      supplier_name: input.supplier_name,
      supplier_tax_id: input.supplier_tax_id,
      supplier_fiscal_address: input.supplier_address || null,

      purchase_invoice_id: invoiceId,
      invoice_number: input.invoice_number,
      control_number: input.control_number || null,
      invoice_date: input.invoice_date,

      invoice_total_amount: totalAmount,
      taxable_base_amount: subtotalTaxable,
      exempt_base_amount: subtotalExempt,
      iva_rate_percent: ivaRate,
      iva_total_amount: ivaAmount,
      retention_rate_percent: retentionRate,
      retained_amount: vatRetainedAmount,
      currency: input.currency || "USD",
      exchange_rate_applied: input.exchange_rate_applied,
      retained_amount_ves: Number((vatRetainedAmount * rate).toFixed(2)),

      legal_legend: adapter.getLegalLegend(input.retention_type || "VAT"),
      created_at: now,
      created_by: actorName || "Admin",
    };
  }

  // Retención de ISLR (Decreto N° 1.808)
  let islrRetentionVoucher: RetentionVoucher | undefined = undefined;
  let retainedIslrAmount = 0;
  const islrConceptCode = input.islr_concept_code || "055";
  const concept = OFFICIAL_ISLR_CONCEPTS.find((c) => c.code === islrConceptCode);
  const islrRate = input.islr_retention_rate_percent ?? concept?.default_rate_percent ?? 2.0;

  if (input.apply_islr_retention && subtotalTaxable > 0) {
    retainedIslrAmount = adapter.calculateIncomeTaxRetention(subtotalTaxable, islrRate);
    const islrSequence = existingCount + (retentionVoucher ? 2 : 1);
    const islrVoucherNumber = adapter.formatVoucherNumber(islrSequence, taxPeriod);

    islrRetentionVoucher = {
      id: `ret_islr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: settings.tenant_id,
      voucher_type: "INCOME_TAX",
      voucher_number: islrVoucherNumber,
      tax_period: taxPeriod,
      issue_date: input.invoice_date,

      agent_business_name:
        settings.billing_settings?.emitter_fiscal_data?.business_name || settings.business_name,
      agent_tax_id:
        settings.billing_settings?.emitter_fiscal_data?.rif || "J-00000000-0",
      agent_fiscal_address:
        settings.billing_settings?.emitter_fiscal_data?.fiscal_address || settings.address || "Sede Principal",

      supplier_id: `sup_${input.supplier_tax_id.replace(/[^A-Za-z0-9]/g, "")}`,
      supplier_name: input.supplier_name,
      supplier_tax_id: input.supplier_tax_id,
      supplier_fiscal_address: input.supplier_address || null,

      purchase_invoice_id: invoiceId,
      invoice_number: input.invoice_number,
      control_number: input.control_number || null,
      invoice_date: input.invoice_date,

      invoice_total_amount: totalAmount,
      taxable_base_amount: subtotalTaxable,
      exempt_base_amount: subtotalExempt,
      iva_rate_percent: ivaRate,
      iva_total_amount: ivaAmount,
      retention_rate_percent: islrRate,
      retained_amount: retainedIslrAmount,
      currency: input.currency || "USD",
      exchange_rate_applied: input.exchange_rate_applied,
      retained_amount_ves: Number((retainedIslrAmount * rate).toFixed(2)),

      legal_legend: adapter.getLegalLegend("INCOME_TAX"),
      islr_concept_code: islrConceptCode,
      islr_concept_name: concept?.name || null,
      created_at: now,
      created_by: actorName || "Admin",
    };
  }

  const invoice: PurchaseInvoice = {
    id: invoiceId,
    tenant_id: settings.tenant_id,
    supplier_id: `sup_${input.supplier_tax_id.replace(/[^A-Za-z0-9]/g, "")}`,
    supplier_name: input.supplier_name,
    supplier_tax_id: input.supplier_tax_id,
    invoice_number: input.invoice_number,
    control_number: input.control_number || null,
    invoice_date: input.invoice_date,
    received_date: now.split("T")[0],
    status: "REGISTERED",
    notes: input.notes || null,

    items,
    subtotal_exempt: subtotalExempt,
    subtotal_taxable: subtotalTaxable,
    iva_rate_percent: ivaRate,
    iva_amount: ivaAmount,
    total_amount: totalAmount,
    currency: input.currency || "USD",
    exchange_rate_applied: input.exchange_rate_applied,
    total_ves: totalVes,

    retention_voucher_id: retentionVoucher?.id || null,
    retained_vat_amount: retainedVatAmount > 0 ? retainedVatAmount : undefined,
    retained_islr_amount: retainedIslrAmount > 0 ? retainedIslrAmount : undefined,
    islr_concept_code: input.apply_islr_retention ? islrConceptCode : undefined,
    islr_retention_rate_percent: input.apply_islr_retention ? islrRate : undefined,
    islr_retention_voucher_id: islrRetentionVoucher?.id || null,

    created_at: now,
    created_by: actorName || "Admin",
  };

  return { invoice, retentionVoucher, islrRetentionVoucher };
}

/**
 * Prepares a RetentionVoucher for an existing purchase invoice
 */
export function prepareRetentionVoucher(options: {
  invoice: PurchaseInvoice;
  input: CreateRetentionVoucherInput;
  settings: TenantSettings;
  existingCount: number;
  activeModuleIds?: string[];
  actorName?: string;
}): RetentionVoucher {
  const { invoice, input, settings, existingCount, activeModuleIds = [], actorName } = options;
  const adapter = resolveRetentionAdapter(undefined, activeModuleIds);

  const rate = invoice.exchange_rate_applied || 1;
  const taxPeriod = input.tax_period || invoice.invoice_date.slice(0, 7).replace("-", "");
  const voucherNumber = adapter.formatVoucherNumber(existingCount + 1, taxPeriod);

  let retainedAmount = 0;
  let islrConceptName: string | null = null;
  const islrConceptCode = input.islr_concept_code || invoice.islr_concept_code || null;

  if (input.voucher_type === "INCOME_TAX") {
    retainedAmount = adapter.calculateIncomeTaxRetention(
      invoice.subtotal_taxable,
      input.retention_rate_percent
    );
    if (islrConceptCode) {
      const concept = OFFICIAL_ISLR_CONCEPTS.find((c) => c.code === islrConceptCode);
      islrConceptName = concept?.name || null;
    }
  } else {
    const { vatRetainedAmount } = adapter.calculateVatRetention(
      invoice.iva_amount,
      input.retention_rate_percent
    );
    retainedAmount = vatRetainedAmount;
  }

  return {
    id: `ret_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    tenant_id: settings.tenant_id,
    voucher_type: input.voucher_type,
    voucher_number: voucherNumber,
    tax_period: taxPeriod,
    issue_date: input.issue_date || new Date().toISOString().split("T")[0],

    agent_business_name:
      settings.billing_settings?.emitter_fiscal_data?.business_name || settings.business_name,
    agent_tax_id:
      settings.billing_settings?.emitter_fiscal_data?.rif || "J-00000000-0",
    agent_fiscal_address:
      settings.billing_settings?.emitter_fiscal_data?.fiscal_address || settings.address || "Sede Principal",

    supplier_id: invoice.supplier_id,
    supplier_name: invoice.supplier_name,
    supplier_tax_id: invoice.supplier_tax_id,
    supplier_fiscal_address: null,

    purchase_invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    control_number: invoice.control_number || null,
    invoice_date: invoice.invoice_date,

    invoice_total_amount: invoice.total_amount,
    taxable_base_amount: invoice.subtotal_taxable,
    exempt_base_amount: invoice.subtotal_exempt,
    iva_rate_percent: invoice.iva_rate_percent,
    iva_total_amount: invoice.iva_amount,
    retention_rate_percent: input.retention_rate_percent,
    retained_amount: retainedAmount,
    currency: invoice.currency,
    exchange_rate_applied: invoice.exchange_rate_applied,
    retained_amount_ves: Number((retainedAmount * rate).toFixed(2)),

    legal_legend: adapter.getLegalLegend(input.voucher_type),
    islr_concept_code: islrConceptCode,
    islr_concept_name: islrConceptName,
    created_at: new Date().toISOString(),
    created_by: actorName || "Admin",
  };
}

/**
 * Builds the official SENIAT TXT file content for uploading to the portal (IVA Providencia 0049)
 */
export function buildSeniatRetentionTxt(rows: SeniatRetentionTxtRow[]): string {
  const adapter = resolveRetentionAdapter("VE", ["local_venezuela"]);
  const lines = rows.map((r) => adapter.formatSeniatTxtLine!(r));
  return lines.join("\r\n");
}

/**
 * Ponytail / RFC compliant XML escaping (no external dependencies)
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Builds the official SENIAT XML file content for ISLR retentions (Decreto N° 1.808)
 * Standard Schema:
 * <RelacionRetencionesISLR RifAgente="J123456780" Periodo="YYYYMM">
 *   <DetalleRetencion>
 *     <RifRetenido>...</RifRetenido>
 *     ...
 *   </DetalleRetencion>
 * </RelacionRetencionesISLR>
 */
export function buildSeniatIslrXml(options: {
  agentRif: string;
  taxPeriod: string; // YYYYMM
  rows: SeniatIslrXmlRow[];
}): string {
  const cleanAgentRif = options.agentRif.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const cleanPeriod = options.taxPeriod.replace(/[^0-9]/g, "").slice(0, 6);

  const detalleItems = options.rows.map((row) => {
    const cleanSupplierRif = row.rifRetenido.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const invoiceNum = escapeXml(row.numeroFactura.trim());
    const controlNum = escapeXml(row.numeroControl ? row.numeroControl.trim() : "0");

    // Standardize date to DD/MM/YYYY for SENIAT XML
    let fechaOp = row.fechaOperacion.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaOp)) {
      const [yyyy, mm, dd] = fechaOp.split("-");
      fechaOp = `${dd}/${mm}/${yyyy}`;
    }

    const concepto = row.codigoConcepto.replace(/[^0-9]/g, "").padStart(3, "0");
    const monto = row.montoOperacion.toFixed(2);
    const porcentaje = row.porcentajeRetencion.toFixed(2);

    return `  <DetalleRetencion>
    <RifRetenido>${cleanSupplierRif}</RifRetenido>
    <NumeroFactura>${invoiceNum}</NumeroFactura>
    <NumeroControl>${controlNum}</NumeroControl>
    <FechaOperacion>${fechaOp}</FechaOperacion>
    <CodigoConcepto>${concepto}</CodigoConcepto>
    <MontoOperacion>${monto}</MontoOperacion>
    <PorcentajeRetencion>${porcentaje}</PorcentajeRetencion>
  </DetalleRetencion>`;
  });

  return `<?xml version="1.0" encoding="ISO-8859-1"?>
<RelacionRetencionesISLR RifAgente="${cleanAgentRif}" Periodo="${cleanPeriod}">
${detalleItems.join("\n")}
</RelacionRetencionesISLR>`;
}

/**
 * Builds the official SENIAT ISLR XML directly from registered purchase invoices
 */
export function buildSeniatIslrXmlFromInvoices(options: {
  agentRif: string;
  taxPeriod: string; // YYYYMM
  invoices: PurchaseInvoice[];
}): string {
  const targetPeriod = options.taxPeriod.replace(/[^0-9]/g, "").slice(0, 6);

  const rows: SeniatIslrXmlRow[] = options.invoices
    .filter((inv) => {
      if (!inv.retained_islr_amount || inv.retained_islr_amount <= 0) return false;
      const period = inv.invoice_date.slice(0, 7).replace("-", "");
      return period === targetPeriod;
    })
    .map((inv) => {
      const rate = inv.exchange_rate_applied || 1;
      const baseVes = inv.currency === "VES"
        ? inv.subtotal_taxable
        : Number((inv.subtotal_taxable * rate).toFixed(2));

      return {
        rifRetenido: inv.supplier_tax_id,
        numeroFactura: inv.invoice_number,
        numeroControl: inv.control_number || "0",
        fechaOperacion: inv.invoice_date,
        codigoConcepto: inv.islr_concept_code || "055",
        montoOperacion: baseVes,
        porcentajeRetencion: inv.islr_retention_rate_percent || 2.0,
      };
    });

  return buildSeniatIslrXml({
    agentRif: options.agentRif,
    taxPeriod: targetPeriod,
    rows,
  });
}
