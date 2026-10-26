/**
 * MarketOS Accounting Domain Types
 * Double-entry bookkeeping system: Chart of Accounts, Journal Entries, and Trial Balance.
 */

export type AccountClassification =
  | "ASSET"       // Activo (Caja, Bancos, Cuentas por Cobrar, Inventario, Crédito Fiscal)
  | "LIABILITY"   // Pasivo (Cuentas por Pagar, Débito Fiscal IVA, IGTF, Retenciones)
  | "EQUITY"      // Patrimonio (Capital Social, Resultados Acumulados)
  | "REVENUE"     // Ingresos (Ventas de Mercancías, Servicios Prestados)
  | "EXPENSE";    // Gastos / Costos (Costo de Ventas, Compras, Fletes, Gastos Operativos)

export type AccountNature = "DEBIT" | "CREDIT";

export interface Account {
  id: string;
  tenant_id: string;
  code: string;               // ej. "1.1.01.01"
  name: string;               // ej. "Caja General Efectivo"
  classification: AccountClassification;
  nature: AccountNature;      // Activos/Gastos = DEBIT, Pasivos/Patrimonio/Ingresos = CREDIT
  level: number;              // 1 (Grupo), 2 (Subgrupo), 3 (Rubro), 4 (Cuenta Operativa)
  parent_code?: string | null;
  is_active: boolean;
  description?: string | null;
}

export interface JournalEntryLine {
  id: string;
  account_code: string;
  account_name: string;
  description?: string | null;
  debit: number;              // Monto al Debe
  credit: number;             // Monto al Haber
}

export type JournalEntrySource =
  | "INVOICING"      // Factura de Venta / Nota de Crédito / Nota de Débito
  | "PURCHASING"     // Factura de Compra a Proveedor
  | "CXC"            // Cobranzas y Abonos de Clientes
  | "CXP"            // Pagos y Abonos a Proveedores
  | "POS_SHIFT"      // Arqueo y Cierre de Caja
  | "MANUAL";        // Asiento Manual de Ajuste / Apertura

export interface JournalEntry {
  id: string;
  tenant_id: string;
  entry_number: number;       // Correlativo del Asiento (1, 2, 3...)
  entry_date: string;         // YYYY-MM-DD
  concept: string;            // Glosa / Concepto del Asiento
  source_module: JournalEntrySource;
  source_document_id?: string | null;
  source_document_number?: string | null;
  lines: JournalEntryLine[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;       // total_debit === total_credit
  created_at: string;
  created_by?: string | null;
}

export interface CreateJournalEntryInput {
  entry_date: string;
  concept: string;
  source_module: JournalEntrySource;
  source_document_id?: string | null;
  source_document_number?: string | null;
  lines: Array<{
    account_code: string;
    account_name?: string;
    description?: string | null;
    debit: number;
    credit: number;
  }>;
  created_by?: string | null;
}

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  classification: AccountClassification;
  initial_debit: number;
  initial_credit: number;
  period_debit: number;
  period_credit: number;
  final_debit: number;
  final_credit: number;
}

export interface TrialBalanceReport {
  period: string; // YYYY-MM
  tenant_id: string;
  generated_at: string;
  rows: TrialBalanceRow[];
  total_initial_debit: number;
  total_initial_credit: number;
  total_period_debit: number;
  total_period_credit: number;
  total_final_debit: number;
  total_final_credit: number;
  is_balanced: boolean;
}
