-- =====================================================================
-- PLUGIN: PRINTO PINK CALCULATOR (COSTEO RÁPIDO & COTIZADOR TALLER)
-- Migration: 00035_printopink_calculator_plugin.sql
-- Compatible con Modelo Bimonetario, Aislamiento RLS Zero-Trust y Ponytail Ultra
-- =====================================================================

-- 1. TABLA DE FICHAS DE COSTEO RÁPIDO (CÁLCULOS GUARDADOS)
CREATE TABLE IF NOT EXISTS public.printopink_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    preset_category TEXT NOT NULL DEFAULT 'custom',
    -- Categorías: 'stickers', 'paper_print', 'lamination', 'textile', 'packaging', 'custom'
    materials_cost_base NUMERIC(12, 4) NOT NULL DEFAULT 0,
    machinery_cost_base NUMERIC(12, 4) NOT NULL DEFAULT 0,
    labor_cost_base NUMERIC(12, 4) NOT NULL DEFAULT 0,
    waste_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    total_cost_base NUMERIC(12, 4) NOT NULL DEFAULT 0,
    selling_price_base NUMERIC(12, 4) NOT NULL DEFAULT 0,
    wholesale_price_base NUMERIC(12, 4) DEFAULT NULL,
    net_profit_base NUMERIC(12, 4) NOT NULL DEFAULT 0,
    margin_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    materials_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_printopink_calc_tenant 
ON public.printopink_calculations (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_printopink_calc_cat 
ON public.printopink_calculations (tenant_id, preset_category, is_active);

-- 2. TABLA DE COTIZACIONES RÁPIDAS (WHATSAPP 50% ANTICIPO)
CREATE TABLE IF NOT EXISTS public.printopink_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    quote_number TEXT NOT NULL,
    customer_name TEXT DEFAULT NULL,
    customer_phone TEXT DEFAULT NULL,
    total_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    deposit_required_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    pending_balance_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, quote_number)
);

CREATE INDEX IF NOT EXISTS idx_printopink_quotes_tenant 
ON public.printopink_quotes (tenant_id, created_at DESC);

-- 3. POLÍTICAS ROW LEVEL SECURITY (RLS)
ALTER TABLE public.printopink_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printopink_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for printopink_calculations" ON public.printopink_calculations;
CREATE POLICY "Tenant isolation for printopink_calculations"
ON public.printopink_calculations FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for printopink_quotes" ON public.printopink_quotes;
CREATE POLICY "Tenant isolation for printopink_quotes"
ON public.printopink_quotes FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 4. ACTIVACIÓN IDEMPOTENTE DEL MÓDULO PARA TENANT 'printopink'
INSERT INTO public.tenant_modules (tenant_id, module_id, is_active, enabled_at)
VALUES ('printopink', 'printopink_calculator', true, NOW())
ON CONFLICT (tenant_id, module_id) 
DO UPDATE SET is_active = true, updated_at = NOW();
