-- =====================================================================
-- PLUGIN: CRAFT WORKSHOP (SUBLIMACIÓN, DTF, VINIL & PAPELERÍA)
-- Migration: 00033_craft_workshop_plugin.sql
-- Compatible con Modelo Bimonetario y Arquitectura RPC MarketOS
-- =====================================================================

-- 0. EXTENDER TABLA PRODUCTS PARA SOPORTAR COST_PRICE DE CONTABILIDAD
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT NULL;

-- 1. CATÁLOGO MAESTRO DE INSUMOS / MATERIA PRIMA
CREATE TABLE IF NOT EXISTS public.craft_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'sublimacion', 
    -- Valores: 'sublimacion', 'dtf', 'vinil', 'papeleria', 'esferas', 'empaque', 'envio', 'general'
    sku TEXT,
    pack_quantity NUMERIC(12, 3) NOT NULL DEFAULT 1 CHECK (pack_quantity > 0),
    pack_price_base NUMERIC(12, 2) NOT NULL DEFAULT 0, -- En moneda base del tenant (USD/EUR)
    unit_cost_base NUMERIC(12, 4) GENERATED ALWAYS AS (
        pack_price_base / pack_quantity
    ) STORED,
    unit_measure TEXT NOT NULL DEFAULT 'UNIDAD', -- 'UNIDAD', 'HOJA', 'METRO', 'CM2', 'ML', 'GRAMO', 'USO'
    stock_packs NUMERIC(12, 3) NOT NULL DEFAULT 0,
    min_stock_packs NUMERIC(12, 3) NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_craft_materials_tenant_cat 
ON public.craft_materials (tenant_id, category, is_active);

-- 2. CABECERA DE RECETAS / ESCANDALLOS TÉCNICOS
CREATE TABLE IF NOT EXISTS public.craft_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    technique TEXT NOT NULL DEFAULT 'sublimacion',
    category_name TEXT DEFAULT 'General',
    -- Costos operativos reales de taller
    materials_cost_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    waste_percentage NUMERIC(5, 2) NOT NULL DEFAULT 5.00, -- % Merma (fallos de calor/corte/pelado)
    labor_cost_base NUMERIC(12, 2) NOT NULL DEFAULT 0,    -- Mano de obra / desgaste de plancha/plotter
    direct_cost_base NUMERIC(12, 2) GENERATED ALWAYS AS (
        ROUND((materials_cost_base * (1 + (waste_percentage / 100.0))) + labor_cost_base, 2)
    ) STORED,
    pricing_formula TEXT NOT NULL DEFAULT 'MARGIN', -- 'MARGIN' (sobre venta) | 'MARKUP' (sobre costo)
    margin_percentage NUMERIC(5, 2) NOT NULL DEFAULT 30.00,
    selling_price_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    wholesale_price_base NUMERIC(12, 2) DEFAULT NULL, -- Precio al mayor opcional (ej. +12 uds)
    profit_base NUMERIC(12, 2) GENERATED ALWAYS AS (
        selling_price_base - ROUND((materials_cost_base * (1 + (waste_percentage / 100.0))) + labor_cost_base, 2)
    ) STORED,
    has_pending_recalc BOOLEAN NOT NULL DEFAULT false, -- Flag automático si sube un insumo
    is_published BOOLEAN NOT NULL DEFAULT false,
    product_id UUID NULL REFERENCES public.products(id) ON DELETE SET NULL,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_craft_recipes_tenant 
ON public.craft_recipes (tenant_id, technique, is_active);

-- 3. RENGLONES DE INSUMOS POR RECETA (Relacional + Rápido para Recálculo en Cascada)
CREATE TABLE IF NOT EXISTS public.craft_recipe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES public.craft_recipes(id) ON DELETE CASCADE,
    material_id UUID NULL REFERENCES public.craft_materials(id) ON DELETE SET NULL,
    custom_name TEXT NOT NULL, -- Nombre del insumo (sincronizado o libre)
    pack_qty_snapshot NUMERIC(12, 3) NOT NULL DEFAULT 1,
    pack_price_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unit_cost_snapshot NUMERIC(12, 4) NOT NULL DEFAULT 0,
    qty_to_use NUMERIC(12, 4) NOT NULL DEFAULT 1,
    cost_used_base NUMERIC(12, 4) GENERATED ALWAYS AS (unit_cost_snapshot * qty_to_use) STORED,
    is_checked BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_craft_recipe_items_recipe ON public.craft_recipe_items (recipe_id);
CREATE INDEX IF NOT EXISTS idx_craft_recipe_items_material ON public.craft_recipe_items (material_id);

-- 4. COTIZACIONES RÁPIDAS PARA WHATSAPP CON ANTICIPO Y CONVERSIÓN A ORDEN
CREATE TABLE IF NOT EXISTS public.craft_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    quote_number TEXT NOT NULL, -- ej. "COT-00124"
    customer_name TEXT,
    customer_phone TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    shipping_notes TEXT,
    shipping_cost_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    subtotal_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    base_currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate_applied NUMERIC(14, 4) NOT NULL DEFAULT 1,
    total_secondary NUMERIC(14, 2) NOT NULL DEFAULT 0, -- Equivalente en Bs.
    deposit_percentage NUMERIC(5, 2) NOT NULL DEFAULT 50.00, -- 50% abono estándar en sublimación
    deposit_required_base NUMERIC(12, 2) GENERATED ALWAYS AS (
        ROUND(total_base * (deposit_percentage / 100.0), 2)
    ) STORED,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'sent_whatsapp', 'converted_to_order'
    converted_order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, quote_number)
);

