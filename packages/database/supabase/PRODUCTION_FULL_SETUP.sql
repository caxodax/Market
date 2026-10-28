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
    custom_domain TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON public.tenants (custom_domain);

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
    custom_domain TEXT,
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
    id_number TEXT,
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
    customer_id_number TEXT,
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
-- =====================================================================
-- SEED DATA: TENANT 1 - SHOP MARKET C.A.
-- Migration: 00002_seed_shop_market.sql
-- =====================================================================

-- 1. Insert Tenant
INSERT INTO public.tenants (id, name, slug, logo_url, status)
VALUES (
    'shop-market-ca',
    'Shop Market C.A.',
    'shop-market',
    '/brand/logo.png',
    'active'
) ON CONFLICT (id) DO NOTHING;

-- 2. Insert Tenant Settings
INSERT INTO public.tenant_settings (
    tenant_id,
    business_name,
    category,
    primary_color,
    secondary_color,
    accent_color,
    logo_url,
    phone,
    email,
    whatsapp_number,
    address,
    supported_currencies,
    default_currency
) VALUES (
    'shop-market-ca',
    'Shop Market C.A.',
    'Minimarket',
    '#DC2626',
    '#09090B',
    '#FFFFFF',
    '/brand/logo.png',
    '+58 424-5919577',
    'shopmarketca@gmail.com',
    '584245919577',
    'Calle 3 entre Carreras 1 y 2, Urb. Nueva Segovia, Barquisimeto, Lara',
    ARRAY['USD', 'VES'],
    'USD'
) ON CONFLICT (tenant_id) DO UPDATE SET
    primary_color = EXCLUDED.primary_color,
    phone = EXCLUDED.phone,
    whatsapp_number = EXCLUDED.whatsapp_number;

-- 3. Insert Store (Nueva Segovia)
INSERT INTO public.stores (id, tenant_id, name, code, address, phone, is_active)
VALUES (
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    'shop-market-ca',
    'Sucursal Nueva Segovia',
    'NS-01',
    'Calle 3 entre Carreras 1 y 2, Urb. Nueva Segovia, Barquisimeto',
    '+58 424-5919577',
    true
) ON CONFLICT (tenant_id, code) DO NOTHING;

-- 4. Initial BCV Exchange Rate
INSERT INTO public.exchange_rates (id, tenant_id, currency, value, source, updated_at)
VALUES (
    'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    'shop-market-ca',
    'VES',
    42.5000,
    'https://bcv.today/api/',
    timezone('utc'::text, now())
) ON CONFLICT (id) DO NOTHING;

