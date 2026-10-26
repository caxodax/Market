import assert from "node:assert/strict";
import {
  VenezuelaRetentionAdapter,
  ChileRetentionAdapter,
  GlobalRetentionAdapter,
  resolveRetentionAdapter,
} from "../adapters/retention-adapter.ts";
import {
  preparePurchaseInvoice,
  prepareRetentionVoucher,
  buildSeniatRetentionTxt,
} from "../services/purchasing-service.ts";
import type { TenantSettings, CreatePurchaseInvoiceInput, SeniatRetentionTxtRow } from "@marketos/types";

console.log("▶ Running tests for @marketos/plugin-purchasing-retentions...");

const mockSettings: TenantSettings = {
  tenant_id: "tenant-demo-123",
  business_name: "Inversiones Demo C.A.",
  address: "Av. Libertador, Caracas",
  default_currency: "USD",
  currency: "USD",
  exchange_rate_bcv: 50.0,
  billing_settings: {
    emitter_fiscal_data: {
      business_name: "Inversiones Demo C.A.",
      rif: "J-30987654-1",
      fiscal_address: "Av. Libertador, Edif. Torre Centro, Caracas",
    },
  },
} as any;

// ─── 1. VENEZUELA ADAPTER TESTS ─────────────────────────────────────────────
console.log("  Testing VenezuelaRetentionAdapter...");
{
  // 75% retention test
  const res75 = VenezuelaRetentionAdapter.calculateVatRetention(100.0, 75.0);
  assert.equal(res75.vatRetainedAmount, 75.0);
  assert.equal(res75.netPayableVat, 25.0);
  assert.equal(res75.retentionRatePercent, 75.0);

  // 100% retention test
  const res100 = VenezuelaRetentionAdapter.calculateVatRetention(100.0, 100.0);
  assert.equal(res100.vatRetainedAmount, 100.0);
  assert.equal(res100.netPayableVat, 0.0);
  assert.equal(res100.retentionRatePercent, 100.0);

  // 14-digit voucher number test (YYYYMMXXXXXXXX)
  const voucherNum = VenezuelaRetentionAdapter.formatVoucherNumber(1, "202610");
  assert.equal(voucherNum, "20261000000001");
  assert.equal(voucherNum.length, 14);

  const voucherNum25 = VenezuelaRetentionAdapter.formatVoucherNumber(25, "202611");
  assert.equal(voucherNum25, "20261100000025");

  // SENIAT TXT line generation (16 fields separated by tab)
  const row: SeniatRetentionTxtRow = {
    agentRif: "J-30987654-1",
    taxPeriod: "202610",
    invoiceDate: "2026-10-25",
    operationType: "C",
    documentType: "01",
    supplierRif: "J-12345678-9",
    invoiceNumber: "0001234",
    controlNumber: "00-009876",
    totalAmountVes: 5800.0,
    taxableBaseVes: 5000.0,
    retainedAmountVes: 600.0, // 75% de 800 IVA
    affectedInvoiceNumber: "0",
    voucherNumber: "20261000000001",
    exemptAmountVes: 0.0,
    ivaRatePercent: 16.0,
    fileNumber: "0",
  };

  const line = VenezuelaRetentionAdapter.formatSeniatTxtLine!(row);
  const fields = line.split("\t");
  assert.equal(fields.length, 16, "SENIAT TXT row must contain exactly 16 fields");
  assert.equal(fields[0], "J309876541", "Agent RIF must be alphanumeric uppercase without dashes");
  assert.equal(fields[1], "202610", "Tax period must be YYYYMM");
  assert.equal(fields[2], "2026-10-25");
  assert.equal(fields[3], "C");
  assert.equal(fields[4], "01");
  assert.equal(fields[5], "J123456789");
  assert.equal(fields[6], "0001234");
  assert.equal(fields[7], "00-009876");
  assert.equal(fields[8], "5800.00");
  assert.equal(fields[9], "5000.00");
  assert.equal(fields[10], "600.00");
  assert.equal(fields[11], "0");
  assert.equal(fields[12], "20261000000001");
  assert.equal(fields[13], "0.00");
  assert.equal(fields[14], "16.00");
  assert.equal(fields[15], "0");
}

// ─── 2. CHILE ADAPTER TESTS ─────────────────────────────────────────────────
console.log("  Testing ChileRetentionAdapter...");
{
  const resCl = ChileRetentionAdapter.calculateVatRetention(19000, 100);
  assert.equal(resCl.vatRetainedAmount, 19000);
  assert.equal(resCl.netPayableVat, 0);

  const numCl = ChileRetentionAdapter.formatVoucherNumber(42, "202610");
  assert.equal(numCl, "DTE-46-000042");
}

