import {
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
} from "@marketos/types";
import { state, INITIAL_SETTINGS, INITIAL_TENANT } from "./mock-data";
import { fetchBcvRate, convertUsdToVes, getCaracasDateKey, getCaracasRangeBounds } from "@marketos/utils";
import { createServerComponentClient } from "./server";
import { isSupabaseOffline } from "./circuit-breaker";

function isUuid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
        .or(`id.eq.${cleanSearch},slug.eq.${cleanSearch},custom_domain.eq.${cleanSearch}`)
        .maybeSingle();

      if (!error && data) {
        return data as Tenant;
      }
    }

    const tenant = state.tenants.find(
      (t) =>
        t.id.toLowerCase() === cleanSearch ||
        t.slug.toLowerCase() === cleanSearch ||
        (t.custom_domain && t.custom_domain.toLowerCase() === cleanSearch)
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
        let customDomain = data.custom_domain || null;
        if (!customDomain) {
          const { data: tenantData } = await supabase
            .from("tenants")
            .select("custom_domain")
            .eq("id", tenantId)
            .maybeSingle();
          if (tenantData?.custom_domain) {
            customDomain = tenantData.custom_domain;
          }
        }

        return {
          ...INITIAL_SETTINGS,
          ...(data as TenantSettings),
          custom_domain: customDomain,
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
            ...(data.billing_settings || {}),
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
      billing_settings: updates.billing_settings
        ? { ...current.billing_settings, ...updates.billing_settings }
        : current.billing_settings,
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
        billing_settings: updated.billing_settings,
        custom_domain: updated.custom_domain,
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
        delete safePayload.billing_settings;
        delete safePayload.font_family;
        delete safePayload.custom_domain;
        await supabase
          .from("tenant_settings")
          .update(safePayload)
          .eq("tenant_id", tenantId);
      }

      // Also keep public.tenants table in sync if logo, name, or custom_domain changed
      if (updated.logo_url || updated.business_name || updates.custom_domain !== undefined) {
        await supabase
          .from("tenants")
          .update({
            ...(updated.logo_url ? { logo_url: updated.logo_url } : {}),
            ...(updated.business_name ? { name: updated.business_name } : {}),
            ...(updates.custom_domain !== undefined ? { custom_domain: updates.custom_domain } : {}),
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
    },
    actor?: AuditActor | null
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
          actorId: actor?.id,
          actorName: actor?.name,
          actorEmail: actor?.email,
          actorRole: actor?.role,
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
   * Get Delivery Zones for Tenant
   */
  static async getDeliveryZones(
    tenantId: string,
    includeInactive = false
  ): Promise<DeliveryZone[]> {
    const supabase = getSupabase();
    if (supabase) {
      let query = supabase
        .from("delivery_zones")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true });

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data as DeliveryZone[];
      }
    }

    return state.deliveryZones
      .filter((z) => z.tenant_id === tenantId && (includeInactive || z.is_active))
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  /**
   * Create a new delivery zone
   */
  static async createDeliveryZone(
    input: CreateDeliveryZoneInput
  ): Promise<DeliveryZone> {
    const supabase = getSupabase();
    const id = generateUuid();
    const now = new Date().toISOString();
    const sortOrder =
      input.sortOrder !== undefined
        ? input.sortOrder
        : state.deliveryZones.filter((z) => z.tenant_id === input.tenantId).length + 1;

    const newZone: DeliveryZone = {
      id,
      tenant_id: input.tenantId,
      name: input.name.trim(),
      price_usd: Math.max(0, Number(input.priceUsd)),
      estimated_time: input.estimatedTime?.trim() || "30-45 min",
      coverage_description: input.coverageDescription?.trim() || null,
      is_active: input.isActive !== undefined ? input.isActive : true,
      sort_order: sortOrder,
      created_at: now,
      updated_at: now,
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("delivery_zones")
          .insert({
            id: newZone.id,
            tenant_id: newZone.tenant_id,
            name: newZone.name,
            price_usd: newZone.price_usd,
            estimated_time: newZone.estimated_time,
            coverage_description: newZone.coverage_description,
            is_active: newZone.is_active,
            sort_order: newZone.sort_order,
          })
          .select("*")
          .single();

        if (!error && data) {
          state.deliveryZones.push(data as DeliveryZone);
          return data as DeliveryZone;
        }
      } catch (e) {
        console.warn("[Supabase] createDeliveryZone fallback:", e);
      }
    }

    state.deliveryZones.push(newZone);
    return newZone;
  }

  /**
   * Update an existing delivery zone
   */
  static async updateDeliveryZone(
    input: UpdateDeliveryZoneInput
  ): Promise<DeliveryZone | null> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const updates: any = { updated_at: now };
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.priceUsd !== undefined) updates.price_usd = Math.max(0, Number(input.priceUsd));
    if (input.estimatedTime !== undefined) updates.estimated_time = input.estimatedTime.trim();
    if (input.coverageDescription !== undefined)
      updates.coverage_description = input.coverageDescription ? input.coverageDescription.trim() : null;
    if (input.isActive !== undefined) updates.is_active = input.isActive;
    if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("delivery_zones")
          .update(updates)
          .eq("id", input.zoneId)
          .eq("tenant_id", input.tenantId)
          .select("*")
          .single();

        if (!error && data) {
          const idx = state.deliveryZones.findIndex((z) => z.id === input.zoneId);
          if (idx !== -1) {
            state.deliveryZones[idx] = data as DeliveryZone;
          }
          return data as DeliveryZone;
        }
      } catch (e) {
        console.warn("[Supabase] updateDeliveryZone fallback:", e);
      }
    }

    const idx = state.deliveryZones.findIndex(
      (z) => z.id === input.zoneId && z.tenant_id === input.tenantId
    );
    if (idx !== -1) {
      const existing = state.deliveryZones[idx];
      const updated: DeliveryZone = {
        ...existing,
        ...updates,
        updated_at: now,
      };
      state.deliveryZones[idx] = updated;
      return updated;
    }

    return null;
  }

  /**
   * Toggle status (Soft delete / reactivate) of a delivery zone
   */
  static async toggleDeliveryZoneStatus(
    tenantId: string,
    zoneId: string,
    isActive: boolean
  ): Promise<boolean> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    if (supabase) {
      try {
        const { error } = await supabase
          .from("delivery_zones")
          .update({ is_active: isActive, updated_at: now })
          .eq("id", zoneId)
          .eq("tenant_id", tenantId);

        if (!error) {
          const zone = state.deliveryZones.find((z) => z.id === zoneId);
          if (zone) zone.is_active = isActive;
          return true;
        }
      } catch (e) {
        console.warn("[Supabase] toggleDeliveryZoneStatus fallback:", e);
      }
    }

    const zone = state.deliveryZones.find(
      (z) => z.id === zoneId && z.tenant_id === tenantId
    );
    if (zone) {
      zone.is_active = isActive;
      return true;
    }
    return false;
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
  static async getDrivers(
    tenantId: string,
    includeInactive = false
  ): Promise<Driver[]> {
    const supabase = getSupabase();
    if (supabase) {
      let query = supabase
        .from("drivers")
        .select("*")
        .eq("tenant_id", tenantId);

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data as Driver[];
      }
    }

    return state.drivers.filter(
      (d) => d.tenant_id === tenantId && (includeInactive || d.is_active)
    );
  }

  /**
   * Create a new driver
   */
  static async createDriver(input: CreateDriverInput): Promise<Driver> {
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
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const updates: any = { updated_at: now };
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.phone !== undefined) updates.phone = input.phone.trim();
    if (input.vehicleType !== undefined) updates.vehicle_type = input.vehicleType;
    if (input.plateNumber !== undefined)
      updates.plate_number = input.plateNumber ? input.plateNumber.trim() : null;
    if (input.storeId !== undefined) updates.store_id = input.storeId;
    if (input.isActive !== undefined) updates.is_active = input.isActive;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("drivers")
          .update(updates)
          .eq("id", input.driverId)
          .eq("tenant_id", input.tenantId)
          .select("*")
          .single();

        if (!error && data) {
          const idx = state.drivers.findIndex((d) => d.id === input.driverId);
          if (idx !== -1) {
            state.drivers[idx] = data as Driver;
          }
          return data as Driver;
        }
      } catch (e) {
        console.warn("[Supabase] updateDriver fallback:", e);
      }
    }

    const idx = state.drivers.findIndex(
      (d) => d.id === input.driverId && d.tenant_id === input.tenantId
    );
    if (idx !== -1) {
      const existing = state.drivers[idx];
      const updated: Driver = {
        ...existing,
        ...updates,
        updated_at: now,
      };
      state.drivers[idx] = updated;
      return updated;
    }

    return null;
  }

  /**
   * Toggle status (Soft delete / reactivate) of a driver
   */
  static async toggleDriverStatus(
    tenantId: string,
    driverId: string,
    isActive: boolean
  ): Promise<boolean> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    if (supabase) {
      try {
        const { error } = await supabase
          .from("drivers")
          .update({ is_active: isActive, updated_at: now })
          .eq("id", driverId)
          .eq("tenant_id", tenantId);

        if (!error) {
          const driver = state.drivers.find((d) => d.id === driverId);
          if (driver) driver.is_active = isActive;
          return true;
        }
      } catch (e) {
        console.warn("[Supabase] toggleDriverStatus fallback:", e);
      }
    }

    const driver = state.drivers.find(
      (d) => d.id === driverId && d.tenant_id === tenantId
    );
    if (driver) {
      driver.is_active = isActive;
      return true;
    }
    return false;
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

    // Ensure valid store UUID
    let validStoreId = input.storeId;
    if (!isUuid(validStoreId)) {
      const stores = await this.getStores(input.tenantId);
      validStoreId = stores[0]?.id || "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
    }

    const validDeliveryZoneId =
      input.deliveryType === "DELIVERY" && isUuid(input.deliveryZoneId)
        ? input.deliveryZoneId
        : null;

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

    const newOrder: Order = {
      id: generateUuid(),
      tenant_id: input.tenantId,
      store_id: validStoreId,
      customer_id: customerId,
      order_number: orderNumber,
      status: "PAYMENT_PENDING",
      delivery_type: input.deliveryType,
      delivery_zone_id: validDeliveryZoneId,
      delivery_address: input.deliveryAddress || null,
      delivery_fee_usd: deliveryFeeUsd,
      coupon_id: validCouponId,
      discount_usd: discountUsd,
      total_usd: finalTotalUsd,
      total_ves: totalVes,
      exchange_rate_applied: rate.value,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_id_number: input.customerIdNumber || null,
      customer_email: input.customerEmail || null,
      items: input.items.map((it, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        order_id: `ord-${Date.now()}`,
        tenant_id: input.tenantId,
        product_id: it.productId,
        product_name: it.productName,
        quantity: it.quantity,
        unit_price_usd: it.unitPriceUsd,
        total_price_usd: Number((it.quantity * it.unitPriceUsd).toFixed(2)),
      })),
    };

    // 6. Insert Order into Supabase
    if (supabase) {
      try {
        const { data: insertedOrder, error: orderInsertErr } = await supabase
          .from("orders")
          .insert({
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
            notes: newOrder.notes,
          })
          .select("id")
          .single();

        if (orderInsertErr) {
          console.error("[MarketOS] Failed to insert order into Supabase:", orderInsertErr);
        } else if (insertedOrder && isUuid(insertedOrder.id)) {
          newOrder.id = insertedOrder.id;
          newOrder.items = input.items.map((it, idx) => ({
            id: `item-${insertedOrder.id}-${idx}`,
            order_id: insertedOrder.id,
            tenant_id: input.tenantId,
            product_id: it.productId,
            product_name: it.productName,
            quantity: it.quantity,
            unit_price_usd: it.unitPriceUsd,
            total_price_usd: Number((it.quantity * it.unitPriceUsd).toFixed(2)),
          }));

          // Insert order items
          const itemsPayload = input.items.map((it) => ({
            tenant_id: input.tenantId,
            order_id: insertedOrder.id,
            product_id: isUuid(it.productId) ? it.productId : null,
            product_name: it.productName,
            quantity: it.quantity,
            unit_price_usd: it.unitPriceUsd,
            total_price_usd: Number((it.quantity * it.unitPriceUsd).toFixed(2)),
          }));

          // Resolve any non-uuid product IDs (e.g. from mock data fallback)
          for (const item of itemsPayload) {
            if (!item.product_id) {
              const { data: p } = await supabase
                .from("products")
                .select("id")
                .eq("tenant_id", input.tenantId)
                .ilike("name", item.product_name)
                .maybeSingle();
              if (p && isUuid(p.id)) {
                item.product_id = p.id;
              }
            }
          }

          const { error: itemsInsertErr } = await supabase.from("order_items").insert(itemsPayload);
          if (itemsInsertErr) {
            console.error("[MarketOS] Error inserting order_items in Supabase:", itemsInsertErr);
          }

          // Decrement inventory stock & record inventory movements in Supabase
          for (const item of input.items) {
            const targetProductId = isUuid(item.productId)
              ? item.productId
              : itemsPayload.find((p) => p.product_name === item.productName)?.product_id;

            if (targetProductId) {
              const { data: inv } = await supabase
                .from("inventory")
                .select("id, quantity")
                .eq("store_id", validStoreId)
                .eq("product_id", targetProductId)
                .maybeSingle();

              if (inv) {
                const newQty = Math.max(0, inv.quantity - item.quantity);
                await supabase
                  .from("inventory")
                  .update({ quantity: newQty, updated_at: new Date().toISOString() })
                  .eq("id", inv.id);

                await supabase.from("inventory_movements").insert({
                  tenant_id: input.tenantId,
                  store_id: validStoreId,
                  product_id: targetProductId,
                  quantity_change: -item.quantity,
                  previous_quantity: inv.quantity,
                  new_quantity: newQty,
                  reason: "SALE",
                });
              }
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
        currency: input.currency || "VES",
      },
    });

    return payment;
  }

  /**
   * Get Orders for Tenant Admin with full enrichment (items, customer, payment details)
   */
  static async getTenantOrders(tenantId: string): Promise<Order[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: rawOrders, error } = await supabase
          .from("orders")
          .select("*")
          .eq("tenant_id", tenantId)
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
            } as Order;
          });
        }
      } catch (err) {
        console.warn("[MarketOS] getTenantOrders Supabase error:", err);
      }
    }

    // In-memory fallback enriched with payments and stores
    return state.orders
      .filter((o) => o.tenant_id === tenantId)
      .map((o) => {
        const pay = state.payments.find((p) => p.order_id === o.id);
        const cust = state.customers.find((c) => c.id === o.customer_id);
        const st = state.stores.find((s) => s.id === o.store_id);
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
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (!error && data) {
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
    actor?: AuditActor | string | null
  ): Promise<PaymentProof | null> {
    const actorObj: AuditActor =
      typeof actor === "string"
        ? { id: actor, name: "Admin Operativo", email: null, role: "ADMIN" }
        : actor || { id: null, name: "Admin Operativo", email: null, role: "ADMIN" };

    const supabase = getSupabase();
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

          let fiscalPayload: Record<string, any> = {};
          if (status === "APPROVED") {
            try {
              const settings = await MarketOSRepository.getTenantSettings(tenantId);
              if (settings?.billing_settings?.fiscal_billing_enabled) {
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
                const rif = settings.billing_settings.emitter_fiscal_data?.rif || "J-50123456-7";

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
          const settings = state.settings.find((s) => s.tenant_id === tenantId);
          if (settings?.billing_settings?.fiscal_billing_enabled) {
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
            const rif = settings.billing_settings.emitter_fiscal_data?.rif || "J-50123456-7";

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

    return payment || null;
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
          .maybeSingle();

        const storeId = ord?.store_id;
        const targetTenantId = ord?.tenant_id || tenantId;

        const { data: items } = await supabase
          .from("order_items")
          .select("product_id, quantity, product_name")
          .eq("order_id", orderId);

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

    if (supabase) {
      try {
        const updateData: Record<string, unknown> = {
          status,
          updated_at: new Date().toISOString(),
        };
        if (driverId) updateData.driver_id = driverId;

        const { data: ordRow } = await supabase
          .from("orders")
          .select("order_number, customer_name, customer_phone, total_usd")
          .eq("id", orderId)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (ordRow) {
          orderNum = ordRow.order_number || "";
          custName = ordRow.customer_name || "";
          custPhone = ordRow.customer_phone || "";
          totalUsd = Number(ordRow.total_usd || 0);
        }

        await supabase
          .from("orders")
          .update(updateData)
          .eq("id", orderId)
          .eq("tenant_id", tenantId);

        if (status === "CANCELLED") {
          await MarketOSRepository.restoreOrderInventoryStock(tenantId, orderId);
        }
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

      if (!orderNum && order.order_number) orderNum = order.order_number;
      if (!custName && order.customer_name) custName = order.customer_name;
      if (!custPhone && order.customer_phone) custPhone = order.customer_phone;
      if (!totalUsd && order.total_usd) totalUsd = order.total_usd;

      if (status === "CANCELLED" && oldStatus !== "CANCELLED") {
        await MarketOSRepository.restoreOrderInventoryStock(tenantId, orderId);
      }

      const isCancellation = status === "CANCELLED";

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
    const tenantName =
      input.tenantName ||
      state.tenants.find((t) => t.id === input.tenantId)?.name ||
      (input.tenantId === "platform" ? "Plataforma Central" : undefined);

    const actorDetails = {
      id: input.actorId || null,
      name: input.actorName || "Admin Operativo",
      email: input.actorEmail || null,
      role: input.actorRole || "OPERATOR",
    };

    const enrichedNewData: Record<string, unknown> = {
      ...(input.newData || {}),
      _actor: actorDetails,
      ...(tenantName ? { _tenant_name: tenantName } : {}),
    };

    const auditLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: input.tenantId,
      tenant_name: tenantName || null,
      actor_id: input.actorId || null,
      actor_name: input.actorName || "Admin Operativo",
      actor_email: input.actorEmail || null,
      actor_role: input.actorRole || "OPERATOR",
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId,
      old_data: input.oldData || null,
      new_data: enrichedNewData,
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const actorUuid = input.actorId && isUuid(input.actorId) ? input.actorId : null;
        const insertPayload: Record<string, unknown> = {
          tenant_id: auditLog.tenant_id,
          action: auditLog.action,
          entity: auditLog.entity,
          entity_id: auditLog.entity_id,
          old_data: auditLog.old_data,
          new_data: enrichedNewData,
          actor_id: actorUuid,
        };
        if (input.actorName) insertPayload.actor_name = input.actorName;
        if (input.actorEmail) insertPayload.actor_email = input.actorEmail;
        if (input.actorRole) insertPayload.actor_role = input.actorRole;
        if (tenantName) insertPayload.tenant_name = tenantName;

        const { error: insertErr } = await supabase.from("audit_logs").insert(insertPayload);
        if (insertErr) {
          // Fallback to base columns if schema hasn't reloaded
          await supabase.from("audit_logs").insert({
            tenant_id: auditLog.tenant_id,
            action: auditLog.action,
            entity: auditLog.entity,
            entity_id: auditLog.entity_id,
            old_data: auditLog.old_data,
            new_data: enrichedNewData,
            actor_id: actorUuid,
          });
        }
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
    return MarketOSRepository.getGlobalAuditLogs({ tenantId, limit });
  }

  /**
   * Get Global Audit Logs across all tenants (Super Admin) or with filters
   */
  static async getGlobalAuditLogs(filters?: AuditLogFilters): Promise<AuditLog[]> {
    const limit = filters?.limit || 100;
    const supabase = getSupabase();

    const tenantMap = new Map<string, string>();
    state.tenants.forEach((t) => tenantMap.set(t.id, t.name));

    if (supabase) {
      try {
        let query = supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (filters?.tenantId && filters.tenantId !== "ALL") {
          query = query.eq("tenant_id", filters.tenantId);
        }
        if (filters?.action && filters.action !== "ALL") {
          query = query.eq("action", filters.action);
        }
        if (filters?.actorId) {
          query = query.eq("actor_id", filters.actorId);
        }
        if (filters?.startDate) {
          query = query.gte("created_at", filters.startDate);
        }
        if (filters?.endDate) {
          query = query.lte("created_at", filters.endDate);
        }

        const { data, error } = await query;

        if (!error && data && data.length > 0) {
          const mapped: AuditLog[] = data.map((d: any) => {
            const actorFromMeta =
              (d.new_data && typeof d.new_data === "object" && d.new_data._actor) || {};
            const tName =
              d.tenant_name ||
              (d.new_data && d.new_data._tenant_name) ||
              tenantMap.get(d.tenant_id) ||
              (d.tenant_id === "platform" ? "Plataforma Central" : "Tienda");

            return {
              id: d.id,
              tenant_id: d.tenant_id,
              tenant_name: tName,
              actor_id: d.actor_id || actorFromMeta.id || null,
              actor_name: d.actor_name || actorFromMeta.name || "Admin Operativo",
              actor_email: d.actor_email || actorFromMeta.email || null,
              actor_role: d.actor_role || actorFromMeta.role || null,
              action: d.action,
              entity: d.entity,
              entity_id: d.entity_id,
              old_data: d.old_data,
              new_data: d.new_data,
              created_at: d.created_at,
            };
          });

          if (filters?.search && filters.search.trim()) {
            const term = filters.search.trim().toLowerCase();
            return mapped.filter(
              (l) =>
                (l.actor_name && l.actor_name.toLowerCase().includes(term)) ||
                (l.actor_email && l.actor_email.toLowerCase().includes(term)) ||
                (l.action && l.action.toLowerCase().includes(term)) ||
                (l.entity_id && l.entity_id.toLowerCase().includes(term)) ||
                (l.tenant_name && l.tenant_name.toLowerCase().includes(term)) ||
                JSON.stringify(l.new_data || {}).toLowerCase().includes(term)
            );
          }

          return mapped;
        }
      } catch (e) {
        console.warn("[MarketOS] Error fetching global audit logs from Supabase:", e);
      }
    }

    // Fallback to in-memory state
    let results = [...state.auditLogs];

    if (filters?.tenantId && filters.tenantId !== "ALL") {
      results = results.filter((l) => l.tenant_id === filters.tenantId);
    }
    if (filters?.action && filters.action !== "ALL") {
      results = results.filter((l) => l.action === filters.action);
    }
    if (filters?.actorId) {
      results = results.filter((l) => l.actor_id === filters.actorId);
    }
    if (filters?.startDate) {
      results = results.filter((l) => l.created_at >= filters.startDate!);
    }
    if (filters?.endDate) {
      results = results.filter((l) => l.created_at <= filters.endDate!);
    }
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      results = results.filter(
        (l) =>
          (l.actor_name && l.actor_name.toLowerCase().includes(term)) ||
          (l.actor_email && l.actor_email.toLowerCase().includes(term)) ||
          (l.action && l.action.toLowerCase().includes(term)) ||
          (l.entity_id && l.entity_id.toLowerCase().includes(term)) ||
          (tenantMap.get(l.tenant_id) &&
            tenantMap.get(l.tenant_id)!.toLowerCase().includes(term)) ||
          JSON.stringify(l.new_data || {}).toLowerCase().includes(term)
      );
    }

    return results.slice(0, limit).map((l) => ({
      ...l,
      tenant_name:
        l.tenant_name ||
        tenantMap.get(l.tenant_id) ||
        (l.tenant_id === "platform" ? "Plataforma Central" : "Tienda"),
    }));
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

      // Check if price changed -> record surgical PRICE_CHANGED audit event
      if (
        input.priceUsd !== undefined &&
        oldData.price_usd !== undefined &&
        Number(input.priceUsd) !== Number(oldData.price_usd)
      ) {
        const oP = Number(oldData.price_usd);
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
            name: prod.name,
          },
          newData: {
            price_usd: nP,
            price_formatted: `$${nP.toFixed(2)}`,
            diff_usd: diff,
            percentage_change: pct,
            name: prod.name,
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
  static async deleteProduct(
    tenantId: string,
    productId: string,
    actor?: AuditActor | null
  ): Promise<boolean> {
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
        actorId: actor?.id,
        actorName: actor?.name,
        actorEmail: actor?.email,
        actorRole: actor?.role,
        action: "PRODUCT_DELETED",
        entity: "products",
        entityId: productId,
        newData: { is_active: false, name: prod.name },
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
}
