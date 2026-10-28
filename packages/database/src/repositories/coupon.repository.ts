import type {
  Coupon,
  CreateCouponInput,
  UpdateCouponInput,
} from "@marketos/types";
import { state } from "../mock-data.ts";
import { getSupabase, isLiveDatabaseConfigured } from "./base.ts";
import { AuditRepository } from "./audit.repository.ts";

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

      if (!error && Array.isArray(data)) {
        return data as Coupon[];
      }
    }

    if (isLiveDatabaseConfigured()) {
      return [];
    }

    return state.coupons
      .filter((c) => c.tenant_id === tenantId)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  /**
   * Create a new Coupon with discount amount, start date & expiration date
   */
  static async createCoupon(input: CreateCouponInput): Promise<Coupon> {
    const cleanCode = input.code.trim().toUpperCase();
    const newCoupon: Coupon = {
      id: `coupon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: input.tenantId,
      code: cleanCode,
      description: input.description?.trim() || null,
      discount_type: input.discountType,
      discount_value: Number(input.discountValue),
      min_order_amount_usd: Number(input.minOrderAmountUsd) || 0,
      max_discount_usd: input.maxDiscountUsd ? Number(input.maxDiscountUsd) : null,
      usage_limit: input.usageLimit ? Number(input.usageLimit) : null,
      usage_limit_per_customer: input.usageLimitPerCustomer ? Number(input.usageLimitPerCustomer) : null,
      usage_count: 0,
      is_active: true,
      starts_at: input.startsAt || null,
      expires_at: input.expiresAt || null,
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("coupons")
        .insert({
          tenant_id: newCoupon.tenant_id,
          code: newCoupon.code,
          description: newCoupon.description,
          discount_type: newCoupon.discount_type,
          discount_value: newCoupon.discount_value,
          min_order_amount_usd: newCoupon.min_order_amount_usd,
          max_discount_usd: newCoupon.max_discount_usd,
          usage_limit: newCoupon.usage_limit,
          usage_limit_per_customer: newCoupon.usage_limit_per_customer,
          usage_count: 0,
          is_active: true,
          starts_at: newCoupon.starts_at,
          expires_at: newCoupon.expires_at,
        })
        .select()
        .single();

      if (!error && data) {
        newCoupon.id = data.id;
      }
    }

    state.coupons.unshift(newCoupon);

    try {
      await AuditRepository.recordAuditLog({
        tenantId: input.tenantId,
        action: "CUPÓN_CREADO",
        entity: "coupons",
        entityId: newCoupon.id,
        newData: {
          code: newCoupon.code,
          discount_type: newCoupon.discount_type,
          discount_value: newCoupon.discount_value,
          expires_at: newCoupon.expires_at,
        },
      });
    } catch {}

    return newCoupon;
  }

  /**
   * Update an existing Coupon
   */
  static async updateCoupon(input: UpdateCouponInput): Promise<Coupon | null> {
    const supabase = getSupabase();
    const updatePayload: Record<string, any> = {};

    if (input.code !== undefined) updatePayload.code = input.code.trim().toUpperCase();
    if (input.description !== undefined) updatePayload.description = input.description?.trim() || null;
    if (input.discountType !== undefined) updatePayload.discount_type = input.discountType;
    if (input.discountValue !== undefined) updatePayload.discount_value = Number(input.discountValue);
    if (input.minOrderAmountUsd !== undefined) updatePayload.min_order_amount_usd = Number(input.minOrderAmountUsd);
    if (input.maxDiscountUsd !== undefined) updatePayload.max_discount_usd = input.maxDiscountUsd ? Number(input.maxDiscountUsd) : null;
    if (input.usageLimit !== undefined) updatePayload.usage_limit = input.usageLimit ? Number(input.usageLimit) : null;
    if (input.usageLimitPerCustomer !== undefined) updatePayload.usage_limit_per_customer = input.usageLimitPerCustomer ? Number(input.usageLimitPerCustomer) : null;
    if (input.startsAt !== undefined) updatePayload.starts_at = input.startsAt || null;
    if (input.expiresAt !== undefined) updatePayload.expires_at = input.expiresAt || null;
    if (input.isActive !== undefined) updatePayload.is_active = input.isActive;

    if (supabase) {
      try {
        await supabase
          .from("coupons")
          .update(updatePayload)
          .eq("id", input.couponId)
          .eq("tenant_id", input.tenantId);
      } catch (err) {
        console.warn("[MarketOS] Update coupon Supabase error:", err);
      }
    }

    const c = state.coupons.find((cp) => cp.id === input.couponId && cp.tenant_id === input.tenantId);
    if (c) {
      if (input.code !== undefined) c.code = input.code.trim().toUpperCase();
      if (input.description !== undefined) c.description = input.description?.trim() || null;
      if (input.discountType !== undefined) c.discount_type = input.discountType;
      if (input.discountValue !== undefined) c.discount_value = Number(input.discountValue);
      if (input.minOrderAmountUsd !== undefined) c.min_order_amount_usd = Number(input.minOrderAmountUsd);
      if (input.maxDiscountUsd !== undefined) c.max_discount_usd = input.maxDiscountUsd ? Number(input.maxDiscountUsd) : null;
      if (input.usageLimit !== undefined) c.usage_limit = input.usageLimit ? Number(input.usageLimit) : null;
      if (input.usageLimitPerCustomer !== undefined) c.usage_limit_per_customer = input.usageLimitPerCustomer ? Number(input.usageLimitPerCustomer) : null;
      if (input.startsAt !== undefined) c.starts_at = input.startsAt || null;
      if (input.expiresAt !== undefined) c.expires_at = input.expiresAt || null;
      if (input.isActive !== undefined) c.is_active = input.isActive;

      try {
        await AuditRepository.recordAuditLog({
          tenantId: input.tenantId,
          action: "CUPÓN_ACTUALIZADO",
          entity: "coupons",
          entityId: input.couponId,
          newData: updatePayload,
        });
      } catch {}

      return c;
    }
    return null;
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
