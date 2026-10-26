/**
 * MarketOS Purchasing & Tax Retentions Domain Types
 * Universal Multi-Country Engine: Vendor procurement, Purchase Invoices,
 * SENIAT VAT & Income Tax Retentions (Sujetos Pasivos Especiales), and Chile DTE 46 / RCV.
 */

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  tax_id: string;               // RIF en VE (ej. J-12345678-0), RUT en CL (ej. 76.123.456-7), Tax ID
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  default_retention_rate?: number; // 75% o 100% en VE
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
}

export type PurchaseInvoiceStatus = "REGISTERED" | "PAID" | "ANNULLED";

export interface PurchaseInvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_exempt?: boolean;
  tax_rate_percent?: number;
}

export interface PurchaseInvoice {
  id: string;
  tenant_id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_tax_id: string;
  invoice_number: string;          // Número de factura emitido por el proveedor
  control_number?: string | null;   // Número de control SENIAT (en Venezuela)
  invoice_date: string;            // Fecha de emisión de la factura
  received_date: string;           // Fecha de recepción en el sistema
  status: PurchaseInvoiceStatus;
  notes?: string | null;

  items: PurchaseInvoiceItem[];
  subtotal_exempt: number;
  subtotal_taxable: number;
  iva_rate_percent: number;
  iva_amount: number;
  total_amount: number;            // Total en la divisa registrada
  currency: "USD" | "EUR" | "CLP" | "VES";
  exchange_rate_applied?: number;  // Tasa de cambio oficial del día de la factura
  total_ves?: number;              // Total en Bs para libros de compra en Venezuela

  // Retenciones asociadas
  retention_voucher_id?: string | null;
  retained_vat_amount?: number;    // Monto retenido de IVA
  retained_islr_amount?: number;   // Monto retenido de ISLR

  created_at: string;
  created_by?: string | null;
}

export type RetentionVoucherType =
  | "VAT"            // Retención de IVA (75% / 100% Sujetos Pasivos Especiales)
  | "INCOME_TAX"     // Retención de ISLR / Renta (Decreto 1808 en VE, Honorarios en CL)
  | "CHILE_DTE_46";  // Factura de Compra con retención de IVA (SII Chile)

export interface RetentionVoucher {
  id: string;
  tenant_id: string;
  voucher_type: RetentionVoucherType;
  voucher_number: string;          // Correlativo SENIAT YYYYMM-XXXXXXXX o Folio DTE
  tax_period: string;              // Periodo fiscal: YYYYMM (ej. "202610")
  issue_date: string;              // Fecha de emisión del comprobante

  // Datos del Agente de Retención (El Comercio)
  agent_business_name: string;
  agent_tax_id: string;            // RIF / RUT del comercio
  agent_fiscal_address: string;

  // Datos del Proveedor (Sujeto Retenido)
  supplier_id: string;
  supplier_name: string;
  supplier_tax_id: string;
  supplier_fiscal_address?: string | null;

  // Documento de Compra Afectado
  purchase_invoice_id: string;
  invoice_number: string;
  control_number?: string | null;
  invoice_date: string;

  // Bases y Desglose Tributario
  invoice_total_amount: number;
  taxable_base_amount: number;
  exempt_base_amount: number;
  iva_rate_percent: number;
  iva_total_amount: number;
  retention_rate_percent: number;  // Ej: 75% o 100%
  retained_amount: number;         // Monto efectivamente retenido
  currency: "USD" | "EUR" | "CLP" | "VES";
  exchange_rate_applied?: number;
  retained_amount_ves?: number;

  legal_legend?: string;
  created_at: string;
  created_by?: string | null;
}

export interface CreatePurchaseInvoiceInput {
  supplier_name: string;
  supplier_tax_id: string;
  supplier_email?: string | null;
  supplier_phone?: string | null;
  supplier_address?: string | null;

