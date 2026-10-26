import type {
  Tenant,
  TenantSettings,
  Store,
  Category,
  Product,
  ExchangeRate,
  Order,
  OrderItem,
  SalesAnalytics,
  PaymentProof,
  CurrencyCode,
  DeliveryType,
  PaymentMethodType,
  PaymentStatus,
  DeliveryZone,
  Coupon,
  CreateCouponInput,
  UpdateCouponInput,
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
  PushSubscriptionRecord,
  SavePushSubscriptionInput,
  PushNotificationLog,
  SendPushBroadcastInput,
  PushStats,
  CreatePlatformUserInput,
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
  CreateDriverInput,
  UpdateDriverInput,
  RecordAuditLogInput,
  AuditLogFilters,
  AuditActor,
  AuditActionType,
  TenantPlanLimits,
  QuotaCheckResult,
  PlatformBiAnalytics,
  PlatformBiAnalyticsFilter,
  DeliveryMethodBreakdown,
  DeliveryZoneRankingItem,
  TenantGmvRankingItem,
  ConsolidatedPaymentMethodStat,
  PlatformDailyTrendItem,
  PlatformStorageTelemetry,
  TenantStorageTelemetry,
  TenantModule,
  TenantModuleId,
  RawMaterial,
  ProductRecipe,
  ProductModifierGroup,
  SelectedModifier,
  PlatformSettings,
  UpdatePlatformSettingsInput,
  ProductBarcode,
  WarehouseLocation,
  CpqCostSettings,
  CpqPricingMatrix,
  CpqAttributeOption,
  CpqVolumeTier,
  CpqQuote,
  CpqQuoteItem,
  CpqOrderMilestone,
} from "@marketos/types";
import {
  convertUnitQuantity,
  extractGpsCoordinates,
} from "@marketos/types";

import { state, INITIAL_SETTINGS, INITIAL_TENANT } from "./mock-data.ts";
import {
  fetchBcvRate,
  convertUsdToVes,
  getCaracasDateKey,
  getCaracasRangeBounds,
  scanR2PlatformStorage,
  scanR2TenantStorage,
  sanitizeSafeUrl,
  formatMediaUrl,
} from "@marketos/utils";
import { createServerComponentClient } from "./server.ts";
import { isSupabaseOffline } from "./circuit-breaker.ts";
import {
  CouponRepository,
  DeliveryRepository,
  AuditRepository,
  ExchangeRateRepository,
} from "./repositories/index.ts";

function isUuid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface CreateOrderInput {
  tenantId: string;
  storeId: string;
  customerName: string;
  customerPhone: string;
  customerIdNumber?: string; // Cédula o RIF (ej. V-12345678)
  customerEmail?: string;
  deliveryType: DeliveryType;
  deliveryZoneId?: string;
  deliveryAddress?: string;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  deliveryFeeUsd?: number;
  couponCode?: string;
  discountUsd?: number;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPriceUsd: number;
    selected_modifiers?: SelectedModifier[];
    is_tax_exempt?: boolean;
  }[];
  notes?: string;
  cashTenderedUsd?: number;
  changeRequiredUsd?: number;
  idempotencyKey?: string;
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
    return createServerComponentClient();
  } catch (e) {
    console.warn("[MarketOS] Could not initialize Supabase server client:", e);
  }
  return null;
}

export class MarketOSRepository {
  /**
   * Fetch Tenant by ID, Slug, or Custom Domain
   */
  static async getTenant(tenantIdOrSlugOrDomain: string): Promise<Tenant | null> {
    const cleanSearch = tenantIdOrSlugOrDomain.trim().toLowerCase();
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .or(`id.eq.${cleanSearch},slug.eq.${cleanSearch}`)
        .maybeSingle();

      if (!error && data) {
        return data as Tenant;
      }

      // Check tenant_settings for custom_domain lookup if not found by id or slug
      const { data: settingsData } = await supabase
        .from("tenant_settings")
        .select("tenant_id")
        .eq("custom_domain", cleanSearch)
        .maybeSingle();

      if (settingsData?.tenant_id) {
        const { data: tenantByDomain } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", settingsData.tenant_id)
          .maybeSingle();

        if (tenantByDomain) {
          return tenantByDomain as Tenant;
        }
      }
    }

    const tenant = state.tenants.find(
      (t) =>
        t.id.toLowerCase() === cleanSearch ||
        t.slug.toLowerCase() === cleanSearch ||
        (t.custom_domain && t.custom_domain.toLowerCase() === cleanSearch)
    );
    return tenant || null;
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
        let resolvedLogoUrl = data.logo_url;
        if (!resolvedLogoUrl) {
          const { data: tenantData } = await supabase
            .from("tenants")
            .select("logo_url")
            .eq("id", tenantId)
            .maybeSingle();
          if (tenantData?.logo_url) {
            resolvedLogoUrl = tenantData.logo_url;
          }
        }