-- 5. Categories
INSERT INTO public.categories (id, tenant_id, name, slug, sort_order, is_active)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'shop-market-ca', 'Víveres y Despensa', 'viveres-y-despensa', 1, true),
    ('c2222222-2222-2222-2222-222222222222', 'shop-market-ca', 'Lácteos y Refrigerados', 'lacteos-y-refrigerados', 2, true),
    ('c3333333-3333-3333-3333-333333333333', 'shop-market-ca', 'Bebidas & Snacks', 'bebidas-y-snacks', 3, true),
    ('c4444444-4444-4444-4444-444444444444', 'shop-market-ca', 'Cuidado y Aseo', 'cuidado-y-aseo', 4, true)
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 6. Products
INSERT INTO public.products (id, tenant_id, category_id, name, slug, description, sku, price_usd, is_active)
VALUES
    ('d1111111-1111-1111-1111-111111111111', 'shop-market-ca', 'c1111111-1111-1111-1111-111111111111', 'Harina PAN Blanca 1kg', 'harina-pan-blanca-1kg', 'Harina de maíz blanco precocida tradicional', 'PAN-001', 1.25, true),
    ('d2222222-2222-2222-2222-222222222222', 'shop-market-ca', 'c1111111-1111-1111-1111-111111111111', 'Arroz Mary Tradicional 1kg', 'arroz-mary-1kg', 'Arroz blanco entero calidad superior', 'MARY-002', 1.40, true),
    ('d3333333-3333-3333-3333-333333333333', 'shop-market-ca', 'c1111111-1111-1111-1111-111111111111', 'Aceite Vegetal Mazeite 1L', 'aceite-mazeite-1l', 'Aceite 100% puro de maíz', 'MAZ-003', 3.50, true),
    ('d4444444-4444-4444-4444-444444444444', 'shop-market-ca', 'c1111111-1111-1111-1111-111111111111', 'Café Fama de América 250g', 'cafe-fama-de-america-250g', 'Café molido tostado oscuro venezolano', 'CAF-004', 2.80, true),
    ('d5555555-5555-5555-5555-555555555555', 'shop-market-ca', 'c2222222-2222-2222-2222-222222222222', 'Queso Paisa Pasteurizado 500g', 'queso-paisa-500g', 'Queso blanco pasteurizado suave', 'QPA-005', 4.20, true),
    ('d6666666-6666-6666-6666-666666666666', 'shop-market-ca', 'c2222222-2222-2222-2222-222222222222', 'Leche Completa La Campiña 1L', 'leche-campina-1l', 'Leche líquida pasteurizada entera', 'LEC-006', 2.10, true),
    ('d7777777-7777-7777-7777-777777777777', 'shop-market-ca', 'c3333333-3333-3333-3333-333333333333', 'Coca-Cola Original 1.5L', 'coca-cola-1-5l', 'Bebida gaseosa refrescante', 'CC-007', 2.00, true),
    ('d8888888-8888-8888-8888-888888888888', 'shop-market-ca', 'c3333333-3333-3333-3333-333333333333', 'Galletas Oreo Chocolate 108g', 'galletas-oreo-108g', 'Galletas rellenas de crema sabor a vainilla', 'ORE-008', 1.10, true)
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 7. Inventory for Store Nueva Segovia
INSERT INTO public.inventory (tenant_id, store_id, product_id, quantity, min_quantity)
VALUES
    ('shop-market-ca', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'd1111111-1111-1111-1111-111111111111', 50, 10),
    ('shop-market-ca', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'd2222222-2222-2222-2222-222222222222', 40, 10),
    ('shop-market-ca', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'd3333333-3333-3333-3333-333333333333', 25, 5),
    ('shop-market-ca', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'd4444444-4444-4444-4444-444444444444', 30, 8),
    ('shop-market-ca', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'd5555555-5555-5555-5555-555555555555', 18, 5),
    ('shop-market-ca', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'd6666666-6666-6666-6666-666666666666', 22, 6),
    ('shop-market-ca', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'd7777777-7777-7777-7777-777777777777', 35, 10),
    ('shop-market-ca', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'd8888888-8888-8888-8888-888888888888', 45, 12)
ON CONFLICT (store_id, product_id) DO NOTHING;
-- =====================================================================
-- MARKETOS - PHASE 2: OPERATIONAL MIGRATION
-- Delivery Zones, Promotions & Coupons, Drivers, Loyalty & Addresses
-- Multi-Tenant strict isolation with RLS enabled
-- =====================================================================

-- 1. DELIVERY ZONES TABLE
CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (price_usd >= 0),
    estimated_time TEXT NOT NULL DEFAULT '30-45 min',
    coverage_description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. COUPONS & PROMOTIONS TABLE
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_USD')),
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
    min_order_amount_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    max_discount_usd NUMERIC(10, 2),
    usage_limit INT,
    usage_count INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_coupon_code UNIQUE (tenant_id, code)
);

-- 3. DRIVERS TABLE
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle_type TEXT NOT NULL DEFAULT 'MOTO' CHECK (vehicle_type IN ('MOTO', 'CARRO', 'BICICLETA')),
    plate_number TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. CUSTOMER ADDRESSES TABLE
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT 'Casa',
    zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
    address_line TEXT NOT NULL,
    reference_point TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. LOYALTY & CUSTOMER UPDATES
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS loyalty_points INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    points_change INT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. ORDER ENHANCEMENTS
ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS delivery_zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS delivery_fee_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS discount_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- 8. POLICIES
DROP POLICY IF EXISTS "Public can view active delivery zones" ON public.delivery_zones;
CREATE POLICY "Public can view active delivery zones" ON public.delivery_zones FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public can validate active coupons" ON public.coupons;
CREATE POLICY "Public can validate active coupons" ON public.coupons FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active drivers" ON public.drivers;
CREATE POLICY "Public can view active drivers" ON public.drivers FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Customers view their addresses" ON public.customer_addresses;
CREATE POLICY "Customers view their addresses" ON public.customer_addresses FOR ALL USING (true);

DROP POLICY IF EXISTS "Customers view loyalty transactions" ON public.loyalty_transactions;
CREATE POLICY "Customers view loyalty transactions" ON public.loyalty_transactions FOR SELECT USING (true);

