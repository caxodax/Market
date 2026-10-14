/**
 * MarketOS Core Multi-Tenant Domain Types
 */

export type TenantStatus = "active" | "inactive" | "suspended" | "trial";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  status: TenantStatus;
  custom_domain?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentAccountSettings {
  enabled_methods: PaymentMethodType[];
  pago_movil?: {
    bank: string;
    phone: string;
    id_doc: string;
    name: string;
  };
  bank_transfer?: {
    bank: string;
    account_number: string;
    account_type: string;
    id_doc: string;
    name: string;
  };
  zelle?: {
    email: string;
    name: string;
  };
  cash_usd?: {
    instructions: string;
  };
  cash_ves?: {
    instructions: string;
  };
  pos?: {
    instructions: string;
  };
}

export interface StoreOperationalSettings {
  is_open?: boolean;
  closed_message?: string;
  schedule?: string;
  min_order_usd?: number;
  announcement_banner?: string;
  estimated_delivery_time?: string;
  custom_whatsapp_message?: string;
  show_ticket_qr?: boolean;
}

export type FiscalBillingMode = "TICKET_ONLY" | "DIGITAL_INVOICE" | "MANUAL_INVOICE";
export type FiscalTaxPayerType = "ORDINARY" | "SPECIAL";
export type FiscalProvider =
  | "THE_FACTORY_HKA"
  | "LIXIE"
  | "GURUSOFT"
  | "FACTURATECH"
  | "MANUAL_SIMULATION";

export interface FiscalEmitterData {
  rif: string; // e.g. "J-50123456-7"
  business_name: string; // Razón Social Fiscal
  fiscal_address: string; // Domicilio Fiscal
  phone?: string;
}

export interface TenantBillingSettings {
  fiscal_billing_enabled?: boolean; // Default FALSE (OFF)
  billing_mode?: FiscalBillingMode; // Default "TICKET_ONLY"
  tax_payer_type?: FiscalTaxPayerType; // Default "ORDINARY"
  apply_igtf?: boolean; // Default false (Aplica 3% si es divisa)
  default_iva_rate?: number; // Default 16.0
  fiscal_provider?: FiscalProvider; // Default "THE_FACTORY_HKA"
  emitter_fiscal_data?: FiscalEmitterData;
  provider_credentials?: {
    api_key?: string;
    token?: string;
    environment?: "SANDBOX" | "PRODUCTION";
  };
}

export interface TenantSettings {
  tenant_id: string;
  business_name: string;
  category: string;
  primary_color: string; // e.g. '#DC2626' (Shop Market Red)
  secondary_color: string; // e.g. '#09090B' (Shop Market Black)
  accent_color: string; // e.g. '#FFFFFF' (Shop Market White)
  font_family?: string; // e.g. 'Inter' | 'Poppins' | 'Montserrat' | 'Plus Jakarta Sans' | 'Roboto' | 'Outfit'
  logo_url: string | null;
  banner_url: string | null;
  phone: string;
  email: string;
  whatsapp_number: string;
  address: string;
  social_links?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };
  supported_currencies: CurrencyCode[];
  default_currency: CurrencyCode;
  payment_settings?: PaymentAccountSettings;
  operational_settings?: StoreOperationalSettings;
  billing_settings?: TenantBillingSettings;
  custom_domain?: string | null;
}

