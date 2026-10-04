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

export class MarketOSRepository {
  /**
   * Fetch Tenant by ID or Slug
   */
  static async getTenant(tenantIdOrSlug: string): Promise<Tenant | null> {
    const tenant = state.tenants.find(
      (t) => t.id === tenantIdOrSlug || t.slug === tenantIdOrSlug
    );
    return tenant || INITIAL_TENANT;
  }

  /**
   * Fetch Tenant Customization & Branding Settings
   */
  static async getTenantSettings(tenantId: string): Promise<TenantSettings> {
    const settings = state.settings.find((s) => s.tenant_id === tenantId);
    return settings || INITIAL_SETTINGS;
  }

  /**
   * Get Stores for Tenant
   */
  static async getStores(tenantId: string): Promise<Store[]> {
    return state.stores.filter((s) => s.tenant_id === tenantId && s.is_active);
  }

  /**
   * Get Categories for Tenant
   */
  static async getCategories(tenantId: string): Promise<Category[]> {
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
    return state.products.filter((p) => {
      if (p.tenant_id !== tenantId || !p.is_active) return false;
      if (categoryId && p.category_id !== categoryId) return false;
      if (query && !p.name.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });
  }

  /**
   * Get Real-time BCV Exchange Rate for Tenant (from bcv.today or cache/fallback)
   */
  static async getExchangeRate(tenantId: string): Promise<ExchangeRate> {
    try {
      const bcv = await fetchBcvRate();
      const updatedRate: ExchangeRate = {
        id: `rate-${tenantId}-${Date.now()}`,
        tenant_id: tenantId,
        currency: "VES",
        value: bcv.usdRate,
        source: "https://bcv.today/api/",
        updated_at: bcv.timestamp,
      };
      // Cache in runtime state
      const existingIdx = state.rates.findIndex((r) => r.tenant_id === tenantId);
      if (existingIdx >= 0) {
        state.rates[existingIdx] = updatedRate;
      } else {
        state.rates.push(updatedRate);
      }
      return updatedRate;
    } catch {
      const fallback = state.rates.find((r) => r.tenant_id === tenantId) || {
        id: "rate-fallback",
        tenant_id: tenantId,
        currency: "VES",
        value: 45.2,
        source: "fallback",
        updated_at: new Date().toISOString(),
      };
      return fallback;
    }
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
    return state.orders.filter((o) => o.tenant_id === tenantId);
  }

  /**
   * Get Payments for Tenant Admin
   */
  static async getTenantPayments(tenantId: string): Promise<PaymentProof[]> {
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
