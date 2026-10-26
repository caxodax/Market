import assert from "node:assert";
import {
  validateChileanRut,
  validateVenezuelanRif,
  VenezuelaFiscalAdapter,
  ChileFiscalAdapter,
  GlobalFiscalAdapter,
  resolveFiscalAdapter,
} from "../adapters/fiscal-adapter.ts";
import { prepareFiscalDocument } from "../services/invoicing-service.ts";
import { INVOICING_MANIFEST } from "../manifest.ts";
import type { TenantSettings, FiscalDocument } from "@marketos/types";

console.log("🧪 [Ponytail & ECC Check] Running tests for @marketos/plugin-invoicing...");

// 1. Manifest
assert.strictEqual(INVOICING_MANIFEST.id, "invoicing");
assert.strictEqual(INVOICING_MANIFEST.country_code, "GLOBAL");
console.log("  ✔ INVOICING_MANIFEST is valid and declared as GLOBAL");

// 2. Chilean RUT validation (Módulo 11)
// Let's test a known valid RUT: "11.111.111-1"
// 1*2 + 1*3 + 1*4 + 1*5 + 1*6 + 1*7 + 1*2 + 1*3 = 2+3+4+5+6+7+2+3 = 32. 32%11 = 10. 11-10 = 1.
assert.strictEqual(validateChileanRut("11.111.111-1"), true, "11.111.111-1 should be valid");
assert.strictEqual(validateChileanRut("111111111"), true, "clean 111111111 without hyphen should be valid");
assert.strictEqual(validateChileanRut("11.111.111-9"), false, "11.111.111-9 with wrong DV should be invalid");
assert.strictEqual(validateChileanRut("123"), false, "short RUT should be invalid");
console.log("  ✔ Chilean RUT validator (Modulo 11) functions accurately");

// 3. Venezuelan RIF validation
assert.strictEqual(validateVenezuelanRif("J-12345678-0"), true, "J-12345678-0 should be valid");
assert.strictEqual(validateVenezuelanRif("V-12345678"), true, "V-12345678 should be valid");
assert.strictEqual(validateVenezuelanRif("G-200000001"), true, "G-200000001 should be valid");
assert.strictEqual(validateVenezuelanRif("Z-12345678"), false, "Z prefix should be invalid");
console.log("  ✔ Venezuelan RIF validator adheres to SENIAT format");

// 4. Venezuela Fiscal Adapter
const veTaxes = VenezuelaFiscalAdapter.calculateTaxes({
  items: [
    { name: "Harina PAN", quantity: 2, unitPrice: 1.5, isExempt: true },
    { name: "Refresco", quantity: 1, unitPrice: 2.0, isExempt: false },
  ],
  currency: "USD",
  applyIgtf: true,
  exchangeRate: 50,
});
// Subtotal exempt: 3.00, Subtotal taxable: 2.00
// IVA 16% on 2.00 = 0.32
// Pre-IGTF total: 5.32
// IGTF 3% on 5.32 = 0.16
// Total: 5.48
assert.strictEqual(veTaxes.subtotalExempt, 3.0);
assert.strictEqual(veTaxes.subtotalTaxable, 2.0);
assert.strictEqual(veTaxes.ivaAmount, 0.32);
assert.strictEqual(veTaxes.igtfAmount, 0.16);
assert.strictEqual(veTaxes.total, 5.48);
assert.strictEqual(veTaxes.totalVes, 274); // 5.48 * 50
assert.strictEqual(VenezuelaFiscalAdapter.formatDocumentNumber("INVOICE", 42), "FACT-000042");
assert.strictEqual(VenezuelaFiscalAdapter.formatDocumentNumber("CREDIT_NOTE", 7), "NC-000007");
assert.strictEqual(VenezuelaFiscalAdapter.formatDocumentNumber("DISPATCH_GUIDE", 3), "GD-000003");
console.log("  ✔ Venezuela Fiscal Adapter calculates 16% IVA, 3% IGTF and SENIAT sequences");

