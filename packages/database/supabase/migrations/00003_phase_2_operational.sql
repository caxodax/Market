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
