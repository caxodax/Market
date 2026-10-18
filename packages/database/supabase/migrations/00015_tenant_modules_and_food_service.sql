-- =====================================================================
-- MARKETOS MODULAR PLUGINS & FOOD SERVICE SYSTEM
-- Migration: 00015_tenant_modules_and_food_service.sql
-- Description: Creates dynamic plugin management (tenant_modules)
--              and domain tables for gastronomy/fast food (Pulldog)
-- =====================================================================

-- ─── 1. TENANT MODULES (PLUGINS) ────────────────────────────────────
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

-- RLS for tenant_modules
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins have full access to tenant_modules" ON public.tenant_modules;
CREATE POLICY "Super admins have full access to tenant_modules"
ON public.tenant_modules FOR ALL
USING (public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can view active modules" ON public.tenant_modules;
CREATE POLICY "Tenant staff can view active modules"
ON public.tenant_modules FOR SELECT
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- ─── 2. RAW MATERIALS (INVENTARIO DE MATERIA PRIMA / INSUMOS) ─────────
CREATE TABLE IF NOT EXISTS public.raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    unit TEXT NOT NULL DEFAULT 'UNIT', -- 'UNIT', 'KG', 'G', 'L', 'ML', 'PORTION'
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

-- RLS for raw_materials
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can manage raw materials" ON public.raw_materials;
CREATE POLICY "Tenant staff can manage raw materials"
ON public.raw_materials FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- ─── 3. PRODUCT RECIPES (RECETAS / ESCANDALLO) ──────────────────────
CREATE TABLE IF NOT EXISTS public.product_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { raw_material_id, quantity, unit }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_product_recipe UNIQUE (tenant_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_recipes_product 
ON public.product_recipes (tenant_id, product_id);

-- RLS for product_recipes
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can manage recipes" ON public.product_recipes;
CREATE POLICY "Tenant staff can manage recipes"
ON public.product_recipes FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- ─── 4. PRODUCT MODIFIER GROUPS (SALSAS, TOPPINGS, EXTRAS) ──────────
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
    options JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { id, name, price_adjustment_usd, raw_material_id, is_default }
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_modifier_groups_lookup 
ON public.product_modifier_groups (tenant_id, is_active, sort_order);

-- RLS for product_modifier_groups
ALTER TABLE public.product_modifier_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can manage modifier groups" ON public.product_modifier_groups;
CREATE POLICY "Tenant staff can manage modifier groups"
ON public.product_modifier_groups FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- Public can read modifier groups for active products
DROP POLICY IF EXISTS "Public can view active modifier groups" ON public.product_modifier_groups;
CREATE POLICY "Public can view active modifier groups"
ON public.product_modifier_groups FOR SELECT
USING (is_active = true);
