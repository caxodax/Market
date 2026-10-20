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
  convertUnitQuantity,
} from "@marketos/types";

import { state, INITIAL_SETTINGS, INITIAL_TENANT } from "./mock-data";
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
        storefront_config: updated.storefront_config,
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
        delete (safePayload as any).storefront_config;
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
          const rate: ExchangeRate = {
            id: data.id,
            tenant_id: data.tenant_id,
            currency: data.currency,
            value: Number(data.value),
            eur_value: data.eur_value ? Number(data.eur_value) : undefined,
            usdt_value: data.usdt_value ? Number(data.usdt_value) : undefined,
            source: data.source,
            updated_at: data.updated_at,
          };

          // If eur_value or usdt_value are missing (since exchange_rates table only stores USD value),
          // hydrate them seamlessly from the latest record in exchange_rate_history
          if (!rate.eur_value || !rate.usdt_value) {
            try {
              const { data: hist } = await supabase
                .from("exchange_rate_history")
                .select("rate_eur, usdt_promedio")
                .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
                .order("date_rate", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (hist) {
                if (hist.rate_eur && !rate.eur_value) rate.eur_value = Number(hist.rate_eur);
                if (hist.usdt_promedio && !rate.usdt_value) rate.usdt_value = Number(hist.usdt_promedio);
              }
            } catch {
              // Non-blocking fallback
            }
          }

          return rate;
        }

        // Fallback: read directly from latest database history (0 external API calls)
        const { data: latestHist } = await supabase
          .from("exchange_rate_history")
          .select("*")
          .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
          .order("date_rate", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestHist) {
          return {
            id: latestHist.id,
            tenant_id: tenantId,
            currency: "VES",
            value: Number(latestHist.rate),
            eur_value: latestHist.rate_eur ? Number(latestHist.rate_eur) : undefined,
            usdt_value: latestHist.usdt_promedio ? Number(latestHist.usdt_promedio) : undefined,
            source: latestHist.source,
            updated_at: latestHist.created_at || new Date().toISOString(),
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

        // exchange_rates table strictly has (id, tenant_id, currency, value, source, updated_at)
        const ratePayload = {
          value: bcv.usdRate,
          source: bcv.source,
          updated_at: bcv.timestamp,
        };

        if (existing) {
          const { error: updateErr } = await supabase
            .from("exchange_rates")
            .update(ratePayload)
            .eq("id", existing.id);
          if (updateErr) {
            console.error("[MarketOS] Error updating exchange_rates:", updateErr);
          }
        } else {
          const { error: insertErr } = await supabase.from("exchange_rates").insert({
            tenant_id: tenantId,
            currency: "VES",
            ...ratePayload,
          });
          if (insertErr) {
            console.error("[MarketOS] Error inserting exchange_rates:", insertErr);
          }
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

        // exchange_rates table strictly has (id, tenant_id, currency, value, source, updated_at)
        const ratePayload = {
          value: data.usd_rate,
          source,
          updated_at: nowIso,
        };

        if (existing) {
          const { error: updateErr } = await supabase
            .from("exchange_rates")
            .update(ratePayload)
            .eq("id", existing.id);
          if (updateErr) {
            console.error("[MarketOS] Error updating manual exchange_rates:", updateErr);
          }
        } else {
          const { error: insertErr } = await supabase.from("exchange_rates").insert({
            tenant_id: tenantId,
            currency: "VES",
            ...ratePayload,
          });
          if (insertErr) {
            console.error("[MarketOS] Error inserting manual exchange_rates:", insertErr);
          }
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
          console.warn("[MarketOS] Could not count customer coupon orders in Supabase:", e);
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

              // Pre-order stock verification
              const invForStore = Array.isArray(dbProd.inventory)
                ? dbProd.inventory.find((inv: any) => inv.store_id === validStoreId)
                : null;
              const currentStock = invForStore?.quantity ?? 0;

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

    // 3. Validate and apply coupon discount if present
    let discountUsd = 0;
    let couponId: string | null = null;
    if (input.couponCode) {
      const couponRes = await this.validateCoupon(
        input.tenantId,
        input.couponCode,
        subtotalUsd,
        input.customerPhone
      );
      if (couponRes.valid) {
        discountUsd = couponRes.discountUsd;
        couponId = couponRes.coupon?.id || null;
      }
    } else if (input.discountUsd) {
      discountUsd = input.discountUsd;
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
    if (deliveryFeeUsd > 0) {
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
            cash_tendered_usd: newOrder.cash_tendered_usd,
            change_required_usd: newOrder.change_required_usd,
          })
          .select("id")
          .single();

        if (orderInsertErr) {
          console.error("[MarketOS] Failed to insert order into Supabase:", orderInsertErr);
        } else if (insertedOrder && isUuid(insertedOrder.id)) {
          newOrder.id = insertedOrder.id;
          newOrder.items = validatedItems.map((it, idx) => ({
            id: `item-${insertedOrder.id}-${idx}`,
            order_id: insertedOrder.id,
            tenant_id: input.tenantId,
            product_id: it.productId,
            product_name: it.productName,
            quantity: it.quantity,
            unit_price_usd: it.unitPriceUsd,
            total_price_usd: Number((it.quantity * it.unitPriceUsd).toFixed(2)),
            selected_modifiers: it.selected_modifiers || [],
          }));

          // Insert order items
          const itemsPayload = validatedItems.map((it) => ({
            tenant_id: input.tenantId,
            order_id: insertedOrder.id,
            product_id: isUuid(it.productId) ? it.productId : null,
            product_name: it.productName,
            quantity: it.quantity,
            unit_price_usd: it.unitPriceUsd,
            total_price_usd: Number((it.quantity * it.unitPriceUsd).toFixed(2)),
            selected_modifiers: it.selected_modifiers || [],
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
          for (const item of validatedItems) {
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
        if (order.coupon_id) {
          const memCoupon = state.coupons.find((c) => c.id === order.coupon_id);
          if (memCoupon && memCoupon.usage_count > 0) {
            memCoupon.usage_count -= 1;
          }
        }
      }

      if (status === "PREPARING" && oldStatus !== "PREPARING") {
        await MarketOSRepository.deductRecipeInventoryForOrder(order);
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

        // Fetch official BCV rate for new tenant only if local_venezuela is active
        const activeMods = await this.getTenantActiveModuleIds(tenantId);
        if (activeMods.includes("local_venezuela")) {
          await this.syncBcvRateFromApi(tenantId);
        }
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
      is_tax_exempt: Boolean(input.isTaxExempt),
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
            is_tax_exempt: Boolean(input.isTaxExempt),
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
        if (input.isTaxExempt !== undefined) updatePayload.is_tax_exempt = input.isTaxExempt;

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
      if (input.isTaxExempt !== undefined) prod.is_tax_exempt = input.isTaxExempt;
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

        if (!error && data) {
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