// 5. Chile Fiscal Adapter
const clTaxes = ChileFiscalAdapter.calculateTaxes({
  items: [
    { name: "Pan Batido", quantity: 2, unitPrice: 1000, isExempt: false },
  ],
  currency: "CLP",
  applyIgtf: false,
});
// Subtotal taxable: 2000
// IVA 19% on 2000 = 380
// Total: 2380
assert.strictEqual(clTaxes.subtotalTaxable, 2000);
assert.strictEqual(clTaxes.ivaAmount, 380);
assert.strictEqual(clTaxes.total, 2380);
assert.strictEqual(clTaxes.igtfAmount, 0);
assert.strictEqual(ChileFiscalAdapter.formatDocumentNumber("INVOICE", 15), "DTE-33-000015");
assert.strictEqual(ChileFiscalAdapter.formatDocumentNumber("CREDIT_NOTE", 15), "DTE-61-000015");
assert.strictEqual(ChileFiscalAdapter.formatDocumentNumber("DISPATCH_GUIDE", 15), "DTE-52-000015");
console.log("  ✔ Chile Fiscal Adapter calculates 19% IVA and maps SII DTE folios");

// 6. Adapter Resolver
assert.strictEqual(resolveFiscalAdapter("VE", ["local_venezuela"]).countryCode, "VE");
assert.strictEqual(resolveFiscalAdapter("CL", ["local_chile"]).countryCode, "CL");
assert.strictEqual(resolveFiscalAdapter("US", []).countryCode, "GLOBAL");
console.log("  ✔ Adapter Resolver selects correct country adapter dynamically");

// 7. Prepare Fiscal Document - Invoice
const mockSettings: TenantSettings = {
  tenant_id: "test-store",
  business_name: "Inversiones MarketOS C.A.",
  address: "Av. Bolívar 123",
  currency: "USD",
  billing_settings: {
    control_prefix: "00-",
    emitter_fiscal_data: {
      business_name: "Inversiones MarketOS C.A.",
      rif: "J-12345678-0",
      fiscal_address: "Av. Bolívar 123",
    },
  },
} as unknown as TenantSettings;

const invoiceDoc = prepareFiscalDocument({
  input: {
    document_type: "INVOICE",
    customer_name: "Juan Perez",
    customer_id_doc: "V-18765432",
    customer_address: "Calle Los Pinos #4",
    items: [
      { name: "Cafe Molido 500g", quantity: 2, unit_price: 5.0, is_exempt: false },
    ],
    currency: "USD",
    apply_igtf: false,
  },
  settings: mockSettings,
  existingCount: 10,
  activeModuleIds: ["local_venezuela"],
});

assert.strictEqual(invoiceDoc.document_number, "FACT-000011");
assert.strictEqual(invoiceDoc.control_number, "00-000011");
assert.strictEqual(invoiceDoc.subtotal_taxable, 10.0);
assert.strictEqual(invoiceDoc.iva_amount, 1.6);
assert.strictEqual(invoiceDoc.total_amount, 11.6);
assert.strictEqual(invoiceDoc.status, "ISSUED");
console.log("  ✔ prepareFiscalDocument issues valid Invoice with control number and tax calculation");

// 8. Prepare Fiscal Document - Dispatch Guide (Guía de Despacho)
const dispatchDoc = prepareFiscalDocument({
  input: {
    document_type: "DISPATCH_GUIDE",
    customer_name: "Automercados Plaza",
    customer_id_doc: "J-30001234-5",
    items: [
      { name: "Caja de Aceite 12x1L", quantity: 5, unit_price: 20.0, is_exempt: false },
    ],
    transport_info: {
      driver_name: "Carlos Mendoza",
      driver_id_doc: "V-14555888",
      vehicle_plate: "A12BC3D",
      vehicle_model: "Iveco Daily",
      origin_address: "Almacén Central",
      destination_address: "Sucursal Valencia",
      packages_count: 5,
    },
  },
  settings: mockSettings,
  existingCount: 20,
  activeModuleIds: ["local_venezuela"],
});

assert.strictEqual(dispatchDoc.document_number, "GD-000021");
assert.strictEqual(dispatchDoc.transport_info?.driver_name, "Carlos Mendoza");
assert.strictEqual(dispatchDoc.transport_info?.vehicle_plate, "A12BC3D");
console.log("  ✔ prepareFiscalDocument issues Dispatch Guide with transport metadata");

// 9. Prepare Fiscal Document - Credit Note validation (Rejects without affected invoice)
assert.throws(
  () => {
    prepareFiscalDocument({
      input: {
        document_type: "CREDIT_NOTE",
        customer_name: "Juan Perez",
        customer_id_doc: "V-18765432",
        items: [{ name: "Devolución Item", quantity: 1, unit_price: 5.0 }],
      },
      settings: mockSettings,
      existingCount: 1,
      activeModuleIds: ["local_venezuela"],
    });
  },
  /es obligatorio especificar el Número de Factura Afectada/i,
  "Should throw error when credit note is missing affected invoice"
);
console.log("  ✔ Credit Note strictly requires affected document reference");

