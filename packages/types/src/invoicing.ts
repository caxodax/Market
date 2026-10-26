/**
 * MarketOS Invoicing & Commercial Documents Domain Types
 * Universal Multi-Country Engine: Invoices, Credit Notes, Debit Notes, Delivery Notes & Dispatch Guides.
 */

export type FiscalDocumentType =
  | "INVOICE"         // Factura de Venta / Boleta Electrónica
  | "CREDIT_NOTE"     // Nota de Crédito (Anulaciones / Devoluciones con reposición de inventario)
  | "DEBIT_NOTE"      // Nota de Débito (Ajustes de precio / recargos posteriores)
  | "DELIVERY_NOTE"   // Orden / Nota de Entrega (Comprobante interno de recepción y despacho)
  | "DISPATCH_GUIDE"; // Guía de Despacho (Documento de traslado en tránsito: chofer, placas, ruta)

export type FiscalDocumentStatus = "ISSUED" | "ANNULLED";

export type PaymentCondition = "CASH" | "CREDIT";
export type PaymentTermStatus = "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";

export interface AccountPaymentRecord {
  id: string;
  amount: number;
  payment_date: string; // YYYY-MM-DD
  payment_method: string;
  reference?: string | null;
  notes?: string | null;
  registered_by?: string | null;
  created_at: string;
}

export interface FiscalDocumentItem {
  id: string;
  product_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_exempt?: boolean;
  tax_rate_percent?: number;
}

export interface FiscalDocumentTransportInfo {
  driver_name?: string;
  driver_id_doc?: string;   // Cédula en VE, RUT en CL, Licencia internacional
  driver_phone?: string;
  vehicle_model?: string;
  vehicle_plate?: string;
  origin_address?: string;
  destination_address?: string;
  packages_count?: number;
  seal_number?: string;
  transport_reason?: string; // "Venta", "Traslado entre sucursales", "Devolución"
}

export interface FiscalDocument {
  id: string;
  tenant_id: string;
  order_id?: string | null;
  document_type: FiscalDocumentType;
  document_number: string;           // Ej: FACT-000001, NC-000001, GD-000001
  control_number?: string | null;     // Ej: 00-000001 (SENIAT) o Folio DTE (SII)
  affected_document_id?: string | null;     // ID del documento que modifica (para NC y ND)
  affected_document_number?: string | null; // Número de factura afectada (para NC y ND)
  status: FiscalDocumentStatus;
  reason?: string | null;            // Motivo de emisión o corrección
  return_items_to_inventory?: boolean; // Si true, reingresa automáticamente al inventario (para NC)

  // Datos del Cliente / Receptor
  customer_name: string;
  customer_id_doc: string;          // RIF en VE, RUT en CL, DNI en otros
  customer_address?: string | null;
  customer_phone?: string | null;

  // Datos del Emisor Fiscal
  emitter_business_name: string;
  emitter_id_doc: string;           // RIF / RUT del comercio
  emitter_address: string;

  // Ítems y Desglose Financiero
  items: FiscalDocumentItem[];
  subtotal_exempt: number;
  subtotal_taxable: number;
  iva_rate_percent: number;
  iva_amount: number;
  igtf_rate_percent?: number;
  igtf_amount?: number;
  total_amount: number;             // Total en divisa base (USD, EUR, CLP)
  total_ves?: number;               // Conversión a Bs. en caso de operar en Venezuela
  exchange_rate_applied?: number;
  currency: "USD" | "EUR" | "CLP" | "VES";

  // Datos de Transporte / Despacho
  transport_info?: FiscalDocumentTransportInfo;

  // Términos de Pago y Cuentas por Cobrar (CxC)
  payment_condition?: PaymentCondition;
  credit_term_days?: number;
  due_date?: string | null;
  payment_status?: PaymentTermStatus;
  amount_paid?: number;
  amount_due?: number;
  payments?: AccountPaymentRecord[];

  // Metadatos y Leyendas Legales
  qr_data?: string | null;
  legal_legend?: string | null;     // Leyenda SENIAT / SII / Comercial
  created_at: string;
  created_by?: string | null;
}

export interface CreateFiscalDocumentInput {
  order_id?: string | null;
  document_type: FiscalDocumentType;
  control_number?: string | null;
  affected_document_id?: string | null;
  affected_document_number?: string | null;
  reason?: string | null;
  return_items_to_inventory?: boolean;

  // Términos de Pago (Contado vs Crédito)
  payment_condition?: PaymentCondition;
  credit_term_days?: number;
  due_date?: string | null;

  customer_name: string;
  customer_id_doc: string;
  customer_address?: string | null;
  customer_phone?: string | null;

  items: Array<{
    product_id?: string;
    name: string;
    quantity: number;
    unit_price: number;
    is_exempt?: boolean;
    tax_rate_percent?: number;
  }>;

  currency?: "USD" | "EUR" | "CLP" | "VES";
  exchange_rate_applied?: number;
  apply_igtf?: boolean;

  transport_info?: FiscalDocumentTransportInfo;
}

/**
 * Official Sales Book Entry (Libro de Ventas Fiscal)
 * Compliant with SENIAT Art. 56 / Providencia 00071 & SII Chile RCV.
 */
export interface SalesBookEntry {
  operation_number: number;
  document_date: string;                     // YYYY-MM-DD
  customer_id_doc: string;                   // RIF en VE / RUT en CL
  customer_name: string;
  document_type: FiscalDocumentType;
  document_number: string;                   // FACT-000001, NC-000001
  control_number: string;                    // N° de Control SENIAT o Folio DTE
  affected_document_number?: string | null;  // N° de Factura Afectada (para NC/ND)
  total_with_tax: number;                    // Total ventas incluyendo impuestos
  exempt_amount: number;                     // Ventas exentas o no gravadas
  taxable_base: number;                      // Base imponible general
  tax_rate_percent: number;                  // 16% en VE / 19% en CL
  tax_amount: number;                        // Débito fiscal IVA
  igtf_amount: number;                       // IGTF percibido (3%) en pagos en divisas
  retained_vat_amount: number;               // IVA retenido por el cliente (si es SPE)
  retention_voucher_number?: string | null;
}

export interface SalesBookTotals {
  total_sales: number;
  total_exempt: number;
  total_taxable_base: number;
  total_vat: number;
  total_igtf: number;
  total_retained_vat: number;
  documents_count: number;
}

export interface SalesBookReport {
  period: string;                            // "YYYY-MM" (ej. "2026-10")
  tenant_id: string;
  emitter_business_name: string;
  emitter_id_doc: string;                    // RIF / RUT
  emitter_address?: string;
  currency: "USD" | "EUR" | "CLP" | "VES";
  generated_at: string;
  entries: SalesBookEntry[];
  totals: SalesBookTotals;
}

