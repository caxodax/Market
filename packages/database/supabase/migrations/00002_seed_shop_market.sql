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
