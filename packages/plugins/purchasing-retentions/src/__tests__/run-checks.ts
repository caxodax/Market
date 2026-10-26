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
  recordSupplierPayment,
  addDaysToDate,
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

// ─── 5.1. ISLR RETENTIONS (DECRETO 1.808) & SENIAT XML GENERATOR ────────────
console.log("  Testing ISLR retentions (Decreto 1.808) and SENIAT XML generator...");
{
  const { buildSeniatIslrXml, buildSeniatIslrXmlFromInvoices } = await import(
    "../services/purchasing-service.ts"
  );
  const { OFFICIAL_ISLR_CONCEPTS } = await import("../constants/islr-concepts.ts");

  assert.ok(OFFICIAL_ISLR_CONCEPTS.length >= 8, "Must declare standard Decreto 1.808 concepts");
  const concept055 = OFFICIAL_ISLR_CONCEPTS.find((c) => c.code === "055");
  assert.equal(concept055?.default_rate_percent, 2, "Concept 055 rate must be 2%");

  // Test purchase invoice with simultaneous VAT + ISLR retentions
  const inputDual: CreatePurchaseInvoiceInput = {
    supplier_name: "Constructora & Mantenimiento Alpha C.A.",
    supplier_tax_id: "J-40999888-7",
    invoice_number: "FAC-0050",
    control_number: "00-001234",
    invoice_date: "2026-10-20",
    currency: "USD",
    exchange_rate_applied: 50.0,
    items: [
      { name: "Mantenimiento General de Servidores", quantity: 1, unit_price: 1000.0, is_exempt: false },
    ],
    auto_generate_retention: true,
    retention_rate_percent: 75.0,
    apply_islr_retention: true,
    islr_concept_code: "055", // 2%
  };

  const { invoice, retentionVoucher, islrRetentionVoucher } = preparePurchaseInvoice({
    input: inputDual,
    settings: mockSettings,
    existingCount: 0,
    activeModuleIds: ["local_venezuela"],
    actorName: "Contador Fiscal",
    defaultIvaRate: 16.0,
  });

  assert.equal(invoice.subtotal_taxable, 1000.0);
  assert.equal(invoice.iva_amount, 160.0); // 16% de 1000
  assert.equal(invoice.total_amount, 1160.0);
  assert.equal(invoice.retained_vat_amount, 120.0); // 75% de 160
  assert.equal(invoice.retained_islr_amount, 20.0); // 2% de 1000 base
  assert.equal(invoice.islr_concept_code, "055");
  assert.equal(invoice.islr_retention_rate_percent, 2);

  // Check VAT voucher
  assert.ok(retentionVoucher);
  assert.equal(retentionVoucher?.voucher_type, "VAT");
  assert.equal(retentionVoucher?.voucher_number, "20261000000001");
  assert.equal(retentionVoucher?.retained_amount, 120.0);

  // Check ISLR voucher
  assert.ok(islrRetentionVoucher, "ISLR voucher must be generated when apply_islr_retention is true");
  assert.equal(islrRetentionVoucher?.voucher_type, "INCOME_TAX");
  assert.equal(islrRetentionVoucher?.voucher_number, "20261000000002");
  assert.equal(islrRetentionVoucher?.retained_amount, 20.0);
  assert.equal(islrRetentionVoucher?.retained_amount_ves, 1000.0); // 20 * 50
  assert.equal(islrRetentionVoucher?.islr_concept_code, "055");
  assert.ok(islrRetentionVoucher?.legal_legend?.includes("Decreto N° 1.808"));

  // Test direct XML generation with SeniatIslrXmlRow
  const xmlOutput = buildSeniatIslrXml({
    agentRif: "J-30987654-1",
    taxPeriod: "202610",
    rows: [
      {
        rifRetenido: "J-40999888-7",
        numeroFactura: "FAC-0050",
        numeroControl: "00-001234",
        fechaOperacion: "2026-10-20",
        codigoConcepto: "055",
        montoOperacion: 50000.0, // 1000 USD * 50 Bs/$
        porcentajeRetencion: 2.0,
      },
    ],
  });

  assert.ok(xmlOutput.startsWith('<?xml version="1.0" encoding="ISO-8859-1"?>'), "Must contain SENIAT XML header");
  assert.ok(xmlOutput.includes('<RelacionRetencionesISLR RifAgente="J309876541" Periodo="202610">'));
  assert.ok(xmlOutput.includes("<DetalleRetencion>"));
  assert.ok(xmlOutput.includes("<RifRetenido>J409998887</RifRetenido>"));
  assert.ok(xmlOutput.includes("<NumeroFactura>FAC-0050</NumeroFactura>"));
  assert.ok(xmlOutput.includes("<NumeroControl>00-001234</NumeroControl>"));
  assert.ok(xmlOutput.includes("<FechaOperacion>20/10/2026</FechaOperacion>"), "Must format date to DD/MM/YYYY");
  assert.ok(xmlOutput.includes("<CodigoConcepto>055</CodigoConcepto>"));
  assert.ok(xmlOutput.includes("<MontoOperacion>50000.00</MontoOperacion>"));
  assert.ok(xmlOutput.includes("<PorcentajeRetencion>2.00</PorcentajeRetencion>"));
  assert.ok(xmlOutput.includes("</DetalleRetencion>"));
  assert.ok(xmlOutput.includes("</RelacionRetencionesISLR>"));

  // Test buildSeniatIslrXmlFromInvoices
  const invoicesList: import("@marketos/types").PurchaseInvoice[] = [invoice];
  const xmlFromInvoices = buildSeniatIslrXmlFromInvoices({
    agentRif: "J-30987654-1",
    taxPeriod: "202610",
    invoices: invoicesList,
  });

  assert.ok(xmlFromInvoices.includes('<RelacionRetencionesISLR RifAgente="J309876541" Periodo="202610">'));
  assert.ok(xmlFromInvoices.includes("<RifRetenido>J409998887</RifRetenido>"));
  assert.ok(xmlFromInvoices.includes("<MontoOperacion>50000.00</MontoOperacion>"), "Must convert to VES taxable base");
}


