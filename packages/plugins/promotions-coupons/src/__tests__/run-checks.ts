import assert from "node:assert";
import type { Coupon } from "@marketos/types";
import { PROMOTIONS_COUPONS_MANIFEST } from "../manifest.ts";
import {
  evaluateCouponDiscount,
  calculateOrderFinancialBreakdown,
} from "../services/discount-engine.ts";

console.log("🧪 [Ponytail Check] Running tests for @marketos/plugin-promotions-coupons...");

// 1. Manifest verification
assert.strictEqual(PROMOTIONS_COUPONS_MANIFEST.id, "promotions_coupons");
assert.strictEqual(PROMOTIONS_COUPONS_MANIFEST.version, "1.0.0");
assert.strictEqual(PROMOTIONS_COUPONS_MANIFEST.country_code, "GLOBAL");
assert.strictEqual(PROMOTIONS_COUPONS_MANIFEST.category, "growth_operations");
console.log("  ✔ PROMOTIONS_COUPONS_MANIFEST is valid and declared as GLOBAL");

// 2. Minimum order amount enforcement
const couponMinSpend: Coupon = {
  id: "c-min",
  tenant_id: "t-1",
  code: "MIN20",
  discount_type: "FIXED_USD",
  discount_value: 5,
  min_order_amount_usd: 20,
  usage_count: 0,
  is_active: true,
};

const failMinSpend = evaluateCouponDiscount({
  coupon: couponMinSpend,
  subtotalUsd: 15,
});
assert.strictEqual(failMinSpend.valid, false);
assert.strictEqual(failMinSpend.discountUsd, 0);
assert.ok(failMinSpend.message.includes("Monto mínimo"));

const passMinSpend = evaluateCouponDiscount({
  coupon: couponMinSpend,
  subtotalUsd: 25,
});
assert.strictEqual(passMinSpend.valid, true);
assert.strictEqual(passMinSpend.discountUsd, 5);
console.log("  ✔ Minimum order amount requirement strictly enforced");

// 3. Percentage discount with max_discount_usd cap
const couponPercentCap: Coupon = {
  id: "c-pct",
  tenant_id: "t-1",
  code: "SALE50",
  discount_type: "PERCENTAGE",
  discount_value: 50, // 50% off
  min_order_amount_usd: 10,
  max_discount_usd: 15, // Max $15 discount
  usage_count: 0,
  is_active: true,
};

// 50% of $100 is $50, but cap is $15
const cappedResult = evaluateCouponDiscount({
  coupon: couponPercentCap,
  subtotalUsd: 100,
});
assert.strictEqual(cappedResult.valid, true);
assert.strictEqual(cappedResult.discountUsd, 15, "Discount must be capped at max_discount_usd");

// 50% of $20 is $10 (under cap)
const normalResult = evaluateCouponDiscount({
  coupon: couponPercentCap,
  subtotalUsd: 20,
});
assert.strictEqual(normalResult.valid, true);
assert.strictEqual(normalResult.discountUsd, 10);
console.log("  ✔ Percentage discount calculates correctly and enforces max_discount_usd cap");

// 4. Fixed USD coupon cannot make subtotal negative
const couponHugeFixed: Coupon = {
  id: "c-huge",
  tenant_id: "t-1",
  code: "BIG30",
  discount_type: "FIXED_USD",
  discount_value: 30,
  min_order_amount_usd: 0,
  usage_count: 0,
  is_active: true,
};
const boundedFixed = evaluateCouponDiscount({
  coupon: couponHugeFixed,
  subtotalUsd: 18.5,
});
assert.strictEqual(boundedFixed.valid, true);
assert.strictEqual(boundedFixed.discountUsd, 18.5, "Fixed discount cannot exceed subtotal");
console.log("  ✔ Fixed USD discounts bounded to order subtotal");

// 5. Global usage limit check
const couponGlobalLimit: Coupon = {
  id: "c-glob",
  tenant_id: "t-1",
  code: "LIMITED10",
  discount_type: "FIXED_USD",
  discount_value: 2,
  min_order_amount_usd: 5,
  usage_limit: 10,
  usage_count: 10, // Reached limit
  is_active: true,
};
const globalLimitRes = evaluateCouponDiscount({
  coupon: couponGlobalLimit,
  subtotalUsd: 15,
});
assert.strictEqual(globalLimitRes.valid, false);
assert.ok(globalLimitRes.message.includes("límite de usos"));
console.log("  ✔ Global usage limit blocks expired quotas");

// 6. Per-customer usage limit check
const couponCustomerLimit: Coupon = {
  id: "c-cust",
  tenant_id: "t-1",
  code: "FIRSTBUY",
  discount_type: "FIXED_USD",
  discount_value: 5,
  min_order_amount_usd: 10,
  usage_limit_per_customer: 1, // Only 1 use per customer
  usage_count: 2,
  is_active: true,
};

// Customer already used it once
const custUsedOnceRes = evaluateCouponDiscount({
  coupon: couponCustomerLimit,
  subtotalUsd: 20,
  customerPhone: "+58 412 1112233",
  customerPreviousUsageCount: 1,
});
assert.strictEqual(custUsedOnceRes.valid, false);
assert.ok(custUsedOnceRes.message.includes("límite de 1 canje(s)"));

// New customer who hasn't used it
const custNewRes = evaluateCouponDiscount({
  coupon: couponCustomerLimit,
  subtotalUsd: 20,
  customerPhone: "+58 414 9998877",
  customerPreviousUsageCount: 0,
});
assert.strictEqual(custNewRes.valid, true);
assert.strictEqual(custNewRes.discountUsd, 5);
console.log("  ✔ Per-customer usage limits protect promotions from multiple redemptions");

// 7. Time windows (starts_at & expires_at)
const now = Date.now();
const futureCoupon: Coupon = {
  ...couponMinSpend,
  starts_at: new Date(now + 86400000).toISOString(), // Tomorrow
};
const futureRes = evaluateCouponDiscount({
  coupon: futureCoupon,
  subtotalUsd: 25,
  nowTimestamp: now,
});
assert.strictEqual(futureRes.valid, false);
assert.ok(futureRes.message.includes("estará activo"));

const expiredCoupon: Coupon = {
  ...couponMinSpend,
  expires_at: new Date(now - 86400000).toISOString(), // Yesterday
};
const expiredRes = evaluateCouponDiscount({
  coupon: expiredCoupon,
  subtotalUsd: 25,
  nowTimestamp: now,
});
assert.strictEqual(expiredRes.valid, false);
assert.ok(expiredRes.message.includes("ha vencido"));
console.log("  ✔ Temporal validity windows (starts_at, expires_at) strictly validated");

// 8. Delivery fee protection in Financial Breakdown
const breakdown = calculateOrderFinancialBreakdown({
  subtotalUsd: 20,
  discountUsd: 25, // User coupon is $25, but products are only $20
  deliveryFeeUsd: 5,
});
assert.strictEqual(breakdown.subtotalUsd, 20);
assert.strictEqual(breakdown.discountUsd, 20, "Discount capped at product subtotal");
assert.strictEqual(breakdown.finalProductsSubtotalUsd, 0);
assert.strictEqual(breakdown.deliveryFeeUsd, 5, "Delivery fee is 100% protected and untouched");
assert.strictEqual(breakdown.totalUsd, 5, "Customer still pays full delivery fee to courier");
console.log("  ✔ Delivery fees are strictly protected from discount erosion");

console.log("🎉 All @marketos/plugin-promotions-coupons tests passed successfully!\n");