// 10. Prepare Fiscal Document - Credit Note capping against affected invoice
assert.throws(
  () => {
    prepareFiscalDocument({
      input: {
        document_type: "CREDIT_NOTE",
        customer_name: "Juan Perez",
        customer_id_doc: "V-18765432",
        affected_document_number: "FACT-000011",
        items: [{ name: "Devolución Excesiva", quantity: 10, unit_price: 50.0 }],
      },
      settings: mockSettings,
      existingCount: 1,
      activeModuleIds: ["local_venezuela"],
      affectedInvoice: invoiceDoc,
    });
  },
  /no puede exceder el total de la Factura Afectada/i,
  "Should throw error when credit note exceeds affected invoice total"
);
console.log("  ✔ Credit Note cannot exceed original invoice amount");

// 11. Credit Note with valid inventory restoration flag
const validCreditNote = prepareFiscalDocument({
  input: {
    document_type: "CREDIT_NOTE",
    customer_name: "Juan Perez",
    customer_id_doc: "V-18765432",
    affected_document_number: "FACT-000011",
    return_items_to_inventory: true,
    items: [{ name: "Cafe Molido 500g", quantity: 1, unit_price: 5.0 }],
  },
  settings: mockSettings,
  existingCount: 1,
  activeModuleIds: ["local_venezuela"],
  affectedInvoice: invoiceDoc,
});
assert.strictEqual(validCreditNote.return_items_to_inventory, true);
assert.strictEqual(validCreditNote.document_number, "NC-000002");
console.log("  ✔ Credit note properly sets return_items_to_inventory flag");

// 12. Sales Book Report compilation and totals
const { buildSalesBook, exportSalesBookCsv } = await import("../services/sales-book-service.ts");
const salesBookDocs: FiscalDocument[] = [
  {
    ...invoiceDoc,
    created_at: "2026-10-15T10:00:00Z",
  },
  {
    ...validCreditNote,
    created_at: "2026-10-18T14:30:00Z",
    total_amount: 5.48,
    total_ves: 274,
  },
  {
    // A document from another month to test period filtering
    ...invoiceDoc,
    id: "doc_sep_01",
    document_number: "FACT-000009",
    created_at: "2026-09-20T10:00:00Z",
  },
];

const salesReport = buildSalesBook(salesBookDocs, {
  period: "2026-10",
  tenantId: "shop-market-ca",
  emitter: {
    name: "Shop Market C.A.",
    taxId: "J-12345678-0",
    address: "Av. Principal",
  },
  currency: "USD",
});

assert.strictEqual(salesReport.entries.length, 2, "Should only include the 2 documents from 2026-10");
assert.strictEqual(salesReport.entries[0].document_number, "FACT-000011");
assert.strictEqual(salesReport.entries[1].document_number, "NC-000002");
// In entries: Invoice (11.60) minus partial Credit Note (5.48) = 6.12 net sales
assert.strictEqual(salesReport.totals.total_sales, 6.12, "Invoice (11.60) minus partial Credit Note (5.48) should net to 6.12");
assert.strictEqual(salesReport.totals.documents_count, 2);
console.log("  ✔ buildSalesBook filters by period, computes negative NC rows and nets totals");

// 13. Sales Book CSV Export
const csvOutput = exportSalesBookCsv(salesReport);
assert.ok(csvOutput.startsWith("\ufeff"), "CSV must start with UTF-8 BOM for Microsoft Excel");
assert.ok(csvOutput.includes("LIBRO DE VENTAS FISCAL"), "CSV must contain header title");
assert.ok(csvOutput.includes("Shop Market C.A."), "CSV must contain emitter name");
assert.ok(csvOutput.includes(";"), "CSV must use semicolon as column delimiter");
assert.ok(csvOutput.includes("TOTALES GENERALES"), "CSV must contain summary totals row");
console.log("  ✔ exportSalesBookCsv generates Excel-compliant UTF-8 BOM semicolon-delimited CSV");

console.log("🎉 All 13 @marketos/plugin-invoicing checks passed successfully!");
