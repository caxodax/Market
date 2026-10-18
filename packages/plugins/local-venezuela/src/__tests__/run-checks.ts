import assert from "node:assert";
import {
  isValidVenezuelanMobile,
  isValidCedulaOrRif,
  validatePagoMovilInput,
  getBankByCode,
} from "../payments/banks.ts";
import { calculateIgtf } from "../payments/igtf.ts";
import { convertUsdToVes, formatBs } from "../exchange/bcv.ts";

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

console.log("✅ [Ponytail Check] All 6 local-venezuela tests passed successfully!");