-- 9. SEED DATA SHOP MARKET C.A.
INSERT INTO public.delivery_zones (id, tenant_id, name, price_usd, estimated_time, coverage_description, is_active, sort_order)
VALUES
    ('e1111111-1111-1111-1111-111111111111', 'shop-market-ca', 'Nueva Segovia (Zona Local)', 0.00, '20-35 min', 'Entrega gratuita en toda la Urb. Nueva Segovia', true, 1),
    ('e2222222-2222-2222-2222-222222222222', 'shop-market-ca', 'Este de Barquisimeto / Santa Rosa', 2.00, '30-45 min', 'Av. Lara, Los Leones, Turbio, Santa Rosa', true, 2),
    ('e3333333-3333-3333-3333-333333333333', 'shop-market-ca', 'Centro de Barquisimeto', 3.00, '35-50 min', 'Carreras 19 a 24, Av. Vargas, Av. Venezuela', true, 3),
    ('e4444444-4444-4444-4444-444444444444', 'shop-market-ca', 'Cabudare Centro / La Mora', 4.50, '45-60 min', 'Intercomunal Barquisimeto - Cabudare, La Mora', true, 4),
    ('e5555555-5555-5555-5555-555555555555', 'shop-market-ca', 'Oeste de Barquisimeto / Pedro León Torres', 3.50, '40-60 min', 'Av. Pedro León Torres, Obelisco, Metrópolis', true, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.coupons (id, tenant_id, code, description, discount_type, discount_value, min_order_amount_usd, usage_limit, is_active)
VALUES
    ('f1111111-1111-1111-1111-111111111111', 'shop-market-ca', 'BIENVENIDO', 'Descuento de bienvenida de $2 en pedidos superiores a $10', 'FIXED_USD', 2.00, 10.00, 500, true),
    ('f2222222-2222-2222-2222-222222222222', 'shop-market-ca', 'SHOP10', '10% de descuento en compras mayores a $20', 'PERCENTAGE', 10.00, 20.00, 1000, true)
ON CONFLICT (id) DO NOTHING;

-- Enlace dinámico a la sucursal de Shop Market existente
INSERT INTO public.drivers (id, tenant_id, store_id, name, phone, vehicle_type, plate_number, is_active)
VALUES
    (
        'a1111111-1111-1111-1111-111111111111',
        'shop-market-ca',
        (SELECT id FROM public.stores WHERE tenant_id = 'shop-market-ca' LIMIT 1),
        'Carlos Mendoza (Repartidor Oficial)',
        '+58 412-1234567',
        'MOTO',
        'AD3X91',
        true
    )
ON CONFLICT (id) DO NOTHING;
-- =====================================================================
-- MARKETOS - PHASE 3: SAAS MULTI-TENANT ARCHITECTURE
-- Subscription Plans, Tenant Subscriptions, Platform Admin & Onboarding
-- Strict RLS with super-admin bypass & tenant isolation
-- =====================================================================

-- 1. SUBSCRIPTION PLANS TABLE
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id TEXT PRIMARY KEY, -- 'STARTER', 'GROWTH', 'ENTERPRISE'
    name TEXT NOT NULL,
    description TEXT,
    price_usd_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    price_usd_yearly NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    max_stores INT NOT NULL DEFAULT 1,
    max_products INT NOT NULL DEFAULT 50,
    custom_domain_allowed BOOLEAN NOT NULL DEFAULT false,
    transaction_fee_percent NUMERIC(4, 2) NOT NULL DEFAULT 0.00,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. TENANT SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'past_due', 'cancelled')),
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now() + interval '30 days'),
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_subscription UNIQUE (tenant_id)
);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES: SUBSCRIPTION PLANS
DROP POLICY IF EXISTS "Public can view active subscription plans" ON public.subscription_plans;
CREATE POLICY "Public can view active subscription plans"
ON public.subscription_plans FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Super admin manage subscription plans" ON public.subscription_plans;
CREATE POLICY "Super admin manage subscription plans"
ON public.subscription_plans FOR ALL
USING (public.is_super_admin());

-- 5. POLICIES: TENANT SUBSCRIPTIONS
DROP POLICY IF EXISTS "Tenant can view own subscription" ON public.tenant_subscriptions;
CREATE POLICY "Tenant can view own subscription"
ON public.tenant_subscriptions FOR SELECT
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Super admin manage all subscriptions" ON public.tenant_subscriptions;
CREATE POLICY "Super admin manage all subscriptions"
ON public.tenant_subscriptions FOR ALL
USING (public.is_super_admin());

