-- Migration: 00017_mto_cpq_engine.sql
-- Description: Universal Make-to-Order / CPQ (Configure, Price, Quote) & Cost-Plus engine schema
-- Architecture: Core-isolated, pure decimals, zero country/currency coupling.

-- 1. Cost & Margin Settings per Tenant
CREATE TABLE IF NOT EXISTS cpq_cost_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  default_margin_percentage NUMERIC(5,2) NOT NULL DEFAULT 45.00 CHECK (default_margin_percentage >= 0 AND default_margin_percentage < 100),
  hourly_labor_rate NUMERIC(10,2) NOT NULL DEFAULT 15.00 CHECK (hourly_labor_rate >= 0),
  machine_cost_per_hour NUMERIC(10,2) NOT NULL DEFAULT 5.00 CHECK (machine_cost_per_hour >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cpq_cost_settings_tenant UNIQUE (tenant_id)
);

-- 2. Pricing & Dimension Matrices
CREATE TABLE IF NOT EXISTS cpq_pricing_matrices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calculation_type TEXT NOT NULL CHECK (calculation_type IN ('AREA', 'LINEAR', 'UNITARY_CUSTOM', 'VOLUME', 'TIERED_VOLUME')),
  min_billable_unit NUMERIC(10,4) NOT NULL DEFAULT 1.0 CHECK (min_billable_unit >= 0),
  setup_fee NUMERIC(10,2) NOT NULL DEFAULT 0.0 CHECK (setup_fee >= 0),
  waste_factor NUMERIC(5,4) NOT NULL DEFAULT 0.05 CHECK (waste_factor >= 0 AND waste_factor <= 1.0),
  base_material_cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0.0 CHECK (base_material_cost_per_unit >= 0),
  base_labor_minutes NUMERIC(10,2) NOT NULL DEFAULT 0.0 CHECK (base_labor_minutes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Attribute Options with Raw Consumables and Labor Minutes
CREATE TABLE IF NOT EXISTS cpq_attribute_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_id UUID NOT NULL REFERENCES cpq_pricing_matrices(id) ON DELETE CASCADE,
  attribute_name TEXT NOT NULL,
  label TEXT NOT NULL,
  material_cost NUMERIC(10,2) NOT NULL DEFAULT 0.0 CHECK (material_cost >= 0),
  labor_minutes NUMERIC(10,2) NOT NULL DEFAULT 0.0 CHECK (labor_minutes >= 0),
  price_modifier NUMERIC(10,2) DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tiered Volume Scale Discounts
CREATE TABLE IF NOT EXISTS cpq_volume_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_id UUID NOT NULL REFERENCES cpq_pricing_matrices(id) ON DELETE CASCADE,
  min_quantity INT NOT NULL CHECK (min_quantity >= 1),
  max_quantity INT CHECK (max_quantity IS NULL OR max_quantity >= min_quantity),
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. CPQ Quotes (Dual View: Customer Price vs Owner Internal Cost & Net Margin)
CREATE TABLE IF NOT EXISTS cpq_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED')),
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.0 CHECK (total_cost >= 0),
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0.0 CHECK (total_price >= 0),
  net_margin_amount NUMERIC(12,2) NOT NULL DEFAULT 0.0,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cpq_quotes_number_tenant UNIQUE (tenant_id, quote_number)
);

