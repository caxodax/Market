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
} from "@marketos/types";
import { state, INITIAL_SETTINGS, INITIAL_TENANT } from "./mock-data";
import { fetchBcvRate, convertUsdToVes } from "@marketos/utils";
import { createServerComponentClient } from "./server";

export interface CreateOrderInput {
  tenantId: string;
  storeId: string;
  customerName: string;
  customerPhone: string;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
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
        return data as TenantSettings;
      }
    }

    const settings = state.settings.find((s) => s.tenant_id === tenantId);
    return settings || INITIAL_SETTINGS;
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
   * Get Exchange Rate for Tenant - Reads strictly from Database / Redis
   * Zero external API calls during customer navigation!
   */
  static async getExchangeRate(tenantId: string): Promise<ExchangeRate> {
    const supabase = getSupabase();
    if (supabase) {
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
          source: data.source,
          updated_at: data.updated_at,
        };
      }
    }

    const fallback = state.rates.find((r) => r.tenant_id === tenantId) || {
      id: "rate-fallback",
      tenant_id: tenantId,
      currency: "VES",
      value: 866.56,
      source: "database",
      updated_at: new Date().toISOString(),
    };
    return fallback;
  }

  /**
   * Synchronize Official BCV Rate from API into Supabase Database
   * Executed via scheduled cron (e.g. daily at 5:00 PM) or manual Admin trigger
   */
  static async syncBcvRateFromApi(tenantId: string): Promise<ExchangeRate> {
    const bcv = await fetchBcvRate();
    const supabase = getSupabase();

    if (supabase) {
      try {
        await supabase
          .from("exchange_rates")
          .upsert(
            {
              tenant_id: tenantId,
              currency: "VES",
              value: bcv.usdRate,
              source: bcv.source,
              updated_at: bcv.timestamp,
            },
            { onConflict: "tenant_id" }
          );
      } catch (e) {
        console.warn("[MarketOS] Error updating exchange rate in Supabase:", e);
      }
    }

    const updatedRate: ExchangeRate = {
      id: `rate-${tenantId}`,
      tenant_id: tenantId,
      currency: "VES",
      value: bcv.usdRate,
      source: bcv.source,
      updated_at: bcv.timestamp,
    };

    const existingIdx = state.rates.findIndex((r) => r.tenant_id === tenantId);
    if (existingIdx >= 0) {
      state.rates[existingIdx] = updatedRate;
    } else {
      state.rates.push(updatedRate);
    }

    return updatedRate;
  }

  /**
   * Create an Order with Multi-Tenant isolation
   */
  static async createOrder(input: CreateOrderInput): Promise<Order> {
    const rate = await this.getExchangeRate(input.tenantId);
    const totalUsd = input.items.reduce(
      (acc, item) => acc + item.unitPriceUsd * item.quantity,
      0
    );
    const totalVes = convertUsdToVes(totalUsd, rate.value);
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      tenant_id: input.tenantId,
      store_id: input.storeId,
      customer_id: `cust-${Date.now()}`,
      order_number: orderNumber,
      status: "PAYMENT_PENDING",
      delivery_type: input.deliveryType,
      delivery_address: input.deliveryAddress || null,
      total_usd: Number(totalUsd.toFixed(2)),
      total_ves: totalVes,
      exchange_rate_applied: rate.value,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("orders").insert({
          tenant_id: newOrder.tenant_id,
          store_id: newOrder.store_id,
          order_number: newOrder.order_number,
          status: newOrder.status,
          delivery_type: newOrder.delivery_type,
          delivery_address: newOrder.delivery_address,
          total_usd: newOrder.total_usd,
          total_ves: newOrder.total_ves,
          exchange_rate_applied: newOrder.exchange_rate_applied,
          notes: newOrder.notes,
        });
      } catch (e) {
        console.warn("[Supabase] Insert order fallback to state:", e);
      }
    }

    state.orders.unshift(newOrder);

    // Decrement stock in memory
    for (const item of input.items) {
      const prod = state.products.find((p) => p.id === item.productId);
      if (prod && prod.stock >= item.quantity) {
        prod.stock -= item.quantity;
      }
    }

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
      } catch (e) {
        console.warn("[Supabase] Insert payment proof fallback to state:", e);
      }
    }

    state.payments.unshift(payment);

    // Update order status
    const order = state.orders.find((o) => o.id === input.orderId);
    if (order) {
      order.status = "PAYMENT_PENDING";
      order.updated_at = new Date().toISOString();
    }

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
    rejectionReason?: string
  ): Promise<PaymentProof | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from("payments")
          .update({
            status,
            reviewed_at: new Date().toISOString(),
            rejection_reason: rejectionReason || null,
          })
          .eq("id", paymentId)
          .eq("tenant_id", tenantId);
      } catch (e) {
        console.warn("[Supabase] Update payment fallback to state:", e);
      }
    }

    const payment = state.payments.find(
      (p) => p.id === paymentId && p.tenant_id === tenantId
    );
    if (!payment) return null;

    payment.status = status;
    payment.reviewed_at = new Date().toISOString();
    if (rejectionReason) payment.rejection_reason = rejectionReason;

    // Update associated order status
    const order = state.orders.find((o) => o.id === payment.order_id);
    if (order) {
      if (status === "APPROVED") {
        order.status = "PREPARING";
      } else if (status === "REJECTED") {
        order.status = "CANCELLED";
      }
      order.updated_at = new Date().toISOString();
    }

    return payment;
  }
}