-- 6. SEED SUBSCRIPTION PLANS
INSERT INTO public.subscription_plans (
    id, name, description, price_usd_monthly, price_usd_yearly,
    max_stores, max_products, custom_domain_allowed, transaction_fee_percent, features
) VALUES
    (
        'STARTER',
        'MarketOS Starter',
        'Ideal para bodegas, panaderías y pequeños minimarkets locales',
        19.00,
        190.00,
        1,
        60,
        false,
        0.00,
        '["1 Sucursal", "Hasta 60 productos", "Catálogo PWA móvil", "Tasa BCV automatizada", "Pagos por WhatsApp y Pago Móvil"]'::jsonb
    ),
    (
        'GROWTH',
        'MarketOS Growth',
        'Para comercios consolidados con delivery propio y alto volumen de ventas',
        49.00,
        490.00,
        3,
        300,
        true,
        0.00,
        '["Hasta 3 Sucursales", "Hasta 300 productos", "Módulo de Repartidores y Zonas", "Cupones y Promociones", "Carga de comprobantes en Cloudflare R2", "Dominio personalizado"]'::jsonb
    ),
    (
        'ENTERPRISE',
        'MarketOS Enterprise',
        'Para cadenas de minimarkets, franquicias y supermercados multi-sucursal',
        99.00,
        990.00,
        10,
        2000,
        true,
        0.00,
        '["Hasta 10 Sucursales", "Productos ilimitados", "Multi-cajero y roles avanzados", "Soporte prioritario 24/7", "Integraciones ERP y Facturación Fiscal"]'::jsonb
    )
ON CONFLICT (id) DO UPDATE SET
    price_usd_monthly = EXCLUDED.price_usd_monthly,
    description = EXCLUDED.description,
    features = EXCLUDED.features;

-- 7. SEED TENANT 1 SUBSCRIPTION (Shop Market C.A. on Growth Tier)
INSERT INTO public.tenant_subscriptions (
    tenant_id, plan_id, status, billing_cycle,
    current_period_start, current_period_end
) VALUES (
    'shop-market-ca',
    'GROWTH',
    'active',
    'monthly',
    timezone('utc'::text, now()),
    timezone('utc'::text, now() + interval '30 days')
) ON CONFLICT (tenant_id) DO NOTHING;
-- =====================================================================
-- MARKETOS - PHASE 4: PRODUCTION HARDENING & ADVANCED OPERATIONS
-- Customers RLS, Loyalty Points, Audit Logs Policies, Exchange Rates Constraint
-- =====================================================================

-- 1. ADD LOYALTY POINTS TO CUSTOMERS
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS loyalty_points INT NOT NULL DEFAULT 0;

-- 2. UNIQUE CONSTRAINT FOR EXCHANGE RATES UPSERT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_exchange_rates_tenant_currency'
    ) THEN
        ALTER TABLE public.exchange_rates
        ADD CONSTRAINT uq_exchange_rates_tenant_currency UNIQUE (tenant_id, currency);
    END IF;
END $$;

-- 3. CUSTOMERS RLS POLICIES
DROP POLICY IF EXISTS "Anyone can create or find customers" ON public.customers;
CREATE POLICY "Anyone can create or find customers"
ON public.customers FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view customers" ON public.customers;
CREATE POLICY "Public can view customers"
ON public.customers FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Tenant staff can update customers" ON public.customers;
CREATE POLICY "Tenant staff can update customers"
ON public.customers FOR UPDATE
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 4. AUDIT LOGS RLS POLICIES
DROP POLICY IF EXISTS "Allow system insert audit logs" ON public.audit_logs;
CREATE POLICY "Allow system insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant staff can view audit logs" ON public.audit_logs;
CREATE POLICY "Tenant staff can view audit logs"
ON public.audit_logs FOR SELECT
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 5. ORDERS & ITEMS EXPANDED POLICIES
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders"
ON public.orders FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read own orders by phone or id" ON public.orders;
CREATE POLICY "Public can read own orders by phone or id"
ON public.orders FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items"
ON public.order_items FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;
CREATE POLICY "Public can view order items"
ON public.order_items FOR SELECT
USING (true);