// ─── 3. GLOBAL ADAPTER & RESOLVER TESTS ─────────────────────────────────────
console.log("  Testing GlobalRetentionAdapter & resolveRetentionAdapter...");
{
  const resGlobal = GlobalRetentionAdapter.calculateVatRetention(200, 10);
  assert.equal(resGlobal.vatRetainedAmount, 20);

  const adapterVe = resolveRetentionAdapter("VE", ["local_venezuela"]);
  assert.equal(adapterVe.countryCode, "VE");

  const adapterCl = resolveRetentionAdapter("CL", ["local_chile"]);
  assert.equal(adapterCl.countryCode, "CL");

  const adapterDef = resolveRetentionAdapter("US", []);
  assert.equal(adapterDef.countryCode, "GLOBAL");
}

// ─── 4. PURCHASING SERVICE: PREPARE PURCHASE & AUTO-RETENTION ───────────────
console.log("  Testing preparePurchaseInvoice with auto-generated retention...");
{
  const input: CreatePurchaseInvoiceInput = {
    supplier_name: "Distribuidora San Juan C.A.",
    supplier_tax_id: "J-40111222-3",
    supplier_address: "Valencia, Edo. Carabobo",
    invoice_number: "INV-9988",
    control_number: "00-000555",
    invoice_date: "2026-10-25",
    currency: "USD",
    exchange_rate_applied: 50.0,
    items: [
      { name: "Cajas de Aceite", quantity: 10, unit_price: 20.0, is_exempt: false }, // 200 taxable
      { name: "Harina de Maíz Exenta", quantity: 5, unit_price: 10.0, is_exempt: true }, // 50 exempt
    ],
    auto_generate_retention: true,
    retention_rate_percent: 75.0,
    retention_type: "VAT",
  };

  const { invoice, retentionVoucher } = preparePurchaseInvoice({
    input,
    settings: mockSettings,
    existingCount: 0,
    activeModuleIds: ["local_venezuela"],
    actorName: "Administrador",
    defaultIvaRate: 16.0,
  });

  assert.equal(invoice.subtotal_taxable, 200.0);
  assert.equal(invoice.subtotal_exempt, 50.0);
  assert.equal(invoice.iva_amount, 32.0); // 16% de 200
  assert.equal(invoice.total_amount, 282.0); // 200 + 50 + 32
  assert.equal(invoice.retained_vat_amount, 24.0); // 75% de 32

  assert.ok(retentionVoucher, "Retention voucher must be created automatically");
  assert.equal(retentionVoucher?.voucher_number, "20261000000001");
  assert.equal(retentionVoucher?.retained_amount, 24.0);
  assert.equal(retentionVoucher?.retained_amount_ves, 1200.0); // 24 * 50
  assert.equal(retentionVoucher?.agent_tax_id, "J-30987654-1");
  assert.equal(retentionVoucher?.supplier_tax_id, "J-40111222-3");
}

// ─── 5. BUILD SENIAT RETENTION TXT ──────────────────────────────────────────
console.log("  Testing buildSeniatRetentionTxt...");
{
  const rows: SeniatRetentionTxtRow[] = [
    {
      agentRif: "J-30987654-1",
      taxPeriod: "202610",
      invoiceDate: "2026-10-25",
      operationType: "C",
      documentType: "01",
      supplierRif: "J-11111111-1",
      invoiceNumber: "001",
      controlNumber: "00-001",
      totalAmountVes: 1160.0,
      taxableBaseVes: 1000.0,
      retainedAmountVes: 120.0,
      affectedInvoiceNumber: "0",
      voucherNumber: "20261000000001",
      exemptAmountVes: 0.0,
      ivaRatePercent: 16.0,
      fileNumber: "0",
    },
    {
      agentRif: "J-30987654-1",
      taxPeriod: "202610",
      invoiceDate: "2026-10-26",
      operationType: "C",
      documentType: "01",
      supplierRif: "J-22222222-2",
      invoiceNumber: "002",
      controlNumber: "00-002",
      totalAmountVes: 2320.0,
      taxableBaseVes: 2000.0,
      retainedAmountVes: 240.0,
      affectedInvoiceNumber: "0",
      voucherNumber: "20261000000002",
      exemptAmountVes: 0.0,
      ivaRatePercent: 16.0,
      fileNumber: "0",
    },
  ];

  const txtContent = buildSeniatRetentionTxt(rows);
  const lines = txtContent.split("\r\n");
  assert.equal(lines.length, 2, "TXT file should contain exactly 2 lines");
  assert.ok(lines[0].includes("J309876541\t202610"));
  assert.ok(lines[1].includes("J222222222\t002"));
}

console.log("✅ All checks passed successfully for @marketos/plugin-purchasing-retentions!");
