/**
 * MarketOS Hexagonal Architecture — Core Ports & Contracts
 * Pure abstract interfaces that decouple Core business logic from external Adapters/Plugins.
 */

import type { CurrencyCode, Order, OrderItem } from "./index.ts";

// ─── 1. PAYMENT PORT ────────────────────────────────────────────────────────
export interface PaymentProcessInput {
  orderId: string;
  tenantId: string;
  storeId: string;
  amount: number;
  currency: CurrencyCode;
  paymentMethod: string;
  referenceNumber?: string;
  proofUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentProcessResult {
  success: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED";
  transactionId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentPort {
  readonly providerId: string;
  processPayment(input: PaymentProcessInput): Promise<PaymentProcessResult>;
  verifyPayment?(transactionId: string): Promise<PaymentProcessResult>;
}

// ─── 2. EXCHANGE RATE PORT ──────────────────────────────────────────────────
export interface ExchangeRateResult {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  source: string;
  updatedAt: string;
  isCached?: boolean;
}

export interface ExchangeRatePort {
  readonly providerId: string;
  getRate(from: CurrencyCode, to: CurrencyCode, tenantId?: string): Promise<ExchangeRateResult>;
}

// ─── 3. INVENTORY PORT ──────────────────────────────────────────────────────
export interface InventoryDeductInput {
  orderId: string;
  tenantId: string;
  storeId: string;
  items: Array<{
    productId: string;
    quantity: number;
    selectedModifiers?: Array<{
      groupName: string;
      optionName: string;
      rawMaterialId?: string;
      quantity?: number;
    }>;
  }>;
}

export interface InventoryDeductResult {
  success: boolean;
  deductedItemsCount: number;
  warnings?: string[];
}

export interface InventoryRestoreInput {
  orderId: string;
  tenantId: string;
  storeId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface InventoryPort {
  readonly strategyId: string;
  deductStock(input: InventoryDeductInput): Promise<InventoryDeductResult>;
  restoreStock(input: InventoryRestoreInput): Promise<void>;
}

// ─── 4. NOTIFICATION PORT ───────────────────────────────────────────────────
export interface NotificationPayload {
  order: Order;
  recipientPhone: string;
  recipientName?: string;
  channel: "WHATSAPP" | "SMS" | "EMAIL";
  templateType: "ORDER_CREATED" | "ORDER_CONFIRMED" | "ORDER_DISPATCHED" | "ORDER_READY";
}

export interface NotificationResult {
  delivered: boolean;
  channel: string;
  externalMessageId?: string;
  directUrl?: string; // e.g. wa.me link
}

export interface NotificationPort {
  readonly channelId: string;
  sendNotification(payload: NotificationPayload): Promise<NotificationResult>;
}
