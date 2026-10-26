import type {
  Account,
  AccountPaymentRecord,
  CreateJournalEntryInput,
  FiscalDocument,
  JournalEntry,
  JournalEntryLine,
  PurchaseInvoice,
  TrialBalanceReport,
  TrialBalanceRow,
} from "@marketos/types";
import { DEFAULT_CHART_OF_ACCOUNTS } from "../constants/default-accounts.ts";

/**
 * Inicializa el catálogo de cuentas contables de fábrica para un comercio.
 */
export function initializeChartOfAccounts(tenantId: string): Account[] {
  return DEFAULT_CHART_OF_ACCOUNTS.map((acc, index) => ({
    ...acc,
    id: `acc_${tenantId}_${acc.code.replace(/\./g, "_")}`,
    tenant_id: tenantId,
  }));
}

/**
 * Valida y crea un asiento contable con estricto principio de Partida Doble (Debe = Haber).
 */
export function createJournalEntry(
  input: CreateJournalEntryInput,
  entryNumber: number,
  tenantId: string
): JournalEntry {
  if (!input.lines || input.lines.length < 2) {
    throw new Error("Un asiento contable debe contener al menos 2 líneas de movimiento.");
  }

  let totalDebit = 0;
  let totalCredit = 0;

  const lines: JournalEntryLine[] = input.lines.map((l, idx) => {
    const debit = Number(Number(l.debit || 0).toFixed(2));
    const credit = Number(Number(l.credit || 0).toFixed(2));
    totalDebit += debit;
    totalCredit += credit;

    return {
      id: `jline_${Date.now()}_${idx}`,
      account_code: l.account_code,
      account_name: l.account_name || l.account_code,
      description: l.description || null,
      debit,
      credit,
    };
  });

  totalDebit = Number(totalDebit.toFixed(2));
  totalCredit = Number(totalCredit.toFixed(2));

  const diff = Math.abs(totalDebit - totalCredit);
  if (diff > 0.015) {
    throw new Error(
      `El asiento #${entryNumber} está descuadrado: Total Debe ($${totalDebit.toFixed(
        2
      )}) ≠ Total Haber ($${totalCredit.toFixed(2)}). Diferencia: $${diff.toFixed(2)}.`
    );
  }

  return {
    id: `jentry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    tenant_id: tenantId,
    entry_number: entryNumber,
    entry_date: input.entry_date,
    concept: input.concept,
    source_module: input.source_module,
    source_document_id: input.source_document_id || null,
    source_document_number: input.source_document_number || null,
    lines,
    total_debit: totalDebit,
    total_credit: totalCredit,
    is_balanced: true,
    created_at: new Date().toISOString(),
    created_by: input.created_by || "Sistema Contable",
  };
}

/**
 * Genera el asiento contable automático por emisión de Factura de Venta.
 * Débito: Caja/Bancos o Cuentas por Cobrar
 * Crédito: Ventas de Mercancías + Débito Fiscal IVA + IGTF (si aplica)
 */
export function generateSalesInvoiceEntry(
  doc: FiscalDocument,
  entryNumber: number
): JournalEntry {
  const isCredit = doc.payment_condition === "CREDIT";
  const date = doc.created_at.split("T")[0];

  const netSales = Number((doc.subtotal_taxable + doc.subtotal_exempt).toFixed(2));
  const vatAmount = Number((doc.iva_amount || 0).toFixed(2));
  const igtfAmount = Number((doc.igtf_amount || 0).toFixed(2));
  const totalAmount = Number((netSales + vatAmount + igtfAmount).toFixed(2));

  const lines: CreateJournalEntryInput["lines"] = [];

  // Línea al Debe: Caja o CxC Clientes
  if (isCredit) {
    lines.push({
      account_code: "1.1.02.01",
      account_name: "Cuentas por Cobrar Clientes (CxC)",
      description: `Factura a Crédito ${doc.document_number} - ${doc.customer_name}`,
      debit: totalAmount,
      credit: 0,
    });
  } else {
    lines.push({
      account_code: "1.1.01.01",
      account_name: "Caja General / Efectivo",
      description: `Cobro Factura ${doc.document_number} - ${doc.customer_name}`,
      debit: totalAmount,
      credit: 0,
    });
  }

  // Línea al Haber: Ventas Netas
  lines.push({
    account_code: "4.1.01.01",
    account_name: "Ventas de Mercancías",
    description: `Ingreso por Venta Factura ${doc.document_number}`,
    debit: 0,
    credit: netSales,
  });

  // Línea al Haber: Débito Fiscal IVA
  if (vatAmount > 0) {
    lines.push({
      account_code: "2.1.02.01",
      account_name: "Débito Fiscal IVA",
      description: `IVA 16% Factura ${doc.document_number}`,
      debit: 0,
      credit: vatAmount,
    });
  }

  // Línea al Haber: IGTF 3%
  if (igtfAmount > 0) {
    lines.push({
      account_code: "2.1.02.02",
      account_name: "IGTF Percibido por Enterar (3%)",
      description: `IGTF 3% percibido en divisas Factura ${doc.document_number}`,
      debit: 0,
      credit: igtfAmount,
    });
  }

  return createJournalEntry(
    {
      entry_date: date,
      concept: `Venta según ${doc.document_number} a ${doc.customer_name}`,
      source_module: "INVOICING",
      source_document_id: doc.id,
      source_document_number: doc.document_number,
      lines,
    },
    entryNumber,
    doc.tenant_id
  );
}

/**
 * Genera el asiento contable automático por recepción de Factura de Compra de Proveedor.
 * Débito: Compras / Inventario + Crédito Fiscal IVA
 * Crédito: Retención IVA (si aplica) + Retención ISLR (si aplica) + Cuentas por Pagar Proveedor
 */
export function generatePurchaseInvoiceEntry(
  invoice: PurchaseInvoice,
  entryNumber: number
): JournalEntry {
  const date = invoice.invoice_date || invoice.created_at.split("T")[0];
  const netPurchases = Number(
    (invoice.subtotal_taxable + invoice.subtotal_exempt).toFixed(2)
  );
  const vatAmount = Number((invoice.iva_amount || 0).toFixed(2));
  const retVat = Number((invoice.retained_vat_amount || 0).toFixed(2));
  const retIslr = Number((invoice.retained_islr_amount || 0).toFixed(2));

  const netPayable = Number(
    (invoice.net_payable_amount ?? Math.max(0, invoice.total_amount - retVat - retIslr)).toFixed(2)
  );

  const lines: CreateJournalEntryInput["lines"] = [];

  // Débito: Compras / Inventario
  lines.push({
    account_code: "5.1.01.01",
    account_name: "Compras y Costo de Ventas",
    description: `Compra Factura ${invoice.invoice_number} - ${invoice.supplier_name}`,
    debit: netPurchases,
    credit: 0,
  });

  // Débito: Crédito Fiscal IVA
  if (vatAmount > 0) {
    lines.push({
      account_code: "1.1.03.01",
      account_name: "Crédito Fiscal IVA",
      description: `Crédito Fiscal IVA Factura ${invoice.invoice_number}`,
      debit: vatAmount,
      credit: 0,
    });
  }

  // Crédito: Retención de IVA por Enterar
  if (retVat > 0) {
    lines.push({
      account_code: "2.1.03.01",
      account_name: "Retenciones de IVA por Enterar",
      description: `Retención IVA aplicada Factura ${invoice.invoice_number}`,
      debit: 0,
      credit: retVat,
    });
  }

  // Crédito: Retención de ISLR por Enterar
  if (retIslr > 0) {
    lines.push({
      account_code: "2.1.03.02",
      account_name: "Retenciones de ISLR por Enterar",
      description: `Retención ISLR aplicada Factura ${invoice.invoice_number}`,
      debit: 0,
      credit: retIslr,
    });
  }

  // Crédito: Cuentas por Pagar Proveedores
  lines.push({
    account_code: "2.1.01.01",
    account_name: "Cuentas por Pagar Proveedores (CxP)",
    description: `Neto a pagar Proveedor ${invoice.supplier_name}`,
    debit: 0,
    credit: netPayable,
  });

  return createJournalEntry(
    {
      entry_date: date,
      concept: `Compra según Factura ${invoice.invoice_number} de ${invoice.supplier_name}`,
      source_module: "PURCHASING",
      source_document_id: invoice.id,
      source_document_number: invoice.invoice_number,
      lines,
    },
    entryNumber,
    invoice.tenant_id
  );
}

/**
 * Genera el asiento contable automático por cobro / abono de cliente (CxC).
 * Débito: Caja / Bancos
 * Crédito: Cuentas por Cobrar Clientes
 */
export function generateCustomerPaymentEntry(
  doc: FiscalDocument,
  payment: AccountPaymentRecord,
  entryNumber: number
): JournalEntry {
  const date = payment.payment_date || new Date().toISOString().split("T")[0];
  const amount = Number(payment.amount.toFixed(2));

  const isBank =
    payment.payment_method === "PAGO_MOVIL" ||
    payment.payment_method === "TRANSFERENCIA" ||
    payment.payment_method === "ZELLE";

  return createJournalEntry(
    {
      entry_date: date,
      concept: `Cobro ${payment.payment_method} Factura ${doc.document_number} - ${doc.customer_name}`,
      source_module: "CXC",
      source_document_id: doc.id,
      source_document_number: doc.document_number,
      lines: [
        {
          account_code: isBank ? "1.1.01.02" : "1.1.01.01",
          account_name: isBank
            ? "Bancos / Cuentas Bancarias"
            : "Caja General / Efectivo",
          description: `Cobro recibido Ref: ${payment.reference || "S/R"}`,
          debit: amount,
          credit: 0,
        },
        {
          account_code: "1.1.02.01",
          account_name: "Cuentas por Cobrar Clientes (CxC)",
          description: `Abono a Factura ${doc.document_number}`,
          debit: 0,
          credit: amount,
        },
      ],
    },
    entryNumber,
    doc.tenant_id
  );
}

/**
 * Genera el Balance de Comprobación (Sumas y Saldos) a partir de los asientos contables y catálogo.
 */
export function buildTrialBalance(
  entries: JournalEntry[],
  accounts: Account[],
  period: string,
  tenantId: string
): TrialBalanceReport {
  const accountMap = new Map<string, { debit: number; credit: number }>();

  // Consolidar movimientos de asientos
  for (const entry of entries) {
    for (const line of entry.lines) {
      const current = accountMap.get(line.account_code) || { debit: 0, credit: 0 };
      current.debit = Number((current.debit + line.debit).toFixed(2));
      current.credit = Number((current.credit + line.credit).toFixed(2));
      accountMap.set(line.account_code, current);
    }
  }

  const rows: TrialBalanceRow[] = [];
  let totalPeriodDebit = 0;
  let totalPeriodCredit = 0;
  let totalFinalDebit = 0;
  let totalFinalCredit = 0;

  for (const acc of accounts) {
    const mov = accountMap.get(acc.code) || { debit: 0, credit: 0 };

    // Si la cuenta no tuvo movimientos y no es de nivel 4, omitir para no saturar
    if (mov.debit === 0 && mov.credit === 0 && acc.level < 4) continue;

    const net = Number((mov.debit - mov.credit).toFixed(2));
    let finalDebit = 0;
    let finalCredit = 0;

    if (acc.nature === "DEBIT") {
      finalDebit = Math.max(0, net);
      finalCredit = net < 0 ? Math.abs(net) : 0;
    } else {
      finalCredit = Math.max(0, -net);
      finalDebit = net > 0 ? net : 0;
    }

    rows.push({
      account_code: acc.code,
      account_name: acc.name,
      classification: acc.classification,
      initial_debit: 0,
      initial_credit: 0,
      period_debit: mov.debit,
      period_credit: mov.credit,
      final_debit: finalDebit,
      final_credit: finalCredit,
    });

    totalPeriodDebit += mov.debit;
    totalPeriodCredit += mov.credit;
    totalFinalDebit += finalDebit;
    totalFinalCredit += finalCredit;
  }

  // Ordenar por código de cuenta
  rows.sort((a, b) => a.account_code.localeCompare(b.account_code));

  totalPeriodDebit = Number(totalPeriodDebit.toFixed(2));
  totalPeriodCredit = Number(totalPeriodCredit.toFixed(2));
  totalFinalDebit = Number(totalFinalDebit.toFixed(2));
  totalFinalCredit = Number(totalFinalCredit.toFixed(2));

  return {
    period,
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    rows,
    total_initial_debit: 0,
    total_initial_credit: 0,
    total_period_debit: totalPeriodDebit,
    total_period_credit: totalPeriodCredit,
    total_final_debit: totalFinalDebit,
    total_final_credit: totalFinalCredit,
    is_balanced: Math.abs(totalPeriodDebit - totalPeriodCredit) <= 0.05,
  };
}