export interface Store {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  address: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CurrencyCode = "USD" | "VES" | "COP" | "EUR";

export interface ExchangeRate {
  id: string;
  tenant_id?: string | null; // null for system-wide fallback
  currency: CurrencyCode;
  value: number; // e.g. rate to USD (1 USD = X VES)
  eur_value?: number;
  usdt_value?: number;
  source: string; // e.g. "bcv.today" | "alcambio" | "manual"
  updated_at: string;
}

export interface RateHistoryItem {
  id?: string;
  tenant_id?: string | null;
  date_rate: string;
  currency: string;
  rate: number;
  rate_eur?: number;
  usdt_promedio?: number;
  source: string;
  created_at?: string;
}

export interface BcvApiResponse {
  usd?: {
    rate: number;
    updated_at: string;
  };
  eur?: {
    rate: number;
    updated_at: string;
  };
  [key: string]: unknown;
}

export type UserRole =
  | "PLATFORM_SUPER_ADMIN"
  | "TENANT_OWNER"
  | "TENANT_MANAGER"
  | "TENANT_INVENTORY"
  | "TENANT_CASHIER"
  | "TENANT_DELIVERY"
  | "CUSTOMER";

export interface UserProfile {
  id: string; // auth.users UUID
  tenant_id: string | null; // null for super-admin or cross-tenant customers
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  auth_user_id: string | null;
  tenant_id: string;
  name: string;
  phone: string;
  id_number?: string | null; // Cédula de Identidad / RIF (ej. V-12345678)
  email: string | null;
  is_guest: boolean;
  loyalty_points?: number;
  addresses?: CustomerAddress[];
  created_at: string;
  updated_at: string;
}

export interface DeliveryZone {
  id: string;
  tenant_id: string;
  name: string;
  price_usd: number;
  estimated_time: string;
  coverage_description?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  tenant_id: string;
  label: string; // "Casa", "Trabajo", etc.
  zone_id?: string | null;
  address_line: string;
  reference_point?: string | null;
  is_default: boolean;
  created_at?: string;
}

export type DiscountType = "PERCENTAGE" | "FIXED_USD";

export interface Coupon {
  id: string;
  tenant_id: string;
  code: string;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount_usd: number;
  max_discount_usd?: number | null;
  usage_limit?: number | null;
  usage_count: number;
  is_active: boolean;
  starts_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
}

export interface CreateCouponInput {
  tenantId: string;
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmountUsd?: number;
  maxDiscountUsd?: number;
  usageLimit?: number;
  startsAt?: string | null;
  expiresAt?: string | null;
}

export interface UpdateCouponInput {
  tenantId: string;
  couponId: string;
  code?: string;
  description?: string;
  discountType?: DiscountType;
  discountValue?: number;
  minOrderAmountUsd?: number;
  maxDiscountUsd?: number;
  usageLimit?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

export interface Driver {
  id: string;
  tenant_id: string;
  store_id?: string | null;
  name: string;
  phone: string;
  vehicle_type: "MOTO" | "CARRO" | "BICICLETA";
  plate_number?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface LoyaltyTransaction {
  id: string;
  tenant_id: string;
  customer_id: string;
  order_id?: string | null;
  points_change: number;
  reason: string;
  created_at: string;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  price_usd: number;
  is_active: boolean;
  external_product_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  tenant_id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  min_quantity: number;
  external_inventory_id?: string | null;
  updated_at: string;
}

export type OrderStatus =
  | "CREATED"
  | "PAYMENT_PENDING"
  | "PAYMENT_APPROVED"
  | "PREPARING"
  | "READY"
  | "DELIVERING"
  | "COMPLETED"
  | "CANCELLED";

export type DeliveryType = "PICKUP" | "DELIVERY";

export type PaymentMethodType =
  | "PAGO_MOVIL"
  | "BANK_TRANSFER"
  | "ZELLE"
  | "CASH_USD"
  | "CASH_VES"
  | "POS";

export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface OrderItem {
  id: string;
  order_id: string;
  tenant_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_usd: number;
  total_price_usd: number;
}

export interface Order {
  id: string;
  tenant_id: string;
  store_id: string;
  customer_id: string;
  order_number: string;
  status: OrderStatus;
  delivery_type: DeliveryType;
  delivery_zone_id?: string | null;
  delivery_address?: string | null;
  delivery_fee_usd?: number;
  coupon_id?: string | null;
  discount_usd?: number;
  driver_id?: string | null;
  total_usd: number;
  total_ves: number;
  exchange_rate_applied: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Enriched fields for operational visibility and reports
  items?: OrderItem[];
  customer_name?: string;
  customer_phone?: string;
  customer_id_number?: string | null; // Cédula de Identidad / RIF (ej. V-12345678)
  customer_email?: string | null;
  payment_method?: PaymentMethodType;
  payment_reference?: string;
  payment_status?: PaymentStatus;
  proof_image_url?: string | null;
  store_name?: string;
  // SENIAT Fiscal Invoice Data (Providencia 00071 & Factura Digital)
  is_fiscal_invoice?: boolean;
  fiscal_invoice_number?: string | null;
  fiscal_control_number?: string | null;
  fiscal_qr_url?: string | null;
  fiscal_cuv?: string | null;
  subtotal_exempt_usd?: number;
  subtotal_taxable_usd?: number;
  iva_amount_usd?: number;
  iva_amount_ves?: number;
  igtf_amount_usd?: number;
  igtf_amount_ves?: number;
}

export interface SalesAnalytics {
  totalRevenueUsd: number;
  totalRevenueVes: number;
  completedOrdersCount: number;
  pendingOrdersCount: number;
  cancelledOrdersCount: number;
  totalOrdersCount: number;
  averageTicketUsd: number;
  itemsSoldTotal: number;
  revenueByMethod: {
    method: PaymentMethodType;
    label: string;
    totalUsd: number;
    totalVes: number;
    count: number;
  }[];
  revenueByStatus: {
    status: OrderStatus;
    label: string;
    totalUsd: number;
    count: number;
  }[];
  topSellingProducts: {
    productId: string;
    productName: string;
    quantitySold: number;
    totalRevenueUsd: number;
  }[];
  dailySales: {
    date: string;
    totalUsd: number;
    orderCount: number;
  }[];
}

export interface PaymentProof {
  id: string;
  order_id: string;
  tenant_id: string;
  method: PaymentMethodType;
  bank_name?: string | null;
  reference_number?: string | null;
  amount: number;
  currency: CurrencyCode;
  payment_date: string;
  proof_image_url?: string | null;
  status: PaymentStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

// =====================================================================
// PHASE 3: SAAS MULTI-TENANT & SUBSCRIPTION TYPES
// =====================================================================

export type SubscriptionPlanTier = "STARTER" | "GROWTH" | "ENTERPRISE";
export type SubscriptionStatus = "active" | "trial" | "past_due" | "cancelled";

export interface SubscriptionPlan {
  id: SubscriptionPlanTier;
  name: string;
  description: string;
  price_usd_monthly: number;
  price_usd_yearly: number;
  max_stores: number;
  max_products: number;
  custom_domain_allowed: boolean;
  transaction_fee_percent: number;
  features: string[];
  is_active: boolean;
}

export interface TenantSubscription {
  id: string;
  tenant_id: string;
  plan_id: SubscriptionPlanTier;
  status: SubscriptionStatus;
  billing_cycle: "monthly" | "yearly";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at?: string;
}

export interface TenantWithDetails extends Tenant {
  settings?: TenantSettings | null;
  stores?: Store[];
  storesCount: number;
  productsCount: number;
  ordersCount: number;
  totalRevenueUsd: number;
  subscription?: TenantSubscription | null;
  plan?: SubscriptionPlan | null;
}

export interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  totalStores: number;
  totalProducts: number;
  totalOrders: number;
  totalGmvUsd: number;
  totalGmvVes: number;
  mrrUsd: number;
}

export interface OnboardTenantInput {
  name: string;
  slug: string;
  category: string;
  ownerEmail: string;
  phone: string;
  whatsapp: string;
  address: string;
  primaryColor?: string;
  secondaryColor?: string;
  planId: SubscriptionPlanTier;
  firstStoreName: string;
  firstStoreCode: string;
}

// =====================================================================
// PHASE 4: PRODUCTION HARDENING, AUDIT TRAILS & LOYALTY TYPES
// =====================================================================

export interface AuditLog {
  id: string;
  tenant_id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  action: string;
  entity: string;
  entity_id: string;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  tenant_id: string;
  store_id: string;
  product_id: string;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reason: "SALE" | "RESTOCK" | "ADJUSTMENT" | "DAMAGE";
  created_by?: string | null;
  created_at: string;
}

export interface CustomerAccountSummary {
  customer: Customer;
  orders: Order[];
  totalSpentUsd: number;
  loyaltyPoints: number;
}

export interface CreateProductInput {
  tenantId: string;
  categoryId: string;
  name: string;
  description?: string;
  priceUsd: number;
  sku?: string;
  barcode?: string;
  imageUrl?: string;
  initialStock?: number;
  storeId?: string;
}

export interface UpdateProductInput {
  tenantId: string;
  productId: string;
  name?: string;
  categoryId?: string;
  description?: string;
  priceUsd?: number;
  sku?: string;
  barcode?: string;
  imageUrl?: string;
  stock?: number;
  isActive?: boolean;
  storeId?: string;
}

export interface InviteStaffInput {
  tenantId: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
}

export interface CreatePlatformUserInput {
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string | null;
  tenantId?: string | null;
}

// ==============================================================================
// PWA & WEB PUSH NOTIFICATIONS TYPES (MULTI-TENANT)
// ==============================================================================

export interface PushSubscriptionRecord {
  id: string;
  tenant_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  customer_id?: string | null;
  user_agent?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavePushSubscriptionInput {
  tenantId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  customerId?: string | null;
  userAgent?: string | null;
}

export interface PushNotificationLog {
  id: string;
  tenant_id: string;
  title: string;
  body: string;
  url: string;
  target_type: "all" | "customers" | "with_orders" | "without_orders" | string;
  sent_count: number;
  created_by?: string | null;
  created_at: string;
}

export interface SendPushBroadcastInput {
  tenantId: string;
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  targetType?: "all" | "with_orders" | "without_orders" | string;
  createdBy?: string | null;
}

export interface PushStats {
  subscriberCount: number;
  totalSentCount: number;
  lastSentAt: string | null;
}

export interface DevicePwaStatus {
  isIos: boolean;
  isStandalone: boolean;
  hasNativePushApis: boolean;
  canSubscribePush: boolean;
}



