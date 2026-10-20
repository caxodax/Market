import assert from "node:assert";
import {
  isValidVenezuelanMobile,
  isValidCedulaOrRif,
  validatePagoMovilInput,
  getBankByCode,
} from "../payments/banks.ts";
import { calculateIgtf } from "../payments/igtf.ts";
import { convertUsdToVes, formatBs } from "../exchange/bcv.ts";

function sanitizeSafeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("data:")) return null;
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("/") || lower.startsWith("mailto:") || lower.startsWith("tel:")) return trimmed;
  return null;
}

console.log("🧪 [Ponytail Check] Running tests for @marketos/plugin-local-venezuela...");

// 1. Mobile phone validation
assert.strictEqual(isValidVenezuelanMobile("04121234567"), true, "0412 should be valid");
assert.strictEqual(isValidVenezuelanMobile("04245919577"), true, "0424 should be valid");
assert.strictEqual(isValidVenezuelanMobile("04169876543"), true, "0416 should be valid");
assert.strictEqual(isValidVenezuelanMobile("584141234567"), true, "58414 international format should be valid");
assert.strictEqual(isValidVenezuelanMobile("04991234567"), false, "0499 is invalid prefix");
assert.strictEqual(isValidVenezuelanMobile("12345"), false, "short number is invalid");

// 2. ID Document validation
assert.strictEqual(isValidCedulaOrRif("V-12345678"), true, "V-12345678 should be valid");
assert.strictEqual(isValidCedulaOrRif("V12345678"), true, "V12345678 should be valid");
assert.strictEqual(isValidCedulaOrRif("J-501234567"), true, "J-501234567 should be valid");
assert.strictEqual(isValidCedulaOrRif("E-84123456"), true, "E-84123456 should be valid");
assert.strictEqual(isValidCedulaOrRif("X-123"), false, "X prefix should be invalid");

// 3. Pago Móvil input validator
const pmValid = validatePagoMovilInput({
  phone: "0424-591-9577",
  idDoc: "V-20123456",
  reference: "123456",
});
assert.strictEqual(pmValid.valid, true, "Valid Pago Movil submission should pass");

const pmInvalidRef = validatePagoMovilInput({
  phone: "0424-591-9577",
  idDoc: "V-20123456",
  reference: "12",
});
assert.strictEqual(pmInvalidRef.valid, false, "Short reference should fail");

// 4. IGTF calculation (3%)
const igtf = calculateIgtf(100, 50); // $100 at 50 Bs/$
assert.strictEqual(igtf.baseAmountUsd, 100);
assert.strictEqual(igtf.igtfAmountUsd, 3.00, "3% of 100 is 3.00 USD");
assert.strictEqual(igtf.totalWithIgtfUsd, 103.00, "Total with IGTF is 103.00 USD");
assert.strictEqual(igtf.igtfAmountVes, 150.00, "IGTF in VES is 150.00 Bs.");
assert.strictEqual(igtf.totalWithIgtfVes, 5150.00, "Total in VES is 5150.00 Bs.");

// 5. Currency conversions
assert.strictEqual(convertUsdToVes(10, 50), 500);
assert.strictEqual(formatBs(1000).includes("1.000"), true, "Should format thousands correctly");

// 6. SUDEBAN bank lookups
const bancamiga = getBankByCode("0172");
assert.strictEqual(bancamiga?.shortName, "Bancamiga");
const bdv = getBankByCode("0102");
assert.strictEqual(bdv?.shortName, "Banco de Venezuela");

// 7. Security Checks (XSS & Protocol Hijack)
assert.strictEqual(sanitizeSafeUrl("javascript:alert(1)"), null, "javascript: URLs must be blocked");
assert.strictEqual(sanitizeSafeUrl("JAVASCRIPT:alert(document.cookie)"), null, "Uppercase JAVASCRIPT: must be blocked");
assert.strictEqual(sanitizeSafeUrl("data:text/html;base64,PHNjcmlwdD4="), null, "data: URIs must be blocked");
assert.strictEqual(sanitizeSafeUrl("https://r2.marketos.lat/proof.jpg"), "https://r2.marketos.lat/proof.jpg", "Valid https URL allowed");
assert.strictEqual(sanitizeSafeUrl("/media/proof.png"), "/media/proof.png", "Valid relative path allowed");