// ─── 6. PURCHASES BOOK TESTS ────────────────────────────────────────────────
console.log("  Testing buildPurchasesBook & exportPurchasesBookCsv...");
{
  const { buildPurchasesBook, exportPurchasesBookCsv } = await import("../services/purchases-book-service.ts");
  const testInvoices: import("@marketos/types").PurchaseInvoice[] = [
    {
      id: "inv-001",
      tenant_id: "tenant-demo-123",
      supplier_id: "sup-1",
      supplier_name: "Distribuidora Polar C.A.",
      supplier_tax_id: "J-00000001-1",
      invoice_number: "FAC-9912",
      control_number: "00-112233",
      invoice_date: "2026-10-12",
      received_date: "2026-10-12",
      status: "REGISTERED",
      items: [],
      subtotal_exempt: 100.0,
      subtotal_taxable: 500.0,
      iva_rate_percent: 16.0,
      iva_amount: 80.0,
      total_amount: 680.0,
      currency: "USD",
      retained_vat_amount: 60.0, // 75% of 80.0
      retention_voucher_id: "vouch-001",
      created_at: "2026-10-12T10:00:00Z",
    },
    {
      // An invoice from another period
      id: "inv-002",
      tenant_id: "tenant-demo-123",
      supplier_id: "sup-2",
      supplier_name: "Molinos Nacionales",
      supplier_tax_id: "J-00000002-2",
      invoice_number: "FAC-8831",
      invoice_date: "2026-09-15",
      received_date: "2026-09-15",
      status: "REGISTERED",
      items: [],
      subtotal_exempt: 0,
      subtotal_taxable: 200.0,
      iva_rate_percent: 16.0,
      iva_amount: 32.0,
      total_amount: 232.0,
      currency: "USD",
      created_at: "2026-09-15T10:00:00Z",
    },
  ];

  const testVouchers: import("@marketos/types").RetentionVoucher[] = [
    {
      id: "vouch-001",
      tenant_id: "tenant-demo-123",
      voucher_type: "VAT",
      voucher_number: "20261000000001",
      tax_period: "202610",
      issue_date: "2026-10-12",
      agent_business_name: "Inversiones Demo C.A.",
      agent_tax_id: "J-30987654-1",
      agent_fiscal_address: "Av. Libertador",
      supplier_id: "sup-1",
      supplier_name: "Distribuidora Polar C.A.",
      supplier_tax_id: "J-00000001-1",
      purchase_invoice_id: "inv-001",
      invoice_number: "FAC-9912",
      invoice_date: "2026-10-12",
      invoice_total_amount: 680.0,
      taxable_base_amount: 500.0,
      exempt_base_amount: 100.0,
      iva_rate_percent: 16.0,
      iva_total_amount: 80.0,
      retention_rate_percent: 75.0,
      retained_vat_amount: 60.0,
      currency: "USD",
      created_at: "2026-10-12T10:00:00Z",
    },
  ];

  const report = buildPurchasesBook(testInvoices, {
    period: "2026-10",
    tenantId: "tenant-demo-123",
    buyer: {
      name: "Inversiones Demo C.A.",
      taxId: "J-30987654-1",
    },
    currency: "USD",
    vouchers: testVouchers,
  });

  assert.equal(report.entries.length, 1, "Should filter strictly by 2026-10 period");
  assert.equal(report.entries[0].invoice_number, "FAC-9912");
  assert.equal(report.entries[0].retention_voucher_number, "20261000000001");
  assert.equal(report.totals.total_purchases, 680.0);
  assert.equal(report.totals.total_vat_credit, 80.0);
  assert.equal(report.totals.total_retained_vat, 60.0);

  const csv = exportPurchasesBookCsv(report);
  assert.ok(csv.startsWith("\ufeff"), "Purchases CSV must start with UTF-8 BOM");
  assert.ok(csv.includes("LIBRO DE COMPRAS FISCAL"), "CSV must contain Purchases header");
  assert.ok(csv.includes("Distribuidora Polar C.A."));
  assert.ok(csv.includes("20261000000001"), "CSV must include retention voucher number");
  assert.ok(csv.includes("TOTALES GENERALES"), "CSV must include totals row");
}

