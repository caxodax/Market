import {
  Tenant,
  TenantSettings,
  Store,
  Category,
  Product,
  ExchangeRate,
  Order,
  PaymentProof,
  DeliveryType,
  PaymentMethodType,
  PaymentStatus,
  DeliveryZone,
  Coupon,
  CreateCouponInput,
  Driver,
  Customer,
  CustomerAddress,
  SubscriptionPlan,
  TenantSubscription,
  TenantWithDetails,
  PlatformMetrics,
  OnboardTenantInput,
  SubscriptionPlanTier,
  AuditLog,
  InventoryMovement,
  CustomerAccountSummary,
  OrderStatus,
  CreateProductInput,
  UpdateProductInput,
  InviteStaffInput,
  UserProfile,
  UserRole,
  RateHistoryItem,
} from "@marketos/types";
import { state, INITIAL_SETTINGS, INITIAL_TENANT } from "./mock-data";
import { fetchBcvRate, convertUsdToVes } from "@marketos/utils";
import { createServerComponentClient } from "./server";
import { isSupabaseOffline } from "./circuit-breaker";

export interface CreateOrderInput {
  tenantId: string;
  storeId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryType: DeliveryType;
  deliveryZoneId?: string;
  deliveryAddress?: string;
  deliveryFeeUsd?: number;
  couponCode?: string;
  discountUsd?: number;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPriceUsd: number;
  }[];
  notes?: string;
}

export interface SubmitPaymentInput {
  tenantId: string;
  orderId: string;
  method: PaymentMethodType;
  bankName?: string;
  referenceNumber: string;
  amount: number;
  currency?: "VES" | "USD";
  proofImageUrl?: string;
}

function getSupabase() {
  if (isSupabaseOffline()) {
    return null;
  }

  try {
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    ) {
      return createServerComponentClient();
    }
  } catch (e) {
    console.warn("[MarketOS] Could not initialize Supabase server client:", e);
  }
  return null;
}

export class MarketOSRepository {
  /**
   * Fetch Tenant by ID or Slug
   */
  static async getTenant(tenantIdOrSlug: string): Promise<Tenant | null> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .or(`id.eq.${tenantIdOrSlug},slug.eq.${tenantIdOrSlug}`)
        .maybeSingle();