-- 6. Items inside a Quote
CREATE TABLE IF NOT EXISTS cpq_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES cpq_quotes(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  selected_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  cost_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.0 CHECK (unit_cost >= 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.0 CHECK (unit_price >= 0),
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0.0 CHECK (total_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Production Work Orders (Floor / Shop Sheet without financials)
CREATE TABLE IF NOT EXISTS cpq_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES cpq_quotes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'IN_PROCESS', 'READY', 'DELIVERED')),
  production_sheet JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Milestone Payment Tracking (e.g. 50% advance, balance on dispatch)
CREATE TABLE IF NOT EXISTS cpq_order_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.0 CHECK (paid_amount >= 0),
  pending_balance NUMERIC(12,2) NOT NULL CHECK (pending_balance >= 0),
  allow_dispatch_with_balance BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cpq_order_milestones_order UNIQUE (order_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cpq_pricing_matrices_tenant ON cpq_pricing_matrices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cpq_attribute_options_matrix ON cpq_attribute_options(matrix_id);
CREATE INDEX IF NOT EXISTS idx_cpq_volume_tiers_matrix ON cpq_volume_tiers(matrix_id);
CREATE INDEX IF NOT EXISTS idx_cpq_quotes_tenant ON cpq_quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cpq_quote_items_quote ON cpq_quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_cpq_work_orders_tenant ON cpq_work_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cpq_work_orders_order ON cpq_work_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_cpq_order_milestones_order ON cpq_order_milestones(order_id);

-- Enable RLS
ALTER TABLE cpq_cost_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpq_pricing_matrices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpq_attribute_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpq_volume_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpq_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpq_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpq_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpq_order_milestones ENABLE ROW LEVEL SECURITY;

-- Standard Multi-tenant RLS Policies (Supports both standard Supabase auth helper functions & session variables)
DROP POLICY IF EXISTS "Tenant isolation for cpq_cost_settings" ON cpq_cost_settings;
CREATE POLICY "Tenant isolation for cpq_cost_settings" ON cpq_cost_settings
  FOR ALL USING (
    tenant_id = public.current_user_tenant_id() 
    OR public.is_super_admin() 
    OR tenant_id = current_setting('app.current_tenant_id', true) 
    OR current_setting('app.is_super_admin', true) = 'true'
  );

DROP POLICY IF EXISTS "Tenant isolation for cpq_pricing_matrices" ON cpq_pricing_matrices;
CREATE POLICY "Tenant isolation for cpq_pricing_matrices" ON cpq_pricing_matrices
  FOR ALL USING (
    tenant_id = public.current_user_tenant_id() 
    OR public.is_super_admin() 
    OR tenant_id = current_setting('app.current_tenant_id', true) 
    OR current_setting('app.is_super_admin', true) = 'true'
  );

DROP POLICY IF EXISTS "Tenant isolation for cpq_attribute_options" ON cpq_attribute_options;
CREATE POLICY "Tenant isolation for cpq_attribute_options" ON cpq_attribute_options
  FOR ALL USING (
    matrix_id IN (
      SELECT id FROM cpq_pricing_matrices 
      WHERE tenant_id = public.current_user_tenant_id() 
         OR public.is_super_admin() 
         OR tenant_id = current_setting('app.current_tenant_id', true) 
         OR current_setting('app.is_super_admin', true) = 'true'
    )
  );

DROP POLICY IF EXISTS "Tenant isolation for cpq_volume_tiers" ON cpq_volume_tiers;
CREATE POLICY "Tenant isolation for cpq_volume_tiers" ON cpq_volume_tiers
  FOR ALL USING (
    matrix_id IN (
      SELECT id FROM cpq_pricing_matrices 
      WHERE tenant_id = public.current_user_tenant_id() 
         OR public.is_super_admin() 
         OR tenant_id = current_setting('app.current_tenant_id', true) 
         OR current_setting('app.is_super_admin', true) = 'true'
    )
  );

DROP POLICY IF EXISTS "Tenant isolation for cpq_quotes" ON cpq_quotes;
CREATE POLICY "Tenant isolation for cpq_quotes" ON cpq_quotes
  FOR ALL USING (
    tenant_id = public.current_user_tenant_id() 
    OR public.is_super_admin() 
    OR tenant_id = current_setting('app.current_tenant_id', true) 
    OR current_setting('app.is_super_admin', true) = 'true'
  );

DROP POLICY IF EXISTS "Tenant isolation for cpq_quote_items" ON cpq_quote_items;
CREATE POLICY "Tenant isolation for cpq_quote_items" ON cpq_quote_items
  FOR ALL USING (
    quote_id IN (
      SELECT id FROM cpq_quotes 
      WHERE tenant_id = public.current_user_tenant_id() 
         OR public.is_super_admin() 
         OR tenant_id = current_setting('app.current_tenant_id', true) 
         OR current_setting('app.is_super_admin', true) = 'true'
    )
  );

DROP POLICY IF EXISTS "Tenant isolation for cpq_work_orders" ON cpq_work_orders;
CREATE POLICY "Tenant isolation for cpq_work_orders" ON cpq_work_orders
  FOR ALL USING (
    tenant_id = public.current_user_tenant_id() 
    OR public.is_super_admin() 
    OR tenant_id = current_setting('app.current_tenant_id', true) 
    OR current_setting('app.is_super_admin', true) = 'true'
  );

DROP POLICY IF EXISTS "Tenant isolation for cpq_order_milestones" ON cpq_order_milestones;
CREATE POLICY "Tenant isolation for cpq_order_milestones" ON cpq_order_milestones
  FOR ALL USING (
    order_id IN (
      SELECT id FROM orders 
      WHERE tenant_id = public.current_user_tenant_id() 
         OR public.is_super_admin() 
         OR tenant_id = current_setting('app.current_tenant_id', true) 
         OR current_setting('app.is_super_admin', true) = 'true'
    )
  );
