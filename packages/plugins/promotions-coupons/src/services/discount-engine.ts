import type { Coupon } from "@marketos/types";

export interface EvaluateCouponParams {
  coupon: Coupon;
  subtotalUsd: number;
  customerPhone?: string;
  customerPreviousUsageCount?: number;
  nowTimestamp?: number;
}

export interface CouponEvaluationResult {
  valid: boolean;
  coupon: Coupon;
  discountUsd: number;
  message: string;
}

/**
 * Pure business logic engine to validate and calculate coupon discounts.
 */
export function evaluateCouponDiscount({
  coupon,
  subtotalUsd,
  customerPhone,
  customerPreviousUsageCount = 0,
  nowTimestamp = Date.now(),
}: EvaluateCouponParams): CouponEvaluationResult {
  if (!coupon.is_active) {
    return {
      valid: false,
      coupon,
      discountUsd: 0,
      message: "Este cupón está inactivo o deshabilitado.",
    };
  }

  if (subtotalUsd < coupon.min_order_amount_usd) {
    return {
      valid: false,
      coupon,
      discountUsd: 0,
      message: `Monto mínimo de compra para este cupón: $${coupon.min_order_amount_usd.toFixed(2)}`,
    };
  }

  // Global usage limit check
  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    return {
      valid: false,
      coupon,
      discountUsd: 0,
      message: "Este cupón ha alcanzado su límite de usos disponibles.",
    };
  }

  // Per-customer usage limit check
  if (coupon.usage_limit_per_customer && customerPhone) {
    if (customerPreviousUsageCount >= coupon.usage_limit_per_customer) {
      return {
        valid: false,
        coupon,
        discountUsd: 0,
        message: `Has alcanzado el límite de ${coupon.usage_limit_per_customer} canje(s) para este cupón.`,
      };
    }
  }

  // Starts at window check
  if (coupon.starts_at) {
    const starts = new Date(coupon.starts_at).getTime();
    if (!isNaN(starts) && nowTimestamp < starts) {
      return {
        valid: false,
        coupon,
        discountUsd: 0,
        message: `Este cupón estará activo a partir del ${new Date(coupon.starts_at).toLocaleDateString("es-VE")}.`,
      };
    }
  }

  // Expiration check
  if (coupon.expires_at) {
    const expiry = new Date(coupon.expires_at).getTime();
    if (!isNaN(expiry) && nowTimestamp > expiry) {
      return {
        valid: false,
        coupon,
        discountUsd: 0,
        message: "Este cupón ha vencido.",
      };
    }
  }

  // Calculate discount
  let rawDiscount = 0;
  if (coupon.discount_type === "FIXED_USD") {
    rawDiscount = Math.min(subtotalUsd, coupon.discount_value);
  } else if (coupon.discount_type === "PERCENTAGE") {
    rawDiscount = (subtotalUsd * coupon.discount_value) / 100;
    if (coupon.max_discount_usd && rawDiscount > coupon.max_discount_usd) {
      rawDiscount = coupon.max_discount_usd;
    }
  }

  const finalDiscount = Number(Math.max(0, rawDiscount).toFixed(2));

  return {
    valid: true,
    coupon,
    discountUsd: finalDiscount,
    message: `¡Cupón aplicado con éxito! -$${finalDiscount.toFixed(2)}`,
  };
}

export interface FinancialBreakdownParams {
  subtotalUsd: number;
  discountUsd: number;
  deliveryFeeUsd?: number;
}

export interface FinancialBreakdownResult {
  subtotalUsd: number;
  discountUsd: number;
  finalProductsSubtotalUsd: number;
  deliveryFeeUsd: number;
  totalUsd: number;
}

/**
 * Calculates final order financial totals ensuring delivery fees are protected from discount erosion.
 */
export function calculateOrderFinancialBreakdown({
  subtotalUsd,
  discountUsd,
  deliveryFeeUsd = 0,
}: FinancialBreakdownParams): FinancialBreakdownResult {
  const safeSubtotal = Number(Math.max(0, subtotalUsd).toFixed(2));
  const safeDiscount = Number(Math.min(safeSubtotal, Math.max(0, discountUsd)).toFixed(2));
  const finalProductsSubtotalUsd = Number((safeSubtotal - safeDiscount).toFixed(2));
  const safeDelivery = Number(Math.max(0, deliveryFeeUsd).toFixed(2));
  const totalUsd = Number((finalProductsSubtotalUsd + safeDelivery).toFixed(2));

  return {
    subtotalUsd: safeSubtotal,
    discountUsd: safeDiscount,
    finalProductsSubtotalUsd,
    deliveryFeeUsd: safeDelivery,
    totalUsd,
  };
}
