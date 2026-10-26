import assert from "node:assert";
import { ACCOUNTING_MANIFEST } from "../manifest.ts";
import { DEFAULT_CHART_OF_ACCOUNTS } from "../constants/default-accounts.ts";
import {
  initializeChartOfAccounts,
  createJournalEntry,
  generateSalesInvoiceEntry,
  generatePurchaseInvoiceEntry,
  generateCustomerPaymentEntry,
  buildTrialBalance,
} from "../services/accounting-service.ts";
import type { FiscalDocument, PurchaseInvoice } from "@marketos/types";

console.log("🧪 [Ponytail & ECC Check] Running tests for @marketos/plugin-accounting...");

// 1. Manifest
assert.strictEqual(ACCOUNTING_MANIFEST.id, "accounting");
assert.strictEqual(ACCOUNTING_MANIFEST.category, "growth_operations");
console.log("  ✔ ACCOUNTING_MANIFEST is properly declared");

// 2. Chart of Accounts initialization
const accounts = initializeChartOfAccounts("tenant-test-1");
assert.ok(accounts.length >= 15, "Chart of accounts must have standard NIIF accounts");
assert.ok(accounts.some((a) => a.code === "1.1.01.01" && a.name.includes("Caja")));
assert.ok(accounts.some((a) => a.code === "2.1.02.01" && a.name.includes("Débito Fiscal")));
assert.ok(accounts.some((a) => a.code === "4.1.01.01" && a.name.includes("Ventas")));
console.log("  ✔ initializeChartOfAccounts provisions standard 4-level NIIF chart");

// 3. Double-entry validation (Debe = Haber)
const validEntry = createJournalEntry(
  {
    entry_date: "2026-10-26",
    concept: "Aporte inicial de capital",
    source_module: "MANUAL",
    lines: [
      { account_code: "1.1.01.01", account_name: "Caja", debit: 500, credit: 0 },
      { account_code: "3.1.01.01", account_name: "Capital", debit: 0, credit: 500 },
    ],
  },
  1,
  "tenant-test-1"
);
assert.strictEqual(validEntry.total_debit, 500);
assert.strictEqual(validEntry.total_credit, 500);
assert.strictEqual(validEntry.is_balanced, true);

// Unbalanced entry rejection
assert.throws(() => {
  createJournalEntry(
    {
      entry_date: "2026-10-26",
      concept: "Asiento descuadrado",
      source_module: "MANUAL",
      lines: [
        { account_code: "1.1.01.01", account_name: "Caja", debit: 500, credit: 0 },
        { account_code: "3.1.01.01", account_name: "Capital", debit: 0, credit: 400 },
      ],
    },
    2,
    "tenant-test-1"
  );
}, /El asiento #2 está descuadrado/);
console.log("  ✔ createJournalEntry enforces strict double-entry equilibrium");

// 4. Automatic Sales Invoice Entry (Contado + IVA 16% + IGTF 3%)
const mockInvoice: FiscalDocument = {
  id: "fdoc_1",
  tenant_id: "tenant-test-1",
  document_type: "INVOICE",
  document_number: "FACT-000001",
  control_number: "00-000001",
  status: "ISSUED",
  customer_name: "Inversiones Los Andes",
  customer_id_doc: "J-12345678-0",
  emitter_business_name: "MarketOS Store",
  emitter_id_doc: "J-00000000-0",
  emitter_address: "Caracas",
  items: [],
  subtotal_exempt: 0,
  subtotal_taxable: 100,
  iva_rate_percent: 16,
  iva_amount: 16,
  igtf_rate_percent: 3,
  igtf_amount: 3.48, // 3% on (100 + 16)
  total_amount: 119.48,
  currency: "USD",
  payment_condition: "CASH",
  created_at: "2026-10-26T12:00:00Z",
};

const salesEntry = generateSalesInvoiceEntry(mockInvoice, 2);
assert.strictEqual(salesEntry.total_debit, 119.48);
assert.strictEqual(salesEntry.total_credit, 119.48);
assert.strictEqual(salesEntry.is_balanced, true);
assert.strictEqual(salesEntry.lines[0].account_code, "1.1.01.01"); // Caja
assert.strictEqual(salesEntry.lines[1].account_code, "4.1.01.01"); // Ventas (100)
assert.strictEqual(salesEntry.lines[2].account_code, "2.1.02.01"); // IVA (16)
assert.strictEqual(salesEntry.lines[3].account_code, "2.1.02.02"); // IGTF (3.48)
console.log("  ✔ generateSalesInvoiceEntry produces balanced entry with IVA & IGTF");

// 5. Automatic Purchase Invoice Entry (Compras + Retención IVA 75% + Retención ISLR 2%)
const mockPurchase: PurchaseInvoice = {
  id: "pur_1",
  tenant_id: "tenant-test-1",
  supplier_id: "sup_1",
  supplier_name: "Distribuidora Polar C.A.",
  supplier_tax_id: "J-00000001-9",
  invoice_number: "PROV-9988",
  control_number: "00-000998",
  invoice_date: "2026-10-26",
  received_date: "2026-10-26",
  items: [],
  subtotal_exempt: 0,
  subtotal_taxable: 200,
  iva_rate_percent: 16,
  iva_amount: 32,
  total_amount: 232,
  retained_vat_amount: 24, // 75% on 32
  retained_islr_amount: 4, // 2% on 200
  net_payable_amount: 204, // 232 - 24 - 4
  status: "REGISTERED",
  currency: "USD",
  created_at: "2026-10-26T12:00:00Z",
};

const purchaseEntry = generatePurchaseInvoiceEntry(mockPurchase, 3);
assert.strictEqual(purchaseEntry.total_debit, 232); // 200 compras + 32 IVA
assert.strictEqual(purchaseEntry.total_credit, 232); // 24 ret IVA + 4 ret ISLR + 204 CxP
assert.strictEqual(purchaseEntry.is_balanced, true);
console.log("  ✔ generatePurchaseInvoiceEntry produces balanced entry with dual tax retentions");

// 6. Automatic Customer Payment Entry (CxC)
const cxcEntry = generateCustomerPaymentEntry(
  mockInvoice,
  {
    id: "pay_1",
    amount: 50,
    payment_date: "2026-10-26",
    payment_method: "TRANSFERENCIA",
    created_at: "2026-10-26T12:30:00Z",
  },
  4
);
assert.strictEqual(cxcEntry.total_debit, 50);
assert.strictEqual(cxcEntry.total_credit, 50);
assert.strictEqual(cxcEntry.lines[0].account_code, "1.1.01.02"); // Bancos
assert.strictEqual(cxcEntry.lines[1].account_code, "1.1.02.01"); // CxC Clientes
console.log("  ✔ generateCustomerPaymentEntry settles customer receivables accurately");

// 7. Trial Balance (Balance de Comprobación de Sumas y Saldos)
const trialReport = buildTrialBalance(
  [validEntry, salesEntry, purchaseEntry, cxcEntry],
  accounts,
  "2026-10",
  "tenant-test-1"
);
assert.strictEqual(trialReport.is_balanced, true);
assert.strictEqual(trialReport.total_period_debit, trialReport.total_period_credit);
assert.strictEqual(trialReport.total_final_debit, trialReport.total_final_credit);
console.log("  ✔ buildTrialBalance produces verified sumas y saldos equilibrium");

console.log("🎉 All 7 @marketos/plugin-accounting checks passed successfully!");