  invoice_number: string;
  control_number?: string | null;
  invoice_date: string;
  notes?: string | null;

  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    is_exempt?: boolean;
    tax_rate_percent?: number;
  }>;

  currency?: "USD" | "EUR" | "CLP" | "VES";
  exchange_rate_applied?: number;

  // Parámetros de emisión automática de retención
  auto_generate_retention?: boolean;
  retention_rate_percent?: number; // 75 o 100 (default 75 para SPE ordinarios)
  retention_type?: RetentionVoucherType;
}

export interface CreateRetentionVoucherInput {
  purchase_invoice_id: string;
  voucher_type: RetentionVoucherType;
  retention_rate_percent: number;  // 75 o 100
  tax_period?: string;             // YYYYMM
  issue_date?: string;
}

/**
 * Representa una fila del archivo TXT oficial del SENIAT para retenciones de IVA
 * Providencia SNAT/2015/0049.
 */
export interface SeniatRetentionTxtRow {
  agentRif: string;               // RIF del Agente de Retención (sin guiones)
  taxPeriod: string;              // Periodo fiscal: YYYYMM (ej. 202610)
  invoiceDate: string;            // Fecha de emisión: YYYY-MM-DD
  operationType: "C";             // "C" para Compras
  documentType: "01" | "02" | "03"; // 01: Factura, 02: Nota de Débito, 03: Nota de Crédito
  supplierRif: string;            // RIF del Proveedor retenido (sin guiones)
  invoiceNumber: string;          // Número de factura
  controlNumber: string;          // Número de control SENIAT
  totalAmountVes: number;         // Total de la factura en Bs.
  taxableBaseVes: number;         // Base imponible en Bs.
  retainedAmountVes: number;      // Impuesto retenido en Bs.
  affectedInvoiceNumber?: string; // Solo si es NC o ND
  voucherNumber: string;          // Número de comprobante de retención (14 dígitos)
  exemptAmountVes: number;        // Monto exento en Bs.
  ivaRatePercent: number;         // Alícuota (ej. 16.00)
  fileNumber?: string;            // Número de expediente (opcional, default 0)
}

/**
 * Official Purchases Book Entry (Libro de Compras Fiscal)
 * Compliant with SENIAT Art. 56 / Providencia 00071 & SII Chile RCV / DTE 46.
 */
export interface PurchasesBookEntry {
  operation_number: number;
  invoice_date: string;                      // YYYY-MM-DD
  supplier_tax_id: string;                   // RIF en VE / RUT en CL
  supplier_name: string;
  document_type: "FACTURA" | "NOTA_CREDITO" | "NOTA_DEBITO" | "DTE-46" | "BOLETA";
  invoice_number: string;                    // N° de Factura emitida por el proveedor
  control_number: string;                    // N° de Control fiscal
  affected_document_number?: string | null;  // Factura afectada si NC/ND
  total_with_tax: number;                    // Total compra incluyendo impuestos
  exempt_amount: number;                     // Compras exentas o sin crédito fiscal
  taxable_base: number;                      // Base imponible
  tax_rate_percent: number;                  // 16% en VE / 19% en CL
  tax_amount: number;                        // Crédito fiscal IVA
  retained_vat_amount: number;               // IVA retenido al proveedor (75% o 100%)
  retention_voucher_number?: string | null;  // N° de comprobante emitido (14 dígitos)
  retention_voucher_date?: string | null;
}

export interface PurchasesBookTotals {
  total_purchases: number;
  total_exempt: number;
  total_taxable_base: number;
  total_vat_credit: number;
  total_retained_vat: number;
  invoices_count: number;
}

export interface PurchasesBookReport {
  period: string;                            // "YYYY-MM" (ej. "2026-10")
  tenant_id: string;
  buyer_business_name: string;
  buyer_id_doc: string;                      // RIF / RUT del comercio adquirente
  buyer_address?: string;
  currency: "USD" | "EUR" | "CLP" | "VES";
  generated_at: string;
  entries: PurchasesBookEntry[];
  totals: PurchasesBookTotals;
}