        return {
          ...INITIAL_SETTINGS,
          ...(data as TenantSettings),
          logo_url: resolvedLogoUrl || null,
          custom_domain: data.custom_domain || null,
          payment_settings: {
            ...INITIAL_SETTINGS.payment_settings,
            ...(data.payment_settings || {}),
          },
          operational_settings: {
            ...INITIAL_SETTINGS.operational_settings,
            ...(data.operational_settings || {}),
          },
          billing_settings: {
            ...INITIAL_SETTINGS.billing_settings,
            ...(data.billing_settings || data.operational_settings?.billing_settings || {}),
          },
          currency_settings: {
            base_currency:
              data.currency_settings?.base_currency ||
              data.operational_settings?.currency_settings?.base_currency ||
              (data.default_currency === "EUR" ? "EUR" : "USD"),
            rate_mode:
              data.currency_settings?.rate_mode ||
              data.operational_settings?.currency_settings?.rate_mode ||
              "BCV_BASE",
            custom_rate_value:
              data.currency_settings?.custom_rate_value ||
              data.operational_settings?.currency_settings?.custom_rate_value,
          },
        };
      }
    }

    const settings = state.settings.find((s) => s.tenant_id === tenantId);
    if (settings) return settings;

    return {
      ...INITIAL_SETTINGS,
      tenant_id: tenantId,
      business_name: tenantId,
    };
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
      billing_settings: updates.billing_settings
        ? { ...current.billing_settings, ...updates.billing_settings }
        : current.billing_settings,
      currency_settings: updates.currency_settings
        ? { ...current.currency_settings, ...updates.currency_settings }
        : current.currency_settings,
    };

    // Keep default_currency in sync with base_currency if updated
    if (updated.currency_settings?.base_currency) {
      updated.default_currency = updated.currency_settings.base_currency;
    }

    // Embed billing_settings & currency_settings inside operational_settings JSONB so it persists reliably
    const operationalPayload = {
      ...(updated.operational_settings || {}),
      ...(updated.billing_settings ? { billing_settings: updated.billing_settings } : {}),
      ...(updated.currency_settings ? { currency_settings: updated.currency_settings } : {}),
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
        operational_settings: operationalPayload,
        storefront_config: updated.storefront_config,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("tenant_settings")
        .update(payload)
        .eq("tenant_id", tenantId);

      if (error) {
        console.warn(
          "[MarketOS] updateTenantSettings Supabase error, retrying without optional columns:",
          error.message
        );
        const safePayload = { ...payload };
        delete safePayload.font_family;
        delete (safePayload as any).storefront_config;
        const retryRes = await supabase
          .from("tenant_settings")
          .update(safePayload)
          .eq("tenant_id", tenantId);
        if (retryRes.error) {
          console.error("[MarketOS] updateTenantSettings fallback error:", retryRes.error.message);
        }
      }

      // Also keep public.tenants table in sync if logo or name changed
      if (updated.logo_url || updated.business_name) {
        await supabase
          .from("tenants")
          .update({
            ...(updated.logo_url ? { logo_url: updated.logo_url } : {}),
            ...(updated.business_name ? { name: updated.business_name } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", tenantId);
      }
    }

    // Keep in-memory cache synchronized
    const idx = state.settings.findIndex((s) => s.tenant_id === tenantId);
    if (idx !== -1) {
      state.settings[idx] = updated;
    } else {
      state.settings.push(updated);
    }

    const tIdx = state.tenants.findIndex((t) => t.id === tenantId);
    if (tIdx !== -1) {
      if (updates.custom_domain !== undefined) {
        state.tenants[tIdx].custom_domain = updates.custom_domain;
      }
      if (updated.business_name) {
        state.tenants[tIdx].name = updated.business_name;
      }
      if (updated.logo_url) {
        state.tenants[tIdx].logo_url = updated.logo_url;
      }
    }

    const tenantIdx = state.tenants.findIndex((t) => t.id === tenantId);
    if (tenantIdx !== -1) {
      if (updated.logo_url) state.tenants[tenantIdx].logo_url = updated.logo_url;
      if (updated.business_name) state.tenants[tenantIdx].name = updated.business_name;
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
  static async getStores(tenantId: string, includeInactive: boolean = false): Promise<Store[]> {
    const supabase = getSupabase();
    if (supabase) {
      let query = supabase.from("stores").select("*").eq("tenant_id", tenantId);
      if (!includeInactive) {
        query = query.eq("is_active", true);
      }
      const { data, error } = await query.order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        return data as Store[];
      }
    }

    return state.stores.filter(
      (s) => s.tenant_id === tenantId && (includeInactive || s.is_active)
    );
  }

  /**
   * Create new Store / Sucursal for Tenant
   */
  static async createStore(storeInput: {
    tenantId: string;
    name: string;
    code?: string;
    address?: string;
    phone?: string;
    isActive?: boolean;
  }): Promise<Store> {
    // 🔒 ENFORCE SAAS QUOTA: Maximum stores allowed for tenant's plan
    const limits = await this.getTenantPlanLimits(storeInput.tenantId);
    if (!limits.canAddStore) {
      throw new Error(
        `PLAN_QUOTA_EXCEEDED: Has alcanzado el límite de ${limits.plan.max_stores} sucursal(es) de tu plan ${limits.plan.name} (${limits.usage.storesCount}/${limits.plan.max_stores}). Actualiza a un plan superior para registrar nuevas sucursales.`
      );
    }

    const supabase = getSupabase();
    const newStore: Store = {
      id: generateUuid(),
      tenant_id: storeInput.tenantId,
      name: storeInput.name,
      code: storeInput.code || `STR-${Math.floor(1000 + Math.random() * 9000)}`,
      address: storeInput.address || "",
      phone: storeInput.phone || null,
      is_active: storeInput.isActive !== undefined ? storeInput.isActive : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("stores")
          .insert(newStore)
          .select()
          .maybeSingle();

        if (!error && data) {
          state.stores.push(data as Store);
          return data as Store;
        }
      } catch (err) {
        console.warn("[MarketOS] createStore Supabase error:", err);
      }
    }

    state.stores.push(newStore);
    return newStore;
  }

  /**
   * Update Store / Sucursal
   */
  static async updateStore(
    storeId: string,
    updates: Partial<Store>
  ): Promise<Store | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("stores")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", storeId)
          .select()
          .maybeSingle();

        if (!error && data) {
          const idx = state.stores.findIndex((s) => s.id === storeId);
          if (idx !== -1) state.stores[idx] = data as Store;
          return data as Store;
        }
      } catch (err) {
        console.warn("[MarketOS] updateStore Supabase error:", err);
      }
    }

    const st = state.stores.find((s) => s.id === storeId);
    if (st) {
      Object.assign(st, updates, { updated_at: new Date().toISOString() });
      return st;
    }
    return null;
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
   */
  static async getExchangeRate(tenantId: string): Promise<ExchangeRate> {
    return ExchangeRateRepository.getExchangeRate(tenantId);
  }

  /**
   * Get Historical Exchange Rates (Daily ledger for accounting, audit and charts)
   */
  static async getExchangeRateHistory(
    tenantId?: string,
    limit: number = 30
  ): Promise<RateHistoryItem[]> {
    return ExchangeRateRepository.getExchangeRateHistory(tenantId, limit);
  }

  /**
   * Synchronize Official BCV Rate from API into Supabase Database
   */
  static async syncBcvRateFromApi(tenantId: string): Promise<ExchangeRate> {
    return ExchangeRateRepository.syncBcvRateFromApi(tenantId);
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
    },
    actor?: AuditActor | null
  ): Promise<ExchangeRate> {
    return ExchangeRateRepository.saveManualExchangeRate(tenantId, data, actor);
  }

  /**
   * Get Delivery Zones for Tenant
   */
  static async getDeliveryZones(
    tenantId: string,
    includeInactive = false
  ): Promise<DeliveryZone[]> {
    return DeliveryRepository.getDeliveryZones(tenantId, includeInactive);
  }

  /**
   * Create a new delivery zone
   */
  static async createDeliveryZone(
    input: CreateDeliveryZoneInput
  ): Promise<DeliveryZone> {
    return DeliveryRepository.createDeliveryZone(input);
  }

  /**
   * Update an existing delivery zone
   */
  static async updateDeliveryZone(
    input: UpdateDeliveryZoneInput
  ): Promise<DeliveryZone | null> {
    return DeliveryRepository.updateDeliveryZone(input);
  }

  /**
   * Toggle status (Soft delete / reactivate) of a delivery zone
   */
  static async toggleDeliveryZoneStatus(
    tenantId: string,
    zoneId: string,
    isActive: boolean
  ): Promise<boolean> {
    return DeliveryRepository.toggleDeliveryZoneStatus(tenantId, zoneId, isActive);
  }

  /**
   * Validate Coupon for a Cart / Order
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
    return CouponRepository.validateCoupon(
      tenantId,
      rawCode,
      orderAmountUsd,
      customerPhone
    );
  }

  /**
   * Get all coupons for Tenant
   */
  static async getCoupons(tenantId: string): Promise<Coupon[]> {
    return CouponRepository.getCoupons(tenantId);
  }

  /**
   * Create a new Coupon with discount amount, start date & expiration date
   */
  static async createCoupon(input: CreateCouponInput): Promise<Coupon> {
    // 🔒 FEATURE FLAG: Coupons & promotions are unlocked on Growth & Enterprise plans
    const limits = await this.getTenantPlanLimits(input.tenantId);
    if (!limits.features.coupons) {
      throw new Error(
        `PLAN_FEATURE_LOCKED: El módulo de cupones y promociones requiere el plan Growth o Enterprise. Tu plan actual (${limits.plan.name}) no incluye esta funcionalidad.`
      );
    }

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
        await MarketOSRepository.recordAuditLog({
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
    return CouponRepository.toggleCoupon(tenantId, couponId, isActive);
  }

  /**
   * Delete Coupon
   */
  static async deleteCoupon(tenantId: string, couponId: string): Promise<boolean> {
    return CouponRepository.deleteCoupon(tenantId, couponId);
  }

  /**
   * Get Drivers for Tenant
   */
  static async getDrivers(
    tenantId: string,
    includeInactive = false
  ): Promise<Driver[]> {
    return DeliveryRepository.getDrivers(tenantId, includeInactive);
  }

  /**
   * Create a new driver
   */
  static async createDriver(input: CreateDriverInput): Promise<Driver> {
    // 🔒 FEATURE FLAG: Drivers module is unlocked on Growth & Enterprise plans
    const limits = await this.getTenantPlanLimits(input.tenantId);
    if (!limits.features.drivers) {
      throw new Error(
        `PLAN_FEATURE_LOCKED: El módulo de repartidores y motoristas dedicados requiere el plan Growth o Enterprise. Tu plan actual (${limits.plan.name}) no incluye esta funcionalidad.`
      );
    }

    const supabase = getSupabase();
    const id = generateUuid();
    const now = new Date().toISOString();

    const newDriver: Driver = {
      id,
      tenant_id: input.tenantId,
      store_id: input.storeId || null,
      name: input.name.trim(),
      phone: input.phone.trim(),
      vehicle_type: input.vehicleType,
      plate_number: input.plateNumber ? input.plateNumber.trim() : null,
      is_active: input.isActive !== undefined ? input.isActive : true,
      created_at: now,
      updated_at: now,
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("drivers")
          .insert({
            id: newDriver.id,
            tenant_id: newDriver.tenant_id,
            store_id: newDriver.store_id,
            name: newDriver.name,
            phone: newDriver.phone,
            vehicle_type: newDriver.vehicle_type,
            plate_number: newDriver.plate_number,
            is_active: newDriver.is_active,
          })
          .select("*")
          .single();

        if (!error && data) {
          state.drivers.push(data as Driver);
          return data as Driver;
        }
      } catch (e) {
        console.warn("[Supabase] createDriver fallback:", e);
      }
    }

    state.drivers.push(newDriver);
    return newDriver;
  }

  /**
   * Update driver details
   */
  static async updateDriver(input: UpdateDriverInput): Promise<Driver | null> {
    return DeliveryRepository.updateDriver(input);
  }

  /**
   * Toggle status (Soft delete / reactivate) of a driver
   */
  static async toggleDriverStatus(
    tenantId: string,
    driverId: string,
    isActive: boolean
  ): Promise<boolean> {
    return DeliveryRepository.toggleDriverStatus(tenantId, driverId, isActive);
  }

  /**
   * Create an Order with Multi-Tenant isolation and Phase 2 Operational features
   */
  static async createOrder(input: CreateOrderInput): Promise<Order> {
    const activeModules = await this.getTenantActiveModuleIds(input.tenantId);
    const isVenezuelaActive = activeModules.includes("local_venezuela");
    const rate = isVenezuelaActive ? await this.getExchangeRate(input.tenantId) : { value: 1 };
    
    // Ensure valid store UUID
    let validStoreId = input.storeId;
    if (!isUuid(validStoreId)) {
      const stores = await this.getStores(input.tenantId);
      validStoreId = stores[0]?.id || "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
    }

    const supabase = getSupabase();

    // 1. Ponytail Security Guard: Validate authentic product prices and verify stock before placing order
    const validatedItems: (CreateOrderInput["items"][number] & { is_tax_exempt?: boolean })[] =
      input.items.map((it) => ({ ...it, is_tax_exempt: it.is_tax_exempt }));

    if (supabase) {
      const productIds = input.items
        .map((it) => it.productId)
        .filter((id) => isUuid(id));

      if (productIds.length > 0) {
        const { data: dbProducts } = await supabase
          .from("products")
          .select("id, name, price_usd, is_active, is_tax_exempt, inventory(quantity, store_id)")
          .eq("tenant_id", input.tenantId)
          .in("id", productIds);

        if (dbProducts && dbProducts.length > 0) {
          const productMap = new Map(dbProducts.map((p: any) => [p.id, p]));

          for (const item of validatedItems) {
            const dbProd: any = productMap.get(item.productId);
            if (dbProd) {
              if (!dbProd.is_active) {
                throw new Error(`El producto "${dbProd.name}" no está disponible actualmente.`);
              }

              // Overwrite with authentic server price and fiscal status from database
              const basePrice = Number(dbProd.price_usd);
              const modifiersDelta = item.selected_modifiers?.reduce((sum, m) => sum + (m.price_usd || 0), 0) || 0;
              item.unitPriceUsd = Number((basePrice + modifiersDelta).toFixed(2));
              item.is_tax_exempt = Boolean(dbProd.is_tax_exempt);

              // Pre-order stock verification with resilient inventory row fallback
              const invForStore = Array.isArray(dbProd.inventory)
                ? dbProd.inventory.find((inv: any) => inv.store_id === validStoreId)
                : null;
              const memProdMatch = state.products.find(
                (p) => p.id === dbProd.id || p.name === dbProd.name
              );
              const fallbackStock = memProdMatch?.stock !== undefined ? memProdMatch.stock : 20;
              const currentStock =
                invForStore?.quantity !== undefined && invForStore?.quantity !== null
                  ? Number(invForStore.quantity)
                  : fallbackStock;

              if (currentStock < item.quantity) {
                throw new Error(
                  `Stock insuficiente para "${dbProd.name}". Disponibles: ${currentStock}, solicitados: ${item.quantity}.`
                );
              }
            }
          }
        }
      }
    }

    // 2. Calculate items subtotal with authentic server prices
    const subtotalUsd = validatedItems.reduce(
      (acc, item) => acc + item.unitPriceUsd * item.quantity,
      0
    );

    // 3. AgentShield: Validate and strictly calculate coupon discount on server
    let discountUsd = 0;
    let couponId: string | null = null;
    if (input.couponCode) {
      const couponRes = await this.validateCoupon(
        input.tenantId,
        input.couponCode,
        subtotalUsd,
        input.customerPhone
      );
      if (!couponRes.valid) {
        throw new Error(
          `Cupón de descuento no válido: ${couponRes.message || "El cupón ha expirado o no cumple los requisitos."}`
        );
      }
      discountUsd = couponRes.discountUsd;
      couponId = couponRes.coupon?.id || null;
    } else {
      // Reject arbitrary client-supplied discounts to prevent price tampering
      discountUsd = 0;
    }

    // 4. Validate delivery fee against database delivery_zones
    let deliveryFeeUsd = 0;
    let validDeliveryZoneId: string | null = null;

    if (input.deliveryType === "DELIVERY") {
      if (input.deliveryZoneId && isUuid(input.deliveryZoneId) && supabase) {
        const { data: zone } = await supabase
          .from("delivery_zones")
          .select("id, price_usd, is_active")
          .eq("tenant_id", input.tenantId)
          .eq("id", input.deliveryZoneId)
          .maybeSingle();

        if (zone && zone.is_active) {
          validDeliveryZoneId = zone.id;
          deliveryFeeUsd = Number(zone.price_usd);
        } else {
          deliveryFeeUsd = input.deliveryFeeUsd || 0;
        }
      } else {
        deliveryFeeUsd = input.deliveryFeeUsd || 0;
      }
    }

    // 5. Compute final totals and fiscal breakdown (Art. 18 Ley del IVA)
    const finalTotalUsd = Number(
      Math.max(0, subtotalUsd - discountUsd + deliveryFeeUsd).toFixed(2)
    );
    const totalVes = isVenezuelaActive ? convertUsdToVes(finalTotalUsd, rate.value) : 0;
    const exchangeRateApplied = isVenezuelaActive ? rate.value : 1;
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

    // Calculate exempt vs taxable portions
    let rawExemptUsd = 0;
    let rawTaxableUsd = 0;
    for (const item of validatedItems) {
      if (!item.is_tax_exempt && typeof item.productId === "string") {
        const memProd = state.products.find((p) => p.id === item.productId);
        if (memProd?.is_tax_exempt) {
          item.is_tax_exempt = true;
        }
      }
      const lineTotal = item.unitPriceUsd * item.quantity;
      if (item.is_tax_exempt) {
        rawExemptUsd += lineTotal;
      } else {
        rawTaxableUsd += lineTotal;
      }
    }

    let subtotalExemptUsd = rawExemptUsd;
    let subtotalTaxableUsd = rawTaxableUsd;
    if (discountUsd > 0 && subtotalUsd > 0) {
      const exemptRatio = rawExemptUsd / subtotalUsd;
      subtotalExemptUsd = Math.max(0, rawExemptUsd - discountUsd * exemptRatio);
      subtotalTaxableUsd = Math.max(0, rawTaxableUsd - discountUsd * (1 - exemptRatio));
    }
    const tenantSettings = await this.getTenantSettings(input.tenantId);
    const isDeliveryFacturado =
      tenantSettings.operational_settings?.delivery_billing_mode !== "THIRD_PARTY" &&
      tenantSettings.billing_settings?.delivery_billing_mode !== "THIRD_PARTY";

    if (deliveryFeeUsd > 0 && isDeliveryFacturado) {
      subtotalTaxableUsd += deliveryFeeUsd;
    }
    subtotalExemptUsd = Number(subtotalExemptUsd.toFixed(2));
    subtotalTaxableUsd = Number(subtotalTaxableUsd.toFixed(2));

    const ivaRate = 0.16;
    const ivaAmountUsd = Number((subtotalTaxableUsd * ivaRate).toFixed(2));
    const ivaAmountVes = Number((ivaAmountUsd * exchangeRateApplied).toFixed(2));

    const validCouponId = isUuid(couponId) ? couponId : null;

    let customerId = generateUuid();
    const earnedPoints = Math.floor(finalTotalUsd);

    // 5. Look up or register customer in Supabase / State with loyalty points
    if (supabase) {
      try {
        const cleanPhone = input.customerPhone.replace(/\D/g, "");
        let existingCustomer: any = null;

        // Try exact match first
        const { data: exactCust } = await supabase
          .from("customers")
          .select("id, loyalty_points")
          .eq("tenant_id", input.tenantId)
          .eq("phone", input.customerPhone)
          .maybeSingle();

        existingCustomer = exactCust;

        // Fallback to last 7-10 digits for Venezuela numbers (e.g. 04128505629 vs 584128505629)
        if (!existingCustomer && cleanPhone.length >= 7) {
          const { data: fuzzyCust } = await supabase
            .from("customers")
            .select("id, loyalty_points")
            .eq("tenant_id", input.tenantId)
            .ilike("phone", `%${cleanPhone.slice(-7)}%`)
            .maybeSingle();

          existingCustomer = fuzzyCust;
        }

        if (existingCustomer && isUuid(existingCustomer.id)) {
          customerId = existingCustomer.id;
          await supabase
            .from("customers")
            .update({
              loyalty_points: (existingCustomer.loyalty_points || 0) + earnedPoints,
              name: input.customerName,
              email: input.customerEmail || null,
              phone: input.customerPhone,
              id_number: input.customerIdNumber || existingCustomer.id_number || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", customerId);
        } else {
          const { data: newCust, error: custErr } = await supabase
            .from("customers")
            .insert({
              tenant_id: input.tenantId,
              name: input.customerName,
              phone: input.customerPhone,
              id_number: input.customerIdNumber || null,
              email: input.customerEmail || null,
              loyalty_points: earnedPoints,
              is_guest: true,
            })
            .select("id")
            .single();

          if (newCust && isUuid(newCust.id)) {
            customerId = newCust.id;
          } else if (custErr) {
            console.warn("[MarketOS] Error registering customer in Supabase:", custErr);
          }
        }

        // Deduplication / Idempotency protection:
        // Check if identical order was already placed by this customer within the last 8 seconds
        const eightSecondsAgo = new Date(Date.now() - 8000).toISOString();
        const { data: recentOrder } = await supabase
          .from("orders")
          .select("id, order_number, total_usd, status, created_at")
          .eq("tenant_id", input.tenantId)
          .eq("customer_id", customerId)
          .gte("created_at", eightSecondsAgo)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentOrder && Math.abs(Number(recentOrder.total_usd) - finalTotalUsd) < 0.01) {
          console.warn("[MarketOS] Duplicate order attempt blocked by database threshold check:", recentOrder.id);
          const allOrders = await this.getTenantOrders(input.tenantId);
          const matched = allOrders.find((o) => o.id === recentOrder.id);
          if (matched) return matched;
        }
      } catch (e) {
        console.warn("[MarketOS] Customer persistence warning:", e);
      }
    }

    // Always mirror customer in in-memory state for fallback
    const memIdx = state.customers.findIndex(
      (c) =>
        c.tenant_id === input.tenantId &&
        (c.phone === input.customerPhone ||
          (c.phone.replace(/\D/g, "") === input.customerPhone.replace(/\D/g, "") &&
            input.customerPhone.replace(/\D/g, "").length >= 7))
    );
    if (memIdx !== -1) {
      state.customers[memIdx].name = input.customerName;
      if (input.customerIdNumber) {
        state.customers[memIdx].id_number = input.customerIdNumber;
      }
      state.customers[memIdx].loyalty_points =
        (state.customers[memIdx].loyalty_points || 0) + earnedPoints;
    } else {
      state.customers.push({
        id: customerId,
        tenant_id: input.tenantId,
        auth_user_id: null,
        name: input.customerName,
        phone: input.customerPhone,
        id_number: input.customerIdNumber || null,
        email: input.customerEmail || null,
        loyalty_points: earnedPoints,
        is_guest: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // In-memory fallback deduplication
    const memRecentOrder = state.orders.find(
      (o) =>
        o.tenant_id === input.tenantId &&
        o.customer_id === customerId &&
        Math.abs(o.total_usd - finalTotalUsd) < 0.01 &&
        Date.now() - new Date(o.created_at).getTime() < 8000
    );
    if (memRecentOrder) {
      console.warn("[MarketOS State] Duplicate order attempt blocked by in-memory check:", memRecentOrder.id);
      return memRecentOrder;
    }

    // Format delivery address with optional precise GPS tag
    let formattedDeliveryAddress = input.deliveryAddress?.trim() || null;
    const hasGpsCoords =
      typeof input.deliveryLatitude === "number" &&
      typeof input.deliveryLongitude === "number";

    if (hasGpsCoords) {
      const gpsTag = `[GPS: ${input.deliveryLatitude!.toFixed(6)},${input.deliveryLongitude!.toFixed(6)}]`;
      if (!formattedDeliveryAddress) {
        formattedDeliveryAddress = gpsTag;
      } else if (!formattedDeliveryAddress.includes("[GPS:")) {
        formattedDeliveryAddress = `${formattedDeliveryAddress} ${gpsTag}`;
      }
    }

    const newOrder: Order = {
      id: generateUuid(),
      tenant_id: input.tenantId,
      store_id: validStoreId,
      customer_id: customerId,
      order_number: orderNumber,
      status: "PAYMENT_PENDING",
      delivery_type: input.deliveryType,
      delivery_zone_id: validDeliveryZoneId,
      delivery_address: formattedDeliveryAddress,
      delivery_latitude: input.deliveryLatitude ?? null,
      delivery_longitude: input.deliveryLongitude ?? null,
      delivery_maps_url: hasGpsCoords
        ? `https://www.google.com/maps?q=${input.deliveryLatitude},${input.deliveryLongitude}`
        : null,
      delivery_fee_usd: deliveryFeeUsd,
      coupon_id: validCouponId,
      discount_usd: discountUsd,
      total_usd: finalTotalUsd,
      total_ves: totalVes,
      exchange_rate_applied: exchangeRateApplied,
      subtotal_exempt_usd: subtotalExemptUsd,
      subtotal_taxable_usd: subtotalTaxableUsd,
      iva_amount_usd: ivaAmountUsd,
      iva_amount_ves: ivaAmountVes,
      notes: input.notes || null,
      cash_tendered_usd: input.cashTenderedUsd ?? null,
      change_required_usd: input.changeRequiredUsd ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_id_number: input.customerIdNumber || null,
      customer_email: input.customerEmail || null,
      items: validatedItems.map((it, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        order_id: `ord-${Date.now()}`,
        tenant_id: input.tenantId,
        product_id: it.productId,
        product_name: it.productName,
        quantity: it.quantity,
        unit_price_usd: it.unitPriceUsd,
        total_price_usd: Number((it.quantity * it.unitPriceUsd).toFixed(2)),
        is_tax_exempt: Boolean(it.is_tax_exempt),
        selected_modifiers: it.selected_modifiers,
      })),
    };

    // 6. Insert Order into Supabase
    if (supabase) {
      try {
        // Build cash notes if applicable
        const extraCashNotes: string[] = [];
        if (newOrder.cash_tendered_usd) {
          extraCashNotes.push(`Paga con: $${newOrder.cash_tendered_usd.toFixed(2)}`);
        }
        if (newOrder.change_required_usd) {
          extraCashNotes.push(`Vuelto: $${newOrder.change_required_usd.toFixed(2)}`);
        }
        const combinedNotes = [newOrder.notes, ...extraCashNotes].filter(Boolean).join(" | ");

        // Strictly safe columns matching Supabase orders table schema
        const orderInsertPayload: any = {
          tenant_id: newOrder.tenant_id,
          store_id: validStoreId,
          customer_id: customerId,
          customer_id_number: newOrder.customer_id_number,
          order_number: newOrder.order_number,
          status: newOrder.status,
          delivery_type: newOrder.delivery_type,
          delivery_zone_id: validDeliveryZoneId,
          delivery_address: newOrder.delivery_address,
          delivery_fee_usd: newOrder.delivery_fee_usd,
          coupon_id: validCouponId,
          discount_usd: newOrder.discount_usd,
          total_usd: newOrder.total_usd,
          total_ves: newOrder.total_ves,
          exchange_rate_applied: newOrder.exchange_rate_applied,
          notes: combinedNotes || null,
        };

        let { data: insertedOrder, error: orderInsertErr } = await supabase
          .from("orders")
          .insert(orderInsertPayload)
          .select("id")
          .single();

        if (orderInsertErr) {
          console.error("[MarketOS] Primary order insert failed, attempting safe fallback:", orderInsertErr);
          // Retry without optional foreign key columns (delivery_zone_id, coupon_id) in case of constraint mismatch
          const safeRetryPayload = {
            tenant_id: newOrder.tenant_id,
            store_id: validStoreId,
            customer_id: customerId,
            order_number: newOrder.order_number,
            status: newOrder.status,
            delivery_type: newOrder.delivery_type,
            delivery_address: newOrder.delivery_address,
            total_usd: newOrder.total_usd,
            total_ves: newOrder.total_ves,
            exchange_rate_applied: newOrder.exchange_rate_applied,
            notes: combinedNotes || null,
          };
          const retryRes = await supabase
            .from("orders")
            .insert(safeRetryPayload)
            .select("id")
            .single();

          if (!retryRes.error && retryRes.data) {
            insertedOrder = retryRes.data;
            orderInsertErr = null;
          } else {
            console.error("[MarketOS] Critical: Safe retry also failed:", retryRes.error);
          }
        }

        if (insertedOrder && isUuid(insertedOrder.id)) {
          newOrder.id = insertedOrder.id;
          newOrder.notes = combinedNotes || null;

          // Fetch fallback product id for tenant to ensure NOT NULL constraint on order_items.product_id
          let fallbackProductId: string | null = null;
          const { data: tenantProds } = await supabase
            .from("products")
            .select("id")
            .eq("tenant_id", input.tenantId)
            .eq("is_active", true)
            .limit(1);
          if (tenantProds && tenantProds.length > 0 && isUuid(tenantProds[0].id)) {
            fallbackProductId = tenantProds[0].id;
          }

          // Build order_items strictly matching Supabase schema (no selected_modifiers column)
          const itemsPayload: any[] = [];
          for (const it of validatedItems) {
            let targetProductId = isUuid(it.productId) ? it.productId : null;
            if (!targetProductId) {
              const { data: p } = await supabase
                .from("products")
                .select("id")
                .eq("tenant_id", input.tenantId)
                .ilike("name", it.productName)
                .maybeSingle();
              if (p && isUuid(p.id)) {
                targetProductId = p.id;
              } else {
                targetProductId = fallbackProductId;
              }
            }

            const modText = it.selected_modifiers && it.selected_modifiers.length > 0
              ? ` (${it.selected_modifiers.map((m: any) => m.name).join(", ")})`
              : "";

            itemsPayload.push({
              tenant_id: input.tenantId,
              order_id: insertedOrder.id,
              product_id: targetProductId,
              product_name: `${it.productName}${modText}`.slice(0, 255),
              quantity: it.quantity,
              unit_price_usd: it.unitPriceUsd,
              total_price_usd: Number((it.quantity * it.unitPriceUsd).toFixed(2)),
            });
          }

          const { error: itemsInsertErr } = await supabase.from("order_items").insert(itemsPayload);
          if (itemsInsertErr) {
            console.error("[MarketOS] Error inserting order_items in Supabase:", itemsInsertErr);
          }

          // Decrement inventory stock & record inventory movements in Supabase
          for (const it of validatedItems) {
            const targetProductId = isUuid(it.productId)
              ? it.productId
              : itemsPayload.find((p) => p.product_name.startsWith(it.productName))?.product_id;

            if (targetProductId) {
              let { data: inv } = await supabase
                .from("inventory")
                .select("id, quantity, store_id")
                .eq("store_id", validStoreId)
                .eq("product_id", targetProductId)
                .maybeSingle();

              if (!inv) {
                const { data: fallbackInv } = await supabase
                  .from("inventory")
                  .select("id, quantity, store_id")
                  .eq("tenant_id", input.tenantId)
                  .eq("product_id", targetProductId)
                  .limit(1)
                  .maybeSingle();
                if (fallbackInv) {
                  inv = fallbackInv;
                }
              }

              const targetStoreId = inv?.store_id || validStoreId;

              if (inv) {
                const newQty = Math.max(0, inv.quantity - it.quantity);
                await supabase
                  .from("inventory")
                  .update({ quantity: newQty, updated_at: new Date().toISOString() })
                  .eq("id", inv.id);

                await supabase.from("inventory_movements").insert({
                  tenant_id: input.tenantId,
                  store_id: targetStoreId,
                  product_id: targetProductId,
                  quantity_change: -it.quantity,
                  previous_quantity: inv.quantity,
                  new_quantity: newQty,
                  reason: "SALE",
                });

                await MarketOSRepository.recordAuditLog({
                  tenantId: input.tenantId,
                  action: "STOCK_ADJUSTED",
                  entity: "inventory",
                  entityId: targetProductId,
                  actorName: "Venta en Línea",
                  actorRole: "SYSTEM",
                  oldData: {
                    product_id: targetProductId,
                    name: it.productName,
                    stock_quantity: inv.quantity,
                  },
                  newData: {
                    product_id: targetProductId,
                    name: it.productName,
                    delta: -it.quantity,
                    quantity: newQty,
                    reason: "VENTA",
                    note: `Deducción por venta #${newOrder.order_number}`,
                  },
                });
              } else {
                // Upsert resilient inventory row if not yet initialized for this store
                const memProdMatch = state.products.find(
                  (p) => p.id === targetProductId || p.name === it.productName
                );
                const initialStock = memProdMatch?.stock !== undefined ? memProdMatch.stock : 20;
                const newQty = Math.max(0, initialStock - it.quantity);

                await supabase
                  .from("inventory")
                  .upsert(
                    {
                      tenant_id: input.tenantId,
                      store_id: validStoreId,
                      product_id: targetProductId,
                      quantity: newQty,
                      min_quantity: 5,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "store_id, product_id" }
                  );

                await supabase.from("inventory_movements").insert({
                  tenant_id: input.tenantId,
                  store_id: validStoreId,
                  product_id: targetProductId,
                  quantity_change: -it.quantity,
                  previous_quantity: initialStock,
                  new_quantity: newQty,
                  reason: "SALE",
                });

                await MarketOSRepository.recordAuditLog({
                  tenantId: input.tenantId,
                  action: "STOCK_ADJUSTED",
                  entity: "inventory",
                  entityId: targetProductId,
                  actorName: "Venta en Línea",
                  actorRole: "SYSTEM",
                  oldData: {
                    product_id: targetProductId,
                    name: it.productName,
                    stock_quantity: initialStock,
                  },
                  newData: {
                    product_id: targetProductId,
                    name: it.productName,
                    delta: -it.quantity,
                    quantity: newQty,
                    reason: "VENTA",
                    note: `Deducción por venta #${newOrder.order_number}`,
                  },
                });
              }
            }
          }
        } else if (orderInsertErr) {
          throw new Error(`No se pudo persistir la orden en el servidor: ${orderInsertErr.message}`);
        }
      } catch (e: any) {
        if (e.message && e.message.includes("No se pudo persistir")) {
          throw e;
        }
        console.warn("[Supabase] Insert order fallback warning:", e);
      }
    }

    state.orders.unshift(newOrder);

    // Increment coupon usage count if a valid coupon was applied
    if (validCouponId) {
      if (supabase) {
        try {
          const { data: coupRow } = await supabase
            .from("coupons")
            .select("usage_count")
            .eq("id", validCouponId)
            .maybeSingle();
          if (coupRow) {
            await supabase
              .from("coupons")
              .update({ usage_count: (Number(coupRow.usage_count) || 0) + 1 })
              .eq("id", validCouponId);
          }
        } catch (e) {
          console.warn("[MarketOS] Coupon usage increment warning in Supabase:", e);
        }
      }
      const memCoup = state.coupons.find((c) => c.id === validCouponId);
      if (memCoup) {
        memCoup.usage_count = (memCoup.usage_count || 0) + 1;
      }
    }

    // Decrement stock in memory state
    for (const item of input.items) {
      const prod = state.products.find((p) => p.id === item.productId || p.name === item.productName);
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
        customer_name: input.customerName,
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
      id: generateUuid(),
      order_id: input.orderId,
      tenant_id: input.tenantId,
      method: input.method,
      bank_name: input.bankName || "Comprobante de Pago",
      reference_number: input.referenceNumber,
      amount: input.amount,
      currency: input.currency || "USD",
      payment_date: new Date().toISOString().split("T")[0],
      proof_image_url: sanitizeSafeUrl(input.proofImageUrl),
      status: "PENDING",
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase && isUuid(input.orderId)) {
      try {
        const { error: payInsertErr } = await supabase.from("payments").insert({
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

        if (payInsertErr) {
          console.error("[MarketOS] Error inserting payment proof in Supabase:", payInsertErr);
        }
      } catch (e) {
        console.warn("[MarketOS] submitPaymentProof Supabase fallback:", e);
      }
    }

    state.payments.unshift(payment);

    // Sync proof and payment info to memory order
    const memOrder = state.orders.find((o) => o.id === input.orderId);
    if (memOrder) {
      memOrder.payment_method = input.method;
      memOrder.payment_reference = input.referenceNumber;
      memOrder.payment_status = "PENDING";
      memOrder.proof_image_url = input.proofImageUrl || null;
    }

    await MarketOSRepository.recordAuditLog({
      tenantId: input.tenantId,
      action: "PAYMENT_PROOF_SUBMITTED",
      entity: "payments",
      entityId: payment.id,
      newData: {
        orderId: input.orderId,
        method: input.method,
        referenceNumber: input.referenceNumber,
        amount: input.amount,
        currency: input.currency || "USD",
      },
    });

    return payment;
  }

  /**
   * Get Orders for Tenant Admin with full enrichment (items, customer, payment details)
   */
  static async getTenantOrders(tenantId: string): Promise<Order[]> {
    const resolvedTenant = await this.getTenant(tenantId);
    const actualTenantId = resolvedTenant?.id || tenantId;

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: rawOrders, error } = await supabase
          .from("orders")
          .select("*")
          .or(`tenant_id.eq.${actualTenantId},tenant_id.eq.${tenantId}`)
          .order("created_at", { ascending: false });

        if (!error && rawOrders) {
          if (rawOrders.length === 0) {
            return [];
          }
          const orderIds = rawOrders.map((o: any) => o.id);
          const customerIds = Array.from(
            new Set(rawOrders.map((o: any) => o.customer_id).filter(Boolean))
          );
          const storeIds = Array.from(
            new Set(rawOrders.map((o: any) => o.store_id).filter(Boolean))
          );

          const [itemsRes, custRes, payRes, storesRes] = await Promise.all([
            supabase.from("order_items").select("*").in("order_id", orderIds),
            customerIds.length > 0
              ? supabase.from("customers").select("id, name, phone, email, id_number").in("id", customerIds)
              : Promise.resolve({ data: [] }),
            supabase.from("payments").select("*").in("order_id", orderIds),
            storeIds.length > 0
              ? supabase.from("stores").select("id, name").in("id", storeIds)
              : Promise.resolve({ data: [] }),
          ]);

          const itemsMap = new Map<string, OrderItem[]>();
          ((itemsRes as any)?.data || []).forEach((item: OrderItem) => {
            const list = itemsMap.get(item.order_id) || [];
            list.push(item);
            itemsMap.set(item.order_id, list);
          });

          const custMap = new Map<string, any>();
          ((custRes as any)?.data || []).forEach((c: any) => custMap.set(c.id, c));

          const payMap = new Map<string, any>();
          ((payRes as any)?.data || []).forEach((p: any) => payMap.set(p.order_id, p));

          const storeMap = new Map<string, string>();
          ((storesRes as any)?.data || []).forEach((s: any) => storeMap.set(s.id, s.name));

          return rawOrders.map((o: any) => {
            const cust = custMap.get(o.customer_id);
            const pay = payMap.get(o.id);
            const storeName = storeMap.get(o.store_id);

            // Parse cash & change from notes if not present directly
            const cashMatch = o.notes ? o.notes.match(/Paga con:\s*\$([0-9.]+)/) : null;
            const changeMatch = o.notes ? o.notes.match(/Vuelto:\s*\$([0-9.]+)/) : null;
            const parsedCash = cashMatch ? parseFloat(cashMatch[1]) : (o.cash_tendered_usd ?? null);
            const parsedChange = changeMatch ? parseFloat(changeMatch[1]) : (o.change_required_usd ?? null);

            // Parse GPS coordinates from delivery_address
            const gpsInfo = extractGpsCoordinates(o.delivery_address);
            const deliveryLat = gpsInfo.lat ?? o.delivery_latitude ?? null;
            const deliveryLng = gpsInfo.lng ?? o.delivery_longitude ?? null;
            const deliveryMapsUrl = gpsInfo.mapsUrl || (deliveryLat && deliveryLng ? `https://www.google.com/maps?q=${deliveryLat},${deliveryLng}` : null);

            return {
              ...o,
              items: itemsMap.get(o.id) || [],
              customer_name: cust?.name || o.customer_name,
              customer_phone: cust?.phone || o.customer_phone,
              customer_id_number: cust?.id_number || o.customer_id_number || null,
              customer_email: cust?.email || o.customer_email,
              payment_method: pay?.method || o.payment_method,
              payment_reference: pay?.reference_number || o.payment_reference,
              payment_status: pay?.status || o.payment_status,
              proof_image_url: pay?.proof_image_url || o.proof_image_url || null,
              store_name: storeName,
              cash_tendered_usd: parsedCash,
              change_required_usd: parsedChange,
              delivery_latitude: deliveryLat,
              delivery_longitude: deliveryLng,
              delivery_maps_url: deliveryMapsUrl,
            } as Order;
          });
        }
      } catch (err) {
        console.warn("[MarketOS] getTenantOrders Supabase error:", err);
      }
    }

    // In-memory fallback enriched with payments and stores
    return state.orders
      .filter((o) => o.tenant_id === actualTenantId || o.tenant_id === tenantId)
      .map((o) => {
        const pay = state.payments.find((p) => p.order_id === o.id);
        const cust = state.customers.find((c) => c.id === o.customer_id);
        const st = state.stores.find((s) => s.id === o.store_id);
        const gpsInfo = extractGpsCoordinates(o.delivery_address);
        const deliveryLat = gpsInfo.lat ?? o.delivery_latitude ?? null;
        const deliveryLng = gpsInfo.lng ?? o.delivery_longitude ?? null;
        const deliveryMapsUrl = gpsInfo.mapsUrl || (deliveryLat && deliveryLng ? `https://www.google.com/maps?q=${deliveryLat},${deliveryLng}` : null);

        return {
          ...o,
          customer_name: cust?.name || o.customer_name,
          customer_phone: cust?.phone || o.customer_phone,
          customer_id_number: cust?.id_number || o.customer_id_number || null,
          customer_email: cust?.email || o.customer_email,
          payment_method: pay?.method || o.payment_method,
          payment_reference: pay?.reference_number || o.payment_reference,
          payment_status: pay?.status || o.payment_status,
          proof_image_url: pay?.proof_image_url || o.proof_image_url || null,
          store_name: st?.name || o.store_name,
          delivery_latitude: deliveryLat,
          delivery_longitude: deliveryLng,
          delivery_maps_url: deliveryMapsUrl,
        };
      });
  }

  /**
   * Get Sales and Financial Analytics for Store Owner
   */
  static async getSalesAnalytics(
    tenantId: string,
    filter?: { dateRange?: "today" | "week" | "month" | "all"; storeId?: string }
  ): Promise<SalesAnalytics> {
    const orders = await this.getTenantOrders(tenantId);

    const range = filter?.dateRange || "all";
    const { startUtc, endUtc } = getCaracasRangeBounds(range);

    const filteredOrders = orders.filter((o) => {
      if (filter?.storeId && o.store_id !== filter.storeId) return false;
      if (startUtc) {
        const orderDate = new Date(o.created_at);
        if (orderDate < startUtc || orderDate > endUtc) return false;
      }
      return true;
    });

    let totalRevenueUsd = 0;
    let totalRevenueVes = 0;
    let completedOrdersCount = 0;
    let pendingOrdersCount = 0;
    let cancelledOrdersCount = 0;
    let itemsSoldTotal = 0;

    const methodStatsMap = new Map<PaymentMethodType, { totalUsd: number; totalVes: number; count: number }>();
    const statusStatsMap = new Map<OrderStatus, { totalUsd: number; count: number }>();
    const productStatsMap = new Map<string, { name: string; quantity: number; revenueUsd: number }>();
    const dailyMap = new Map<string, { totalUsd: number; count: number }>();

    for (const order of filteredOrders) {
      const isPaidOrCompleted = ["PAYMENT_APPROVED", "PREPARING", "READY", "DELIVERING", "COMPLETED"].includes(order.status);

      if (order.status === "COMPLETED") completedOrdersCount++;
      else if (order.status === "CANCELLED") cancelledOrdersCount++;
      else pendingOrdersCount++;

      if (isPaidOrCompleted) {
        totalRevenueUsd += order.total_usd;
        totalRevenueVes += order.total_ves;
      }

      // Status breakdown
      const st = statusStatsMap.get(order.status) || { totalUsd: 0, count: 0 };
      st.totalUsd += order.total_usd;
      st.count += 1;
      statusStatsMap.set(order.status, st);

      // Payment method breakdown
      if (order.payment_method) {
        const m = methodStatsMap.get(order.payment_method) || { totalUsd: 0, totalVes: 0, count: 0 };
        m.totalUsd += order.total_usd;
        m.totalVes += order.total_ves;
        m.count += 1;
        methodStatsMap.set(order.payment_method, m);
      }

      // Products breakdown
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          if (isPaidOrCompleted) {
            itemsSoldTotal += item.quantity;
          }
          const p = productStatsMap.get(item.product_id) || { name: item.product_name, quantity: 0, revenueUsd: 0 };
          p.quantity += item.quantity;
          p.revenueUsd += item.total_price_usd;
          productStatsMap.set(item.product_id, p);
        }
      }

      // Daily breakdown (normalized to America/Caracas timezone)
      const dayKey = getCaracasDateKey(order.created_at) || order.created_at.split("T")[0];
      const d = dailyMap.get(dayKey) || { totalUsd: 0, count: 0 };
      if (isPaidOrCompleted) {
        d.totalUsd += order.total_usd;
      }
      d.count += 1;
      dailyMap.set(dayKey, d);
    }

    const totalOrdersCount = filteredOrders.length;
    const averageTicketUsd =
      completedOrdersCount > 0
        ? Number((totalRevenueUsd / completedOrdersCount).toFixed(2))
        : totalOrdersCount > 0
        ? Number((totalRevenueUsd / totalOrdersCount).toFixed(2))
        : 0;

    const METHOD_LABELS: Record<PaymentMethodType, string> = {
      PAGO_MOVIL: "Pago Móvil (VES)",
      BANK_TRANSFER: "Transferencia Bancaria",
      ZELLE: "Zelle (USD)",
      CASH_USD: "Efectivo Dólares ($)",
      CASH_VES: "Efectivo Bolívares (Bs)",
      POS: "Punto de Venta / Tarjeta",
      BINANCE: "Binance Pay / USDT",
      BINANCE_PAY: "Binance Pay / USDT",
    };

    const STATUS_LABELS: Record<OrderStatus, string> = {
      CREATED: "Iniciado",
      PAYMENT_PENDING: "Por Verificar Pago",
      PAYMENT_APPROVED: "Pago Aprobado",
      PREPARING: "En Preparación",
      READY: "Listo para Despacho",
      DELIVERING: "En Ruta",
      COMPLETED: "Completado y Entregado",
      CANCELLED: "Cancelado / Rechazado",
    };

    const revenueByMethod = Array.from(methodStatsMap.entries())
      .map(([method, val]) => ({
        method,
        label: METHOD_LABELS[method] || method,
        totalUsd: Number(val.totalUsd.toFixed(2)),
        totalVes: Number(val.totalVes.toFixed(2)),
        count: val.count,
      }))
      .sort((a, b) => b.totalUsd - a.totalUsd);

    const revenueByStatus = Array.from(statusStatsMap.entries()).map(([status, val]) => ({
      status,
      label: STATUS_LABELS[status] || status,
      totalUsd: Number(val.totalUsd.toFixed(2)),
      count: val.count,
    }));

    const topSellingProducts = Array.from(productStatsMap.entries())
      .map(([productId, val]) => ({
        productId,
        productName: val.name,
        quantitySold: val.quantity,
        totalRevenueUsd: Number(val.revenueUsd.toFixed(2)),
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10);

    const dailySales = Array.from(dailyMap.entries())
      .map(([date, val]) => ({
        date,
        totalUsd: Number(val.totalUsd.toFixed(2)),
        orderCount: val.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalRevenueUsd: Number(totalRevenueUsd.toFixed(2)),
      totalRevenueVes: Number(totalRevenueVes.toFixed(2)),
      completedOrdersCount,
      pendingOrdersCount,
      cancelledOrdersCount,
      totalOrdersCount,
      averageTicketUsd,
      itemsSoldTotal,
      revenueByMethod,
      revenueByStatus,
      topSellingProducts,
      dailySales,
    };
  }

  /**
   * Get Payments for Tenant Admin
   */
  static async getTenantPayments(tenantId: string): Promise<PaymentProof[]> {
    const resolvedTenant = await this.getTenant(tenantId);
    const actualTenantId = resolvedTenant?.id || tenantId;

    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .or(`tenant_id.eq.${actualTenantId},tenant_id.eq.${tenantId}`)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data as PaymentProof[];
      }
    }

    return state.payments.filter((p) => p.tenant_id === actualTenantId || p.tenant_id === tenantId);
  }

  /**
   * Review & Approve/Reject Payment
   */
  static async reviewPayment(
    tenantId: string,
    paymentId: string,
    status: PaymentStatus,
    rejectionReason?: string,
    actor?: AuditActor | string | null
  ): Promise<PaymentProof | null> {
    const actorObj: AuditActor =
      typeof actor === "string"
        ? { id: actor, name: "Admin Operativo", email: null, role: "ADMIN" }
        : actor || { id: null, name: "Admin Operativo", email: null, role: "ADMIN" };

    const supabase = getSupabase();
    let updatedSupabasePayment: PaymentProof | null = null;
    let orderIdToUpdate: string | null = null;
    let paymentCurrency = "VES";
    let paymentAmount = 0;
    let paymentMethod = "";
    let paymentRef = "";
    let orderNumber = "";

    if (supabase) {
      try {
        const { data: paymentRow } = await supabase
          .from("payments")
          .select("order_id, currency, amount, method, reference_number")
          .eq("id", paymentId)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        orderIdToUpdate = paymentRow?.order_id || null;
        if (paymentRow?.currency) paymentCurrency = paymentRow.currency;
        if (paymentRow?.amount) paymentAmount = Number(paymentRow.amount);
        if (paymentRow?.method) paymentMethod = paymentRow.method;
        if (paymentRow?.reference_number) paymentRef = paymentRow.reference_number;

        const { data: updatedPaymentRow } = await supabase
          .from("payments")
          .update({
            status,
            reviewed_at: new Date().toISOString(),
            rejection_reason: rejectionReason || null,
          })
          .eq("id", paymentId)
          .eq("tenant_id", tenantId)
          .select("*")
          .maybeSingle();

        if (updatedPaymentRow) {
          updatedSupabasePayment = {
            id: updatedPaymentRow.id,
            tenant_id: updatedPaymentRow.tenant_id,
            order_id: updatedPaymentRow.order_id,
            method: updatedPaymentRow.method,
            bank_name: updatedPaymentRow.bank_name || null,
            reference_number: updatedPaymentRow.reference_number || null,
            amount: Number(updatedPaymentRow.amount),
            currency: (updatedPaymentRow.currency === "USD" ? "USD" : "VES") as CurrencyCode,
            payment_date: updatedPaymentRow.payment_date,
            proof_image_url: updatedPaymentRow.proof_image_url || null,
            status: updatedPaymentRow.status,
            reviewed_by: updatedPaymentRow.reviewed_by || null,
            reviewed_at: updatedPaymentRow.reviewed_at,
            rejection_reason: updatedPaymentRow.rejection_reason || null,
            created_at: updatedPaymentRow.created_at,
          };
        }

        if (orderIdToUpdate) {
          const newOrderStatus: OrderStatus =
            status === "APPROVED" ? "PREPARING" : "CANCELLED";

          let fiscalPayload: Record<string, any> = {};
          if (status === "APPROVED") {
            try {
              const activeModules = await MarketOSRepository.getTenantActiveModuleIds(tenantId);
              const isVenezuelaActive = activeModules.includes("local_venezuela");
              const settings = await MarketOSRepository.getTenantSettings(tenantId);
              if (isVenezuelaActive && settings?.billing_settings?.fiscal_billing_enabled) {
                const { data: ordRow } = await supabase
                  .from("orders")
                  .select("total_usd, total_ves, exchange_rate_applied, order_number")
                  .eq("id", orderIdToUpdate)
                  .maybeSingle();

                if (ordRow?.order_number) orderNumber = ordRow.order_number;
                const totUsd = Number(ordRow?.total_usd || 0);
                const exRate = Number(ordRow?.exchange_rate_applied || 1);
                const ivaRate = (settings.billing_settings.default_iva_rate || 16) / 100;
                const baseImponible = Number((totUsd / (1 + ivaRate)).toFixed(2));
                const ivaUsd = Number((totUsd - baseImponible).toFixed(2));
                const ivaVes = Number((ivaUsd * exRate).toFixed(2));

                const isForeignPayment = paymentCurrency === "USD";
                let igtfUsd = 0;
                let igtfVes = 0;
                if (settings.billing_settings.apply_igtf && isForeignPayment) {
                  igtfUsd = Number((totUsd * 0.03).toFixed(2));
                  igtfVes = Number((igtfUsd * exRate).toFixed(2));
                }

                const invSeq = Date.now().toString().slice(-8);
                const invNum = `FACT-${invSeq}`;
                const ctrlNum = `00-${invSeq}`;
                const rif = settings.billing_settings.emitter_fiscal_data?.rif || "";

                fiscalPayload = {
                  is_fiscal_invoice: true,
                  fiscal_invoice_number: invNum,
                  fiscal_control_number: ctrlNum,
                  fiscal_cuv: `CUV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                  fiscal_qr_url: `https://fiscal.seniat.gob.ve/verificar?rif=${encodeURIComponent(rif)}&factura=${invNum}&control=${ctrlNum}`,
                  subtotal_exempt_usd: 0,
                  subtotal_taxable_usd: baseImponible,
                  iva_amount_usd: ivaUsd,
                  iva_amount_ves: ivaVes,
                  igtf_amount_usd: igtfUsd,
                  igtf_amount_ves: igtfVes,
                };
              }
            } catch (err) {
              console.warn("[MarketOS] Fiscal generation error:", err);
            }
          }

          await supabase
            .from("orders")
            .update({
              status: newOrderStatus,
              ...fiscalPayload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderIdToUpdate)
            .eq("tenant_id", tenantId);

          if (status === "REJECTED") {
            await MarketOSRepository.restoreOrderInventoryStock(tenantId, orderIdToUpdate);
          }
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
      if (payment.currency) paymentCurrency = payment.currency;
      if (payment.amount) paymentAmount = payment.amount;
      if (payment.method) paymentMethod = payment.method;
      if (payment.reference_number) paymentRef = payment.reference_number;

      const order = state.orders.find((o) => o.id === payment.order_id);
      if (order) {
        if (!orderNumber && order.order_number) orderNumber = order.order_number;
        if (status === "APPROVED") {
          order.status = "PREPARING";
          await MarketOSRepository.deductRecipeInventoryForOrder(order);
          const activeModules = await MarketOSRepository.getTenantActiveModuleIds(tenantId);
          const isVenezuelaActive = activeModules.includes("local_venezuela");
          const settings = state.settings.find((s) => s.tenant_id === tenantId);
          if (isVenezuelaActive && settings?.billing_settings?.fiscal_billing_enabled) {
            const totUsd = order.total_usd || 0;
            const exRate = order.exchange_rate_applied || 1;
            const ivaRate = (settings.billing_settings.default_iva_rate || 16) / 100;
            const baseImponible = Number((totUsd / (1 + ivaRate)).toFixed(2));
            const ivaUsd = Number((totUsd - baseImponible).toFixed(2));
            const ivaVes = Number((ivaUsd * exRate).toFixed(2));
            const isForeignPayment =
              payment.currency === "USD" ||
              order.payment_method === "CASH_USD" ||
              order.payment_method === "ZELLE";
            let igtfUsd = 0;
            let igtfVes = 0;
            if (settings.billing_settings.apply_igtf && isForeignPayment) {
              igtfUsd = Number((totUsd * 0.03).toFixed(2));
              igtfVes = Number((igtfUsd * exRate).toFixed(2));
            }
            const invSeq = Date.now().toString().slice(-8);
            const invNum = `FACT-${invSeq}`;
            const ctrlNum = `00-${invSeq}`;
            const rif = settings.billing_settings.emitter_fiscal_data?.rif || "";

            order.is_fiscal_invoice = true;
            order.fiscal_invoice_number = invNum;
            order.fiscal_control_number = ctrlNum;
            order.fiscal_cuv = `CUV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
            order.fiscal_qr_url = `https://fiscal.seniat.gob.ve/verificar?rif=${encodeURIComponent(rif)}&factura=${invNum}&control=${ctrlNum}`;
            order.subtotal_exempt_usd = 0;
            order.subtotal_taxable_usd = baseImponible;
            order.iva_amount_usd = ivaUsd;
            order.iva_amount_ves = ivaVes;
            order.igtf_amount_usd = igtfUsd;
            order.igtf_amount_ves = igtfVes;
          }
        } else if (status === "REJECTED") {
          order.status = "CANCELLED";
          await MarketOSRepository.restoreOrderInventoryStock(tenantId, payment.order_id);
        }
        order.payment_status = status;
        order.updated_at = new Date().toISOString();
      }
    }

    const targetOrderId = orderIdToUpdate || payment?.order_id || "";
    if (!orderNumber && targetOrderId) {
      const ord = state.orders.find((o) => o.id === targetOrderId);
      if (ord) orderNumber = ord.order_number;
    }

    await MarketOSRepository.recordAuditLog({
      tenantId,
      actorId: actorObj.id,
      actorName: actorObj.name,
      actorEmail: actorObj.email,
      actorRole: actorObj.role,
      action: status === "APPROVED" ? "PAYMENT_APPROVED" : "PAYMENT_REJECTED",
      entity: "payments",
      entityId: paymentId,
      newData: {
        status,
        rejection_reason: rejectionReason || null,
        order_id: targetOrderId,
        order_number: orderNumber || "N/A",
        amount: paymentAmount,
        currency: paymentCurrency,
        method: paymentMethod,
        reference_number: paymentRef,
      },
    });

    if (updatedSupabasePayment) {
      return updatedSupabasePayment;
    }

    if (payment) {
      return payment;
    }

    if (targetOrderId) {
      return {
        id: paymentId,
        tenant_id: tenantId,
        order_id: targetOrderId,
        method: (paymentMethod || "PAGO_MOVIL") as any,
        bank_name: null,
        reference_number: paymentRef || null,
        amount: paymentAmount,
        currency: (paymentCurrency === "USD" ? "USD" : "VES") as CurrencyCode,
        payment_date: new Date().toISOString().split("T")[0],
        proof_image_url: null,
        status,
        reviewed_by: actorObj.id || null,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason || null,
        created_at: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Revert / Return inventory stock when an order is cancelled or payment rejected
   */
  static async restoreOrderInventoryStock(
    tenantId: string,
    orderId?: string | null
  ): Promise<void> {
    if (!orderId) return;
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: ord } = await supabase
          .from("orders")
          .select("id, store_id, tenant_id")
          .eq("id", orderId)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (!ord) return;

        const storeId = ord.store_id;
        const targetTenantId = ord.tenant_id;

        const { data: items } = await supabase
          .from("order_items")
          .select("product_id, quantity, product_name")
          .eq("order_id", orderId)
          .eq("tenant_id", tenantId);

        if (items && items.length > 0 && storeId) {
          for (const item of items) {
            if (item.product_id) {
              const { data: inv } = await supabase
                .from("inventory")
                .select("id, quantity")
                .eq("store_id", storeId)
                .eq("product_id", item.product_id)
                .maybeSingle();

              if (inv) {
                const newQty = inv.quantity + item.quantity;
                await supabase
                  .from("inventory")
                  .update({
                    quantity: newQty,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", inv.id);

                await supabase.from("inventory_movements").insert({
                  tenant_id: targetTenantId,
                  store_id: storeId,
                  product_id: item.product_id,
                  quantity_change: item.quantity,
                  previous_quantity: inv.quantity,
                  new_quantity: newQty,
                  reason: "CANCELLATION",
                });
              } else {
                await supabase
                  .from("inventory")
                  .upsert(
                    {
                      tenant_id: targetTenantId,
                      store_id: storeId,
                      product_id: item.product_id,
                      quantity: item.quantity,
                      min_quantity: 5,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "store_id, product_id" }
                  );

                await supabase.from("inventory_movements").insert({
                  tenant_id: targetTenantId,
                  store_id: storeId,
                  product_id: item.product_id,
                  quantity_change: item.quantity,
                  previous_quantity: 0,
                  new_quantity: item.quantity,
                  reason: "CANCELLATION",
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn("[MarketOS] Revert inventory error:", err);
      }
    }

    // In-memory state rollback
    const memOrder = state.orders.find((o) => o.id === orderId);
    if (memOrder && memOrder.items) {
      for (const item of memOrder.items) {
        const prod = state.products.find(
          (p) => p.id === item.product_id || p.name === item.product_name
        );
        if (prod) {
          prod.stock += item.quantity;
        }
      }
      await MarketOSRepository.restoreRecipeInventoryForOrder(memOrder);
    }
  }

  /**
   * Update Order delivery/preparation status and assign driver
   */
  static async updateOrderStatus(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    driverId?: string,
    actor?: AuditActor | string | null,
    cancellationReason?: string
  ): Promise<Order | null> {
    const actorObj: AuditActor =
      typeof actor === "string"
        ? { id: actor, name: "Admin Operativo", email: null, role: "ADMIN" }
        : actor || { id: null, name: "Admin Operativo", email: null, role: "ADMIN" };

    const supabase = getSupabase();
    let orderNum = "";
    let custName = "";
    let custPhone = "";
    let totalUsd = 0;
    let oldStatus: OrderStatus = "CREATED";
    let isDbUpdated = false;
    let ordRowData: any = null;

    if (supabase) {
      try {
        const updateData: Record<string, unknown> = {
          status,
          updated_at: new Date().toISOString(),
        };
        if (driverId) updateData.driver_id = driverId;

        const { data: ordRow } = await supabase
          .from("orders")
          .select("order_number, customer_name, customer_phone, total_usd, status, customer_id, store_id, total_ves, exchange_rate_applied, delivery_type")
          .eq("id", orderId)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (ordRow) {
          ordRowData = ordRow;
          orderNum = ordRow.order_number || "";
          custName = ordRow.customer_name || "";
          custPhone = ordRow.customer_phone || "";
          totalUsd = Number(ordRow.total_usd || 0);
          if (ordRow.status) oldStatus = ordRow.status as OrderStatus;
        }

        const { error: updErr } = await supabase
          .from("orders")
          .update(updateData)
          .eq("id", orderId)
          .eq("tenant_id", tenantId);

        if (!updErr) {
          isDbUpdated = true;
        }

        if (status === "CANCELLED" && oldStatus !== "CANCELLED") {
          await MarketOSRepository.restoreOrderInventoryStock(tenantId, orderId);
          // Restore coupon usage if order used a coupon
          const { data: ordWithCoupon } = await supabase
            .from("orders")
            .select("coupon_id")
            .eq("id", orderId)
            .maybeSingle();
          if (ordWithCoupon?.coupon_id) {
            const { data: cData } = await supabase
              .from("coupons")
              .select("usage_count")
              .eq("id", ordWithCoupon.coupon_id)
              .maybeSingle();
            if (cData && Number(cData.usage_count) > 0) {
              await supabase
                .from("coupons")
                .update({ usage_count: Math.max(0, Number(cData.usage_count) - 1) })
                .eq("id", ordWithCoupon.coupon_id);
            }
          }
        }
      } catch (e) {
        console.warn("[MarketOS] Update order status in Supabase error:", e);
      }
    }

    const isCancellation = status === "CANCELLED";

    const memOrder = state.orders.find(
      (o) => o.id === orderId && o.tenant_id === tenantId
    );
    if (memOrder) {
      oldStatus = memOrder.status;
      memOrder.status = status;
      if (driverId) memOrder.driver_id = driverId;
      memOrder.updated_at = new Date().toISOString();

      if (!orderNum && memOrder.order_number) orderNum = memOrder.order_number;
      if (!custName && memOrder.customer_name) custName = memOrder.customer_name;
      if (!custPhone && memOrder.customer_phone) custPhone = memOrder.customer_phone;
      if (!totalUsd && memOrder.total_usd) totalUsd = memOrder.total_usd;

      if (status === "CANCELLED" && oldStatus !== "CANCELLED") {
        await MarketOSRepository.restoreOrderInventoryStock(tenantId, orderId);
        if (memOrder.coupon_id) {
          const memCoupon = state.coupons.find((c) => c.id === memOrder.coupon_id);
          if (memCoupon && memCoupon.usage_count > 0) {
            memCoupon.usage_count -= 1;
          }
        }
      }

      if (status === "PREPARING" && oldStatus !== "PREPARING") {
        await MarketOSRepository.deductRecipeInventoryForOrder(memOrder);
      }
    }

    // Always record audit log for status change
    await MarketOSRepository.recordAuditLog({
      tenantId,
      actorId: actorObj.id,
      actorName: actorObj.name,
      actorEmail: actorObj.email,
      actorRole: actorObj.role,
      action: isCancellation ? "ORDER_CANCELLED" : "ORDER_STATUS_CHANGED",
      entity: "orders",
      entityId: orderId,
      oldData: { status: oldStatus },
      newData: {
        status,
        driver_id: driverId,
        order_number: orderNum || orderId,
        customer_name: custName,
        customer_phone: custPhone,
        total_usd: totalUsd,
        ...(isCancellation
          ? {
              cancellation_reason:
                cancellationReason || "Anulación administrativa de orden",
              inventory_restored: true,
            }
          : {}),
      },
    });

    if (memOrder) {
      return memOrder;
    }

    // If order was in Supabase, fetch and return the fresh enriched order
    if (isDbUpdated || supabase) {
      try {
        const tenantOrders = await MarketOSRepository.getTenantOrders(tenantId);
        const fresh = tenantOrders.find((o) => o.id === orderId);
        if (fresh) {
          const existingIdx = state.orders.findIndex((o) => o.id === orderId);
          if (existingIdx >= 0) {
            state.orders[existingIdx] = fresh;
          } else {
            state.orders.unshift(fresh);
          }
          return fresh;
        }
      } catch (e) {
        console.warn("[MarketOS] getTenantOrders fallback warning in updateOrderStatus:", e);
      }
    }

    if (isDbUpdated) {
      const fallbackOrder: Order = {
        id: orderId,
        tenant_id: tenantId,
        store_id: ordRowData?.store_id || "",
        customer_id: ordRowData?.customer_id || "cust-guest",
        order_number: orderNum || `ORD-${orderId.slice(-6)}`,
        customer_name: custName || "Cliente",
        customer_phone: custPhone || "",
        total_usd: totalUsd,
        total_ves: ordRowData?.total_ves ? Number(ordRowData.total_ves) : 0,
        exchange_rate_applied: ordRowData?.exchange_rate_applied ? Number(ordRowData.exchange_rate_applied) : 0,
        status,
        driver_id: driverId || null,
        delivery_type: (ordRowData?.delivery_type || "delivery") as any,
        items: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.orders.unshift(fallbackOrder);
      return fallbackOrder;
    }

    return null;
  }

  /**
   * Asociar factura física de máquina fiscal de mostrador a un pedido (Providencia 00071)
   */
  static async registerPhysicalFiscalInvoice(
    tenantId: string,
    orderId: string,
    physicalInvoiceNumber: string,
    physicalMachineSerial?: string
  ): Promise<Order> {
    const supabase = getSupabase();
    const cleanInvoiceNumber = physicalInvoiceNumber.trim().toUpperCase();
    const cleanSerial = physicalMachineSerial ? physicalMachineSerial.trim().toUpperCase() : null;
    const nowIso = new Date().toISOString();

    if (supabase) {
      try {
        await supabase
          .from("orders")
          .update({
            physical_invoice_number: cleanInvoiceNumber,
            physical_machine_serial: cleanSerial,
            physical_fiscal_registered_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", orderId)
          .eq("tenant_id", tenantId);
      } catch (e) {
        console.warn("[MarketOS] registerPhysicalFiscalInvoice Supabase warning:", e);
      }
    }

    const order = state.orders.find((o) => o.id === orderId && o.tenant_id === tenantId);
    if (order) {
      order.physical_invoice_number = cleanInvoiceNumber;
      order.physical_machine_serial = cleanSerial;
      order.physical_fiscal_registered_at = nowIso;
      order.updated_at = nowIso;
      return order;
    }

    const allOrders = await this.getTenantOrders(tenantId);
    const fetched = allOrders.find((o) => o.id === orderId);
    if (!fetched) {
      throw new Error(`Pedido no encontrado: ${orderId}`);
    }
    return fetched;
  }

  /**
   * Adjust product stock in Supabase inventory & record inventory movement
   */
  static async adjustStock(
    tenantId: string,
    productId: string,
    delta: number,
    storeId?: string,
    actor?: AuditActor | string | null
  ): Promise<number> {
    const actorObj: AuditActor =
      typeof actor === "string"
        ? { id: actor, name: "Admin Operativo", email: null, role: "ADMIN" }
        : actor || { id: null, name: "Admin Operativo", email: null, role: "ADMIN" };

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
            actorId: actorObj.id,
            actorName: actorObj.name,
            actorEmail: actorObj.email,
            actorRole: actorObj.role,
            action: "STOCK_ADJUSTED",
            entity: "inventory",
            entityId: productId,
            oldData: { quantity: inv.quantity },
            newData: { quantity: newQty, delta },
          });

          return newQty;
        } else {
          const memProd = state.products.find((p) => p.id === productId);
          const initialStock = memProd?.stock !== undefined ? memProd.stock : 20;
          const newQty = Math.max(0, initialStock + delta);

          await supabase
            .from("inventory")
            .upsert(
              {
                tenant_id: tenantId,
                store_id: targetStoreId,
                product_id: productId,
                quantity: newQty,
                min_quantity: 5,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "store_id, product_id" }
            );

          await supabase.from("inventory_movements").insert({
            tenant_id: tenantId,
            store_id: targetStoreId,
            product_id: productId,
            quantity_change: delta,
            previous_quantity: initialStock,
            new_quantity: newQty,
            reason: delta > 0 ? "RESTOCK" : "ADJUSTMENT",
          });

          await MarketOSRepository.recordAuditLog({
            tenantId,
            actorId: actorObj.id,
            actorName: actorObj.name,
            actorEmail: actorObj.email,
            actorRole: actorObj.role,
            action: "STOCK_ADJUSTED",
            entity: "inventory",
            entityId: productId,
            oldData: { quantity: initialStock },
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
        actorId: actorObj.id,
        actorName: actorObj.name,
        actorEmail: actorObj.email,
        actorRole: actorObj.role,
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
  static async recordAuditLog(input: RecordAuditLogInput): Promise<AuditLog> {
    return AuditRepository.recordAuditLog(input);
  }

  /**
   * Get Audit Logs for Tenant Admin
   */
  static async getAuditLogs(tenantId: string, limit = 50): Promise<AuditLog[]> {
    return AuditRepository.getAuditLogs(tenantId, limit);
  }

  /**
   * Get Global Audit Logs across all tenants (Super Admin) or with filters
   */
  static async getGlobalAuditLogs(filters?: AuditLogFilters): Promise<AuditLog[]> {
    return AuditRepository.getGlobalAuditLogs(filters);
  }

  /**
   * Get Customer Profile, Order History and Loyalty Points
   */
  static async getCustomerOrdersAndPoints(
    tenantId: string,
    phoneOrEmail: string
  ): Promise<CustomerAccountSummary | null> {
    const rawInput = (phoneOrEmail || "").trim();
    if (!rawInput) return null;

    const cleanPhone = rawInput.replace(/\D/g, "");
    const supabase = getSupabase();

    if (supabase) {
      try {
        let customer: any = null;

        // 1. Try search by Order Number (e.g. ORD-289699 or numeric part)
        if (rawInput.toUpperCase().startsWith("ORD-") || /^\d{5,8}$/.test(rawInput)) {
          const { data: orderMatch } = await supabase
            .from("orders")
            .select("customer_id")
            .eq("tenant_id", tenantId)
            .ilike("order_number", `%${rawInput}%`)
            .limit(1)
            .maybeSingle();

          if (orderMatch?.customer_id) {
            const { data: byOrderCust } = await supabase
              .from("customers")
              .select("*")
              .eq("id", orderMatch.customer_id)
              .maybeSingle();
            customer = byOrderCust;
          }
        }

        // 2. Try Cédula / RIF match on id_number
        if (!customer) {
          if (cleanPhone.length >= 5) {
            const { data: byCi } = await supabase
              .from("customers")
              .select("*")
              .eq("tenant_id", tenantId)
              .or(`id_number.eq.${rawInput},id_number.ilike.%${cleanPhone}%`)
              .limit(1)
              .maybeSingle();
            customer = byCi;
          } else if (rawInput.includes("-")) {
            const { data: byCiExact } = await supabase
              .from("customers")
              .select("*")
              .eq("tenant_id", tenantId)
              .eq("id_number", rawInput)
              .maybeSingle();
            customer = byCiExact;
          }
        }

        // 3. Try exact phone match
        if (!customer) {
          const { data: byExactPhone } = await supabase
            .from("customers")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("phone", rawInput)
            .maybeSingle();
          customer = byExactPhone;
        }

        // 4. Try fuzzy last-7-digit phone match
        if (!customer && cleanPhone.length >= 7) {
          const { data: byCleanPhone } = await supabase
            .from("customers")
            .select("*")
            .eq("tenant_id", tenantId)
            .ilike("phone", `%${cleanPhone.slice(-7)}%`)
            .maybeSingle();

          customer = byCleanPhone;
        }

        // 5. Try email match
        if (!customer && rawInput.includes("@")) {
          const { data: byEmail } = await supabase
            .from("customers")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("email", rawInput.toLowerCase())
            .maybeSingle();

          customer = byEmail;
        }

        if (customer) {
          const { data: rawOrders } = await supabase
            .from("orders")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("customer_id", customer.id)
            .order("created_at", { ascending: false });

          const orderList = (rawOrders as any[]) || [];
          let enrichedOrders: Order[] = [];

          if (orderList.length > 0) {
            const orderIds = orderList.map((o) => o.id);
            const storeIds = Array.from(new Set(orderList.map((o) => o.store_id).filter(Boolean)));

            const [itemsRes, payRes, storesRes] = await Promise.all([
              supabase.from("order_items").select("*").in("order_id", orderIds),
              supabase.from("payments").select("*").in("order_id", orderIds),
              storeIds.length > 0
                ? supabase.from("stores").select("id, name").in("id", storeIds)
                : Promise.resolve({ data: [] }),
            ]);

            const itemsMap = new Map<string, OrderItem[]>();
            ((itemsRes as any)?.data || []).forEach((item: OrderItem) => {
              const list = itemsMap.get(item.order_id) || [];
              list.push(item);
              itemsMap.set(item.order_id, list);
            });

            const payMap = new Map<string, any>();
            ((payRes as any)?.data || []).forEach((p: any) => payMap.set(p.order_id, p));

            const storeMap = new Map<string, string>();
            ((storesRes as any)?.data || []).forEach((s: any) => storeMap.set(s.id, s.name));

            enrichedOrders = orderList.map((o) => {
              const pay = payMap.get(o.id);
              const storeName = storeMap.get(o.store_id);
              const gpsInfo = extractGpsCoordinates(o.delivery_address);
              const deliveryLat = gpsInfo.lat ?? (o as any).delivery_latitude ?? null;
              const deliveryLng = gpsInfo.lng ?? (o as any).delivery_longitude ?? null;
              const deliveryMapsUrl = gpsInfo.mapsUrl || (deliveryLat && deliveryLng ? `https://www.google.com/maps?q=${deliveryLat},${deliveryLng}` : null);

              return {
                ...o,
                items: itemsMap.get(o.id) || [],
                customer_name: customer.name,
                customer_phone: customer.phone,
                customer_id_number: customer.id_number || (o as any).customer_id_number || null,
                customer_email: customer.email,
                payment_method: pay?.method,
                payment_reference: pay?.reference_number,
                payment_status: pay?.status,
                proof_image_url: pay?.proof_image_url,
                store_name: storeName,
                delivery_latitude: deliveryLat,
                delivery_longitude: deliveryLng,
                delivery_maps_url: deliveryMapsUrl,
              } as Order;
            });
          }

          const totalSpentUsd = enrichedOrders.reduce(
            (sum, o) => sum + Number(o.total_usd),
            0
          );

          return {
            customer: customer as Customer,
            orders: enrichedOrders,
            totalSpentUsd: Number(totalSpentUsd.toFixed(2)),
            loyaltyPoints: customer.loyalty_points || 0,
          };
        }
      } catch (e) {
        console.warn("[MarketOS] Error fetching customer in Supabase:", e);
      }
    }

    const memoryCustomer =
      state.customers.find((c) => {
        if (c.tenant_id !== tenantId) return false;
        if (c.email && c.email.toLowerCase() === rawInput.toLowerCase()) return true;
        if (c.phone === rawInput) return true;
        if (
          c.id_number &&
          (c.id_number.toLowerCase() === rawInput.toLowerCase() ||
            (cleanPhone.length >= 5 &&
              c.id_number.replace(/\D/g, "").includes(cleanPhone)))
        ) {
          return true;
        }
        if (cleanPhone.length >= 7 && c.phone.replace(/\D/g, "").includes(cleanPhone.slice(-7))) {
          return true;
        }
        return false;
      }) ||
      (() => {
        const matchedOrder = state.orders.find(
          (o) =>
            o.tenant_id === tenantId &&
            o.order_number.toLowerCase().includes(rawInput.toLowerCase())
        );
        if (matchedOrder && matchedOrder.customer_id) {
          return state.customers.find((c) => c.id === matchedOrder.customer_id);
        }
        return undefined;
      })();

    if (memoryCustomer) {
      const orders = state.orders
        .filter((o) => o.tenant_id === tenantId && o.customer_id === memoryCustomer.id)
        .map((o) => {
          const pay = state.payments.find((p) => p.order_id === o.id);
          const st = state.stores.find((s) => s.id === o.store_id);
          return {
            ...o,
            customer_name: memoryCustomer.name,
            customer_phone: memoryCustomer.phone,
            customer_id_number: memoryCustomer.id_number || (o as any).customer_id_number || null,
            payment_method: pay?.method || o.payment_method,
            payment_reference: pay?.reference_number || o.payment_reference,
            payment_status: pay?.status || o.payment_status,
            proof_image_url: pay?.proof_image_url || o.proof_image_url,
            store_name: st?.name || o.store_name,
          };
        });

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
   * Get Orders for a specific customer by phone, Cédula, order number, or ID with full item enrichment
   */
  static async getCustomerOrders(
    tenantId: string,
    phoneOrId: string
  ): Promise<Order[]> {
    const rawQuery = (phoneOrId || "").trim();
    if (!rawQuery) return [];

    const cleanDigits = rawQuery.replace(/\D/g, "");
    const supabase = getSupabase();

    if (supabase) {
      try {
        const matchedOrderIds = new Set<string>();

        // 1. Search by Order Number (e.g. ORD-123456 or partial digits)
        const { data: byOrderNum } = await supabase
          .from("orders")
          .select("id")
          .eq("tenant_id", tenantId)
          .ilike("order_number", `%${rawQuery}%`);

        (byOrderNum || []).forEach((o: any) => matchedOrderIds.add(o.id));

        // 2. If phone search has >= 7 digits, find customers by phone then their orders
        if (cleanDigits.length >= 7) {
          const { data: matchedCusts } = await supabase
            .from("customers")
            .select("id")
            .eq("tenant_id", tenantId)
            .ilike("phone", `%${cleanDigits.slice(-7)}%`);

          const custIds = (matchedCusts || []).map((c: any) => c.id);
          if (custIds.length > 0) {
            const { data: byCust } = await supabase
              .from("orders")
              .select("id")
              .eq("tenant_id", tenantId)
              .in("customer_id", custIds);

            (byCust || []).forEach((o: any) => matchedOrderIds.add(o.id));
          }
        }

        // 3. Search by Customer Cédula / RIF (id_number)
        if (cleanDigits.length >= 5 || rawQuery.includes("-")) {
          const { data: matchedCiCusts } = await supabase
            .from("customers")
            .select("id")
            .eq("tenant_id", tenantId)
            .or(`id_number.eq.${rawQuery},id_number.ilike.%${cleanDigits}%`);

          const ciCustIds = (matchedCiCusts || []).map((c: any) => c.id);
          if (ciCustIds.length > 0) {
            const { data: byCiOrders } = await supabase
              .from("orders")
              .select("id")
              .eq("tenant_id", tenantId)
              .in("customer_id", ciCustIds);

            (byCiOrders || []).forEach((o: any) => matchedOrderIds.add(o.id));
          }
        }

        // 4. If query is a valid UUID, search by exact order ID or customer ID
        if (isUuid(rawQuery)) {
          const { data: byUuid } = await supabase
            .from("orders")
            .select("id")
            .eq("tenant_id", tenantId)
            .or(`id.eq.${rawQuery},customer_id.eq.${rawQuery}`);

          (byUuid || []).forEach((o: any) => matchedOrderIds.add(o.id));
        }

        // 5. Also search by delivery address or notes containing phone/reference
        const { data: byText } = await supabase
          .from("orders")
          .select("id")
          .eq("tenant_id", tenantId)
          .or(`delivery_address.ilike.%${rawQuery}%,notes.ilike.%${rawQuery}%`);

        (byText || []).forEach((o: any) => matchedOrderIds.add(o.id));

        if (matchedOrderIds.size > 0) {
          const orderIds = Array.from(matchedOrderIds);
          const { data: rawOrders, error } = await supabase
            .from("orders")
            .select("*")
            .in("id", orderIds)
            .order("created_at", { ascending: false });

          if (!error && rawOrders && rawOrders.length > 0) {
            const customerIds = Array.from(
              new Set(rawOrders.map((o: any) => o.customer_id).filter(Boolean))
            );
            const storeIds = Array.from(
              new Set(rawOrders.map((o: any) => o.store_id).filter(Boolean))
            );

            // Enrich orders with items, customer details, payment proof and store names
            const [itemsRes, custRes, payRes, storesRes] = await Promise.all([
              supabase.from("order_items").select("*").in("order_id", orderIds),
              customerIds.length > 0
                ? supabase.from("customers").select("id, name, phone, email, id_number").in("id", customerIds)
                : Promise.resolve({ data: [] }),
              supabase.from("payments").select("*").in("order_id", orderIds),
              storeIds.length > 0
                ? supabase.from("stores").select("id, name").in("id", storeIds)
                : Promise.resolve({ data: [] }),
            ]);

            const itemsMap = new Map<string, OrderItem[]>();
            ((itemsRes as any)?.data || []).forEach((item: OrderItem) => {
              const list = itemsMap.get(item.order_id) || [];
              list.push(item);
              itemsMap.set(item.order_id, list);
            });

            const custMap = new Map<string, any>();
            ((custRes as any)?.data || []).forEach((c: any) => custMap.set(c.id, c));

            const payMap = new Map<string, any>();
            ((payRes as any)?.data || []).forEach((p: any) => payMap.set(p.order_id, p));

            const storeMap = new Map<string, string>();
            ((storesRes as any)?.data || []).forEach((s: any) => storeMap.set(s.id, s.name));

            return rawOrders.map((o: any) => {
              const cust = custMap.get(o.customer_id);
              const pay = payMap.get(o.id);
              const storeName = storeMap.get(o.store_id);
              const gpsInfo = extractGpsCoordinates(o.delivery_address);
              const deliveryLat = gpsInfo.lat ?? o.delivery_latitude ?? null;
              const deliveryLng = gpsInfo.lng ?? o.delivery_longitude ?? null;
              const deliveryMapsUrl = gpsInfo.mapsUrl || (deliveryLat && deliveryLng ? `https://www.google.com/maps?q=${deliveryLat},${deliveryLng}` : null);

              return {
                ...o,
                items: itemsMap.get(o.id) || [],
                customer_name: cust?.name || o.customer_name,
                customer_phone: cust?.phone || o.customer_phone,
                customer_id_number: cust?.id_number || o.customer_id_number || null,
                customer_email: cust?.email || o.customer_email,
                payment_method: pay?.method,
                payment_reference: pay?.reference_number,
                payment_status: pay?.status,
                proof_image_url: pay?.proof_image_url,
                store_name: storeName,
                delivery_latitude: deliveryLat,
                delivery_longitude: deliveryLng,
                delivery_maps_url: deliveryMapsUrl,
              } as Order;
            });
          }
        }
      } catch (err) {
        console.warn("[MarketOS] getCustomerOrders Supabase error:", err);
      }
    }

    // In-memory fallback
    return state.orders
      .filter((o) => {
        if (o.tenant_id !== tenantId) return false;
        if (o.order_number.toLowerCase().includes(rawQuery.toLowerCase())) return true;
        if (o.id === rawQuery) return true;
        if (o.customer_id === rawQuery) return true;
        if (
          cleanDigits.length >= 5 &&
          o.customer_id_number &&
          o.customer_id_number.replace(/\D/g, "").includes(cleanDigits)
        ) {
          return true;
        }
        if (
          o.customer_id_number &&
          o.customer_id_number.toLowerCase().includes(rawQuery.toLowerCase())
        ) {
          return true;
        }
        if (
          cleanDigits.length >= 7 &&
          o.customer_phone &&
          o.customer_phone.replace(/\D/g, "").includes(cleanDigits.slice(-7))
        ) {
          return true;
        }
        if (
          o.customer_name &&
          o.customer_name.toLowerCase().includes(rawQuery.toLowerCase())
        ) {
          return true;
        }
        if (
          o.delivery_address &&
          o.delivery_address.toLowerCase().includes(rawQuery.toLowerCase())
        ) {
          return true;
        }
        return false;
      })
      .map((o) => {
        const pay = state.payments.find((p) => p.order_id === o.id);
        const cust = state.customers.find((c) => c.id === o.customer_id);
        const st = state.stores.find((s) => s.id === o.store_id);
        const gpsInfo = extractGpsCoordinates(o.delivery_address);
        const deliveryLat = gpsInfo.lat ?? o.delivery_latitude ?? null;
        const deliveryLng = gpsInfo.lng ?? o.delivery_longitude ?? null;
        const deliveryMapsUrl = gpsInfo.mapsUrl || (deliveryLat && deliveryLng ? `https://www.google.com/maps?q=${deliveryLat},${deliveryLng}` : null);

        return {
          ...o,
          customer_name: cust?.name || o.customer_name,
          customer_phone: cust?.phone || o.customer_phone,
          customer_id_number: cust?.id_number || o.customer_id_number || null,
          customer_email: cust?.email || o.customer_email,
          payment_method: pay?.method || o.payment_method,
          payment_reference: pay?.reference_number || o.payment_reference,
          payment_status: pay?.status || o.payment_status,
          proof_image_url: pay?.proof_image_url || o.proof_image_url,
          store_name: st?.name || o.store_name,
          delivery_latitude: deliveryLat,
          delivery_longitude: deliveryLng,
          delivery_maps_url: deliveryMapsUrl,
        };
      });
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
          stores,
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

  // Storage Telemetry In-Memory Cache (TTL: 3 minutes)
  private static cachedStorageTelemetry: { data: PlatformStorageTelemetry; timestamp: number } | null = null;

  /**
   * Obtener telemetría de almacenamiento Cloudflare R2 consolidada y por tienda
   */
  static async getPlatformStorageTelemetry(forceRefresh = false): Promise<PlatformStorageTelemetry> {
    const now = Date.now();
    if (!forceRefresh && this.cachedStorageTelemetry && now - this.cachedStorageTelemetry.timestamp < 180000) {
      return this.cachedStorageTelemetry.data;
    }

    const allTenants = await this.getAllTenants();
    const metaList = allTenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      planId: (t.subscription?.plan_id || t.plan?.id || "GROWTH") as SubscriptionPlanTier,
      planName: t.plan?.name || "MarketOS Growth",
      subscription: t.subscription,
      plan: t.plan,
    }));

    const telemetry = await scanR2PlatformStorage(metaList);
    this.cachedStorageTelemetry = { data: telemetry, timestamp: now };
    return telemetry;
  }

  /**
   * Obtener telemetría de almacenamiento Cloudflare R2 para una tienda específica
   */
  static async getTenantStorageTelemetry(tenantId: string, forceRefresh = false): Promise<TenantStorageTelemetry> {
    const platformTelemetry = await this.getPlatformStorageTelemetry(forceRefresh);
    const tenantTelemetry = platformTelemetry.tenants.find(
      (t) => t.tenantId.toLowerCase() === tenantId.toLowerCase() || t.tenantSlug.toLowerCase() === tenantId.toLowerCase()
    );

    if (tenantTelemetry) {
      return tenantTelemetry;
    }

    const tenant = await this.getTenant(tenantId);
    const sub = await this.getTenantSubscription(tenantId);
    return scanR2TenantStorage(
      tenantId,
      tenant?.name || "Comercio",
      tenant?.slug || "tienda",
      sub?.plan_id || "GROWTH"
    );
  }

  /**
   * Get Platform Business Intelligence & Global Analytics (BI Analytics)
   * Ranking de tiendas por GMV, Ticket Promedio Global de la Red,
   * Desglose Consolidado de Métodos de Pago más usados (Pago Móvil, Zelle, Efectivo, Binance, etc.)
   * y Analítica de Despacho (Delivery vs Retiro en Tienda y Ranking de Zonas de Mayor Demanda)
   */
  static async getPlatformBiAnalytics(
    filterInput?: PlatformBiAnalyticsFilter | "today" | "week" | "month" | "all"
  ): Promise<PlatformBiAnalytics> {
    const filter: PlatformBiAnalyticsFilter =
      typeof filterInput === "string"
        ? { dateRange: filterInput, deliveryType: "ALL", deliveryZoneId: "ALL", tenantId: "ALL" }
        : {
            dateRange: filterInput?.dateRange || "all",
            deliveryType: filterInput?.deliveryType || "ALL",
            deliveryZoneId: filterInput?.deliveryZoneId || "ALL",
            tenantId: filterInput?.tenantId || "ALL",
          };

    const range = filter.dateRange || "all";
    const selectedDeliveryType = filter.deliveryType || "ALL";
    const selectedZoneId = filter.deliveryZoneId || "ALL";
    const selectedTenantId = filter.tenantId || "ALL";

    const { startUtc, endUtc } = getCaracasRangeBounds(range);
    const rate = await this.getExchangeRate("shop-market-ca");
    const activeRateValue = rate?.value || 52.5;

    const allTenants = await this.getAllTenants();
    const supabase = getSupabase();

    // Map of zones: zoneId -> DeliveryZone
    const zoneMap = new Map<string, DeliveryZone>();
    if (supabase) {
      try {
        const { data: dbZones } = await supabase
          .from("delivery_zones")
          .select("*");
        if (dbZones) {
          for (const z of dbZones) zoneMap.set(z.id, z as DeliveryZone);
        }
      } catch (err) {
        console.warn("[MarketOS] getPlatformBiAnalytics error fetching zones:", err);
      }
    }
    for (const z of state.deliveryZones) {
      if (!zoneMap.has(z.id)) zoneMap.set(z.id, z);
    }

    const METHOD_LABELS: Record<string, string> = {
      PAGO_MOVIL: "Pago Móvil (VES)",
      ZELLE: "Zelle (USD)",
      CASH_USD: "Efectivo Dólares ($)",
      CASH_VES: "Efectivo Bolívares (Bs)",
      BINANCE: "Binance Pay / USDT",
      BINANCE_PAY: "Binance Pay / USDT",
      POS: "Punto de Venta / Tarjeta",
      BANK_TRANSFER: "Transferencia Bancaria",
      OTHER: "Otros Métodos",
    };

    // Tracking for Delivery vs Pickup Breakdown & Zone Leaderboard
    let totalDeliveryOrdersCount = 0;
    let totalDeliveryGmvUsd = 0;
    let totalDeliveryFeesUsd = 0;

    let totalPickupOrdersCount = 0;
    let totalPickupGmvUsd = 0;

    const deliveryZoneStatsMap = new Map<
      string,
      {
        zoneName: string;
        tenantId: string;
        tenantName: string;
        ordersCount: number;
        gmvUsd: number;
        totalFeeUsd: number;
      }
    >();

    // Tracking for filtered subset
    let totalNetworkGmvUsd = 0;
    let totalNetworkOrders = 0;
    let totalCompletedOrders = 0;
    let totalPendingOrders = 0;
    let totalCancelledOrders = 0;

    const tenantRankingMap = new Map<
      string,
      {
        tenant: TenantWithDetails;
        totalOrders: number;
        completedOrders: number;
        pendingOrders: number;
        cancelledOrders: number;
        gmvUsd: number;
      }
    >();

    const paymentMethodsMap = new Map<
      string,
      {
        method: PaymentMethodType;
        label: string;
        totalUsd: number;
        totalVes: number;
        transactionCount: number;
      }
    >();

    const dailyTrendMap = new Map<
      string,
      { totalUsd: number; totalVes: number; orderCount: number }
    >();

    const targetTenants =
      selectedTenantId && selectedTenantId !== "ALL"
        ? allTenants.filter((t) => t.id === selectedTenantId || t.slug === selectedTenantId)
        : allTenants;

    for (const t of targetTenants) {
      const orders = await this.getTenantOrders(t.id);

      // Date range filter
      const ordersInDateRange = orders.filter((o) => {
        if (startUtc) {
          const orderDate = new Date(o.created_at);
          if (orderDate < startUtc || orderDate > endUtc) return false;
        }
        return true;
      });

      // 1. Compute Delivery vs Pickup & Zone rankings across ALL orders in this date range
      for (const order of ordersInDateRange) {
        if (order.delivery_type === "DELIVERY") {
          totalDeliveryOrdersCount++;
          if (order.status !== "CANCELLED") {
            totalDeliveryGmvUsd += order.total_usd;
            totalDeliveryFeesUsd += order.delivery_fee_usd || 0;
          }

          // Zone tracking
          const zoneId = order.delivery_zone_id || "sin-zona";
          const matchedZone = zoneMap.get(zoneId);
          const zoneName =
            matchedZone?.name ||
            (order.delivery_zone_id
              ? `Zona (${order.delivery_zone_id.slice(0, 8)})`
              : "Sin Zona Especificada");

          const currentZone = deliveryZoneStatsMap.get(zoneId) || {
            zoneName,
            tenantId: t.id,
            tenantName: t.name,
            ordersCount: 0,
            gmvUsd: 0,
            totalFeeUsd: 0,
          };

          currentZone.ordersCount++;
          if (order.status !== "CANCELLED") {
            currentZone.gmvUsd += order.total_usd;
            currentZone.totalFeeUsd += order.delivery_fee_usd || 0;
          }
          deliveryZoneStatsMap.set(zoneId, currentZone);
        } else if (order.delivery_type === "PICKUP") {
          totalPickupOrdersCount++;
          if (order.status !== "CANCELLED") {
            totalPickupGmvUsd += order.total_usd;
          }
        }
      }

      // 2. Filter orders for this tenant according to deliveryType & deliveryZoneId filters
      const filteredOrders = ordersInDateRange.filter((o) => {
        if (
          selectedDeliveryType !== "ALL" &&
          o.delivery_type !== selectedDeliveryType
        ) {
          return false;
        }
        if (selectedZoneId !== "ALL" && o.delivery_zone_id !== selectedZoneId) {
          return false;
        }
        return true;
      });

      let tenantTotalOrders = filteredOrders.length;
      let tenantCompletedOrders = 0;
      let tenantPendingOrders = 0;
      let tenantCancelledOrders = 0;
      let tenantGmvUsd = 0;

      for (const order of filteredOrders) {
        if (order.status === "COMPLETED") {
          tenantCompletedOrders++;
        } else if (order.status === "CANCELLED") {
          tenantCancelledOrders++;
        } else {
          tenantPendingOrders++;
        }

        // Non-cancelled orders contribute to GMV and network volume
        if (order.status !== "CANCELLED") {
          tenantGmvUsd += order.total_usd;
          totalNetworkGmvUsd += order.total_usd;

          // Consolidated payment method breakdown
          let rawMethod = (
            order.payment_method ||
            (order as any).paymentMethod ||
            "OTHER"
          ).toUpperCase();
          if (rawMethod === "BINANCE_PAY") rawMethod = "BINANCE";

          const label =
            METHOD_LABELS[rawMethod] ||
            (rawMethod === "BINANCE" ? "Binance Pay / USDT" : rawMethod);
          const currentMethodStat = paymentMethodsMap.get(rawMethod) || {
            method: rawMethod as PaymentMethodType,
            label,
            totalUsd: 0,
            totalVes: 0,
            transactionCount: 0,
          };

          currentMethodStat.totalUsd += order.total_usd;
          currentMethodStat.totalVes +=
            order.total_ves || convertUsdToVes(order.total_usd, activeRateValue);
          currentMethodStat.transactionCount += 1;
          paymentMethodsMap.set(rawMethod, currentMethodStat);

          // Daily Trend Aggregation
          const dayKey =
            getCaracasDateKey(order.created_at) || order.created_at.split("T")[0];
          const currentDaily = dailyTrendMap.get(dayKey) || {
            totalUsd: 0,
            totalVes: 0,
            orderCount: 0,
          };
          currentDaily.totalUsd += order.total_usd;
          currentDaily.totalVes +=
            order.total_ves || convertUsdToVes(order.total_usd, activeRateValue);
          currentDaily.orderCount += 1;
          dailyTrendMap.set(dayKey, currentDaily);
        }
      }

      totalNetworkOrders += tenantTotalOrders;
      totalCompletedOrders += tenantCompletedOrders;
      totalPendingOrders += tenantPendingOrders;
      totalCancelledOrders += tenantCancelledOrders;

      tenantRankingMap.set(t.id, {
        tenant: t,
        totalOrders: tenantTotalOrders,
        completedOrders: tenantCompletedOrders,
        pendingOrders: tenantPendingOrders,
        cancelledOrders: tenantCancelledOrders,
        gmvUsd: Number(tenantGmvUsd.toFixed(2)),
      });
    }

    // Consolidated Delivery Breakdown calculations
    const totalDespachoOrders = totalDeliveryOrdersCount + totalPickupOrdersCount;
    const deliverySharePercent =
      totalDespachoOrders > 0
        ? Number(((totalDeliveryOrdersCount / totalDespachoOrders) * 100).toFixed(1))
        : 0;
    const pickupSharePercent =
      totalDespachoOrders > 0
        ? Number(((totalPickupOrdersCount / totalDespachoOrders) * 100).toFixed(1))
        : 0;

    const deliveryAverageTicketUsd =
      totalDeliveryOrdersCount > 0
        ? Number((totalDeliveryGmvUsd / totalDeliveryOrdersCount).toFixed(2))
        : 0;
    const pickupAverageTicketUsd =
      totalPickupOrdersCount > 0
        ? Number((totalPickupGmvUsd / totalPickupOrdersCount).toFixed(2))
        : 0;

    const deliveryBreakdown: DeliveryMethodBreakdown = {
      deliveryOrdersCount: totalDeliveryOrdersCount,
      deliveryGmvUsd: Number(totalDeliveryGmvUsd.toFixed(2)),
      deliveryGmvVes: convertUsdToVes(totalDeliveryGmvUsd, activeRateValue),
      deliverySharePercent,
      deliveryAverageTicketUsd,
      totalDeliveryFeesUsd: Number(totalDeliveryFeesUsd.toFixed(2)),
      totalDeliveryFeesVes: convertUsdToVes(totalDeliveryFeesUsd, activeRateValue),
      pickupOrdersCount: totalPickupOrdersCount,
      pickupGmvUsd: Number(totalPickupGmvUsd.toFixed(2)),
      pickupGmvVes: convertUsdToVes(totalPickupGmvUsd, activeRateValue),
      pickupSharePercent,
      pickupAverageTicketUsd,
    };

    // Consolidated Delivery Zone Rankings (Leaderboard of most demanded zones)
    const deliveryZoneRankings: DeliveryZoneRankingItem[] = Array.from(
      deliveryZoneStatsMap.entries()
    )
      .map(([zoneId, stat]) => {
        const gmvUsd = Number(stat.gmvUsd.toFixed(2));
        const gmvVes = convertUsdToVes(gmvUsd, activeRateValue);
        const sharePercent =
          totalDeliveryOrdersCount > 0
            ? Number(((stat.ordersCount / totalDeliveryOrdersCount) * 100).toFixed(1))
            : 0;
        const averageDeliveryFeeUsd =
          stat.ordersCount > 0
            ? Number((stat.totalFeeUsd / stat.ordersCount).toFixed(2))
            : 0;
        const averageTicketUsd =
          stat.ordersCount > 0
            ? Number((gmvUsd / stat.ordersCount).toFixed(2))
            : 0;

        return {
          zoneId,
          zoneName: stat.zoneName,
          tenantId: stat.tenantId,
          tenantName: stat.tenantName,
          ordersCount: stat.ordersCount,
          gmvUsd,
          gmvVes,
          sharePercent,
          averageDeliveryFeeUsd,
          averageTicketUsd,
        };
      })
      .sort((a, b) => b.ordersCount - a.ordersCount || b.gmvUsd - a.gmvUsd);

    // Available delivery zones for dropdown filter with populated orders count
    const availableDeliveryZones = Array.from(zoneMap.values()).map((z) => {
      const tenant = allTenants.find((t) => t.id === z.tenant_id);
      const zoneStats = deliveryZoneStatsMap.get(z.id);
      return {
        id: z.id,
        name: z.name,
        tenantName: tenant?.name,
        ordersCount: zoneStats?.ordersCount || 0,
      };
    });

    totalNetworkGmvUsd = Number(totalNetworkGmvUsd.toFixed(2));
    const totalNetworkGmvVes = convertUsdToVes(totalNetworkGmvUsd, activeRateValue);

    // Global Ticket Promedio de la Red (AOV)
    const validOrdersForAov =
      totalCompletedOrders > 0
        ? totalCompletedOrders
        : totalNetworkOrders - totalCancelledOrders > 0
        ? totalNetworkOrders - totalCancelledOrders
        : 0;

    const networkAverageTicketUsd =
      validOrdersForAov > 0
        ? Number((totalNetworkGmvUsd / validOrdersForAov).toFixed(2))
        : 0;
    const networkAverageTicketVes = convertUsdToVes(
      networkAverageTicketUsd,
      activeRateValue
    );

    // Order Success Rate (% de pedidos completados sobre no-cancelados)
    const nonCancelledTotal = totalNetworkOrders - totalCancelledOrders;
    const orderSuccessRatePercent =
      nonCancelledTotal > 0
        ? Number(((totalCompletedOrders / nonCancelledTotal) * 100).toFixed(1))
        : 0;

    // Leaderboard de tiendas ordenado por GMV USD desc
    const tenantRankings: TenantGmvRankingItem[] = Array.from(
      tenantRankingMap.values()
    )
      .map((entry) => {
        const t = entry.tenant;
        const gmvUsd = entry.gmvUsd;
        const gmvVes = convertUsdToVes(gmvUsd, activeRateValue);
        const aovOrders =
          entry.completedOrders > 0
            ? entry.completedOrders
            : entry.totalOrders - entry.cancelledOrders;
        const aovUsd =
          aovOrders > 0 ? Number((gmvUsd / aovOrders).toFixed(2)) : 0;
        const aovVes = convertUsdToVes(aovUsd, activeRateValue);
        const sharePercent =
          totalNetworkGmvUsd > 0
            ? Number(((gmvUsd / totalNetworkGmvUsd) * 100).toFixed(1))
            : 0;

        return {
          tenantId: t.id,
          tenantName: t.name,
          tenantSlug: t.slug,
          category: t.settings?.category || "Comercio",
          logoUrl: t.logo_url || t.settings?.logo_url || null,
          planTier: (t.plan?.id as SubscriptionPlanTier) || "GROWTH",
          status: t.status,
          totalOrders: entry.totalOrders,
          completedOrders: entry.completedOrders,
          pendingOrders: entry.pendingOrders,
          cancelledOrders: entry.cancelledOrders,
          gmvUsd,
          gmvVes,
          averageTicketUsd: aovUsd,
          averageTicketVes: aovVes,
          sharePercent,
          storesCount: t.storesCount || t.stores?.length || 1,
          productsCount: t.productsCount || 0,
        };
      })
      .sort((a, b) => b.gmvUsd - a.gmvUsd);

    const sellingTenantsCount = tenantRankings.filter((t) => t.gmvUsd > 0).length;

    // Desglose Consolidado de Métodos de Pago
    const totalApprovedPaymentUsd = Array.from(paymentMethodsMap.values()).reduce(
      (sum, m) => sum + m.totalUsd,
      0
    );

    const paymentMethodsConsolidated: ConsolidatedPaymentMethodStat[] = Array.from(
      paymentMethodsMap.values()
    )
      .map((m) => {
        const totalUsd = Number(m.totalUsd.toFixed(2));
        const totalVes = Number(m.totalVes.toFixed(2));
        const sharePercent =
          totalApprovedPaymentUsd > 0
            ? Number(((totalUsd / totalApprovedPaymentUsd) * 100).toFixed(1))
            : 0;
        const averageTicketUsd =
          m.transactionCount > 0
            ? Number((totalUsd / m.transactionCount).toFixed(2))
            : 0;

        return {
          method: m.method,
          label: m.label,
          totalUsd,
          totalVes,
          transactionCount: m.transactionCount,
          sharePercent,
          averageTicketUsd,
        };
      })
      .sort((a, b) => b.totalUsd - a.totalUsd);

    // Tendencia Diaria en orden cronológico
    const sortedDailyKeys = Array.from(dailyTrendMap.keys()).sort();
    const dailyTrend: PlatformDailyTrendItem[] = sortedDailyKeys.map((dateKey) => {
      const data = dailyTrendMap.get(dateKey)!;
      const todayKey = getCaracasDateKey(new Date());
      let label = dateKey;
      if (dateKey === todayKey) {
        label = "Hoy";
      } else {
        const parts = dateKey.split("-");
        if (parts.length === 3) {
          const d = new Date(`${dateKey}T12:00:00Z`);
          label = d.toLocaleDateString("es-VE", {
            day: "numeric",
            month: "short",
          });
        }
      }
      return {
        date: dateKey,
        label,
        totalUsd: Number(data.totalUsd.toFixed(2)),
        totalVes: Number(data.totalVes.toFixed(2)),
        orderCount: data.orderCount,
      };
    });

    return {
      dateRange: range,
      exchangeRate: activeRateValue,
      appliedDeliveryType: selectedDeliveryType,
      appliedZoneId: selectedZoneId,
      appliedTenantId: selectedTenantId,
      totalNetworkGmvUsd,
      totalNetworkGmvVes,
      networkAverageTicketUsd,
      networkAverageTicketVes,
      totalNetworkOrders,
      completedOrdersCount: totalCompletedOrders,
      pendingOrdersCount: totalPendingOrders,
      cancelledOrdersCount: totalCancelledOrders,
      orderSuccessRatePercent,
      activeTenantsCount: allTenants.filter((t) => t.status === "active").length,
      sellingTenantsCount,
      deliveryBreakdown,
      deliveryZoneRankings,
      availableDeliveryZones,
      tenantRankings,
      paymentMethodsConsolidated,
      dailyTrend,
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
      supported_currencies: ["USD"],
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

        // Initialize default modules from platform settings
        const platformSettings = await this.getPlatformSettings();
        const defaultMods = platformSettings.default_tenant_modules || [
          "local_venezuela",
          "invoicing",
          "purchasing_retentions",
        ];

        const moduleRows = defaultMods.map((modId) => ({
          tenant_id: tenantId,
          module_id: modId,
          is_active: true,
          installed_at: now,
          updated_at: now,
        }));
        await supabase.from("tenant_modules").insert(moduleRows);

        // Fetch official BCV rate for new tenant only if local_venezuela is active
        if (defaultMods.includes("local_venezuela")) {
          await this.syncBcvRateFromApi(tenantId);
        }
      } catch (e) {
        console.warn("[Supabase] Onboarding fallback to memory state:", e);
      }
    }

    // Memory state initialization for default modules
    const defaultModsInMemory = state.platformSettings.default_tenant_modules || [
      "local_venezuela",
      "invoicing",
      "purchasing_retentions",
    ];
    if (!state.tenantModules) state.tenantModules = [];
    for (const modId of defaultModsInMemory) {
      state.tenantModules.push({
        id: `mod-${tenantId}-${modId}`,
        tenant_id: tenantId,
        module_id: modId,
        is_active: true,
        installed_at: now,
        updated_at: now,
      });
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
    const now = new Date().toISOString();

    if (supabase) {
      try {
        await supabase
          .from("tenants")
          .update({ status, updated_at: now })
          .eq("id", tenantId);

        // Also synchronize subscription status if applicable
        const subStatus = status === "suspended" ? "past_due" : status === "active" ? "active" : undefined;
        if (subStatus) {
          await supabase
            .from("tenant_subscriptions")
            .update({ status: subStatus, updated_at: now })
            .eq("tenant_id", tenantId);
        }
      } catch (e) {
        console.warn("[Supabase] Update tenant status error:", e);
      }
    }

    const t = state.tenants.find((item) => item.id === tenantId);
    if (t) {
      t.status = status;
      t.updated_at = now;
    }

    const sub = state.subscriptions.find((item) => item.tenant_id === tenantId);
    if (sub) {
      if (status === "suspended") sub.status = "past_due";
      else if (status === "active") sub.status = "active";
      sub.updated_at = now;
    }

    state.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      tenant_id: tenantId,
      action: status === "suspended" ? "TENANT_SUSPENDED" : "TENANT_ACTIVATED",
      entity: "tenant",
      entity_id: tenantId,
      details: `Estado del comercio cambiado a: ${status.toUpperCase()}`,
      created_at: now,
    });

    return true;
  }

  /**
   * Renew or extend tenant SaaS subscription
   */
  static async renewTenantSubscription(
    tenantId: string,
    durationDays: number = 30,
    paymentMethod: string = "PAGO_MOVIL",
    reference?: string
  ): Promise<TenantSubscription> {
    const supabase = getSupabase();
    const now = new Date();

    let existingSub = state.subscriptions.find((s) => s.tenant_id === tenantId);
    if (supabase) {
      try {
        const { data } = await supabase
          .from("tenant_subscriptions")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (data) {
          existingSub = data as TenantSubscription;
        }
      } catch (e) {
        console.warn("[Supabase] Fetch subscription for renew error:", e);
      }
    }

    // Calculate new period: if current period end is in future, add days to it, else from now
    let baseDate = now;
    if (existingSub && existingSub.current_period_end) {
      const currentEnd = new Date(existingSub.current_period_end);
      if (currentEnd > now) {
        baseDate = currentEnd;
      }
    }

    const newPeriodEnd = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    const newPeriodStart = now.toISOString();

    const updatedSub: TenantSubscription = {
      id: existingSub?.id || `sub-${Date.now()}`,
      tenant_id: tenantId,
      plan_id: existingSub?.plan_id || "GROWTH",
      status: "active",
      billing_cycle: existingSub?.billing_cycle || "monthly",
      current_period_start: newPeriodStart,
      current_period_end: newPeriodEnd,
      cancel_at_period_end: false,
      created_at: existingSub?.created_at || now.toISOString(),
      updated_at: now.toISOString(),
    };

    if (supabase) {
      try {
        await supabase
          .from("tenant_subscriptions")
          .upsert({
            id: updatedSub.id,
            tenant_id: updatedSub.tenant_id,
            plan_id: updatedSub.plan_id,
            status: updatedSub.status,
            billing_cycle: updatedSub.billing_cycle,
            current_period_start: updatedSub.current_period_start,
            current_period_end: updatedSub.current_period_end,
            cancel_at_period_end: updatedSub.cancel_at_period_end,
            updated_at: updatedSub.updated_at,
          });

        // Ensure tenant itself is reactivated when subscription is renewed
        await supabase
          .from("tenants")
          .update({ status: "active", updated_at: now.toISOString() })
          .eq("id", tenantId);
      } catch (e) {
        console.warn("[Supabase] Renew tenant subscription error:", e);
      }
    }

    const subIdx = state.subscriptions.findIndex((s) => s.tenant_id === tenantId);
    if (subIdx >= 0) {
      state.subscriptions[subIdx] = updatedSub;
    } else {
      state.subscriptions.push(updatedSub);
    }

    const t = state.tenants.find((item) => item.id === tenantId);
    if (t) {
      t.status = "active";
      t.updated_at = now.toISOString();
    }

    state.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      tenant_id: tenantId,
      action: "SUBSCRIPTION_RENEWED",
      entity: "subscription",
      entity_id: tenantId,
      details: `Suscripción extendida por ${durationDays} días vía ${paymentMethod}. Ref: ${reference || "N/A"}`,
      created_at: now.toISOString(),
    });

    return updatedSub;
  }

  /**
   * Change SaaS subscription plan tier for a tenant
   */
  static async changeTenantPlan(
    tenantId: string,
    planTier: SubscriptionPlanTier
  ): Promise<TenantSubscription> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    let existingSub = state.subscriptions.find((s) => s.tenant_id === tenantId);
    if (supabase) {
      try {
        const { data } = await supabase
          .from("tenant_subscriptions")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (data) {
          existingSub = data as TenantSubscription;
        }
      } catch (e) {
        console.warn("[Supabase] Fetch subscription for plan change error:", e);
      }
    }

    const updatedSub: TenantSubscription = {
      id: existingSub?.id || `sub-${Date.now()}`,
      tenant_id: tenantId,
      plan_id: planTier,
      status: existingSub?.status || "active",
      billing_cycle: existingSub?.billing_cycle || "monthly",
      current_period_start: existingSub?.current_period_start || now,
      current_period_end: existingSub?.current_period_end || new Date(Date.now() + 30 * 86400000).toISOString(),
      cancel_at_period_end: existingSub?.cancel_at_period_end || false,
      created_at: existingSub?.created_at || now,
      updated_at: now,
    };

    if (supabase) {
      try {
        await supabase
          .from("tenant_subscriptions")
          .upsert({
            id: updatedSub.id,
            tenant_id: updatedSub.tenant_id,
            plan_id: updatedSub.plan_id,
            status: updatedSub.status,
            billing_cycle: updatedSub.billing_cycle,
            current_period_start: updatedSub.current_period_start,
            current_period_end: updatedSub.current_period_end,
            cancel_at_period_end: updatedSub.cancel_at_period_end,
            updated_at: updatedSub.updated_at,
          });
      } catch (e) {
        console.warn("[Supabase] Change tenant plan error:", e);
      }
    }

    const subIdx = state.subscriptions.findIndex((s) => s.tenant_id === tenantId);
    if (subIdx >= 0) {
      state.subscriptions[subIdx] = updatedSub;
    } else {
      state.subscriptions.push(updatedSub);
    }

    state.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      tenant_id: tenantId,
      action: "SUBSCRIPTION_PLAN_CHANGED",
      entity: "subscription",
      entity_id: tenantId,
      details: `Plan cambiado a nivel ${planTier}`,
      created_at: now,
    });

    return updatedSub;
  }

  /**
   * Get tenant subscription
   */
  static async getTenantSubscription(
    tenantId: string
  ): Promise<TenantSubscription | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("tenant_subscriptions")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (!error && data) {
          return data as TenantSubscription;
        }
      } catch (e) {
        console.warn("[MarketOS] getTenantSubscription error:", e);
      }
    }

    const sub = state.subscriptions.find((s) => s.tenant_id === tenantId);
    return sub || null;
  }

  /**
   * Get active subscription plan for a tenant
   */
  static async getTenantPlan(tenantId: string): Promise<SubscriptionPlan> {
    const plans = await this.getSubscriptionPlans();
    const sub = await this.getTenantSubscription(tenantId);
    const planId = sub?.plan_id || "STARTER";
    const plan = plans.find((p) => p.id === planId);
    return plan || plans[0];
  }

  /**
   * Calculate tenant SaaS plan limits, current usage and available feature flags
   */
  static async getTenantPlanLimits(tenantId: string): Promise<TenantPlanLimits> {
    const [plan, sub, products, stores, orders] = await Promise.all([
      this.getTenantPlan(tenantId),
      this.getTenantSubscription(tenantId),
      this.getProducts(tenantId),
      this.getStores(tenantId, true),
      this.getTenantOrders(tenantId),
    ]);

    const productsCount = products.length;
    const storesCount = stores.length;
    const ordersCount = orders.length;

    const canAddProduct = productsCount < plan.max_products;
    const canAddStore = storesCount < plan.max_stores;

    const productUsagePercent = Math.min(
      100,
      Math.round((productsCount / Math.max(1, plan.max_products)) * 100)
    );
    const storeUsagePercent = Math.min(
      100,
      Math.round((storesCount / Math.max(1, plan.max_stores)) * 100)
    );

    const hasDrivers = plan.id !== "STARTER";
    const hasCoupons = plan.id !== "STARTER";

    const storageTelemetry = await this.getTenantStorageTelemetry(tenantId);

    return {
      tenantId,
      plan,
      subscription: sub,
      usage: {
        productsCount,
        storesCount,
        ordersCount,
      },
      canAddProduct,
      canAddStore,
      productUsagePercent,
      storeUsagePercent,
      features: {
        customDomain: Boolean(plan.custom_domain_allowed),
        coupons: hasCoupons,
        drivers: hasDrivers,
        r2Uploads: true,
        unlimitedProducts: plan.max_products >= 2000,
        unlimitedStores: plan.max_stores >= 10,
      },
      storageUsage: {
        usedBytes: storageTelemetry.totalSizeBytes,
        usedFormatted: storageTelemetry.totalSizeFormatted,
        quotaBytes: storageTelemetry.quotaBytes,
        quotaFormatted: storageTelemetry.quotaFormatted,
        percentUsed: storageTelemetry.percentUsed,
      },
    };
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
    // 🔒 ENFORCE SAAS QUOTA: Maximum products allowed for tenant's plan
    const limits = await this.getTenantPlanLimits(input.tenantId);
    if (!limits.canAddProduct) {
      throw new Error(
        `PLAN_QUOTA_EXCEEDED: Has alcanzado el límite de ${limits.plan.max_products} productos de tu plan ${limits.plan.name} (${limits.usage.productsCount}/${limits.plan.max_products}). Actualiza a un plan superior para seguir agregando productos.`
      );
    }

    const supabase = getSupabase();
    const slug = `${input.name.toLowerCase().trim().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`;
    
    // Resolve store ID for inventory
    const tenantStores = supabase ? await this.getStores(input.tenantId, true) : [];
    const storeId =
      input.storeId ||
      tenantStores[0]?.id ||
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
      is_tax_exempt: Boolean(input.isTaxExempt),
      stock: initialStock,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      try {
        const insertPayload: Record<string, unknown> = {
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
        };

        const { data: prodData, error } = await supabase
          .from("products")
          .insert(insertPayload)
          .select("id")
          .single();

        if (error) {
          console.error("[Supabase] Create product error:", error);
          throw new Error(error.message || "Error al insertar producto en Supabase");
        }

        if (prodData) {
          createdProduct.id = prodData.id;

          // Insert store inventory
          if (storeId) {
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
        }
      } catch (e) {
        console.error("[Supabase] Create product error:", e);
        if (supabase) {
          throw e;
        }
      }
    }

    state.products.unshift(createdProduct);

    await MarketOSRepository.recordAuditLog({
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorName: input.actorName,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
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
    const tenantStores = supabase ? await this.getStores(input.tenantId, true) : [];
    const storeId =
      input.storeId ||
      tenantStores[0]?.id ||
      state.stores.find((s) => s.tenant_id === input.tenantId)?.id ||
      "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";

    let updatedFromDb: (Product & { stock: number }) | null = null;
    let oldPriceUsd: number | undefined = undefined;
    let oldStock: number | undefined = undefined;

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

        // Fetch current product to compare old values for audit
        const { data: currentProd } = await supabase
          .from("products")
          .select("*, inventory(quantity)")
          .eq("id", input.productId)
          .eq("tenant_id", input.tenantId)
          .maybeSingle();

        if (currentProd) {
          oldPriceUsd = Number(currentProd.price_usd);
          oldStock = Array.isArray(currentProd.inventory)
            ? currentProd.inventory.reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0)
            : 20;
        }

        const { data: updatedData, error: updateErr } = await supabase
          .from("products")
          .update(updatePayload)
          .eq("id", input.productId)
          .eq("tenant_id", input.tenantId)
          .select("*, inventory(quantity)")
          .maybeSingle();

        if (updateErr) {
          console.error("[Supabase] Update product error:", updateErr);
          throw new Error(updateErr.message || "Error al actualizar producto en Supabase");
        }

        if (input.stock !== undefined && storeId) {
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
          } else {
            await supabase
              .from("inventory")
              .upsert(
                {
                  tenant_id: input.tenantId,
                  store_id: storeId,
                  product_id: input.productId,
                  quantity: input.stock,
                  min_quantity: 5,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "store_id, product_id" }
              );

            await supabase.from("inventory_movements").insert({
              tenant_id: input.tenantId,
              store_id: storeId,
              product_id: input.productId,
              quantity_change: input.stock,
              previous_quantity: 0,
              new_quantity: input.stock,
              reason: "ADJUSTMENT",
            });
          }
        }

        if (updatedData) {
          const totalStock = input.stock !== undefined
            ? input.stock
            : Array.isArray(updatedData.inventory)
            ? updatedData.inventory.reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0)
            : (oldStock ?? 20);

          updatedFromDb = {
            id: updatedData.id,
            tenant_id: updatedData.tenant_id,
            category_id: updatedData.category_id,
            name: updatedData.name,
            slug: updatedData.slug,
            description: updatedData.description,
            sku: updatedData.sku,
            barcode: updatedData.barcode,
            image_url: updatedData.image_url,
            price_usd: Number(updatedData.price_usd),
            is_active: updatedData.is_active,
            is_tax_exempt: Boolean(input.isTaxExempt),
            stock: totalStock,
            created_at: updatedData.created_at,
            updated_at: updatedData.updated_at,
          };
        }
      } catch (e) {
        console.error("[Supabase] Update product error:", e);
        if (supabase) throw e;
      }
    }

    const prod = state.products.find(
      (p) => p.id === input.productId && p.tenant_id === input.tenantId
    );
    if (prod) {
      const oldData = { ...prod };
      if (oldPriceUsd === undefined) oldPriceUsd = oldData.price_usd;
      if (oldStock === undefined) oldStock = oldData.stock;

      if (input.name !== undefined) prod.name = input.name;
      if (input.categoryId !== undefined) prod.category_id = input.categoryId;
      if (input.description !== undefined) prod.description = input.description;
      if (input.priceUsd !== undefined) prod.price_usd = input.priceUsd;
      if (input.sku !== undefined) prod.sku = input.sku;
      if (input.barcode !== undefined) prod.barcode = input.barcode;
      if (input.imageUrl !== undefined) prod.image_url = input.imageUrl;
      if (input.isActive !== undefined) prod.is_active = input.isActive;
      if (input.isTaxExempt !== undefined) prod.is_tax_exempt = input.isTaxExempt;
      if (input.stock !== undefined) prod.stock = input.stock;
      prod.updated_at = new Date().toISOString();
    }

    const finalProduct = updatedFromDb || prod;
    if (!finalProduct) {
      return null;
    }

    // Sync in-memory state if finalProduct came from DB
    if (updatedFromDb) {
      const existingIdx = state.products.findIndex(
        (p) => p.id === input.productId && p.tenant_id === input.tenantId
      );
      if (existingIdx >= 0) {
        state.products[existingIdx] = { ...state.products[existingIdx], ...updatedFromDb };
      } else {
        state.products.unshift(updatedFromDb);
      }
    }

    // Check if price changed -> record surgical PRICE_CHANGED audit event
    if (
      input.priceUsd !== undefined &&
      oldPriceUsd !== undefined &&
      Number(input.priceUsd) !== Number(oldPriceUsd)
    ) {
      const oP = Number(oldPriceUsd);
      const nP = Number(input.priceUsd);
      const diff = Number((nP - oP).toFixed(2));
      const pct = oP > 0 ? Number(((diff / oP) * 100).toFixed(1)) : 0;

      await MarketOSRepository.recordAuditLog({
        tenantId: input.tenantId,
        actorId: input.actorId,
        actorName: input.actorName,
        actorEmail: input.actorEmail,
        actorRole: input.actorRole,
        action: "PRICE_CHANGED",
        entity: "products",
        entityId: input.productId,
        oldData: {
          price_usd: oP,
          price_formatted: `$${oP.toFixed(2)}`,
          name: finalProduct.name,
        },
        newData: {
          price_usd: nP,
          price_formatted: `$${nP.toFixed(2)}`,
          diff_usd: diff,
          percentage_change: pct,
          name: finalProduct.name,
        },
      });
    }

    await MarketOSRepository.recordAuditLog({
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorName: input.actorName,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      action: "PRODUCT_UPDATED",
      entity: "products",
      entityId: input.productId,
      oldData: { price_usd: oldPriceUsd, stock: oldStock },
      newData: { price_usd: finalProduct.price_usd, stock: finalProduct.stock, name: finalProduct.name },
    });

    return finalProduct;
  }

  /**
   * Delete / Deactivate a product
   */
  static async deleteProduct(
    tenantId: string,
    productId: string,
    actor?: AuditActor | null
  ): Promise<boolean> {
    const supabase = getSupabase();
    let deletedSuccessfully = false;
    let deletedProductName = "Producto";

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("products")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", productId)
          .eq("tenant_id", tenantId)
          .select("name")
          .maybeSingle();

        if (!error && data) {
          deletedSuccessfully = true;
          deletedProductName = data.name;
        } else if (error) {
          console.error("[Supabase] Delete product error:", error);
          throw new Error(error.message || "Error al eliminar producto en Supabase");
        }
      } catch (e) {
        console.error("[Supabase] Delete product error:", e);
        if (supabase) throw e;
      }
    }

    const prod = state.products.find(
      (p) => p.id === productId && p.tenant_id === tenantId
    );
    if (prod) {
      prod.is_active = false;
      prod.updated_at = new Date().toISOString();
      deletedSuccessfully = true;
      deletedProductName = prod.name;
    }

    if (deletedSuccessfully) {
      await MarketOSRepository.recordAuditLog({
        tenantId,
        actorId: actor?.id,
        actorName: actor?.name,
        actorEmail: actor?.email,
        actorRole: actor?.role,
        action: "PRODUCT_DELETED",
        entity: "products",
        entityId: productId,
        newData: { is_active: false, name: deletedProductName },
      });
      return true;
    }

    return false;
  }

  // =====================================================================
  // STAFF & ROLE ASSIGNMENT (MULTI-TENANT & PLATFORM)
  // =====================================================================

  /**
   * Get all user profiles across the entire platform (Super Admin)
   */
  static async getAllProfiles(): Promise<UserProfile[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          return data as UserProfile[];
        }
      } catch (e) {
        console.warn("[Supabase] Get all profiles error:", e);
      }
    }

    return state.profiles;
  }

  /**
   * Create or invite a new platform or tenant user (Super Admin)
   */
  static async createPlatformUser(input: CreatePlatformUserInput): Promise<UserProfile> {
    const newProfile: UserProfile = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: input.tenantId || null,
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
            tenant_id: newProfile.tenant_id,
            email: newProfile.email,
            full_name: newProfile.full_name,
            phone: newProfile.phone,
            role: newProfile.role,
          })
          .select("id")
          .maybeSingle();

        if (data?.id) newProfile.id = data.id;
      } catch (e) {
        console.warn("[Supabase] Insert platform user fallback:", e);
      }
    }

    state.profiles.unshift(newProfile);

    await MarketOSRepository.recordAuditLog({
      tenantId: input.tenantId || "platform",
      action: "PLATFORM_USER_CREATED",
      entity: "profiles",
      entityId: newProfile.id,
      newData: { email: newProfile.email, role: newProfile.role, name: newProfile.full_name },
    });

    return newProfile;
  }

  /**
   * Update a user's profile details (role, tenant, phone, name)
   */
  static async updateUserProfile(
    userId: string,
    data: Partial<UserProfile>
  ): Promise<UserProfile | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from("profiles")
          .update({
            ...(data.role && { role: data.role }),
            ...(data.full_name && { full_name: data.full_name }),
            ...(data.phone !== undefined && { phone: data.phone }),
            ...(data.tenant_id !== undefined && { tenant_id: data.tenant_id }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
      } catch (e) {
        console.warn("[Supabase] Update user profile error:", e);
      }
    }

    const idx = state.profiles.findIndex((p) => p.id === userId);
    if (idx !== -1) {
      const old = { ...state.profiles[idx] };
      state.profiles[idx] = {
        ...state.profiles[idx],
        ...data,
        updated_at: new Date().toISOString(),
      };

      await MarketOSRepository.recordAuditLog({
        tenantId: state.profiles[idx].tenant_id || "platform",
        action: "PROFILE_UPDATED",
        entity: "profiles",
        entityId: userId,
        oldData: old as unknown as Record<string, unknown>,
        newData: state.profiles[idx] as unknown as Record<string, unknown>,
      });

      return state.profiles[idx];
    }
    return null;
  }

  /**
   * Delete or revoke access for a user profile
   */
  static async deleteUserProfile(userId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("profiles").delete().eq("id", userId);
      } catch (e) {
        console.warn("[Supabase] Delete user profile error:", e);
      }
    }

    const initialLength = state.profiles.length;
    state.profiles = state.profiles.filter((p) => p.id !== userId);

    await MarketOSRepository.recordAuditLog({
      tenantId: "platform",
      action: "PROFILE_DELETED",
      entity: "profiles",
      entityId: userId,
    });

    return state.profiles.length < initialLength;
  }

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

  // ==============================================================================
  // PWA & WEB PUSH NOTIFICATIONS REPOSITORY (MULTI-TENANT)
  // ==============================================================================

  /**
   * Save or update client device push subscription for a tenant
   */
  static async savePushSubscription(
    input: SavePushSubscriptionInput
  ): Promise<PushSubscriptionRecord> {
    const now = new Date().toISOString();
    const id = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const record: PushSubscriptionRecord = {
      id,
      tenant_id: input.tenantId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      customer_id: input.customerId || null,
      user_agent: input.userAgent || null,
      created_at: now,
      updated_at: now,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("push_subscriptions")
          .upsert(
            {
              tenant_id: input.tenantId,
              endpoint: input.endpoint,
              p256dh: input.p256dh,
              auth: input.auth,
              customer_id: input.customerId || null,
              user_agent: input.userAgent || null,
              updated_at: now,
            },
            { onConflict: "endpoint" }
          )
          .select()
          .maybeSingle();

        if (!error && data) {
          record.id = data.id;
        }
      } catch (err) {
        console.warn("[MarketOS] Could not save push subscription to Supabase:", err);
      }
    }

    // Update in-memory state
    const existingIdx = state.pushSubscriptions.findIndex(
      (s) => s.endpoint === input.endpoint
    );
    if (existingIdx !== -1) {
      state.pushSubscriptions[existingIdx] = {
        ...state.pushSubscriptions[existingIdx],
        tenant_id: input.tenantId,
        p256dh: input.p256dh,
        auth: input.auth,
        customer_id: input.customerId || null,
        user_agent: input.userAgent || null,
        updated_at: now,
      };
      return state.pushSubscriptions[existingIdx];
    } else {
      state.pushSubscriptions.push(record);
      return record;
    }
  }

  /**
   * Get all active push subscriptions for a tenant
   */
  static async getPushSubscriptions(
    tenantId: string
  ): Promise<PushSubscriptionRecord[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("tenant_id", tenantId);

        if (!error && data && data.length > 0) {
          return data as PushSubscriptionRecord[];
        }
      } catch (err) {
        console.warn("[MarketOS] Could not fetch push subscriptions from Supabase:", err);
      }
    }

    return state.pushSubscriptions.filter((s) => s.tenant_id === tenantId);
  }

  /**
   * Delete an expired or revoked subscription endpoint
   */
  static async deletePushSubscription(endpoint: string): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", endpoint);
      } catch (err) {
        console.warn("[MarketOS] Could not delete push subscription from Supabase:", err);
      }
    }

    state.pushSubscriptions = state.pushSubscriptions.filter(
      (s) => s.endpoint !== endpoint
    );
  }

  /**
   * Record a push broadcast log for audit & metrics
   */
  static async recordPushNotificationLog(input: {
    tenantId: string;
    title: string;
    body: string;
    url?: string;
    targetType?: "all" | "customers" | "with_orders" | "without_orders" | string;
    sentCount: number;
    createdBy?: string | null;
  }): Promise<PushNotificationLog> {
    const now = new Date().toISOString();
    const id = `log-${Date.now()}`;
    const logRecord: PushNotificationLog = {
      id,
      tenant_id: input.tenantId,
      title: input.title,
      body: input.body,
      url: input.url || "/",
      target_type: input.targetType || "all",
      sent_count: input.sentCount,
      created_by: input.createdBy || null,
      created_at: now,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("push_notifications_log").insert({
          tenant_id: input.tenantId,
          title: input.title,
          body: input.body,
          url: input.url || "/",
          target_type: input.targetType || "all",
          sent_count: input.sentCount,
          created_by: input.createdBy || null,
          created_at: now,
        });
      } catch (err) {
        console.warn("[MarketOS] Could not save push log to Supabase:", err);
      }
    }

    state.pushLogs.unshift(logRecord);
    return logRecord;
  }

  /**
   * Get push notification logs for a tenant
   */
  static async getPushNotificationLogs(
    tenantId: string
  ): Promise<PushNotificationLog[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("push_notifications_log")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!error && data && data.length > 0) {
          return data as PushNotificationLog[];
        }
      } catch (err) {
        console.warn("[MarketOS] Could not fetch push logs from Supabase:", err);
      }
    }

    return state.pushLogs
      .filter((l) => l.tenant_id === tenantId)
      .slice(0, 50);
  }

  /**
   * Get push statistics for a tenant
   */
  static async getPushStats(tenantId: string): Promise<PushStats> {
    const subscriptions = await this.getPushSubscriptions(tenantId);
    const logs = await this.getPushNotificationLogs(tenantId);

    const totalSent = logs.reduce((acc, l) => acc + l.sent_count, 0);
    const lastSentAt = logs.length > 0 ? logs[0].created_at : null;

    return {
      subscriberCount: subscriptions.length,
      totalSentCount: totalSent,
      lastSentAt,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MODULAR PLUGINS & TENANT MODULES SYSTEM
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get all installed plugins/modules for a tenant
   */
  static async getTenantModules(tenantId: string): Promise<TenantModule[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("tenant_modules")
          .select("*")
          .eq("tenant_id", tenantId);

        if (!error && data && data.length > 0) {
          return data as TenantModule[];
        }
      } catch (err) {
        console.warn("[MarketOS] Could not fetch tenant modules from Supabase:", err);
      }
    }

    return (state.tenantModules || []).filter((m) => m.tenant_id === tenantId);
  }

  /**
   * Get list of active module IDs for a tenant (e.g. ['food_service', 'local_venezuela'])
   */
  static async getTenantActiveModuleIds(tenantId: string): Promise<TenantModuleId[]> {
    const modules = await this.getTenantModules(tenantId);
    return modules.filter((m) => m.is_active).map((m) => m.module_id);
  }

  /**
   * Fast check if a specific plugin is active for a tenant
   */
  static async isModuleActiveForTenant(
    tenantId: string,
    moduleId: TenantModuleId
  ): Promise<boolean> {
    const activeIds = await this.getTenantActiveModuleIds(tenantId);
    return activeIds.includes(moduleId);
  }

  /**
   * Activate or deactivate a plugin for a tenant (Super Admin operation)
   */
  static async setTenantModuleStatus(
    tenantId: string,
    moduleId: TenantModuleId,
    isActive: boolean,
    settings?: Record<string, unknown>
  ): Promise<TenantModule> {
    const now = new Date().toISOString();
    const supabase = getSupabase();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("tenant_modules")
          .upsert(
            {
              tenant_id: tenantId,
              module_id: moduleId,
              is_active: isActive,
              settings: settings || {},
              updated_at: now,
            },
            { onConflict: "tenant_id,module_id" }
          )
          .select()
          .single();

        if (!error && data) {
          return data as TenantModule;
        }
      } catch (err) {
        console.warn("[MarketOS] Could not update tenant module status in Supabase:", err);
      }
    }

    // Mock state fallback
    if (!state.tenantModules) state.tenantModules = [];
    let existing = state.tenantModules.find(
      (m) => m.tenant_id === tenantId && m.module_id === moduleId
    );

    if (existing) {
      existing.is_active = isActive;
      if (settings) existing.settings = { ...existing.settings, ...settings };
      existing.updated_at = now;
      return existing;
    }

    const newModule: TenantModule = {
      id: `mod-${Date.now()}`,
      tenant_id: tenantId,
      module_id: moduleId,
      is_active: isActive,
      settings: settings || {},
      installed_at: now,
      updated_at: now,
    };
    state.tenantModules.push(newModule);
    return newModule;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FOOD SERVICE & GASTRONOMY (PULLDOG) REPOSITORY SERVICES
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get raw materials / ingredients for a store
   */
  static async getRawMaterials(
    tenantId: string,
    storeId?: string
  ): Promise<RawMaterial[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase
          .from("raw_materials")
          .select("*")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .order("name", { ascending: true });

        if (storeId) {
          query = query.eq("store_id", storeId);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data as RawMaterial[];
        }
      } catch (err) {
        console.warn("[MarketOS] Could not fetch raw materials from Supabase:", err);
      }
    }

    return (state.rawMaterials || []).filter(
      (r) =>
        r.tenant_id === tenantId &&
        (!storeId || r.store_id === storeId) &&
        !r.deleted_at
    );
  }

  /**
   * Create or update a raw material / ingredient
   */
  static async saveRawMaterial(
    input: Partial<RawMaterial> & {
      tenant_id: string;
      store_id: string;
      name: string;
    }
  ): Promise<RawMaterial> {
    const now = new Date().toISOString();
    const id = input.id || `raw-${Date.now()}`;
    const rawRecord: RawMaterial = {
      id,
      tenant_id: input.tenant_id,
      store_id: input.store_id,
      name: input.name,
      sku: input.sku || null,
      unit: input.unit || "UNIT",
      current_stock: input.current_stock ?? 0,
      min_alert_stock: input.min_alert_stock ?? 5,
      cost_per_unit_usd: input.cost_per_unit_usd ?? 0,
      is_active: input.is_active ?? true,
      created_at: input.created_at || now,
      updated_at: now,
      deleted_at: input.deleted_at || null,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("raw_materials")
          .upsert(rawRecord)
          .select()
          .single();

        if (!error && data) {
          return data as RawMaterial;
        }
      } catch (err) {
        console.warn("[MarketOS] Could not save raw material to Supabase:", err);
      }
    }

    if (!state.rawMaterials) state.rawMaterials = [];
    const idx = state.rawMaterials.findIndex((r) => r.id === id);
    if (idx >= 0) {
      state.rawMaterials[idx] = rawRecord;
    } else {
      state.rawMaterials.push(rawRecord);
    }
    return rawRecord;
  }

  /**
   * Soft-delete a raw material (Preserves history & audit integrity)
   */
  static async deleteRawMaterial(tenantId: string, id: string): Promise<void> {
    const now = new Date().toISOString();
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from("raw_materials")
          .update({ deleted_at: now, is_active: false })
          .eq("id", id)
          .eq("tenant_id", tenantId);
      } catch (err) {
        console.warn("[MarketOS] Could not soft delete raw material in Supabase:", err);
      }
    }

    const item = (state.rawMaterials || []).find(
      (r) => r.id === id && r.tenant_id === tenantId
    );
    if (item) {
      item.deleted_at = now;
      item.is_active = false;
    }
  }

  /**
   * Get recipe for a specific product
   */
  static async getProductRecipe(
    tenantId: string,
    productId: string
  ): Promise<ProductRecipe | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("product_recipes")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("product_id", productId)
          .single();

        if (!error && data) {
          return data as ProductRecipe;
        }
      } catch (err) {
        console.warn("[MarketOS] Could not fetch product recipe from Supabase:", err);
      }
    }

    return (
      (state.recipes || []).find(
        (r) => r.tenant_id === tenantId && r.product_id === productId
      ) || null
    );
  }

  /**
   * Get all product recipes for a tenant
   */
  static async getProductRecipes(tenantId: string): Promise<ProductRecipe[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("product_recipes")
          .select("*")
          .eq("tenant_id", tenantId);

        if (!error && data) {
          return data as ProductRecipe[];
        }
      } catch (err) {
        console.warn("[MarketOS] Could not fetch product recipes from Supabase:", err);
      }
    }

    return (state.recipes || []).filter((r) => r.tenant_id === tenantId);
  }

  /**
   * Save recipe for a product
   */
  static async saveProductRecipe(recipe: ProductRecipe): Promise<ProductRecipe> {
    const now = new Date().toISOString();
    const record: ProductRecipe = {
      ...recipe,
      updated_at: now,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("product_recipes")
          .upsert(record)
          .select()
          .single();

        if (!error && data) {
          return data as ProductRecipe;
        }
      } catch (err) {
        console.warn("[MarketOS] Could not save product recipe to Supabase:", err);
      }
    }

    if (!state.recipes) state.recipes = [];
    const idx = state.recipes.findIndex(
      (r) => r.tenant_id === recipe.tenant_id && r.product_id === recipe.product_id
    );
    if (idx >= 0) {
      state.recipes[idx] = record;
    } else {
      state.recipes.push(record);
    }
    return record;
  }

  /**
   * Get modifier groups (sauces, extras, toppings) for a product or category
   */
  static async getProductModifierGroups(
    tenantId: string,
    productId?: string,
    categoryId?: string
  ): Promise<ProductModifierGroup[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase
          .from("product_modifier_groups")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        const { data, error } = await query;
        if (!error && data) {
          return (data as ProductModifierGroup[]).filter((g) => {
            if (g.product_id && productId && g.product_id === productId) return true;
            if (g.category_id && categoryId && g.category_id === categoryId) return true;
            if (!g.product_id && !g.category_id) return true;
            return false;
          });
        }
      } catch (err) {
        console.warn("[MarketOS] Could not fetch modifier groups from Supabase:", err);
      }
    }

    return (state.modifierGroups || [])
      .filter((g) => g.tenant_id === tenantId && g.is_active)
      .filter((g) => {
        if (g.product_id && productId && g.product_id === productId) return true;
        if (g.category_id && categoryId && g.category_id === categoryId) return true;
        if (!g.product_id && !g.category_id) return true;
        return false;
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  /**
   * Save a product modifier group
   */
  static async saveProductModifierGroup(
    group: ProductModifierGroup
  ): Promise<ProductModifierGroup> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("product_modifier_groups")
          .upsert(group)
          .select()
          .single();

        if (!error && data) {
          return data as ProductModifierGroup;
        }
      } catch (err) {
        console.warn("[MarketOS] Could not save modifier group to Supabase:", err);
      }
    }

    if (!state.modifierGroups) state.modifierGroups = [];
    const idx = state.modifierGroups.findIndex((g) => g.id === group.id);
    if (idx >= 0) {
      state.modifierGroups[idx] = group;
    } else {
      state.modifierGroups.push(group);
    }
    return group;
  }

  /**
   * Automatically deduct raw material stock when a gastronomy order is processed
   * (e.g. 1 Hot dog sold = -1 Bread, -1 Sausage, etc.)
   */
  /**
   * Automatically deduct raw material stock when a gastronomy order is processed
   * (e.g. 1 Hot dog sold = -1 Bread, -1 Sausage, etc.)
   * Applies unit conversion (KG <-> G, L <-> ML) and cooking shrinkage factor.
   */
  static async deductRecipeInventoryForOrder(
    order: Order
  ): Promise<{ success: boolean; deductedItemsCount: number }> {
    if (!order.items || order.items.length === 0) {
      return { success: true, deductedItemsCount: 0 };
    }

    const rawMaterialsList = await this.getRawMaterials(order.tenant_id, order.store_id);
    if (!rawMaterialsList || rawMaterialsList.length === 0) {
      return { success: true, deductedItemsCount: 0 };
    }

    const rawMaterialMap = new Map<string, RawMaterial>();
    for (const rm of rawMaterialsList) {
      rawMaterialMap.set(rm.id, { ...rm });
    }

    const deductionsAccumulator = new Map<string, number>();

    for (const item of order.items) {
      // 1. Deduct Base Recipe
      const recipe = await this.getProductRecipe(order.tenant_id, item.product_id);
      if (recipe && recipe.items && recipe.items.length > 0) {
        for (const ingredient of recipe.items) {
          const rawMaterial = rawMaterialMap.get(ingredient.raw_material_id);
          if (rawMaterial) {
            const recipeUnit = ingredient.unit || rawMaterial.unit;
            const wastePct = Math.max(0, Math.min(90, ingredient.waste_percentage || 0));
            const shrinkageMultiplier = wastePct > 0 ? 1 / (1 - wastePct / 100) : 1;

            const effectiveRecipeQty = ingredient.quantity * item.quantity * shrinkageMultiplier;
            const storageQtyNeeded = convertUnitQuantity(recipeUnit, rawMaterial.unit, effectiveRecipeQty);

            const currentDeduction = deductionsAccumulator.get(rawMaterial.id) || 0;
            deductionsAccumulator.set(rawMaterial.id, currentDeduction + storageQtyNeeded);
          }
        }
      }

      // 2. Deduct Extra Modifiers (e.g. Extra Bacon, Extra Cheese)
      if (item.selected_modifiers && item.selected_modifiers.length > 0) {
        for (const mod of item.selected_modifiers) {
          if (mod.raw_material_id) {
            const rawMaterial = rawMaterialMap.get(mod.raw_material_id);
            if (rawMaterial) {
              const modUnit = mod.raw_material_unit || rawMaterial.unit;
              const rawQty = (mod.raw_material_quantity || 1) * item.quantity;
              const storageQtyNeeded = convertUnitQuantity(modUnit, rawMaterial.unit, rawQty);

              const currentDeduction = deductionsAccumulator.get(rawMaterial.id) || 0;
              deductionsAccumulator.set(rawMaterial.id, currentDeduction + storageQtyNeeded);
            }
          }
        }
      }
    }

    let totalDeductions = 0;
    for (const [rawMaterialId, qtyToDeduct] of deductionsAccumulator.entries()) {
      const rawMaterial = rawMaterialMap.get(rawMaterialId);
      if (!rawMaterial) continue;

      const newStock = Math.max(0, Number((rawMaterial.current_stock - qtyToDeduct).toFixed(3)));
      await this.saveRawMaterial({
        ...rawMaterial,
        current_stock: newStock,
        updated_at: new Date().toISOString(),
      });
      totalDeductions++;
    }

    return { success: true, deductedItemsCount: totalDeductions };
  }

  /**
   * Revert / Return raw material stock when a gastronomy order is cancelled
   */
  static async restoreRecipeInventoryForOrder(
    order: Order
  ): Promise<{ success: boolean; restoredItemsCount: number }> {
    if (!order.items || order.items.length === 0) {
      return { success: true, restoredItemsCount: 0 };
    }

    const rawMaterialsList = await this.getRawMaterials(order.tenant_id, order.store_id);
    if (!rawMaterialsList || rawMaterialsList.length === 0) {
      return { success: true, restoredItemsCount: 0 };
    }

    const rawMaterialMap = new Map<string, RawMaterial>();
    for (const rm of rawMaterialsList) {
      rawMaterialMap.set(rm.id, { ...rm });
    }

    const restoreAccumulator = new Map<string, number>();

    for (const item of order.items) {
      const recipe = await this.getProductRecipe(order.tenant_id, item.product_id);
      if (recipe && recipe.items && recipe.items.length > 0) {
        for (const ingredient of recipe.items) {
          const rawMaterial = rawMaterialMap.get(ingredient.raw_material_id);
          if (rawMaterial) {
            const recipeUnit = ingredient.unit || rawMaterial.unit;
            const wastePct = Math.max(0, Math.min(90, ingredient.waste_percentage || 0));
            const shrinkageMultiplier = wastePct > 0 ? 1 / (1 - wastePct / 100) : 1;

            const effectiveRecipeQty = ingredient.quantity * item.quantity * shrinkageMultiplier;
            const storageQtyToReturn = convertUnitQuantity(recipeUnit, rawMaterial.unit, effectiveRecipeQty);

            const currentRestored = restoreAccumulator.get(rawMaterial.id) || 0;
            restoreAccumulator.set(rawMaterial.id, currentRestored + storageQtyToReturn);
          }
        }
      }

      if (item.selected_modifiers && item.selected_modifiers.length > 0) {
        for (const mod of item.selected_modifiers) {
          if (mod.raw_material_id) {
            const rawMaterial = rawMaterialMap.get(mod.raw_material_id);
            if (rawMaterial) {
              const modUnit = mod.raw_material_unit || rawMaterial.unit;
              const rawQty = (mod.raw_material_quantity || 1) * item.quantity;
              const storageQtyToReturn = convertUnitQuantity(modUnit, rawMaterial.unit, rawQty);

              const currentRestored = restoreAccumulator.get(rawMaterial.id) || 0;
              restoreAccumulator.set(rawMaterial.id, currentRestored + storageQtyToReturn);
            }
          }
        }
      }
    }

    let totalRestored = 0;
    for (const [rawMaterialId, qtyToReturn] of restoreAccumulator.entries()) {
      const rawMaterial = rawMaterialMap.get(rawMaterialId);
      if (!rawMaterial) continue;

      const restoredStock = Number((rawMaterial.current_stock + qtyToReturn).toFixed(3));
      await this.saveRawMaterial({
        ...rawMaterial,
        current_stock: restoredStock,
        updated_at: new Date().toISOString(),
      });
      totalRestored++;
    }

    return { success: true, restoredItemsCount: totalRestored };
  }

  /**
   * Obtener ajustes globales de la plataforma SaaS (White-label, Canales de Soporte y Marca)
   */
  static async getPlatformSettings(): Promise<PlatformSettings> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("*")
          .eq("id", "default")
          .maybeSingle();

        if (!error && data) {
          const formatted: PlatformSettings = {
            ...(data as PlatformSettings),
            logo_url: (data as PlatformSettings).logo_url
              ? formatMediaUrl((data as PlatformSettings).logo_url)
              : null,
          };
          state.platformSettings = formatted;
          return formatted;
        }
      } catch (e) {
        console.warn("[Supabase] Get platform settings error:", e);
      }
    }

    const current = state.platformSettings || {
      id: "default",
      platform_name: "MarketOS",
      platform_tagline: "Consola Centralizada Multi-Tenant SaaS",
      logo_url: null,
      support_phone: "+58 412-0000000",
      support_email: "soporte@marketos.com",
      support_whatsapp: "+58 412-0000000",
      currency_symbol: "$",
      contact_address: "Torre Empresarial, Piso 10",
      updated_at: new Date().toISOString(),
    };

    if (current.logo_url) {
      current.logo_url = formatMediaUrl(current.logo_url);
    }

    return current;
  }

  /**
   * Actualizar ajustes globales de la plataforma SaaS (White-label y Canales de Soporte)
   */
  static async updatePlatformSettings(
    input: Partial<PlatformSettings>
  ): Promise<PlatformSettings> {
    const current = await this.getPlatformSettings();
    const cleanLogoUrl = input.logo_url ? formatMediaUrl(input.logo_url) : input.logo_url;
    const updated: PlatformSettings = {
      ...current,
      ...input,
      ...(cleanLogoUrl !== undefined && { logo_url: cleanLogoUrl }),
      id: "default",
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .upsert(updated)
          .select("*")
          .single();

        if (!error && data) {
          const formatted: PlatformSettings = {
            ...(data as PlatformSettings),
            logo_url: (data as PlatformSettings).logo_url
              ? formatMediaUrl((data as PlatformSettings).logo_url)
              : null,
          };
          state.platformSettings = formatted;
          return formatted;
        }
      } catch (e) {
        console.warn("[Supabase] Upsert platform settings error:", e);
      }
    }

    state.platformSettings = updated;
    return updated;
  }

  // =====================================================================
  // BARCODE RETAIL & PACKAGING METHODS
  // =====================================================================

  static async getProductBarcodes(productId: string): Promise<ProductBarcode[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("product_barcodes")
          .select("*")
          .eq("product_id", productId)
          .order("created_at", { ascending: true });

        if (!error && data) {
          return data as ProductBarcode[];
        }
      } catch (e) {
        console.warn("[MarketOS] getProductBarcodes error:", e);
      }
    }
    return [];
  }

  static async upsertProductBarcode(
    input: Omit<ProductBarcode, "id" | "created_at">
  ): Promise<ProductBarcode | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("product_barcodes")
          .upsert(
            {
              tenant_id: input.tenant_id,
              product_id: input.product_id,
              barcode: input.barcode,
              pack_name: input.pack_name,
              units_per_pack: input.units_per_pack,
              price_usd: input.price_usd,
              is_primary: input.is_primary,
            },
            { onConflict: "tenant_id,barcode" }
          )
          .select("*")
          .single();

        if (!error && data) {
          return data as ProductBarcode;
        }
      } catch (e) {
        console.warn("[MarketOS] upsertProductBarcode error:", e);
      }
    }
    return null;
  }

  static async deleteProductBarcode(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from("product_barcodes")
          .delete()
          .eq("id", id);
        return !error;
      } catch (e) {
        console.warn("[MarketOS] deleteProductBarcode error:", e);
      }
    }
    return false;
  }

  static async findProductByBarcode(
    tenantId: string,
    rawBarcode: string
  ): Promise<{ product: Product; barcodeRecord?: ProductBarcode; unitsPerPack: number; priceUsd: number } | null> {
    const clean = rawBarcode.trim();
    if (!clean) return null;
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      // 1. Try secondary packaging barcodes table first
      const { data: packBarcode } = await supabase
        .from("product_barcodes")
        .select("*, products(*)")
        .eq("tenant_id", tenantId)
        .eq("barcode", clean)
        .maybeSingle();

      if (packBarcode && packBarcode.products) {
        const p = packBarcode.products as Product;
        const units = packBarcode.units_per_pack || 1;
        const finalPrice =
          packBarcode.price_usd !== null && packBarcode.price_usd !== undefined
            ? Number(packBarcode.price_usd)
            : Number(p.price_usd) * units;

        return {
          product: p,
          barcodeRecord: packBarcode as ProductBarcode,
          unitsPerPack: units,
          priceUsd: finalPrice,
        };
      }

      // 2. Try primary products table barcode
      const { data: directProduct } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("barcode", clean)
        .maybeSingle();

      if (directProduct) {
        return {
          product: directProduct as Product,
          unitsPerPack: 1,
          priceUsd: Number(directProduct.price_usd),
        };
      }

      // 3. Fallback for GS1 Scale Barcode (prefixes 20-29): e.g. 2001452...
      if (clean.length === 13 && clean.startsWith("2")) {
        const itemCode = clean.slice(2, 7);
        // Look up product by SKU or external_product_id or trailing code
        const { data: scaleProd } = await supabase
          .from("products")
          .select("*")
          .eq("tenant_id", tenantId)
          .or(`sku.eq.${itemCode},barcode.ilike.%${itemCode}%,external_product_id.eq.${itemCode}`)
          .maybeSingle();

        if (scaleProd) {
          const isPriceMode = clean.startsWith("23") || clean.startsWith("24");
          const payloadNum = parseInt(clean.slice(7, 12), 10);
          const computedPrice = isPriceMode
            ? payloadNum / 100
            : Number(scaleProd.price_usd) * (payloadNum / 1000);

          return {
            product: scaleProd as Product,
            unitsPerPack: 1,
            priceUsd: computedPrice,
          };
        }
      }
    } catch (e) {
      console.warn("[MarketOS] findProductByBarcode error:", e);
    }

    return null;
  }

  static async updateInventoryLocation(
    storeId: string,
    productId: string,
    location: WarehouseLocation
  ): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from("inventory")
          .update({
            aisle: location.aisle || "01",
            shelf: location.shelf || "A",
            bin: location.bin || "01",
          })
          .eq("store_id", storeId)
          .eq("product_id", productId);

        return !error;
      } catch (e) {
        console.warn("[MarketOS] updateInventoryLocation error:", e);
      }
    }
    return false;
  }

  // ==========================================
  // MAKE-TO-ORDER & CPQ (TALLER & FABRICACIÓN)
  // ==========================================

  static async getTenantCpqSettings(tenantId: string): Promise<CpqCostSettings | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from("cpq_cost_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return (data as CpqCostSettings) || null;
    } catch (e) {
      console.warn("[MarketOS] getTenantCpqSettings error:", e);
      return null;
    }
  }

  static async saveTenantCpqSettings(
    tenantId: string,
    settings: Partial<CpqCostSettings>
  ): Promise<CpqCostSettings | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const payload = {
        tenant_id: tenantId,
        hourly_labor_rate: settings.hourly_labor_rate ?? 15,
        machine_cost_per_hour: settings.machine_cost_per_hour ?? 10,
        default_margin_percentage: settings.default_margin_percentage ?? 35,
        default_deposit_percentage: settings.default_deposit_percentage ?? 50,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("cpq_cost_settings")
        .upsert(payload, { onConflict: "tenant_id" })
        .select()
        .single();
      if (error) throw error;
      return (data as CpqCostSettings) || null;
    } catch (e) {
      console.warn("[MarketOS] saveTenantCpqSettings error:", e);
      return null;
    }
  }


  static async getCpqPricingMatrices(
    tenantId: string,
    productId?: string
  ): Promise<CpqPricingMatrix[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    try {
      let query = supabase
        .from("cpq_pricing_matrices")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });
      if (productId) {
        query = query.eq("product_id", productId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as CpqPricingMatrix[]) || [];
    } catch (e) {
      console.warn("[MarketOS] getCpqPricingMatrices error:", e);
      return [];
    }
  }

  static async saveCpqPricingMatrix(
    matrix: Partial<CpqPricingMatrix> & { tenant_id: string; name: string }
  ): Promise<CpqPricingMatrix | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      if (matrix.id) {
        const { data, error } = await supabase
          .from("cpq_pricing_matrices")
          .update({
            ...matrix,
            updated_at: new Date().toISOString(),
          })
          .eq("id", matrix.id)
          .eq("tenant_id", matrix.tenant_id)
          .select()
          .single();
        if (error) throw error;
        return data as CpqPricingMatrix;
      } else {
        const { data, error } = await supabase
          .from("cpq_pricing_matrices")
          .insert(matrix)
          .select()
          .single();
        if (error) throw error;
        return data as CpqPricingMatrix;
      }
    } catch (e) {
      console.warn("[MarketOS] saveCpqPricingMatrix error:", e);
      return null;
    }
  }

  static async getCpqMatrixAttributeOptions(
    matrixId: string
  ): Promise<CpqAttributeOption[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("cpq_attribute_options")
        .select("*")
        .eq("pricing_matrix_id", matrixId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as CpqAttributeOption[]) || [];
    } catch (e) {
      console.warn("[MarketOS] getCpqMatrixAttributeOptions error:", e);
      return [];
    }
  }

  static async createCpqQuote(input: {
    quote: Partial<CpqQuote> & { tenant_id: string; total_price: number };
    items: Omit<CpqQuoteItem, "id" | "quote_id">[];
  }): Promise<CpqQuote | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const quoteNumber =
        input.quote.quote_number || `COT-${Date.now().toString().slice(-6)}`;
      const depositPercentage = input.quote.deposit_percentage ?? 50;
      const depositAmount =
        input.quote.deposit_amount ??
        (input.quote.total_price * depositPercentage) / 100;

      const { data: quote, error: quoteErr } = await supabase
        .from("cpq_quotes")
        .insert({
          ...input.quote,
          quote_number: quoteNumber,
          deposit_percentage: depositPercentage,
          deposit_amount: depositAmount,
          status: input.quote.status || "DRAFT",
        })
        .select()
        .single();

      if (quoteErr || !quote) throw quoteErr || new Error("Failed to insert quote");

      if (input.items && input.items.length > 0) {
        const itemsPayload = input.items.map((item) => ({
          ...item,
          quote_id: quote.id,
        }));
        const { error: itemsErr } = await supabase
          .from("cpq_quote_items")
          .insert(itemsPayload);
        if (itemsErr) {
          console.warn("[MarketOS] createCpqQuote items insert error:", itemsErr);
        }
      }

      return quote as CpqQuote;
    } catch (e) {
      console.warn("[MarketOS] createCpqQuote error:", e);
      return null;
    }
  }

  static async getCpqQuotes(tenantId: string): Promise<CpqQuote[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("cpq_quotes")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as CpqQuote[]) || [];
    } catch (e) {
      console.warn("[MarketOS] getCpqQuotes error:", e);
      return [];
    }
  }

  static async convertQuoteToOrder(
    quoteId: string,
    storeId: string
  ): Promise<{ order: Order; milestone: CpqOrderMilestone } | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data: quote, error: qErr } = await supabase
        .from("cpq_quotes")
        .select("*, cpq_quote_items(*)")
        .eq("id", quoteId)
        .single();

      if (qErr || !quote) throw qErr || new Error("Quote not found");

      const depositPct = quote.deposit_percentage ?? 50;
      const depositAmt =
        quote.deposit_amount ?? (quote.total_price * depositPct) / 100;

      // 1. Create order
      const orderNumber = `ORD-MTO-${Date.now().toString().slice(-6)}`;
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          tenant_id: quote.tenant_id,
          store_id: storeId,
          order_number: orderNumber,
          customer_name: quote.customer_name || "Cliente Taller",
          customer_phone: quote.customer_phone || "",
          delivery_type: "pickup",
          total_amount_usd: quote.total_price,
          status: "PENDING",
          payment_status: "PENDING",
          notes: `Orden generada desde Presupuesto #${quote.quote_number}`,
        })
        .select()
        .single();

      if (orderErr || !order) throw orderErr || new Error("Failed to create order from quote");

      // 2. Create order items if any
      const quoteItems = quote.cpq_quote_items || [];
      if (quoteItems.length > 0) {
        const orderItemsPayload = quoteItems.map((qi: any) => ({
          order_id: order.id,
          product_id: qi.product_id,
          product_name: qi.product_name,
          quantity: qi.quantity,
          unit_price_usd: qi.unit_price,
          total_price_usd: qi.total_price,
        }));
        await supabase.from("order_items").insert(orderItemsPayload);
      }

      // 3. Create CPQ Order Milestone
      const { data: milestone, error: mileErr } = await supabase
        .from("cpq_order_milestones")
        .insert({
          order_id: order.id,
          tenant_id: quote.tenant_id,
          total_amount: quote.total_price,
          paid_amount: 0,
          pending_balance: quote.total_price,
          required_deposit_percentage: depositPct,
          required_deposit_amount: depositAmt,
          allow_dispatch_with_balance: false,
        })
        .select()
        .single();

      if (mileErr) console.warn("[MarketOS] milestone insert error:", mileErr);

      // 4. Update quote status to ACCEPTED
      await supabase
        .from("cpq_quotes")
        .update({ status: "ACCEPTED", updated_at: new Date().toISOString() })
        .eq("id", quoteId);

      return {
        order: order as Order,
        milestone: milestone as CpqOrderMilestone,
      };
    } catch (e) {
      console.warn("[MarketOS] convertQuoteToOrder error:", e);
      return null;
    }
  }

  static async getCpqOrderMilestone(orderId: string): Promise<CpqOrderMilestone | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from("cpq_order_milestones")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return (data as CpqOrderMilestone) || null;
    } catch (e) {
      console.warn("[MarketOS] getCpqOrderMilestone error:", e);
      return null;
    }
  }

  static async recordCpqMilestonePayment(
    milestoneId: string,
    amount: number,
    note?: string
  ): Promise<CpqOrderMilestone | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data: current, error: curErr } = await supabase
        .from("cpq_order_milestones")
        .select("*")
        .eq("id", milestoneId)
        .single();
      if (curErr || !current) throw curErr || new Error("Milestone not found");

      const newPaid = Number(current.paid_amount || 0) + amount;
      const newPending = Math.max(0, Number(current.total_amount || 0) - newPaid);

      const { data: updated, error: upErr } = await supabase
        .from("cpq_order_milestones")
        .update({
          paid_amount: newPaid,
          pending_balance: newPending,
          updated_at: new Date().toISOString(),
        })
        .eq("id", milestoneId)
        .select()
        .single();

      if (upErr) throw upErr;
      return updated as CpqOrderMilestone;
    } catch (e) {
      console.warn("[MarketOS] recordCpqMilestonePayment error:", e);
      return null;
    }
  }

  static async updateCpqMilestoneDispatchAllowance(
    milestoneId: string,
    allow: boolean
  ): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    try {
      const { error } = await supabase
        .from("cpq_order_milestones")
        .update({
          allow_dispatch_with_balance: allow,
          updated_at: new Date().toISOString(),
        })
        .eq("id", milestoneId);
      return !error;
    } catch (e) {
      console.warn("[MarketOS] updateCpqMilestoneDispatchAllowance error:", e);
      return false;
    }
  }
}

