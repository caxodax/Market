import assert from "node:assert";
import {
  calculateSalesCommission,
  generateFintechPaymentLink,
  buildFintechWhatsAppShareMessage,
} from "../fintech.ts";

console.log("🧪 [ECC & Ponytail Check] Running Fintech & Commissions Tests...");

// 1. Commission Calculation
const comm1 = calculateSalesCommission(100, 5);
assert.strictEqual(comm1, 5.0, "5% of 100 should be 5.00");

const comm2 = calculateSalesCommission(254.33, 3.5);
assert.strictEqual(comm2, 8.9, "3.5% of 254.33 should be 8.90");

const commZero = calculateSalesCommission(0, 10);
assert.strictEqual(commZero, 0, "Zero sale gives zero commission");

console.log("  ✔ calculateSalesCommission computes exact percentages and rounding");

// 2. Cashea Payment Link
const casheaLink = generateFintechPaymentLink({
  tenantId: "tenant_demo",
  tenantName: "Mi Gran Tienda",
  orderId: "ORD-9901",
  provider: "CASHEA",
  amountUsd: 120.5,
  exchangeRateBcv: 875.0,
  customerName: "Juan Pérez",
});

assert.strictEqual(casheaLink.provider, "CASHEA");
assert.strictEqual(casheaLink.amount, 120.5);
assert.strictEqual(casheaLink.currency, "USD");
assert.ok(casheaLink.url.includes("app.cashea.com/pay"));
assert.ok(casheaLink.url.includes("ORD-9901"));
console.log("  ✔ generateFintechPaymentLink generates Cashea BNPL deep links");

// 3. Biopago BDV Link
const biopagoLink = generateFintechPaymentLink({
  tenantId: "tenant_demo",
  tenantName: "Mi Gran Tienda",
  orderId: "ORD-9902",
  provider: "BIOPAGO_BDV",
  amountUsd: 10,
  exchangeRateBcv: 800,
  customerName: "Maria Gómez",
});

assert.strictEqual(biopagoLink.provider, "BIOPAGO_BDV");
assert.strictEqual(biopagoLink.currency, "VES");
assert.strictEqual(biopagoLink.amount, 8000.0);
assert.ok(biopagoLink.qr_data.includes("bdv:biopago"));
console.log("  ✔ generateFintechPaymentLink generates Biopago BDV links & QR in VES");

// 4. WhatsApp Share Message
const waUrl = buildFintechWhatsAppShareMessage(casheaLink, "+584121234567");
assert.ok(waUrl.startsWith("https://wa.me/584121234567?text="));
assert.ok(waUrl.includes(encodeURIComponent("ORD-9901")));
console.log("  ✔ buildFintechWhatsAppShareMessage generates instant sharing URL");

console.log("🎉 All Fintech & Commissions checks passed successfully!\n");
