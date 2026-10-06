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
