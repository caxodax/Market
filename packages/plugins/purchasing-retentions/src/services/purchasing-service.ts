import type {
  CreatePurchaseInvoiceInput,
  PurchaseInvoice,
  PurchaseInvoiceItem,
  RetentionVoucher,
  TenantSettings,
  SeniatRetentionTxtRow,
  CreateRetentionVoucherInput,
} from "@marketos/types";
import { resolveRetentionAdapter } from "../adapters/retention-adapter.ts";

export interface PreparePurchaseInvoiceResult {
  invoice: PurchaseInvoice;
  retentionVoucher?: RetentionVoucher;
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

  let retentionVoucher: RetentionVoucher | undefined = undefined;
  let retainedVatAmount = 0;

  if (input.auto_generate_retention && ivaAmount > 0) {
    const retentionRate = input.retention_rate_percent ?? adapter.defaultVatRetentionRate;
    const { vatRetainedAmount } = adapter.calculateVatRetention(ivaAmount, retentionRate);
    retainedVatAmount = vatRetainedAmount;

    const taxPeriod = input.invoice_date.slice(0, 7).replace("-", ""); // YYYYMM
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

    created_at: now,
    created_by: actorName || "Admin",
  };

  return { invoice, retentionVoucher };
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

  const { vatRetainedAmount } = adapter.calculateVatRetention(
    invoice.iva_amount,
    input.retention_rate_percent
  );

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
    retained_amount: vatRetainedAmount,
    currency: invoice.currency,
    exchange_rate_applied: invoice.exchange_rate_applied,
    retained_amount_ves: Number((vatRetainedAmount * rate).toFixed(2)),

    legal_legend: adapter.getLegalLegend(input.voucher_type),
    created_at: new Date().toISOString(),
    created_by: actorName || "Admin",
  };
}

/**
 * Builds the official SENIAT TXT file content for uploading to the portal
 */
export function buildSeniatRetentionTxt(rows: SeniatRetentionTxtRow[]): string {
  const adapter = resolveRetentionAdapter("VE", ["local_venezuela"]);
  const lines = rows.map((r) => adapter.formatSeniatTxtLine!(r));
  return lines.join("\r\n");
}
