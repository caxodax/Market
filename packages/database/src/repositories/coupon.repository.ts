import type {
  Coupon,
  CreateCouponInput,
  UpdateCouponInput,
} from "@marketos/types";
import { state } from "../mock-data.ts";
import { getSupabase } from "./base.ts";

export class CouponRepository {
  /**
   * Validate Coupon for a Cart / Order with strict usage and date boundary enforcement
   */
  static async validateCoupon(
    tenantId: string,
    rawCode: string,
    orderAmountUsd: number,
    customerPhone?: string
  ): Promise<{
    valid: boolean;
    coupon?: Coupon;
    discountUsd: number;
    message?: string;
  }> {
    const code = rawCode.trim().toUpperCase();
    let coupon: Coupon | undefined;

    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .eq("tenant_id", tenantId)
        .ilike("code", code)
        .eq("is_active", true)
        .maybeSingle();

      if (data) {
        coupon = data as Coupon;
      }
    }

    if (!coupon) {
      coupon = state.coupons.find(
        (c) =>
          c.tenant_id === tenantId &&
          c.code.toUpperCase() === code &&
          c.is_active
      );
    }

    if (!coupon) {
      return { valid: false, discountUsd: 0, message: "Cupón no encontrado o inválido" };
    }

    if (orderAmountUsd < coupon.min_order_amount_usd) {
      return {
        valid: false,
        coupon,
        discountUsd: 0,
        message: `Monto mínimo de compra para este cupón: $${coupon.min_order_amount_usd.toFixed(2)}`,
      };
    }

    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return {
        valid: false,
        coupon,
        discountUsd: 0,
        message: "Este cupón ha alcanzado su límite de usos",
      };
    }

    if (coupon.usage_limit_per_customer && customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, "");
      let customerUsageCount = 0;

      if (supabase && cleanPhone.length >= 7) {
        try {
          const { count } = await supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("coupon_id", coupon.id)
            .neq("status", "CANCELLED")
            .ilike("customer_phone", `%${cleanPhone.slice(-7)}%`);
          customerUsageCount = count || 0;
        } catch (e) {
          console.warn("[CouponRepository] Could not count customer coupon orders in Supabase:", e);
        }
      }

      if (!customerUsageCount) {
        customerUsageCount = state.orders.filter(
          (o) =>
            o.tenant_id === tenantId &&
            o.coupon_id === coupon?.id &&
            o.status !== "CANCELLED" &&
            (o.customer_phone?.replace(/\D/g, "").slice(-7) === cleanPhone.slice(-7) ||
              o.customer_phone === customerPhone)
        ).length;
      }

      if (customerUsageCount >= coupon.usage_limit_per_customer) {
        return {
          valid: false,
          coupon,
          discountUsd: 0,
          message: `Has alcanzado el límite de ${coupon.usage_limit_per_customer} uso(s) permitido(s) para este cupón`,
        };
      }
    }

    if (coupon.starts_at) {
      const starts = new Date(coupon.starts_at).getTime();
      if (!isNaN(starts) && Date.now() < starts) {
        return {
          valid: false,
          coupon,
          discountUsd: 0,
          message: `Este cupón aún no está activo. Estará disponible a partir del ${new Date(coupon.starts_at).toLocaleDateString("es-VE")}`,
        };
      }
    }

    if (coupon.expires_at) {
      const expiry = new Date(coupon.expires_at).getTime();
      if (!isNaN(expiry) && Date.now() > expiry) {
        return {
          valid: false,
          coupon,
          discountUsd: 0,
          message: "Este cupón ha vencido",
        };
      }
    }

    let discount = 0;
    if (coupon.discount_type === "FIXED_USD") {
      discount = Math.min(orderAmountUsd, coupon.discount_value);
    } else if (coupon.discount_type === "PERCENTAGE") {
      discount = (orderAmountUsd * coupon.discount_value) / 100;
      if (coupon.max_discount_usd && discount > coupon.max_discount_usd) {
        discount = coupon.max_discount_usd;
      }
    }

    discount = Number(discount.toFixed(2));

    return {
      valid: true,
      coupon,
      discountUsd: discount,
      message: `¡Cupón aplicado con éxito! -$${discount.toFixed(2)}`,
    };
  }

  /**
   * Get all coupons for Tenant
   */
  static async getCoupons(tenantId: string): Promise<Coupon[]> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data as Coupon[];
      }
    }

    return state.coupons
      .filter((c) => c.tenant_id === tenantId)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  /**
   * Toggle Coupon active status
   */
  static async toggleCoupon(
    tenantId: string,
    couponId: string,
    isActive: boolean
  ): Promise<Coupon | null> {
    const supabase = getSupabase();
    if (supabase) {
      await supabase
        .from("coupons")
        .update({ is_active: isActive })
        .eq("id", couponId)
        .eq("tenant_id", tenantId);
    }

    const c = state.coupons.find((cp) => cp.id === couponId && cp.tenant_id === tenantId);
    if (c) {
      c.is_active = isActive;
      return c;
    }
    return null;
  }

  /**
   * Delete Coupon
   */
  static async deleteCoupon(tenantId: string, couponId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      await supabase
        .from("coupons")
        .delete()
        .eq("id", couponId)
        .eq("tenant_id", tenantId);
    }

    const idx = state.coupons.findIndex(
      (cp) => cp.id === couponId && cp.tenant_id === tenantId
    );
    if (idx !== -1) {
      state.coupons.splice(idx, 1);
    }
    return true;
  }
}