// ─── 8. CUENTAS POR PAGAR (CxP) TESTS ──────────────────────────────────────────
console.log("  Testing Accounts Payable (CxP) and Supplier Payments...");
{
  // 1. Credit Purchase Invoice with dual withholding (VAT 75% + ISLR 2%)
  const creditInput: CreatePurchaseInvoiceInput = {
    supplier_name: "Molinos Nacionales C.A.",
    supplier_tax_id: "J-00022334-9",
    invoice_number: "FACT-MOL-4421",
    invoice_date: "2026-10-20",
    payment_condition: "CREDIT",
    credit_term_days: 30,
    items: [
      { name: "Saco Harina Trigo 50kg", quantity: 20, unit_price: 50.0, is_exempt: false },
    ],
    currency: "USD",
    auto_generate_retention: true,
    retention_rate_percent: 75.0,
    apply_islr_retention: true,
    islr_concept_code: "055", // 2.0%
    islr_retention_rate_percent: 2.0,
  };

  const { invoice, retentionVoucher, islrRetentionVoucher } = preparePurchaseInvoice({
    input: creditInput,
    settings: mockSettings,
    existingCount: 5,
    activeModuleIds: ["local_venezuela"],
  });

  // Base: 1000, IVA 16%: 160, Total: 1160
  // Retención IVA 75%: 120.00
  // Retención ISLR 2%: 20.00
  // Net Payable to Supplier: 1160 - 120 - 20 = 1020.00
  assert.equal(invoice.total_amount, 1160.0);
  assert.equal(invoice.retained_vat_amount, 120.0);
  assert.equal(invoice.retained_islr_amount, 20.0);
  assert.equal(invoice.payment_condition, "CREDIT");
  assert.equal(invoice.credit_term_days, 30);
  assert.equal(invoice.net_payable_amount, 1020.0, "Net payable must equal total - retained VAT - retained ISLR");
  assert.equal(invoice.amount_paid, 0.0);
  assert.equal(invoice.amount_due, 1020.0);
  assert.equal(invoice.payment_status, "PENDING");
  assert.equal(invoice.due_date, "2026-11-19");
  console.log("    ✔ Credit purchase invoice accurately computes net payable debt after retentions");

  // 2. Partial Abono to Supplier
  const partialPaid = recordSupplierPayment(invoice, {
    amount: 500.0,
    payment_method: "TRANSFERENCIA",
    reference: "TRF-BANCO-776655",
    notes: "Abono 500$ inicial",
  });

  assert.equal(partialPaid.amount_paid, 500.0);
  assert.equal(partialPaid.amount_due, 520.0);
  assert.equal(partialPaid.payment_status, "PARTIALLY_PAID");
  assert.equal(partialPaid.payments?.length, 1);
  assert.equal(partialPaid.payments?.[0].amount, 500.0);
  assert.equal(partialPaid.payments?.[0].payment_method, "TRANSFERENCIA");
  console.log("    ✔ Supplier abono updates net debt and sets status to PARTIALLY_PAID");

  // 3. Full Settlement of Supplier Debt
  const fullySettled = recordSupplierPayment(partialPaid, {
    amount: 520.0,
    payment_method: "PAGO_MOVIL",
    reference: "PM-889900",
  });

  assert.equal(fullySettled.amount_paid, 1020.0);
  assert.equal(fullySettled.amount_due, 0.0);
  assert.equal(fullySettled.payment_status, "PAID");
  assert.equal(fullySettled.status, "PAID");
  assert.equal(fullySettled.payments?.length, 2);

  // Overpay protection
  assert.throws(() => {
    recordSupplierPayment(fullySettled, {
      amount: 50.0,
      payment_method: "EFECTIVO",
    });
  }, /no puede exceder la deuda neta pendiente/);
  console.log("    ✔ Settling supplier debt transitions status to PAID and protects against overpayment");
}

console.log("✅ All checks passed successfully for @marketos/plugin-purchasing-retentions!");
