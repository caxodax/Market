-- =====================================================================
-- MARKETOS TENANT ANALYTICS & AUDIENCE INTELLIGENCE
-- Migration: 00024_tenant_analytics.sql
-- Description: Creates tenant_page_views for traffic tracking,
--              acquisition source attribution, and conversion rates.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.tenant_page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    session_id TEXT,
    device_type TEXT DEFAULT 'desktop', -- 'mobile', 'desktop', 'tablet', 'other'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for analytics dashboards & aggregations
CREATE INDEX IF NOT EXISTS idx_tenant_page_views_tenant_date 
ON public.tenant_page_views (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_page_views_path 
ON public.tenant_page_views (tenant_id, path);

CREATE INDEX IF NOT EXISTS idx_tenant_page_views_session 
ON public.tenant_page_views (tenant_id, session_id);

CREATE INDEX IF NOT EXISTS idx_tenant_page_views_source 
ON public.tenant_page_views (tenant_id, utm_source);

-- Enable Row-Level Security
ALTER TABLE public.tenant_page_views ENABLE ROW LEVEL SECURITY;

-- 1. Anonymous / Public Tracking Insert: allow visitors to log page views
DROP POLICY IF EXISTS "Public can record tenant page views" ON public.tenant_page_views;
CREATE POLICY "Public can record tenant page views"
ON public.tenant_page_views FOR INSERT
WITH CHECK (true);

-- 2. Tenant Staff & Super Admins Read Policy
DROP POLICY IF EXISTS "Tenant staff can view their tenant page views" ON public.tenant_page_views;
CREATE POLICY "Tenant staff can view their tenant page views"
ON public.tenant_page_views FOR SELECT
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 3. Super Admins Full Management
DROP POLICY IF EXISTS "Super admins have full access to tenant page views" ON public.tenant_page_views;
CREATE POLICY "Super admins have full access to tenant page views"
ON public.tenant_page_views FOR ALL
USING (public.is_super_admin());
