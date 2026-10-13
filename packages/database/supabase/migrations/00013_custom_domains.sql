-- =====================================================================
-- MARKETOS - MIGRACIÓN 00013: CUSTOM DOMAINS SUPPORT
-- Add custom_domain to tenants and tenant_settings with unique index
-- =====================================================================

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain 
ON public.tenants (custom_domain);

ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS custom_domain TEXT;
