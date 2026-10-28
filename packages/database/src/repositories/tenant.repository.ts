import type {
  Tenant,
  TenantSettings,
  SubscriptionPlan,
  TenantSubscription,
  TenantWithDetails,
  PlatformMetrics,
  OnboardTenantInput,
  SubscriptionPlanTier,
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
  PlatformSettings,
  UpdatePlatformSettingsInput,
  AuditActor,
  DeliveryZone,
  PaymentMethodType,
  Store,
} from "@marketos/types";
import { state, INITIAL_SETTINGS, INITIAL_TENANT } from "../mock-data.ts";
import {
  scanR2PlatformStorage,
  scanR2TenantStorage,
  sanitizeSafeUrl,
  formatMediaUrl,
  getCaracasRangeBounds,
  convertUsdToVes,
  getCaracasDateKey,
} from "@marketos/utils";
import { getSupabase, isLiveDatabaseConfigured } from "./base.ts";
import { AuditRepository } from "./audit.repository.ts";
import { ExchangeRateRepository } from "./exchange-rate.repository.ts";
import { CatalogRepository } from "./catalog.repository.ts";
import { OrderRepository } from "./order.repository.ts";

export class TenantRepository {


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
    if (isLiveDatabaseConfigured()) return null;
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
      await AuditRepository.recordAuditLog({
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

      if (!error && Array.isArray(data)) {
        tenantsList = data as Tenant[];
      }
    }

    if (tenantsList.length === 0) {
      if (isLiveDatabaseConfigured()) return [];
      tenantsList = state.tenants;
    }

    const plans = await this.getSubscriptionPlans();

    return Promise.all(
      tenantsList.map(async (t) => {
        const settings = await this.getTenantSettings(t.id);
        const stores = await CatalogRepository.getStores(t.id);
        const products = await CatalogRepository.getProducts(t.id);
        const orders = await OrderRepository.getTenantOrders(t.id);

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
    const rate = await ExchangeRateRepository.getExchangeRate("shop-market-ca");

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
    const rate = await ExchangeRateRepository.getExchangeRate("shop-market-ca");
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
      const orders = await OrderRepository.getTenantOrders(t.id);

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

      if (!error && Array.isArray(data)) {
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
          await ExchangeRateRepository.syncBcvRateFromApi(tenantId);
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
      CatalogRepository.getProducts(tenantId),
      CatalogRepository.getStores(tenantId, true),
      OrderRepository.getTenantOrders(tenantId),
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
        if (!error && Array.isArray(data) && isLiveDatabaseConfigured()) {
          return [];
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
}
