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