CREATE INDEX IF NOT EXISTS idx_craft_quotes_tenant 
ON public.craft_quotes (tenant_id, created_at DESC);

-- 5. POLÍTICAS ROW LEVEL SECURITY (RLS)
ALTER TABLE public.craft_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craft_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craft_recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craft_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for craft_materials" ON public.craft_materials;
CREATE POLICY "Tenant isolation for craft_materials"
ON public.craft_materials FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for craft_recipes" ON public.craft_recipes;
CREATE POLICY "Tenant isolation for craft_recipes"
ON public.craft_recipes FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for craft_recipe_items" ON public.craft_recipe_items;
CREATE POLICY "Tenant isolation for craft_recipe_items"
ON public.craft_recipe_items FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for craft_quotes" ON public.craft_quotes;
CREATE POLICY "Tenant isolation for craft_quotes"
ON public.craft_quotes FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 6. RPC ATÓMICO: RECALCULAR TODAS LAS RECETAS AL SUBIR PRECIOS DE INSUMOS
CREATE OR REPLACE FUNCTION public.rpc_recalculate_craft_recipes(
    p_tenant_id TEXT,
    p_sync_storefront BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_recipes INT := 0;
    v_synced_products INT := 0;
BEGIN
    -- 1. Actualizar snapshots de costos en los renglones vinculados a insumos maestros
    UPDATE public.craft_recipe_items cri
    SET 
        pack_qty_snapshot = cm.pack_quantity,
        pack_price_snapshot = cm.pack_price_base,
        unit_cost_snapshot = cm.unit_cost_base
    FROM public.craft_materials cm
    WHERE cri.material_id = cm.id
      AND cri.tenant_id = p_tenant_id
      AND cm.tenant_id = p_tenant_id;

    -- 2. Recalcular costo de materiales y nuevo precio sugerido en cada receta del tenant
    WITH recipe_sums AS (
        SELECT 
            recipe_id,
            COALESCE(SUM(CASE WHEN is_checked THEN unit_cost_snapshot * qty_to_use ELSE 0 END), 0) AS new_mat_cost
        FROM public.craft_recipe_items
        WHERE tenant_id = p_tenant_id
        GROUP BY recipe_id
    )
    UPDATE public.craft_recipes cr
    SET 
        materials_cost_base = ROUND(rs.new_mat_cost, 2),
        selling_price_base = CASE 
            WHEN cr.pricing_formula = 'MARGIN' AND cr.margin_percentage < 100 THEN
                ROUND(
                    ((rs.new_mat_cost * (1 + (cr.waste_percentage / 100.0))) + cr.labor_cost_base) 
                    / (1.0 - (cr.margin_percentage / 100.0)), 
                2)
            ELSE
                ROUND(
                    ((rs.new_mat_cost * (1 + (cr.waste_percentage / 100.0))) + cr.labor_cost_base) 
                    * (1.0 + (cr.margin_percentage / 100.0)), 
                2)
        END,
        has_pending_recalc = false,
        updated_at = NOW()
    FROM recipe_sums rs
    WHERE cr.id = rs.recipe_id
      AND cr.tenant_id = p_tenant_id;

    GET DIAGNOSTICS v_updated_recipes = ROW_COUNT;

    -- 3. Si el usuario solicitó sincronizar precios y costos con el catálogo público (products)
    IF p_sync_storefront THEN
        UPDATE public.products p
        SET 
            price_usd = cr.selling_price_base,
            cost_price = cr.direct_cost_base,
            updated_at = NOW()
        FROM public.craft_recipes cr
        WHERE cr.product_id = p.id
          AND cr.tenant_id = p_tenant_id
          AND p.tenant_id = p_tenant_id
          AND cr.is_published = true;

        GET DIAGNOSTICS v_synced_products = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'updated_recipes', v_updated_recipes,
        'synced_products', v_synced_products
    );
END;
$$;

-- 7. TRIGGER: ALERTA DE INFLACIÓN (MARCAR has_pending_recalc AL VARIAR PRECIO DE INSUMO)
CREATE OR REPLACE FUNCTION public.fn_flag_recipes_on_material_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.pack_price_base IS DISTINCT FROM OLD.pack_price_base 
       OR NEW.pack_quantity IS DISTINCT FROM OLD.pack_quantity THEN
        UPDATE public.craft_recipes cr
        SET has_pending_recalc = true,
            updated_at = NOW()
        FROM public.craft_recipe_items cri
        WHERE cri.recipe_id = cr.id
          AND cri.material_id = NEW.id
          AND cr.tenant_id = NEW.tenant_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_craft_material_price_change ON public.craft_materials;
CREATE TRIGGER trg_craft_material_price_change
AFTER UPDATE OF pack_price_base, pack_quantity ON public.craft_materials
FOR EACH ROW
EXECUTE FUNCTION public.fn_flag_recipes_on_material_price_change();