// 8. SENIAT Fiscal Calculations & Providencia 00071 Compliance
import {
  calculateSeniatFiscalBreakdown,
  formatSeniatControlNumber,
  formatSeniatInvoiceNumber,
  validateSeniatRif,
  SENIAT_LEGAL_CONSTANTS,
} from "../fiscal/seniat.ts";
import { generateSeniatSalesBookCsv } from "../fiscal/salesBook.ts";

// Test 8.1: Mixed Cart (Exempt items + Taxable items + Delivery + IGTF 3%)
const fiscalRes = calculateSeniatFiscalBreakdown({
  items: [
    { name: "Harina PAN", quantity: 2, unitPriceUsd: 1.20, isTaxExempt: true },
    { name: "Refresco", quantity: 1, unitPriceUsd: 2.00, isTaxExempt: false },
  ],
  deliveryFeeUsd: 2.50, // Taxable transport
  applyIgtf: true,
  paymentMethod: "CASH_USD",
  exchangeRate: 45,
});

assert.strictEqual(fiscalRes.subtotalExemptUsd, 2.40, "Exempt subtotal should be 2.40 USD");
assert.strictEqual(fiscalRes.subtotalTaxableUsd, 4.50, "Taxable subtotal should be 2.00 + 2.50 = 4.50 USD");
assert.strictEqual(fiscalRes.ivaAmountUsd, 0.72, "16% IVA on 4.50 is 0.72 USD");
assert.strictEqual(fiscalRes.igtfAmountUsd, 0.23, "3% IGTF on 7.62 is 0.23 USD");
assert.strictEqual(fiscalRes.totalUsd, 7.85, "Total USD should be 7.85");
assert.strictEqual(fiscalRes.totalVes, 353.25, "Total VES should be 7.85 * 45 = 353.25 Bs.");

// Test 8.2: SENIAT Control & Invoice Numbering Formats
assert.strictEqual(formatSeniatControlNumber(1), "00-00000001", "Control number 1 must be 00-00000001");
assert.strictEqual(formatSeniatControlNumber(1045, "01-"), "01-00001045", "Control number with custom prefix");
assert.strictEqual(formatSeniatInvoiceNumber(1001), "FACT-00001001", "Invoice number must be FACT-00001001");

// Test 8.3: RIF Validation
const validRif = validateSeniatRif("j-50123456-7");
assert.strictEqual(validRif.isValid, true);
assert.strictEqual(validRif.normalizedRif, "J-50123456-7");

const validRifNoHyphens = validateSeniatRif("V123456789");
assert.strictEqual(validRifNoHyphens.isValid, true);
assert.strictEqual(validRifNoHyphens.normalizedRif, "V-12345678-9");

const invalidRif = validateSeniatRif("ABC12345");
assert.strictEqual(invalidRif.isValid, false);

// Test 8.4: SENIAT Libro de Ventas CSV Generation
const dummyOrder: any = {
  id: "ord-test-1",
  tenant_id: "shop-market-ca",
  order_number: "ORD-123456",
  status: "COMPLETED",
  created_at: new Date().toISOString(),
  total_usd: 10.00,
  total_ves: 450.00,
  exchange_rate_applied: 45,
  customer_name: "Juan Perez",
  customer_id_number: "V-12345678",
  subtotal_exempt_usd: 4.00,
  subtotal_taxable_usd: 6.00,
  iva_amount_usd: 0.96,
  physical_invoice_number: "0001245",
  physical_machine_serial: "Z4A1234567",
};

const dummySettings: any = {
  business_name: "Shop Market C.A.",
  billing_settings: {
    emitter_fiscal_data: {
      rif: "J-50123456-7",
      business_name: "Shop Market C.A.",
    },
  },
};

const csv = generateSeniatSalesBookCsv({
  orders: [dummyOrder],
  settings: dummySettings,
  periodLabel: "OCTUBRE 2026",
});

assert.strictEqual(csv.includes("LIBRO DE VENTAS E INGRESOS"), true, "Must have SENIAT header");
assert.strictEqual(csv.includes("J-50123456-7"), true, "Must have emitter RIF");
assert.strictEqual(csv.includes("0001245"), true, "Must include invoice number");
assert.strictEqual(csv.includes("MF:Z4A1234567"), true, "Must include physical fiscal machine serial");

console.log("✅ [Ponytail & ECC Check] All 11 local-venezuela & SENIAT fiscal tests passed successfully!");

