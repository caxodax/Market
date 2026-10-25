import type {
  CreateFiscalDocumentInput,
  FiscalDocument,
  FiscalDocumentItem,
  TenantSettings,
} from "@marketos/types";
import { resolveFiscalAdapter } from "../adapters/fiscal-adapter.ts";

export interface PrepareFiscalDocumentOptions {
  input: CreateFiscalDocumentInput;
  settings: TenantSettings;
  existingCount: number;
  activeModuleIds?: string[];
  actorName?: string;
  affectedInvoice?: FiscalDocument | null;
}

export function prepareFiscalDocument(
  options: PrepareFiscalDocumentOptions
): FiscalDocument {
  const { input, settings, existingCount, activeModuleIds = [], actorName, affectedInvoice } = options;

  const adapter = resolveFiscalAdapter(undefined, activeModuleIds);

  // 1. Validar Tipo de Documento y Reglas de Negocio
  if (input.document_type === "CREDIT_NOTE" || input.document_type === "DEBIT_NOTE") {
    if (!input.affected_document_number && !affectedInvoice?.document_number) {
      throw new Error(
        `Para emitir una ${
          input.document_type === "CREDIT_NOTE" ? "Nota de Crédito" : "Nota de Débito"
        } es obligatorio especificar el Número de Factura Afectada.`
      );
    }
  }

  // 2. Desglose de Ítems
  const items: FiscalDocumentItem[] = input.items.map((it, idx) => ({
    id: `item-${Date.now()}-${idx}`,
    product_id: it.product_id,
    name: it.name,
    quantity: it.quantity,
    unit_price: it.unit_price,
    total_price: Number((it.quantity * it.unit_price).toFixed(2)),
    is_exempt: Boolean(it.is_exempt),
    tax_rate_percent: it.tax_rate_percent ?? (it.is_exempt ? 0 : adapter.defaultIvaRate),
  }));

  // 3. Cálculo Tributario Desacoplado por Adaptador
  const breakdown = adapter.calculateTaxes({
    items: input.items.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      unitPrice: it.unit_price,
      isExempt: it.is_exempt,
      taxRatePercent: it.tax_rate_percent,
    })),
    currency: input.currency || "USD",
    applyIgtf: Boolean(input.apply_igtf),
    exchangeRate: input.exchange_rate_applied,
  });

  // 4. Validación de Monto en Nota de Crédito (No puede superar la factura afectada)
  if (input.document_type === "CREDIT_NOTE" && affectedInvoice) {
    if (breakdown.total > affectedInvoice.total_amount + 0.05) {
      throw new Error(
        `El monto de la Nota de Crédito ($${breakdown.total.toFixed(2)}) no puede exceder el total de la Factura Afectada ($${affectedInvoice.total_amount.toFixed(2)}).`
      );
    }
  }

  // 5. Correlativo Oficial
  const sequence = existingCount + 1;
  const documentNumber = adapter.formatDocumentNumber(input.document_type, sequence);

  // 6. Número de Control (SENIAT o Correlativo Fiscal)
  const prefix = settings.billing_settings?.control_prefix || "00-";
  const controlNumber =
    input.control_number ||
    `${prefix}${String(sequence).padStart(6, "0")}`;

  // 7. Leyenda Legal
  const legalLegend = adapter.getLegalLegend(input.document_type);

  // 8. CUV / QR Data
  const qrData = JSON.stringify({
    tenant: settings.tenant_id,
    doc: documentNumber,
    ctrl: controlNumber,
    emitter_rif: settings.billing_settings?.emitter_fiscal_data?.rif || "N/A",
    customer_rif: input.customer_id_doc,
    total: breakdown.total,
    date: new Date().toISOString().split("T")[0],
  });

  const now = new Date().toISOString();

  return {
    id: `fdoc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    tenant_id: settings.tenant_id,
    order_id: input.order_id || null,
    document_type: input.document_type,
    document_number: documentNumber,
    control_number: controlNumber,
    affected_document_id: input.affected_document_id || affectedInvoice?.id || null,
    affected_document_number:
      input.affected_document_number || affectedInvoice?.document_number || null,
    status: "ISSUED",
    reason: input.reason || null,
    return_items_to_inventory: Boolean(input.return_items_to_inventory),

    customer_name: input.customer_name,
    customer_id_doc: input.customer_id_doc,
    customer_address: input.customer_address || null,
    customer_phone: input.customer_phone || null,

    emitter_business_name:
      settings.billing_settings?.emitter_fiscal_data?.business_name ||
      settings.business_name,
    emitter_id_doc:
      settings.billing_settings?.emitter_fiscal_data?.rif ||
      "J-00000000-0",
    emitter_address:
      settings.billing_settings?.emitter_fiscal_data?.fiscal_address ||
      settings.address ||
      "Sede Principal",

    items,
    subtotal_exempt: breakdown.subtotalExempt,
    subtotal_taxable: breakdown.subtotalTaxable,
    iva_rate_percent: breakdown.ivaRatePercent,
    iva_amount: breakdown.ivaAmount,
    igtf_rate_percent: breakdown.igtfRatePercent,
    igtf_amount: breakdown.igtfAmount,
    total_amount: breakdown.total,
    total_ves: breakdown.totalVes,
    exchange_rate_applied: input.exchange_rate_applied,
    currency: input.currency || "USD",

    transport_info: input.transport_info,
    qr_data: qrData,
    legal_legend: legalLegend,
    created_at: now,
    created_by: actorName || "Admin",
  };
}
