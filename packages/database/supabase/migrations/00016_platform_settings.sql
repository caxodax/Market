-- ==============================================================================
-- 00016_platform_settings.sql
-- Platform / SaaS White-Label Settings, Support Channels & Branding Customization
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    platform_name TEXT NOT NULL DEFAULT 'MarketOS',
    platform_tagline TEXT NOT NULL DEFAULT 'Consola Centralizada Multi-Tenant SaaS',
    logo_url TEXT NULL,
    support_phone TEXT NULL,
    support_email TEXT NULL,
    support_whatsapp TEXT NULL,
    currency_symbol TEXT NOT NULL DEFAULT '$',
    contact_address TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Super Admins have full access to manage platform settings
DROP POLICY IF EXISTS "Platform Super Admin can manage platform settings" ON public.platform_settings;
CREATE POLICY "Platform Super Admin can manage platform settings"
ON public.platform_settings FOR ALL
USING (public.is_super_admin());

-- Authenticated users and tenants can read platform branding and official support channels
DROP POLICY IF EXISTS "Authenticated users can read platform settings" ON public.platform_settings;
CREATE POLICY "Authenticated users can read platform settings"
ON public.platform_settings FOR SELECT
USING (true);

-- Seed initial default configuration row if not already present
INSERT INTO public.platform_settings (
    id,
    platform_name,
    platform_tagline,
    logo_url,
    support_phone,
    support_email,
    support_whatsapp,
    currency_symbol,
    contact_address
)
VALUES (
    'default',
    'MarketOS',
    'Consola Centralizada Multi-Tenant SaaS',
    NULL,
    '+58 412-0000000',
    'soporte@marketos.com',
    '+58 412-0000000',
    '$',
    'Torre Empresarial, Piso 10'
)
ON CONFLICT (id) DO NOTHING;