      if (!error && data) {
        return data as Tenant;
      }
    }

    const tenant = state.tenants.find(
      (t) => t.id === tenantIdOrSlug || t.slug === tenantIdOrSlug
    );
    return tenant || INITIAL_TENANT;
  }

  /**
   * Fetch Tenant Customization & Branding Settings
   */
  static async getTenantSettings(tenantId: string): Promise<TenantSettings> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!error && data) {
        return {
          ...INITIAL_SETTINGS,
          ...(data as TenantSettings),
          payment_settings: {
            ...INITIAL_SETTINGS.payment_settings,
            ...(data.payment_settings || {}),
          },
          operational_settings: {
            ...INITIAL_SETTINGS.operational_settings,
            ...(data.operational_settings || {}),
          },
        };
      }
    }

    const settings = state.settings.find((s) => s.tenant_id === tenantId);
    return settings || INITIAL_SETTINGS;
  }

  /**
   * Update Tenant Settings, Branding and Payment Accounts
   */
  static async updateTenantSettings(
    tenantId: string,
    updates: Partial<TenantSettings>
  ): Promise<TenantSettings> {
    const current = await this.getTenantSettings(tenantId);
    const updated: TenantSettings = {
      ...current,
      ...updates,
      social_links: updates.social_links
        ? { ...current.social_links, ...updates.social_links }
        : current.social_links,
      payment_settings: updates.payment_settings
        ? { ...current.payment_settings, ...updates.payment_settings }
        : current.payment_settings,
      operational_settings: updates.operational_settings
        ? { ...current.operational_settings, ...updates.operational_settings }
        : current.operational_settings,
    };

    const supabase = getSupabase();
    if (supabase) {
      const payload: Record<string, any> = {
        business_name: updated.business_name,
        category: updated.category,
        primary_color: updated.primary_color,
        secondary_color: updated.secondary_color,
        accent_color: updated.accent_color,
        font_family: updated.font_family,
        logo_url: updated.logo_url,
        banner_url: updated.banner_url,
        phone: updated.phone,
        email: updated.email,
        whatsapp_number: updated.whatsapp_number,
        address: updated.address,
        social_links: updated.social_links,
        supported_currencies: updated.supported_currencies,
        default_currency: updated.default_currency,
        payment_settings: updated.payment_settings,
        operational_settings: updated.operational_settings,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("tenant_settings")
        .update(payload)
        .eq("tenant_id", tenantId);

      if (error) {
        console.warn(
          "[MarketOS] updateTenantSettings Supabase error, retrying without extended columns:",
          error.message
        );
        const safePayload = { ...payload };
        delete safePayload.payment_settings;
        delete safePayload.operational_settings;
        delete safePayload.font_family;
        await supabase
          .from("tenant_settings")
          .update(safePayload)
          .eq("tenant_id", tenantId);
      }
    }

    // Keep in-memory cache synchronized
    const idx = state.settings.findIndex((s) => s.tenant_id === tenantId);
    if (idx !== -1) {
      state.settings[idx] = updated;
    } else {
      state.settings.push(updated);
    }

    // Log to Audit Trail
    try {
      await MarketOSRepository.recordAuditLog({
        tenantId,
        action: "CONFIGURACIÓN_ACTUALIZADA",
        entity: "tenant_settings",
        entityId: tenantId,
        newData: {
          business_name: updated.business_name,
          primary_color: updated.primary_color,
          font_family: updated.font_family,
          enabled_payment_methods: updated.payment_settings?.enabled_methods,
        },
      });
    } catch (e) {
      // audit log failure non-blocking
    }

    return updated;
  }

  /**
   * Get Stores for Tenant
   */
  static async getStores(tenantId: string): Promise<Store[]> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      if (!error && data && data.length > 0) {
        return data as Store[];
      }
    }

    return state.stores.filter((s) => s.tenant_id === tenantId && s.is_active);
  }

  /**
   * Get Categories for Tenant
   */
  static async getCategories(tenantId: string): Promise<Category[]> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && data && data.length > 0) {
        return data as Category[];
      }
    }

    return state.categories
      .filter((c) => c.tenant_id === tenantId && c.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  /**
   * Get Products for Tenant with optional category & search filter
   */
  static async getProducts(
    tenantId: string,
    categoryId?: string,
    query?: string
  ): Promise<(Product & { stock: number })[]> {
    const supabase = getSupabase();
    if (supabase) {
      let q = supabase
        .from("products")
        .select("*, inventory(quantity)")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      if (categoryId) {
        q = q.eq("category_id", categoryId);
      }

      if (query) {
        q = q.ilike("name", `%${query}%`);
      }

      const { data, error } = await q;

      if (!error && data && data.length > 0) {
        return data.map((item: any) => {
          const totalStock = Array.isArray(item.inventory)
            ? item.inventory.reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0)
            : 20;

          return {
            id: item.id,
            tenant_id: item.tenant_id,
            category_id: item.category_id,
            name: item.name,
            slug: item.slug,
            description: item.description,
            sku: item.sku,
            barcode: item.barcode,
            image_url: item.image_url,
            price_usd: Number(item.price_usd),
            is_active: item.is_active,
            stock: totalStock,
            created_at: item.created_at,
            updated_at: item.updated_at,
          };
        });
      }
    }

    return state.products.filter((p) => {
      if (p.tenant_id !== tenantId || !p.is_active) return false;
      if (categoryId && p.category_id !== categoryId) return false;
      if (query && !p.name.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });
  }

  /**
   * Get Exchange Rate for Tenant - Reads strictly from Database / Local Seed
   * Pure database read (0 network latency, 0 external API calls on user requests)
   */
  static async getExchangeRate(tenantId: string): Promise<ExchangeRate> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("exchange_rates")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id,
            tenant_id: data.tenant_id,
            currency: data.currency,
            value: Number(data.value),
            eur_value: data.eur_value ? Number(data.eur_value) : undefined,
            usdt_value: data.usdt_value ? Number(data.usdt_value) : undefined,
            source: data.source,
            updated_at: data.updated_at,
          };
        }
      } catch (err) {
        console.warn("[MarketOS] Exchange rate fetch error, using resilient fallback:", err);
      }
    }

    const fallback = state.rates.find((r) => r.tenant_id === tenantId) || {
      id: "rate-fallback",
      tenant_id: tenantId,
      currency: "VES",
      value: 875.6505,
      eur_value: 980.6147,
      usdt_value: 1016.785,
      source: "alcambio.app",
      updated_at: new Date().toISOString(),
    };
    return fallback;
  }

  /**
   * Get Historical Exchange Rates (Daily ledger for accounting, audit and charts)
   */
  static async getExchangeRateHistory(
    tenantId?: string,
    limit: number = 30
  ): Promise<RateHistoryItem[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase
          .from("exchange_rate_history")
          .select("*")
          .order("date_rate", { ascending: false })
          .limit(limit);

        if (tenantId) {
          query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data.map((item: any) => ({
            id: item.id,
            tenant_id: item.tenant_id,
            date_rate: item.date_rate,
            currency: item.currency || "USD",
            rate: Number(item.rate),
            rate_eur: item.rate_eur ? Number(item.rate_eur) : undefined,
            usdt_promedio: item.usdt_promedio ? Number(item.usdt_promedio) : undefined,
            source: item.source,
            created_at: item.created_at,
          }));
        }
      } catch (err) {
        console.warn("[MarketOS] Error fetching exchange rate history from Supabase:", err);
      }
    }

    // Fallback to in-memory history state
    let history = [...state.rateHistory];
    if (tenantId) {
      history = history.filter((h) => !h.tenant_id || h.tenant_id === tenantId);
    }
    history.sort((a, b) => b.date_rate.localeCompare(a.date_rate));
    return history.slice(0, limit);
  }

  /**
   * Synchronize Official BCV Rate from API into Supabase Database
   * Executed via scheduled cron (e.g. daily at 7:00 AM) or manual Admin trigger
   */
  static async syncBcvRateFromApi(tenantId: string): Promise<ExchangeRate> {
    let bcv: {
      usdRate: number;
      eurRate?: number;
      usdtRate?: number;
      source: string;
      timestamp: string;
    };

    try {
      bcv = await fetchBcvRate();
    } catch {
      bcv = {
        usdRate: 875.6505,
        eurRate: 980.6147,
        usdtRate: 1016.785,
        source: "alcambio.app",
        timestamp: new Date().toISOString(),
      };
    }

    const todayDateStr = bcv.timestamp.split("T")[0];
    const supabase = getSupabase();

    if (supabase) {
      try {
        // 1. Update active rate in exchange_rates
        const { data: existing } = await supabase
          .from("exchange_rates")
          .select("id")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        const ratePayload: any = {
          value: bcv.usdRate,
          source: bcv.source,
          updated_at: bcv.timestamp,
        };
        if (bcv.eurRate) ratePayload.eur_value = bcv.eurRate;
        if (bcv.usdtRate) ratePayload.usdt_value = bcv.usdtRate;

        if (existing) {
          await supabase
            .from("exchange_rates")
            .update(ratePayload)
            .eq("id", existing.id);
        } else {
          await supabase.from("exchange_rates").insert({
            tenant_id: tenantId,
            currency: "VES",
            ...ratePayload,
          });
        }

        // 2. Upsert into exchange_rate_history
        await supabase.from("exchange_rate_history").upsert(
          {
            tenant_id: tenantId,
            date_rate: todayDateStr,
            currency: "USD",
            rate: bcv.usdRate,
            rate_eur: bcv.eurRate,
            usdt_promedio: bcv.usdtRate,
            source: bcv.source,
            created_at: bcv.timestamp,
          },
          { onConflict: "tenant_id,date_rate,currency" }
        );

        await MarketOSRepository.recordAuditLog({
          tenantId,
          action: "BCV_RATE_SYNCED",
          entity: "exchange_rates",
          entityId: tenantId,
          newData: {
            value: bcv.usdRate,
            eurRate: bcv.eurRate,
            usdtRate: bcv.usdtRate,
            timestamp: bcv.timestamp,
          },
        });
      } catch (e) {
        console.warn("[MarketOS] Error updating exchange rate in Supabase:", e);
      }
    }

    const updatedRate: ExchangeRate = {
      id: `rate-${tenantId}`,
      tenant_id: tenantId,
      currency: "VES",
      value: bcv.usdRate,
      eur_value: bcv.eurRate,
      usdt_value: bcv.usdtRate,
      source: bcv.source,
      updated_at: bcv.timestamp,
    };

    // Update in-memory state
    const existingIdx = state.rates.findIndex((r) => r.tenant_id === tenantId);
    if (existingIdx >= 0) {
      state.rates[existingIdx] = updatedRate;
    } else {
      state.rates.push(updatedRate);
    }

    // Update in-memory history
    const existingHistIdx = state.rateHistory.findIndex(
      (h) => h.tenant_id === tenantId && h.date_rate === todayDateStr
    );
    const historyItem: RateHistoryItem = {
      id: `hist-${Date.now()}`,
      tenant_id: tenantId,
      date_rate: todayDateStr,
      currency: "USD",
      rate: bcv.usdRate,
      rate_eur: bcv.eurRate,
      usdt_promedio: bcv.usdtRate,
      source: bcv.source,
      created_at: bcv.timestamp,
    };
    if (existingHistIdx >= 0) {
      state.rateHistory[existingHistIdx] = historyItem;
    } else {
      state.rateHistory.unshift(historyItem);
    }

    return updatedRate;
  }

  /**
   * Save Manual Contingency Exchange Rate (Admin & Super Admin)
   */
  static async saveManualExchangeRate(
    tenantId: string,
    data: {
      date_rate: string;
      usd_rate: number;
      eur_rate?: number;
      usdt_rate?: number;
      source?: string;
    }
  ): Promise<ExchangeRate> {
    const source = data.source || "MANUAL";
    const nowIso = new Date().toISOString();
    const supabase = getSupabase();

    if (supabase) {
      try {
        // 1. Update active rate in exchange_rates
        const { data: existing } = await supabase
          .from("exchange_rates")
          .select("id")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        const ratePayload: any = {
          value: data.usd_rate,
          source,
          updated_at: nowIso,
        };
        if (data.eur_rate) ratePayload.eur_value = data.eur_rate;
        if (data.usdt_rate) ratePayload.usdt_value = data.usdt_rate;

        if (existing) {
          await supabase
            .from("exchange_rates")
            .update(ratePayload)
            .eq("id", existing.id);
        } else {
          await supabase.from("exchange_rates").insert({
            tenant_id: tenantId,
            currency: "VES",
            ...ratePayload,
          });
        }

        // 2. Upsert in exchange_rate_history
        await supabase.from("exchange_rate_history").upsert(
          {
            tenant_id: tenantId,
            date_rate: data.date_rate,
            currency: "USD",
            rate: data.usd_rate,
            rate_eur: data.eur_rate,
            usdt_promedio: data.usdt_rate,
            source,
            created_at: nowIso,
          },
          { onConflict: "tenant_id,date_rate,currency" }
        );

        await MarketOSRepository.recordAuditLog({
          tenantId,
          action: "MANUAL_RATE_SAVED",
          entity: "exchange_rates",
          entityId: tenantId,
          newData: {
            usd: data.usd_rate,
            eur: data.eur_rate,
            usdt: data.usdt_rate,
            date: data.date_rate,
          },
        });
      } catch (e) {
        console.warn("[MarketOS] Error saving manual rate to Supabase:", e);
      }
    }

    const updatedRate: ExchangeRate = {
      id: `rate-${tenantId}`,
      tenant_id: tenantId,
      currency: "VES",
      value: data.usd_rate,
      eur_value: data.eur_rate,
      usdt_value: data.usdt_rate,
      source,
      updated_at: nowIso,
    };

    const existingIdx = state.rates.findIndex((r) => r.tenant_id === tenantId);
    if (existingIdx >= 0) {
      state.rates[existingIdx] = updatedRate;
    } else {
      state.rates.push(updatedRate);
    }

    // Add to history
    const existingHistIdx = state.rateHistory.findIndex(
      (h) => h.tenant_id === tenantId && h.date_rate === data.date_rate
    );
    const historyItem: RateHistoryItem = {
      id: `hist-${Date.now()}`,
      tenant_id: tenantId,
      date_rate: data.date_rate,
      currency: "USD",
      rate: data.usd_rate,
      rate_eur: data.eur_rate,
      usdt_promedio: data.usdt_rate,
      source,
      created_at: nowIso,
    };
    if (existingHistIdx >= 0) {
      state.rateHistory[existingHistIdx] = historyItem;
    } else {
      state.rateHistory.unshift(historyItem);
    }

    return updatedRate;
  }

  /**
   * Get Active Delivery Zones for Tenant
   */
  static async getDeliveryZones(tenantId: string): Promise<DeliveryZone[]> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && data && data.length > 0) {
        return data as DeliveryZone[];
      }
    }

    return state.deliveryZones
      .filter((z) => z.tenant_id === tenantId && z.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  /**
   * Validate Coupon for a Cart / Order
   */
  static async validateCoupon(
    tenantId: string,
    rawCode: string,
    orderAmountUsd: number
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
   * Create a new Coupon with discount amount & expiration date
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
      usage_count: 0,
      is_active: true,
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
          usage_count: 0,
          is_active: true,
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
      await MarketOSRepository.recordAuditLog({
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

  /**
   * Get Drivers for Tenant
   */
  static async getDrivers(tenantId: string): Promise<Driver[]> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      if (!error && data && data.length > 0) {
        return data as Driver[];
      }
    }

    return state.drivers.filter((d) => d.tenant_id === tenantId && d.is_active);
  }

  /**
   * Create an Order with Multi-Tenant isolation and Phase 2 Operational features
   */
  static async createOrder(input: CreateOrderInput): Promise<Order> {
    const rate = await this.getExchangeRate(input.tenantId);
    
    // 1. Calculate items subtotal
    const subtotalUsd = input.items.reduce(
      (acc, item) => acc + item.unitPriceUsd * item.quantity,
      0
    );

    // 2. Validate and apply coupon discount if present
    let discountUsd = 0;
    let couponId: string | null = null;
    if (input.couponCode) {
      const couponRes = await this.validateCoupon(
        input.tenantId,
        input.couponCode,
        subtotalUsd
      );
      if (couponRes.valid) {
        discountUsd = couponRes.discountUsd;
        couponId = couponRes.coupon?.id || null;
      }
    } else if (input.discountUsd) {
      discountUsd = input.discountUsd;
    }

    // 3. Apply delivery fee if delivery selected
    const deliveryFeeUsd =
      input.deliveryType === "DELIVERY" ? input.deliveryFeeUsd || 0 : 0;

    // 4. Compute final totals
    const finalTotalUsd = Number(
      Math.max(0, subtotalUsd - discountUsd + deliveryFeeUsd).toFixed(2)
    );
    const totalVes = convertUsdToVes(finalTotalUsd, rate.value);
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    const supabase = getSupabase();

    let customerId = `cust-${Date.now()}`;
    const earnedPoints = Math.floor(finalTotalUsd);

    // 5. Look up or register customer in Supabase / State with loyalty points
    if (supabase) {
      try {
        const cleanPhone = input.customerPhone.replace(/\D/g, "");
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id, loyalty_points")
          .eq("tenant_id", input.tenantId)
          .eq("phone", input.customerPhone)
          .maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
          await supabase
            .from("customers")
            .update({
              loyalty_points: (existingCustomer.loyalty_points || 0) + earnedPoints,
              name: input.customerName,
              email: input.customerEmail || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", customerId);
        } else {
          const { data: newCust } = await supabase
            .from("customers")
            .insert({
              tenant_id: input.tenantId,
              name: input.customerName,
              phone: input.customerPhone,
              email: input.customerEmail || null,
              loyalty_points: earnedPoints,
              is_guest: true,
            })
            .select("id")
            .single();

          if (newCust) customerId = newCust.id;
        }
      } catch (e) {
        console.warn("[MarketOS] Customer persistence warning:", e);
      }
    }

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      tenant_id: input.tenantId,
      store_id: input.storeId,
      customer_id: customerId,
      order_number: orderNumber,
      status: "PAYMENT_PENDING",
      delivery_type: input.deliveryType,
      delivery_zone_id: input.deliveryZoneId || null,
      delivery_address: input.deliveryAddress || null,
      delivery_fee_usd: deliveryFeeUsd,
      coupon_id: couponId,
      discount_usd: discountUsd,
      total_usd: finalTotalUsd,
      total_ves: totalVes,
      exchange_rate_applied: rate.value,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 6. Insert Order into Supabase
    if (supabase) {
      try {
        const { data: insertedOrder } = await supabase
          .from("orders")
          .insert({
            tenant_id: newOrder.tenant_id,
            store_id: newOrder.store_id,
            customer_id: customerId,
            order_number: newOrder.order_number,
            status: newOrder.status,
            delivery_type: newOrder.delivery_type,
            delivery_zone_id: newOrder.delivery_zone_id,
            delivery_address: newOrder.delivery_address,
            delivery_fee_usd: newOrder.delivery_fee_usd,
            coupon_id: newOrder.coupon_id,
            discount_usd: newOrder.discount_usd,
            total_usd: newOrder.total_usd,
            total_ves: newOrder.total_ves,
            exchange_rate_applied: newOrder.exchange_rate_applied,
            notes: newOrder.notes,
          })
          .select("id")
          .single();

        if (insertedOrder) {
          newOrder.id = insertedOrder.id;

          // Insert order items
          const itemsPayload = input.items.map((it) => ({
            tenant_id: input.tenantId,
            order_id: insertedOrder.id,
            product_id: it.productId,
            product_name: it.productName,
            quantity: it.quantity,
            unit_price_usd: it.unitPriceUsd,
            total_price_usd: it.quantity * it.unitPriceUsd,
          }));

          await supabase.from("order_items").insert(itemsPayload);

          // Decrement inventory stock & record inventory movements in Supabase
          for (const item of input.items) {
            const { data: inv } = await supabase
              .from("inventory")
              .select("id, quantity")
              .eq("store_id", input.storeId)
              .eq("product_id", item.productId)
              .maybeSingle();

            if (inv) {
              const newQty = Math.max(0, inv.quantity - item.quantity);
              await supabase
                .from("inventory")
                .update({ quantity: newQty, updated_at: new Date().toISOString() })
                .eq("id", inv.id);

              await supabase.from("inventory_movements").insert({
                tenant_id: input.tenantId,
                store_id: input.storeId,
                product_id: item.productId,
                quantity_change: -item.quantity,
                previous_quantity: inv.quantity,
                new_quantity: newQty,
                reason: "SALE",
              });
            }
          }
        }
      } catch (e) {
        console.warn("[Supabase] Insert order fallback to state:", e);
      }
    }

    state.orders.unshift(newOrder);

    // Decrement stock in memory state
    for (const item of input.items) {
      const prod = state.products.find((p) => p.id === item.productId);
      if (prod && prod.stock >= item.quantity) {
        prod.stock -= item.quantity;
      }
    }

    // Record audit log for new order
    await MarketOSRepository.recordAuditLog({
      tenantId: input.tenantId,
      action: "ORDER_CREATED",
      entity: "orders",
      entityId: newOrder.id,
      newData: {
        order_number: newOrder.order_number,
        total_usd: newOrder.total_usd,
        total_ves: newOrder.total_ves,
        customer_phone: input.customerPhone,
      },
    });

    return newOrder;
  }

  /**
   * Submit Payment Proof for an Order
   */
  static async submitPaymentProof(
    input: SubmitPaymentInput
  ): Promise<PaymentProof> {
    const payment: PaymentProof = {
      id: `pay-${Date.now()}`,
      order_id: input.orderId,
      tenant_id: input.tenantId,
      method: input.method,
      bank_name: input.bankName || "Pago Móvil / Transferencia",
      reference_number: input.referenceNumber,
      amount: input.amount,
      currency: input.currency || "VES",
      payment_date: new Date().toISOString().split("T")[0],
      proof_image_url: input.proofImageUrl || null,
      status: "PENDING",
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("payments").insert({
          tenant_id: payment.tenant_id,
          order_id: payment.order_id,
          method: payment.method,
          bank_name: payment.bank_name,
          reference_number: payment.reference_number,
          amount: payment.amount,
          currency: payment.currency,
          payment_date: payment.payment_date,
          proof_image_url: payment.proof_image_url,
          status: payment.status,
        });

        // Update order status in Supabase
        await supabase
          .from("orders")
          .update({
            status: "PAYMENT_PENDING",
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.orderId)
          .eq("tenant_id", input.tenantId);
      } catch (e) {
        console.warn("[Supabase] Insert payment proof fallback to state:", e);
      }
    }

    state.payments.unshift(payment);

    // Update order status in memory
    const order = state.orders.find((o) => o.id === input.orderId);
    if (order) {
      order.status = "PAYMENT_PENDING";
      order.updated_at = new Date().toISOString();
    }

    await MarketOSRepository.recordAuditLog({
      tenantId: input.tenantId,
      action: "PAYMENT_PROOF_SUBMITTED",
      entity: "payments",
      entityId: payment.id,
      newData: {
        orderId: input.orderId,
        method: input.method,
        reference: input.referenceNumber,
        amount: input.amount,
      },
    });

    return payment;
  }

  /**
   * Get Orders for Tenant Admin
   */
  static async getTenantOrders(tenantId: string): Promise<Order[]> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data as Order[];
      }
    }

    return state.orders.filter((o) => o.tenant_id === tenantId);
  }

  /**
   * Get Payments for Tenant Admin
   */
  static async getTenantPayments(tenantId: string): Promise<PaymentProof[]> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data as PaymentProof[];
      }
    }

    return state.payments.filter((p) => p.tenant_id === tenantId);
  }

  /**
   * Review & Approve/Reject Payment
   */
  static async reviewPayment(
    tenantId: string,
    paymentId: string,
    status: PaymentStatus,
    rejectionReason?: string,
    actorId?: string
  ): Promise<PaymentProof | null> {
    const supabase = getSupabase();
    let orderIdToUpdate: string | null = null;

    if (supabase) {
      try {
        const { data: paymentRow } = await supabase
          .from("payments")
          .select("order_id")
          .eq("id", paymentId)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        orderIdToUpdate = paymentRow?.order_id || null;

        await supabase
          .from("payments")
          .update({
            status,
            reviewed_at: new Date().toISOString(),
            rejection_reason: rejectionReason || null,
          })
          .eq("id", paymentId)
          .eq("tenant_id", tenantId);

        if (orderIdToUpdate) {
          const newOrderStatus: OrderStatus =
            status === "APPROVED" ? "PREPARING" : "CANCELLED";
          await supabase
            .from("orders")
            .update({
              status: newOrderStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderIdToUpdate)
            .eq("tenant_id", tenantId);
        }
      } catch (e) {
        console.warn("[Supabase] Update payment fallback to state:", e);
      }
    }

    const payment = state.payments.find(
      (p) => p.id === paymentId && p.tenant_id === tenantId
    );
    if (payment) {
      payment.status = status;
      payment.reviewed_at = new Date().toISOString();
      if (rejectionReason) payment.rejection_reason = rejectionReason;

      const order = state.orders.find((o) => o.id === payment.order_id);
      if (order) {
        if (status === "APPROVED") {
          order.status = "PREPARING";
        } else if (status === "REJECTED") {
          order.status = "CANCELLED";
        }
        order.updated_at = new Date().toISOString();
      }
    }

    await MarketOSRepository.recordAuditLog({
      tenantId,
      actorId,
      action: status === "APPROVED" ? "PAYMENT_APPROVED" : "PAYMENT_REJECTED",
      entity: "payments",
      entityId: paymentId,
      newData: {
        status,
        rejectionReason: rejectionReason || null,
        orderId: orderIdToUpdate || payment?.order_id,
      },
    });

    return payment || null;
  }

  /**
   * Update Order delivery/preparation status and assign driver
   */
  static async updateOrderStatus(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    driverId?: string,
    actorId?: string
  ): Promise<Order | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const updateData: Record<string, unknown> = {
          status,
          updated_at: new Date().toISOString(),
        };
        if (driverId) updateData.driver_id = driverId;

        await supabase
          .from("orders")
          .update(updateData)
          .eq("id", orderId)
          .eq("tenant_id", tenantId);
      } catch (e) {
        console.warn("[MarketOS] Update order status in Supabase error:", e);
      }
    }

    const order = state.orders.find(
      (o) => o.id === orderId && o.tenant_id === tenantId
    );
    if (order) {
      const oldStatus = order.status;
      order.status = status;
      if (driverId) order.driver_id = driverId;
      order.updated_at = new Date().toISOString();

      await MarketOSRepository.recordAuditLog({
        tenantId,
        actorId,
        action: "ORDER_STATUS_CHANGED",
        entity: "orders",
        entityId: orderId,
        oldData: { status: oldStatus },
        newData: { status, driver_id: driverId },
      });
      return order;
    }

    return null;
  }

  /**
   * Adjust product stock in Supabase inventory & record inventory movement
   */
  static async adjustStock(
    tenantId: string,
    productId: string,
    delta: number,
    storeId?: string,
    actorId?: string
  ): Promise<number> {
    const targetStoreId =
      storeId || state.stores.find((s) => s.tenant_id === tenantId)?.id;
    const supabase = getSupabase();

    if (supabase && targetStoreId) {
      try {
        const { data: inv } = await supabase
          .from("inventory")
          .select("id, quantity")
          .eq("store_id", targetStoreId)
          .eq("product_id", productId)
          .maybeSingle();

        if (inv) {
          const newQty = Math.max(0, inv.quantity + delta);
          await supabase
            .from("inventory")
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq("id", inv.id);

          await supabase.from("inventory_movements").insert({
            tenant_id: tenantId,
            store_id: targetStoreId,
            product_id: productId,
            quantity_change: delta,
            previous_quantity: inv.quantity,
            new_quantity: newQty,
            reason: delta > 0 ? "RESTOCK" : "ADJUSTMENT",
          });

          await MarketOSRepository.recordAuditLog({
            tenantId,
            actorId,
            action: "STOCK_ADJUSTED",
            entity: "inventory",
            entityId: productId,
            oldData: { quantity: inv.quantity },
            newData: { quantity: newQty, delta },
          });

          return newQty;
        }
      } catch (e) {
        console.warn("[MarketOS] Adjust stock in Supabase error:", e);
      }
    }

    const prod = state.products.find(
      (p) => p.id === productId && p.tenant_id === tenantId
    );
    if (prod) {
      const oldStock = prod.stock;
      prod.stock = Math.max(0, prod.stock + delta);

      await MarketOSRepository.recordAuditLog({
        tenantId,
        actorId,
        action: "STOCK_ADJUSTED",
        entity: "inventory",
        entityId: productId,
        oldData: { quantity: oldStock },
        newData: { quantity: prod.stock, delta },
      });

      return prod.stock;
    }
    return 0;
  }

  /**
   * Record Audit Log in Supabase & memory state
   */
  static async recordAuditLog(input: {
    tenantId: string;
    actorId?: string | null;
    actorName?: string | null;
    action: string;
    entity: string;
    entityId: string;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
  }): Promise<AuditLog> {
    const auditLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: input.tenantId,
      actor_id: input.actorId || null,
      actor_name: input.actorName || "Admin Operativo",
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId,
      old_data: input.oldData || null,
      new_data: input.newData || null,
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("audit_logs").insert({
          tenant_id: auditLog.tenant_id,
          action: auditLog.action,
          entity: auditLog.entity,
          entity_id: auditLog.entity_id,
          old_data: auditLog.old_data,
          new_data: auditLog.new_data,
        });
      } catch (e) {
        console.warn("[MarketOS] Error recording audit log in Supabase:", e);
      }
    }

    state.auditLogs.unshift(auditLog);
    return auditLog;
  }

  /**
   * Get Audit Logs for Tenant Admin
   */
  static async getAuditLogs(tenantId: string, limit = 50): Promise<AuditLog[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("audit_logs")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            tenant_id: d.tenant_id,
            actor_id: d.actor_id,
            actor_name: d.actor_name || "Admin Operativo",
            action: d.action,
            entity: d.entity,
            entity_id: d.entity_id,
            old_data: d.old_data,
            new_data: d.new_data,
            created_at: d.created_at,
          }));
        }
      } catch (e) {
        console.warn("[MarketOS] Error fetching audit logs from Supabase:", e);
      }
    }

    return state.auditLogs
      .filter((l) => l.tenant_id === tenantId)
      .slice(0, limit);
  }

  /**
   * Get Customer Profile, Order History and Loyalty Points
   */
  static async getCustomerOrdersAndPoints(
    tenantId: string,
    phoneOrEmail: string
  ): Promise<CustomerAccountSummary | null> {
    const cleanPhone = phoneOrEmail.replace(/\D/g, "");
    const supabase = getSupabase();

    if (supabase) {
      try {
        let query = supabase
          .from("customers")
          .select("*")
          .eq("tenant_id", tenantId);

        if (cleanPhone.length >= 7) {
          query = query.ilike("phone", `%${cleanPhone.slice(-7)}%`);
        } else {
          query = query.eq("email", phoneOrEmail.trim().toLowerCase());
        }

        const { data: customer } = await query.maybeSingle();

        if (customer) {
          const { data: orders } = await supabase
            .from("orders")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("customer_id", customer.id)
            .order("created_at", { ascending: false });

          const customerOrders = (orders as Order[]) || [];
          const totalSpentUsd = customerOrders.reduce(
            (sum, o) => sum + Number(o.total_usd),
            0
          );

          return {
            customer: customer as Customer,
            orders: customerOrders,
            totalSpentUsd: Number(totalSpentUsd.toFixed(2)),
            loyaltyPoints: customer.loyalty_points || 0,
          };
        }
      } catch (e) {
        console.warn("[MarketOS] Error fetching customer in Supabase:", e);
      }
    }

    const memoryCustomer = state.customers.find(
      (c) =>
        c.tenant_id === tenantId &&
        (c.phone.includes(cleanPhone) || c.email === phoneOrEmail)
    );

    if (memoryCustomer) {
      const orders = state.orders.filter(
        (o) => o.tenant_id === tenantId && o.customer_id === memoryCustomer.id
      );
      const totalSpentUsd = orders.reduce((sum, o) => sum + o.total_usd, 0);
      return {
        customer: memoryCustomer,
        orders,
        totalSpentUsd,
        loyaltyPoints: memoryCustomer.loyalty_points || 0,
      };
    }

    return null;
  }

  /**
   * Get Orders for a specific customer by phone or ID
   */
  static async getCustomerOrders(
    tenantId: string,
    phoneOrId: string
  ): Promise<Order[]> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("tenant_id", tenantId)
        .or(`customer_id.eq.${phoneOrId},delivery_address.ilike.%${phoneOrId}%`)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data as Order[];
      }
    }

    return state.orders.filter(
      (o) =>
        o.tenant_id === tenantId &&
        (o.customer_id === phoneOrId ||
          o.order_number.toLowerCase().includes(phoneOrId.toLowerCase()))
    );
  }

  // =====================================================================
  // PHASE 3: PLATFORM SUPER-ADMIN & SAAS MULTI-TENANCY METHODS
  // =====================================================================

  /**
   * Get all tenants with aggregated store, product, and revenue counts
   */
  static async getAllTenants(): Promise<TenantWithDetails[]> {
    const supabase = getSupabase();
    let tenantsList: Tenant[] = [];

    if (supabase) {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        tenantsList = data as Tenant[];
      }
    }

    if (tenantsList.length === 0) {
      tenantsList = state.tenants;
    }

    const plans = await this.getSubscriptionPlans();

    return Promise.all(
      tenantsList.map(async (t) => {
        const settings = await this.getTenantSettings(t.id);
        const stores = await this.getStores(t.id);
        const products = await this.getProducts(t.id);
        const orders = await this.getTenantOrders(t.id);

        const totalRevenue = orders.reduce(
          (acc, o) => (o.status !== "CANCELLED" ? acc + o.total_usd : acc),
          0
        );

        let sub = state.subscriptions.find((s) => s.tenant_id === t.id);
        if (supabase) {
          const { data } = await supabase
            .from("tenant_subscriptions")
            .select("*")
            .eq("tenant_id", t.id)
            .maybeSingle();
          if (data) sub = data as TenantSubscription;
        }

        const currentPlan =
          plans.find((p) => p.id === (sub?.plan_id || "GROWTH")) || plans[1];

        return {
          ...t,
          settings,
          storesCount: stores.length,
          productsCount: products.length,
          ordersCount: orders.length,
          totalRevenueUsd: Number(totalRevenue.toFixed(2)),
          subscription: sub || null,
          plan: currentPlan,
        };
      })
    );
  }

  /**
   * Get Platform Global KPIs across all tenants
   */
  static async getPlatformMetrics(): Promise<PlatformMetrics> {
    const allTenants = await this.getAllTenants();
    const rate = await this.getExchangeRate("shop-market-ca");

    const totalStores = allTenants.reduce((acc, t) => acc + t.storesCount, 0);
    const totalProducts = allTenants.reduce((acc, t) => acc + t.productsCount, 0);
    const totalOrders = allTenants.reduce((acc, t) => acc + t.ordersCount, 0);
    const totalGmvUsd = allTenants.reduce((acc, t) => acc + t.totalRevenueUsd, 0);
    const totalGmvVes = convertUsdToVes(totalGmvUsd, rate.value);

    const mrrUsd = allTenants.reduce((acc, t) => {
      if (t.status === "active" && t.plan) {
        return acc + t.plan.price_usd_monthly;
      }
      return acc;
    }, 0);

    return {
      totalTenants: allTenants.length,
      activeTenants: allTenants.filter((t) => t.status === "active").length,
      totalStores,
      totalProducts,
      totalOrders,
      totalGmvUsd: Number(totalGmvUsd.toFixed(2)),
      totalGmvVes,
      mrrUsd: Number(mrrUsd.toFixed(2)),
    };
  }

  /**
   * Get SaaS Subscription Plans
   */
  static async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_usd_monthly", { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((d) => ({
          ...d,
          features: Array.isArray(d.features) ? d.features : JSON.parse(d.features || "[]"),
        })) as SubscriptionPlan[];
      }
    }

    return state.plans;
  }

  /**
   * Onboard and auto-provision a new tenant into MarketOS SaaS
   */
  static async onboardTenant(
    input: OnboardTenantInput
  ): Promise<TenantWithDetails> {
    const tenantId = input.slug.toLowerCase().trim();
    const now = new Date().toISOString();

    const newTenant: Tenant = {
      id: tenantId,
      name: input.name,
      slug: input.slug,
      logo_url: "/brand/logo.png",
      status: "active",
      created_at: now,
      updated_at: now,
    };

    const newSettings: TenantSettings = {
      tenant_id: tenantId,
      business_name: input.name,
      category: input.category,
      primary_color: input.primaryColor || "#DC2626",
      secondary_color: input.secondaryColor || "#09090B",
      accent_color: "#FFFFFF",
      logo_url: "/brand/logo.png",
      banner_url: null,
      phone: input.phone,
      email: input.ownerEmail,
      whatsapp_number: input.whatsapp.replace(/[^0-9]/g, ""),
      address: input.address,
      supported_currencies: ["USD", "VES"],
      default_currency: "USD",
      social_links: {},
    };

    const newStore: Store = {
      id: `store-${Date.now()}`,
      tenant_id: tenantId,
      name: input.firstStoreName,
      code: input.firstStoreCode,
      address: input.address,
      phone: input.phone,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    const newSubscription: TenantSubscription = {
      id: `sub-${Date.now()}`,
      tenant_id: tenantId,
      plan_id: input.planId,
      status: "active",
      billing_cycle: "monthly",
      current_period_start: now,
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      cancel_at_period_end: false,
      created_at: now,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("tenants").insert(newTenant);
        await supabase.from("tenant_settings").insert(newSettings);
        await supabase.from("stores").insert({
          tenant_id: newStore.tenant_id,
          name: newStore.name,
          code: newStore.code,
          address: newStore.address,
          phone: newStore.phone,
          is_active: true,
        });
        await supabase.from("tenant_subscriptions").insert({
          tenant_id: newSubscription.tenant_id,
          plan_id: newSubscription.plan_id,
          status: newSubscription.status,
          billing_cycle: newSubscription.billing_cycle,
          current_period_start: newSubscription.current_period_start,
          current_period_end: newSubscription.current_period_end,
        });

        // Initialize default delivery zone for tenant
        await supabase.from("delivery_zones").insert({
          tenant_id: tenantId,
          name: "Zona Local (Inmediata)",
          price_usd: 0.00,
          estimated_time: "25-40 min",
          coverage_description: "Entrega local en zona céntrica",
          is_active: true,
          sort_order: 1,
        });

        // Fetch official BCV rate for new tenant
        await this.syncBcvRateFromApi(tenantId);
      } catch (e) {
        console.warn("[Supabase] Onboarding fallback to memory state:", e);
      }
    }

    state.tenants.push(newTenant);
    state.settings.push(newSettings);
    state.stores.push(newStore);
    state.subscriptions.push(newSubscription);

    const plans = await this.getSubscriptionPlans();
    const plan = plans.find((p) => p.id === input.planId) || plans[0];

    return {
      ...newTenant,
      settings: newSettings,
      storesCount: 1,
      productsCount: 0,
      ordersCount: 0,
      totalRevenueUsd: 0,
      subscription: newSubscription,
      plan,
    };
  }

  /**
   * Update Tenant Status (Activate / Suspend / Trial)
   */
  static async updateTenantStatus(
    tenantId: string,
    status: "active" | "inactive" | "suspended" | "trial"
  ): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from("tenants")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", tenantId);
      } catch (e) {
        console.warn("[Supabase] Update tenant status error:", e);
      }
    }

    const t = state.tenants.find((item) => item.id === tenantId);
    if (t) {
      t.status = status;
      t.updated_at = new Date().toISOString();
      return true;
    }
    return false;
  }

  // =====================================================================
  // PRODUCT MANAGEMENT WITH CLOUDFLARE R2 IMAGES
  // =====================================================================

  /**
   * Create a new product with stock and Cloudflare R2 image
   */
  static async createProduct(
    input: CreateProductInput
  ): Promise<Product & { stock: number }> {
    const supabase = getSupabase();
    const slug = `${input.name.toLowerCase().trim().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`;
    const storeId =
      input.storeId ||
      state.stores.find((s) => s.tenant_id === input.tenantId)?.id ||
      "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
    const initialStock = input.initialStock !== undefined ? input.initialStock : 20;

    let createdProduct: Product & { stock: number } = {
      id: `prod-${Date.now()}`,
      tenant_id: input.tenantId,
      category_id: input.categoryId,
      name: input.name,
      slug,
      description: input.description || null,
      sku: input.sku || null,
      barcode: input.barcode || null,
      image_url: input.imageUrl || null,
      price_usd: input.priceUsd,
      is_active: true,
      stock: initialStock,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      try {
        const { data: prodData, error } = await supabase
          .from("products")
          .insert({
            tenant_id: input.tenantId,
            category_id: input.categoryId,
            name: input.name,
            slug,
            description: input.description || null,
            sku: input.sku || null,
            barcode: input.barcode || null,
            image_url: input.imageUrl || null,
            price_usd: input.priceUsd,
            is_active: true,
          })
          .select("id")
          .single();

        if (!error && prodData) {
          createdProduct.id = prodData.id;

          // Insert store inventory
          await supabase.from("inventory").insert({
            tenant_id: input.tenantId,
            store_id: storeId,
            product_id: prodData.id,
            quantity: initialStock,
            min_quantity: 5,
          });

          // Insert inventory movement
          await supabase.from("inventory_movements").insert({
            tenant_id: input.tenantId,
            store_id: storeId,
            product_id: prodData.id,
            quantity_change: initialStock,
            previous_quantity: 0,
            new_quantity: initialStock,
            reason: "RESTOCK",
          });
        }
      } catch (e) {
        console.warn("[Supabase] Create product fallback to state:", e);
      }
    }

    state.products.unshift(createdProduct);

    await MarketOSRepository.recordAuditLog({
      tenantId: input.tenantId,
      action: "PRODUCT_CREATED",
      entity: "products",
      entityId: createdProduct.id,
      newData: {
        name: createdProduct.name,
        price_usd: createdProduct.price_usd,
        stock: initialStock,
        image_url: createdProduct.image_url,
      },
    });

    return createdProduct;
  }

  /**
   * Update an existing product
   */
  static async updateProduct(
    input: UpdateProductInput
  ): Promise<(Product & { stock: number }) | null> {
    const supabase = getSupabase();
    const storeId =
      input.storeId ||
      state.stores.find((s) => s.tenant_id === input.tenantId)?.id ||
      "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";

    if (supabase) {
      try {
        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (input.name !== undefined) updatePayload.name = input.name;
        if (input.categoryId !== undefined) updatePayload.category_id = input.categoryId;
        if (input.description !== undefined) updatePayload.description = input.description;
        if (input.priceUsd !== undefined) updatePayload.price_usd = input.priceUsd;
        if (input.sku !== undefined) updatePayload.sku = input.sku;
        if (input.barcode !== undefined) updatePayload.barcode = input.barcode;
        if (input.imageUrl !== undefined) updatePayload.image_url = input.imageUrl;
        if (input.isActive !== undefined) updatePayload.is_active = input.isActive;

        await supabase
          .from("products")
          .update(updatePayload)
          .eq("id", input.productId)
          .eq("tenant_id", input.tenantId);

        if (input.stock !== undefined) {
          const { data: inv } = await supabase
            .from("inventory")
            .select("id, quantity")
            .eq("store_id", storeId)
            .eq("product_id", input.productId)
            .maybeSingle();

          if (inv) {
            await supabase
              .from("inventory")
              .update({ quantity: input.stock, updated_at: new Date().toISOString() })
              .eq("id", inv.id);

            await supabase.from("inventory_movements").insert({
              tenant_id: input.tenantId,
              store_id: storeId,
              product_id: input.productId,
              quantity_change: input.stock - inv.quantity,
              previous_quantity: inv.quantity,
              new_quantity: input.stock,
              reason: "ADJUSTMENT",
            });
          }
        }
      } catch (e) {
        console.warn("[Supabase] Update product error:", e);
      }
    }

    const prod = state.products.find(
      (p) => p.id === input.productId && p.tenant_id === input.tenantId
    );
    if (prod) {
      const oldData = { ...prod };
      if (input.name !== undefined) prod.name = input.name;
      if (input.categoryId !== undefined) prod.category_id = input.categoryId;
      if (input.description !== undefined) prod.description = input.description;
      if (input.priceUsd !== undefined) prod.price_usd = input.priceUsd;
      if (input.sku !== undefined) prod.sku = input.sku;
      if (input.barcode !== undefined) prod.barcode = input.barcode;
      if (input.imageUrl !== undefined) prod.image_url = input.imageUrl;
      if (input.isActive !== undefined) prod.is_active = input.isActive;
      if (input.stock !== undefined) prod.stock = input.stock;
      prod.updated_at = new Date().toISOString();

      await MarketOSRepository.recordAuditLog({
        tenantId: input.tenantId,
        action: "PRODUCT_UPDATED",
        entity: "products",
        entityId: input.productId,
        oldData: { price_usd: oldData.price_usd, stock: oldData.stock },
        newData: { price_usd: prod.price_usd, stock: prod.stock, name: prod.name },
      });

      return prod;
    }

    return null;
  }

  /**
   * Delete / Deactivate a product
   */
  static async deleteProduct(tenantId: string, productId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from("products")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", productId)
          .eq("tenant_id", tenantId);
      } catch (e) {
        console.warn("[Supabase] Delete product error:", e);
      }
    }

    const prod = state.products.find(
      (p) => p.id === productId && p.tenant_id === tenantId
    );
    if (prod) {
      prod.is_active = false;
      prod.updated_at = new Date().toISOString();

      await MarketOSRepository.recordAuditLog({
        tenantId,
        action: "PRODUCT_DELETED",
        entity: "products",
        entityId: productId,
        newData: { is_active: false },
      });
      return true;
    }
    return false;
  }

  // =====================================================================
  // STAFF & ROLE ASSIGNMENT
  // =====================================================================

  /**
   * Get all staff members and employees for a tenant
   */
  static async getTenantStaff(tenantId: string): Promise<UserProfile[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: true });

        if (!error && data && data.length > 0) {
          return data as UserProfile[];
        }
      } catch (e) {
        console.warn("[Supabase] Get tenant staff error:", e);
      }
    }

    return state.profiles.filter((p) => p.tenant_id === tenantId);
  }

  /**
   * Invite or assign a new staff member to a tenant
   */
  static async inviteStaffMember(input: InviteStaffInput): Promise<UserProfile> {
    const newProfile: UserProfile = {
      id: `usr-${Date.now()}`,
      tenant_id: input.tenantId,
      email: input.email.toLowerCase().trim(),
      full_name: input.fullName,
      phone: input.phone || null,
      avatar_url: null,
      role: input.role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase
          .from("profiles")
          .insert({
            tenant_id: input.tenantId,
            email: newProfile.email,
            full_name: newProfile.full_name,
            phone: newProfile.phone,
            role: newProfile.role,
          })
          .select("id")
          .maybeSingle();

        if (data) newProfile.id = data.id;
      } catch (e) {
        console.warn("[Supabase] Insert staff member fallback:", e);
      }
    }

    state.profiles.push(newProfile);

    await MarketOSRepository.recordAuditLog({
      tenantId: input.tenantId,
      action: "STAFF_INVITED",
      entity: "profiles",
      entityId: newProfile.id,
      newData: { email: newProfile.email, role: newProfile.role, name: newProfile.full_name },
    });

    return newProfile;
  }

  /**
   * Update a staff member's role
   */
  static async updateStaffRole(
    tenantId: string,
    profileId: string,
    newRole: UserRole
  ): Promise<UserProfile | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from("profiles")
          .update({ role: newRole, updated_at: new Date().toISOString() })
          .eq("id", profileId)
          .eq("tenant_id", tenantId);
      } catch (e) {
        console.warn("[Supabase] Update staff role error:", e);
      }
    }

    const member = state.profiles.find(
      (p) => p.id === profileId && p.tenant_id === tenantId
    );
    if (member) {
      const oldRole = member.role;
      member.role = newRole;
      member.updated_at = new Date().toISOString();

      await MarketOSRepository.recordAuditLog({
        tenantId,
        action: "ROLE_UPDATED",
        entity: "profiles",
        entityId: profileId,
        oldData: { role: oldRole },
        newData: { role: newRole },
      });
      return member;
    }
    return null;
  }

  /**
   * Get user profile by ID or Email
   */
  static async getUserProfile(userIdOrEmail: string): Promise<UserProfile | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .or(`id.eq.${userIdOrEmail},email.eq.${userIdOrEmail.toLowerCase().trim()}`)
          .maybeSingle();

        if (data) return data as UserProfile;
      } catch (e) {
        console.warn("[Supabase] Get user profile error:", e);
      }
    }

    const mem = state.profiles.find(
      (p) =>
        p.id === userIdOrEmail ||
        p.email.toLowerCase() === userIdOrEmail.toLowerCase().trim()
    );
    return mem || null;
  }
}