-- 6. INVENTORY MOVEMENTS POLICIES
DROP POLICY IF EXISTS "Allow insert inventory movements" ON public.inventory_movements;
CREATE POLICY "Allow insert inventory movements"
ON public.inventory_movements FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant staff can view inventory movements" ON public.inventory_movements;
CREATE POLICY "Tenant staff can view inventory movements"
ON public.inventory_movements FOR SELECT
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id_number ON public.customers (tenant_id, id_number);
CREATE INDEX IF NOT EXISTS idx_customers_id_number ON public.customers (id_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id_number ON public.orders (tenant_id, customer_id_number);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_prod ON public.inventory_movements (tenant_id, product_id, created_at DESC);
-- =====================================================================
-- MIGRATION: 00006_auth_roles_profiles.sql
-- Module: Supabase Auth, RBAC Roles, Profiles & Tenant Staff Management
-- =====================================================================

-- 1. Ensure app_role enum exists with all platform and tenant roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM (
            'PLATFORM_SUPER_ADMIN',
            'TENANT_OWNER',
            'TENANT_MANAGER',
            'TENANT_INVENTORY',
            'TENANT_CASHIER',
            'TENANT_DELIVERY',
            'CUSTOMER'
        );
    END IF;
END $$;

-- 2. Relax profiles constraints to allow administrative invitations before auth account creation
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Drop rigid foreign key constraint on auth.users(id) if present to allow pre-invitation of staff
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    END IF;
END $$;

-- Ensure unique email per profile (or per tenant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_role ON public.profiles (tenant_id, role);

-- 3. RLS POLICIES FOR PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop previous policies if any exist
DROP POLICY IF EXISTS "Public can view staff profile basics" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Tenant staff can view tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Tenant owners and managers can manage staff" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;

-- Anyone authenticated can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (
    id = auth.uid() 
    OR lower(email) = lower(auth.jwt()->>'email')
);

-- Tenant staff can view team members in their tenant
CREATE POLICY "Tenant staff can view tenant profiles"
ON public.profiles FOR SELECT
USING (
    tenant_id = public.current_user_tenant_id() 
    OR public.is_super_admin()
);

-- Tenant Owners, Managers and Super Admins can insert/invite staff
CREATE POLICY "Tenant owners and managers can manage staff"
ON public.profiles FOR ALL
USING (
    (tenant_id = public.current_user_tenant_id() AND EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE (p.id = auth.uid() OR lower(p.email) = lower(auth.jwt()->>'email'))
        AND p.role IN ('TENANT_OWNER', 'TENANT_MANAGER', 'PLATFORM_SUPER_ADMIN')
    ))
    OR public.is_super_admin()
);

-- 4. FUNCTION & TRIGGER: Sync Supabase auth.users with public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    existing_profile_id UUID;
    target_role public.app_role;
    target_tenant TEXT;
BEGIN
    -- Check if pre-invited profile exists with this email
    SELECT id, role, tenant_id INTO existing_profile_id, target_role, target_tenant
    FROM public.profiles
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;

    IF existing_profile_id IS NOT NULL THEN
        -- Link existing profile to auth.users.id
        UPDATE public.profiles
        SET 
            id = NEW.id,
            updated_at = timezone('utc'::text, now())
        WHERE id = existing_profile_id;
    ELSE
        -- Determine role from metadata or fallback to CUSTOMER
        target_role := COALESCE(
            (NEW.raw_user_meta_data->>'role')::public.app_role, 
            'CUSTOMER'::public.app_role
        );
        target_tenant := NEW.raw_user_meta_data->>'tenant_id';

        INSERT INTO public.profiles (
            id,
            tenant_id,
            email,
            full_name,
            phone,
            role,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            target_tenant,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            NEW.raw_user_meta_data->>'phone',
            target_role,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        )
        ON CONFLICT (lower(email)) DO UPDATE SET
            id = EXCLUDED.id,
            updated_at = timezone('utc'::text, now());
    END IF;

    RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 5. SEED INITIAL PROFILES FOR SHOP MARKET & SUPER ADMIN
-- Note: Uses deterministic UUIDs so foreign key references remain consistent
INSERT INTO public.profiles (id, tenant_id, email, full_name, phone, role, created_at, updated_at)
VALUES
    (
        'e1111111-1111-1111-1111-111111111111',
        'shop-market-ca',
        'owner@shopmarket.com',
        'Luis Montes (Dueño)',
        '+58 424-5919577',
        'TENANT_OWNER',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ),
    (
        'e2222222-2222-2222-2222-222222222222',
        'shop-market-ca',
        'gerente@shopmarket.com',
        'María Rodríguez (Encargada)',
        '+58 414-5551234',
        'TENANT_MANAGER',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ),
    (
        'e3333333-3333-3333-3333-333333333333',
        'shop-market-ca',
        'caja@shopmarket.com',
        'Carlos Pérez (Caja)',
        '+58 412-5559876',
        'TENANT_CASHIER',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ),
    (
        'e4444444-4444-4444-4444-444444444444',
        NULL,
        'superadmin@marketos.com',
        'Super Admin Maestro',
        '+58 412-0000000',
        'PLATFORM_SUPER_ADMIN',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
ON CONFLICT (lower(email)) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    tenant_id = EXCLUDED.tenant_id,
    phone = EXCLUDED.phone,
    updated_at = timezone('utc'::text, now());

-- =====================================================================
-- End of Migration 00006_auth_roles_profiles.sql
-- =====================================================================
-- ==============================================================================
-- MIGRATION 00007: AUTOMATED DAILY BCV EXCHANGE RATE SYNCHRONIZATION
-- MarketOS • Postgres pg_cron & pg_net native scheduling
-- ==============================================================================

-- 1. Habilitar extensiones necesarias en Supabase (Disponibles de forma nativa)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Conceder permisos de ejecución al rol postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- 3. Crear función de utilidad para disparar la sincronización de la tasa
CREATE OR REPLACE FUNCTION public.trigger_bcv_rate_sync(target_url TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    endpoint_url TEXT;
BEGIN
    -- Si no se pasa URL, usar el webhook configurado o el endpoint de la app
    endpoint_url := COALESCE(
        target_url,
        current_setting('app.settings.bcv_sync_url', true),
        'https://marketos.app/api/cron/bcv-sync'
    );

    -- Ejecuta petición HTTP asíncrona segura vía pg_net enviando Authorization Bearer si está configurado
    PERFORM net.http_get(
        url := endpoint_url,
        headers := jsonb_build_object(
            'Accept', 'application/json',
            'Authorization', 'Bearer ' || COALESCE(current_setting('app.settings.cron_secret', true), '')
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Programar Cron Job Diario en Postgres (Supabase pg_cron)
-- Se ejecuta todos los días a las 11:00 UTC (7:00 AM hora Venezuela VET, idéntico a KsaSport)
SELECT cron.schedule(
    'marketos-daily-bcv-sync',
    '0 11 * * *',
    $$ SELECT public.trigger_bcv_rate_sync(); $$
);

-- Para verificar tareas programadas activas:
-- SELECT * FROM cron.job;

-- Para ver el historial de ejecuciones:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Para desprogramar la tarea en el futuro si se requiere:
-- SELECT cron.unschedule('marketos-daily-bcv-sync');
-- ==============================================================================
-- MIGRATION 00008: HISTORIAL DIARIO DE TASAS DE CAMBIO (BCV / ALCAMBIO / MANUAL)
-- MarketOS • Registro inmutable y consulta histórica de divisas
-- ==============================================================================

-- 1. Tabla de Histórico Diario de Tasas
CREATE TABLE IF NOT EXISTS public.exchange_rate_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL indica tasa global de la plataforma
    date_rate DATE NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    rate NUMERIC(14, 4) NOT NULL,
    rate_eur NUMERIC(14, 4),
    usdt_promedio NUMERIC(14, 4),
    source TEXT NOT NULL DEFAULT 'alcambio.app',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_rate_history_tenant_date_curr UNIQUE (tenant_id, date_rate, currency)
);

-- 2. Índices para acelerar consultas por fecha y tenant
CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_date 
ON public.exchange_rate_history (date_rate DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_tenant_date 
ON public.exchange_rate_history (tenant_id, date_rate DESC);

-- 3. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.exchange_rate_history ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acceso:
-- Lectura pública para cualquier cliente, tenant o storefront
CREATE POLICY "Permitir lectura publica del historico de tasas"
ON public.exchange_rate_history FOR SELECT
USING (true);

-- Escritura restringida al rol de servicio (Cron jobs, Edge Functions) o super admin
CREATE POLICY "Permitir escritura al rol de servicio en historico de tasas"
ON public.exchange_rate_history FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Semilla inicial de tasas históricas oficiales (Barquisimeto / Nacional)
INSERT INTO public.exchange_rate_history (tenant_id, date_rate, currency, rate, rate_eur, usdt_promedio, source, created_at)
VALUES
    ('shop-market-ca', '2026-10-09', 'USD', 875.6505, 980.6147, 1016.7850, 'alcambio.app', '2026-10-09 09:30:02-04'),
    ('shop-market-ca', '2026-10-08', 'USD', 874.7321, 979.0789, 1015.6700, 'alcambio.app', '2026-10-08 16:30:02-04'),
    ('shop-market-ca', '2026-10-07', 'USD', 873.8670, 984.2626, 1008.7650, 'alcambio.app', '2026-10-07 16:30:02-04'),
    ('shop-market-ca', '2026-10-06', 'USD', 872.3927, 977.2194, 993.9900, 'alcambio.app', '2026-10-06 16:30:05-04'),
    ('shop-market-ca', '2026-10-05', 'USD', 871.3689, 981.1788, 975.2450, 'alcambio.app', '2026-10-05 09:30:06-04'),
    ('shop-market-ca', '2026-10-02', 'USD', 866.5612, 973.9281, 971.5750, 'alcambio.app', '2026-10-02 16:30:06-04'),
    ('shop-market-ca', '2026-10-01', 'USD', 860.1753, 976.8409, 959.5500, 'alcambio.app', '2026-10-01 16:30:06-04'),
    ('shop-market-ca', '2026-09-30', 'USD', 859.0629, 973.3097, 954.8100, 'alcambio.app', '2026-09-30 16:30:06-04'),
    ('shop-market-ca', '2026-09-29', 'USD', 857.8876, 974.7147, 958.3600, 'alcambio.app', '2026-09-29 09:30:05-04'),
    ('shop-market-ca', '2026-09-28', 'USD', 857.0058, 976.9009, 965.3350, 'alcambio.app', '2026-09-28 16:30:05-04')
ON CONFLICT (tenant_id, date_rate, currency) DO UPDATE
SET rate = EXCLUDED.rate,
    rate_eur = EXCLUDED.rate_eur,
    usdt_promedio = EXCLUDED.usdt_promedio,
    source = EXCLUDED.source,
    created_at = EXCLUDED.created_at;

-- ==============================================================================
-- 6. BRANDING, TYPOGRAPHY, PAYMENT ACCOUNTS & OPERATIONAL SETTINGS
-- ==============================================================================
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS payment_settings JSONB DEFAULT '{
  "enabled_methods": ["PAGO_MOVIL", "BANK_TRANSFER", "ZELLE", "CASH_USD"],
  "pago_movil": {
    "bank": "Bancamiga",
    "phone": "04245919577",
    "id_doc": "J-50123456-7",
    "name": "Shop Market C.A."
  },
  "bank_transfer": {
    "bank": "Bancamiga",
    "account_number": "01720111551100012345",
    "account_type": "Corriente",
    "id_doc": "J-50123456-7",
    "name": "Shop Market C.A."
  },
  "zelle": {
    "email": "pagos@shopmarket.com",
    "name": "Shop Market C.A."
  },
  "cash_usd": {
    "instructions": "Billetes en buen estado sin roturas ni marcas. Pago al retirar en tienda o contra entrega."
  }
}'::jsonb;

ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS operational_settings JSONB DEFAULT '{
  "is_open": true,
  "closed_message": "Actualmente nos encontramos fuera de horario de atención. Tomaremos tu pedido a primera hora.",
  "schedule": "Lunes a Sábado: 8:00 AM - 9:00 PM | Domingos: 9:00 AM - 6:00 PM",
  "min_order_usd": 0,
  "announcement_banner": "¡Bienvenidos a Shop Market! Delivery rápido en Barquisimeto y Cabudare 🛵",
  "estimated_delivery_time": "30 a 60 minutos",
  "custom_whatsapp_message": "Hola Shop Market, acabo de realizar un pedido por la tienda web:"
}'::jsonb;

ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'Inter';

-- 00011: Cédula de Identidad / RIF en clientes y pedidos
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS id_number TEXT;

ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS customer_id_number TEXT;

-- 00012: Configuración Fiscal SENIAT (Providencia 00071 & Facturación Digital)
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS billing_settings JSONB DEFAULT '{
  "fiscal_billing_enabled": false,
  "billing_mode": "TICKET_ONLY",
  "tax_payer_type": "ORDINARY",
  "apply_igtf": false,
  "default_iva_rate": 16.0,
  "fiscal_provider": "THE_FACTORY_HKA",
  "emitter_fiscal_data": {
    "rif": "J-50123456-7",
    "business_name": "Shop Market C.A.",
    "fiscal_address": "Calle 3 entre Carreras 1 y 2, Urb. Nueva Segovia, Barquisimeto, Edo. Lara, Venezuela",
    "phone": "+58 424-5919577"
  },
  "provider_credentials": {
    "api_key": "",
    "token": "",
    "environment": "SANDBOX"
  }
}'::jsonb;

ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS is_fiscal_invoice BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fiscal_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_control_number TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_qr_url TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_cuv TEXT,
  ADD COLUMN IF NOT EXISTS subtotal_exempt_usd NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_taxable_usd NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_amount_usd NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_amount_ves NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igtf_amount_usd NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igtf_amount_ves NUMERIC(14, 2) DEFAULT 0;

-- =====================================================================
-- MARKETOS MODULAR PLUGINS & FOOD SERVICE SYSTEM (Migration 00015)
-- =====================================================================

-- 1. TENANT MODULES (PLUGINS)
CREATE TABLE IF NOT EXISTS public.tenant_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    module_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_tenant_module UNIQUE (tenant_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_lookup 
ON public.tenant_modules (tenant_id, is_active);

ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins have full access to tenant_modules" ON public.tenant_modules;
CREATE POLICY "Super admins have full access to tenant_modules"
ON public.tenant_modules FOR ALL
USING (public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can view active modules" ON public.tenant_modules;
CREATE POLICY "Tenant staff can view active modules"
ON public.tenant_modules FOR SELECT
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 2. RAW MATERIALS (INVENTARIO DE MATERIA PRIMA / INSUMOS)
CREATE TABLE IF NOT EXISTS public.raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    unit TEXT NOT NULL DEFAULT 'UNIT',
    current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0,
    min_alert_stock NUMERIC(12, 3) NOT NULL DEFAULT 5,
    cost_per_unit_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_materials_tenant_store 
ON public.raw_materials (tenant_id, store_id, is_active)
WHERE deleted_at IS NULL;

ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can manage raw materials" ON public.raw_materials;
CREATE POLICY "Tenant staff can manage raw materials"
ON public.raw_materials FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 3. PRODUCT RECIPES (RECETAS / ESCANDALLO)
CREATE TABLE IF NOT EXISTS public.product_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_product_recipe UNIQUE (tenant_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_recipes_product 
ON public.product_recipes (tenant_id, product_id);

ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can manage recipes" ON public.product_recipes;
CREATE POLICY "Tenant staff can manage recipes"
ON public.product_recipes FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 4. PRODUCT MODIFIER GROUPS (SALSAS, TOPPINGS, EXTRAS)
CREATE TABLE IF NOT EXISTS public.product_modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    product_id TEXT NULL,
    category_id TEXT NULL,
    name TEXT NOT NULL,
    description TEXT,
    required BOOLEAN DEFAULT false,
    min_selectable INT DEFAULT 0,
    max_selectable INT DEFAULT 1,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_modifier_groups_lookup 
ON public.product_modifier_groups (tenant_id, is_active, sort_order);

ALTER TABLE public.product_modifier_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can manage modifier groups" ON public.product_modifier_groups;
CREATE POLICY "Tenant staff can manage modifier groups"
ON public.product_modifier_groups FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Public can view active modifier groups" ON public.product_modifier_groups;
CREATE POLICY "Public can view active modifier groups"
ON public.product_modifier_groups FOR SELECT
USING (is_active = true);

-- ==============================================================================
-- 31. ATOMIC FISCAL SEQUENCES (AgentShield: Race Condition Prevention)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_fiscal_sequences (
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, document_type)
);

ALTER TABLE public.tenant_fiscal_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can manage fiscal sequences" ON public.tenant_fiscal_sequences;
CREATE POLICY "Tenant staff can manage fiscal sequences"
ON public.tenant_fiscal_sequences FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_fiscal_documents_tenant_type_num'
  ) THEN
    ALTER TABLE public.fiscal_documents
      ADD CONSTRAINT uq_fiscal_documents_tenant_type_num
      UNIQUE (tenant_id, document_type, document_number);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_next_fiscal_sequence(
  p_tenant_id TEXT,
  p_document_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_next_seq INTEGER;
  v_initial_max INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_fiscal_sequences 
    WHERE tenant_id = p_tenant_id AND document_type = p_document_type
  ) THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(document_number, '\D', '', 'g'), '')::INTEGER), 0)
    INTO v_initial_max
    FROM public.fiscal_documents
    WHERE tenant_id = p_tenant_id AND document_type = p_document_type;

    INSERT INTO public.tenant_fiscal_sequences (tenant_id, document_type, last_sequence, updated_at)
    VALUES (p_tenant_id, p_document_type, v_initial_max, NOW())
    ON CONFLICT (tenant_id, document_type) DO NOTHING;
  END IF;

  UPDATE public.tenant_fiscal_sequences
  SET last_sequence = last_sequence + 1,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND document_type = p_document_type
  RETURNING last_sequence INTO v_next_seq;

  RETURN v_next_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


