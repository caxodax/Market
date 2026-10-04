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
  created_at: string;
  updated_at: string;
}

export interface TenantSettings {
  tenant_id: string;
  business_name: string;
  category: string;
  primary_color: string; // e.g. '#DC2626' (Shop Market Red)
  secondary_color: string; // e.g. '#09090B' (Shop Market Black)
  accent_color: string; // e.g. '#FFFFFF' (Shop Market White)
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
  source: string; // e.g. "bcv.today" | "manual"
  updated_at: string;
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
  email: string | null;
  is_guest: boolean;
  addresses?: CustomerAddress[];
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  tenant_id: string;
  label: string; // "Casa", "Trabajo", etc.
  address_line: string;
  city: string;
  state: string;
  reference_point?: string;
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
  total_usd: number;
  total_ves: number;
  exchange_rate_applied: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
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
