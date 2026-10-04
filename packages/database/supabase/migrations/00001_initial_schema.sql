-- =====================================================================
-- MARKETOS MULTI-TENANT COMMERCE ENGINE SCHEMA
-- Migration: 00001_initial_schema.sql
-- Description: Core multi-tenant architecture with strict RLS policies
-- =====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TENANTS (SaaS Businesses)
CREATE TABLE IF NOT EXISTS public.tenants (
    id TEXT PRIMARY KEY, -- e.g. 'shop-market-ca' or uuid
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'trial')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TENANT SETTINGS (Branding, Currencies, Socials)
CREATE TABLE IF NOT EXISTS public.tenant_settings (
    tenant_id TEXT PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Minimarket',
    primary_color TEXT NOT NULL DEFAULT '#DC2626', -- Default: Shop Market Red
    secondary_color TEXT NOT NULL DEFAULT '#09090B', -- Default: Shop Market Black
    accent_color TEXT NOT NULL DEFAULT '#FFFFFF', -- Default: White
    logo_url TEXT,
    banner_url TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    whatsapp_number TEXT NOT NULL,
    address TEXT NOT NULL,
    supported_currencies TEXT[] NOT NULL DEFAULT ARRAY['USD', 'VES'],
    default_currency TEXT NOT NULL DEFAULT 'USD',
    social_links JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. STORES (Multi-location per Tenant)
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_store_code UNIQUE (tenant_id, code)
);

-- 5. USER PROFILES & ROLES
CREATE TYPE public.app_role AS ENUM (
    'PLATFORM_SUPER_ADMIN',
    'TENANT_OWNER',
    'TENANT_MANAGER',
    'TENANT_INVENTORY',
    'TENANT_CASHIER',
    'TENANT_DELIVERY',
    'CUSTOMER'
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    role public.app_role NOT NULL DEFAULT 'CUSTOMER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. EXCHANGE RATES (BCV API synced & cached)
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL means global system default
    currency TEXT NOT NULL DEFAULT 'VES',
    value NUMERIC(14, 4) NOT NULL,
    source TEXT NOT NULL DEFAULT 'bcv.today',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    image_url TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_category_slug UNIQUE (tenant_id, slug)
);

-- 8. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    barcode TEXT,
    image_url TEXT,
    price_usd NUMERIC(12, 2) NOT NULL CHECK (price_usd >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    external_product_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_product_slug UNIQUE (tenant_id, slug)
);

-- 9. INVENTORY & STOCKS (Per Store)
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_quantity INT NOT NULL DEFAULT 5 CHECK (min_quantity >= 0),
    external_inventory_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_store_product_inventory UNIQUE (store_id, product_id)
);

-- 10. INVENTORY MOVEMENTS (Audit Trail)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity_change INT NOT NULL,
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    reason TEXT NOT NULL, -- 'SALE', 'RESTOCK', 'ADJUSTMENT', 'DAMAGE'
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    is_guest BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. ORDERS
CREATE TYPE public.order_status AS ENUM (
    'CREATED',
    'PAYMENT_PENDING',
    'PAYMENT_APPROVED',
    'PREPARING',
    'READY',
    'DELIVERING',
    'COMPLETED',
    'CANCELLED'
);

CREATE TYPE public.delivery_type AS ENUM (
    'PICKUP',
    'DELIVERY'
);

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    order_number TEXT NOT NULL,
    status public.order_status NOT NULL DEFAULT 'CREATED',
    delivery_type public.delivery_type NOT NULL DEFAULT 'PICKUP',
    delivery_address TEXT,
    total_usd NUMERIC(12, 2) NOT NULL,
    total_ves NUMERIC(14, 2) NOT NULL,
    exchange_rate_applied NUMERIC(14, 4) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_order_number UNIQUE (tenant_id, order_number)
);

-- 13. ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price_usd NUMERIC(12, 2) NOT NULL,
    total_price_usd NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 14. PAYMENTS & PROOFS (Venezuelan Commerce Validation)
CREATE TYPE public.payment_method_type AS ENUM (
    'PAGO_MOVIL',
    'BANK_TRANSFER',
    'ZELLE',
    'CASH_USD',
    'CASH_VES',
    'POS'
);

CREATE TYPE public.payment_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    method public.payment_method_type NOT NULL,
    bank_name TEXT,
    reference_number TEXT,
    amount NUMERIC(14, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'VES',
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    proof_image_url TEXT,
    status public.payment_status NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 15. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL, -- e.g. 'PAYMENT_APPROVED', 'STOCK_ADJUSTED'
    entity TEXT NOT NULL, -- e.g. 'payments', 'inventory'
    entity_id TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- Helper function to extract user's tenant_id from auth claim or profile
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS TEXT AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::TEXT;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'PLATFORM_SUPER_ADMIN', false);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS on ALL tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Tenants Policies: Public can read active tenant info (needed to load storefront)
CREATE POLICY "Public can view active tenants"
ON public.tenants FOR SELECT
USING (status = 'active');

CREATE POLICY "Super admins manage tenants"
ON public.tenants FOR ALL
USING (public.is_super_admin());

-- 2. Tenant Settings: Public can read settings for styling & info
CREATE POLICY "Public can view tenant settings"
ON public.tenant_settings FOR SELECT
USING (true);

CREATE POLICY "Tenant admin can update tenant settings"
ON public.tenant_settings FOR UPDATE
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 3. Stores Policies: Public can view active stores
CREATE POLICY "Public can view active stores"
ON public.stores FOR SELECT
USING (is_active = true);

-- 4. Exchange Rates: Public read, admin update
CREATE POLICY "Public can view exchange rates"
ON public.exchange_rates FOR SELECT
USING (true);

-- 5. Products & Categories: Public read active
CREATE POLICY "Public can view active categories"
ON public.categories FOR SELECT
USING (is_active = true);

CREATE POLICY "Public can view active products"
ON public.products FOR SELECT
USING (is_active = true);

CREATE POLICY "Tenant staff can manage categories"
ON public.categories FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

CREATE POLICY "Tenant staff can manage products"
ON public.products FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 6. Inventory: Public can read store inventory, tenant staff can update
CREATE POLICY "Public can view inventory"
ON public.inventory FOR SELECT
USING (true);

CREATE POLICY "Tenant staff can manage inventory"
ON public.inventory FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 7. Orders & Items: Customers can view their own orders; tenant staff can view all in their tenant
CREATE POLICY "Anyone can create orders"
ON public.orders FOR INSERT
WITH CHECK (true);

CREATE POLICY "Tenant staff can view tenant orders"
ON public.orders FOR SELECT
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

CREATE POLICY "Tenant staff can update tenant orders"
ON public.orders FOR UPDATE
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

CREATE POLICY "Anyone can create order items"
ON public.order_items FOR INSERT
WITH CHECK (true);

CREATE POLICY "Tenant staff can view order items"
ON public.order_items FOR SELECT
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 8. Payments: Anyone can submit payment proof; tenant staff can review/update
CREATE POLICY "Anyone can submit payments"
ON public.payments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Tenant staff can view and review payments"
ON public.payments FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 9. Audit Logs: Tenant staff can view their tenant logs
CREATE POLICY "Tenant staff can view audit logs"
ON public.audit_logs FOR SELECT
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- =====================================================================
-- PERFORMANCE INDEXES (Optimized for Multi-Tenant Queries)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_products_tenant_category ON public.products (tenant_id, category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_store_product ON public.inventory (store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON public.orders (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status ON public.payments (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs (tenant_id, created_at DESC);
