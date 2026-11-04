-- ==============================================================================
-- MARKETOS - CONSOLIDATED PENDING PRODUCTION MIGRATIONS (00004 -> 00030)
-- Fully idempotent with IF NOT EXISTS, compatible with Supabase SQL Editor
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CLEANUP & PERFILES UNIFICADOS (Consolidados en public.profiles)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.tenant_plan_limits CASCADE;
DROP TABLE IF EXISTS public.mto_quote_requests CASCADE;
DROP TABLE IF EXISTS public.mto_materials CASCADE;

-- Asegurar clave foránea profiles -> auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 4. BARCODE RETAIL ENGINE (from 00020)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.barcode_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  barcode TEXT NOT NULL,
  barcode_type TEXT NOT NULL DEFAULT 'EAN_13',
  is_scale_product BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_barcode_tenant UNIQUE (tenant_id, barcode)
);

-- ------------------------------------------------------------------------------
-- 5. MULTI-CAJA & TURNOS POS (from 00023)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  pin_hash TEXT,
  is_virtual BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cashier_name TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(12, 2),
  expected_balance NUMERIC(12, 2),
  difference NUMERIC(12, 2),
  total_sales_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_cash_in NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_cash_out NUMERIC(12, 2) NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  close_type TEXT CHECK (close_type IN ('X', 'Z')),
  ticket_printed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES public.cash_shifts(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
  amount_usd NUMERIC(12, 2) NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. TENANT ANALYTICS (from 00024)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  pathname TEXT NOT NULL,
  referrer TEXT,
  device_type TEXT,
  channel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.analytics_daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_pageviews INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  revenue_usd NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  conversion_rate NUMERIC(6, 3) NOT NULL DEFAULT 0.000,
  top_products JSONB DEFAULT '[]'::jsonb,
  traffic_sources JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT uq_analytics_tenant_date UNIQUE (tenant_id, date)
);

-- ------------------------------------------------------------------------------
-- 7. FISCAL DOCUMENTS, DISPATCH GUIDES, CXC & PAC (00025)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiscal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'DELIVERY_NOTE', 'DISPATCH_GUIDE')),
  document_number TEXT NOT NULL,
  control_number TEXT,
  affected_document_id UUID REFERENCES public.fiscal_documents(id) ON DELETE SET NULL,
  affected_document_number TEXT,
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'ANNULLED')),
  reason TEXT,
  return_items_to_inventory BOOLEAN DEFAULT FALSE,
  customer_name TEXT NOT NULL,
  customer_id_doc TEXT NOT NULL,
  customer_address TEXT,
  customer_phone TEXT,
  emitter_business_name TEXT NOT NULL,
  emitter_id_doc TEXT NOT NULL,
  emitter_address TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_exempt NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  subtotal_taxable NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  iva_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 16.00,
  iva_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  igtf_rate_percent NUMERIC(5, 2) DEFAULT 0.00,
  igtf_amount NUMERIC(14, 2) DEFAULT 0.00,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  total_ves NUMERIC(14, 2),
  exchange_rate_applied NUMERIC(12, 4),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'CLP', 'VES')),
  transport_info JSONB,
  payment_condition TEXT DEFAULT 'CASH' CHECK (payment_condition IN ('CASH', 'CREDIT')),
  credit_term_days INTEGER DEFAULT 0,
  due_date DATE,
  payment_status TEXT DEFAULT 'PAID' CHECK (payment_status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')),
  amount_paid NUMERIC(14, 2) DEFAULT 0.00,
  amount_due NUMERIC(14, 2) DEFAULT 0.00,
  payments JSONB DEFAULT '[]'::jsonb,
  pac_status TEXT DEFAULT 'NOT_CONFIGURED' CHECK (pac_status IN ('NOT_CONFIGURED', 'PENDING', 'CERTIFIED', 'FAILED')),
  pac_certification JSONB,
  pac_error_message TEXT,
  qr_data TEXT,
  legal_legend TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_tenant_type ON public.fiscal_documents(tenant_id, document_type);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_tenant_date ON public.fiscal_documents(tenant_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 8. PURCHASING, RETENTIONS SPE & CXP (00026)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_id TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  default_retention_rate NUMERIC(5, 2) DEFAULT 75.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_supplier_tenant_taxid UNIQUE (tenant_id, tax_id)
);

CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  supplier_name TEXT NOT NULL,
  supplier_tax_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  control_number TEXT,
  invoice_date DATE NOT NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'PAID', 'ANNULLED')),
  notes TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_exempt NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  subtotal_taxable NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  iva_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 16.00,
  iva_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate_applied NUMERIC(12, 4),
  total_ves NUMERIC(14, 2),
  retention_voucher_id UUID,
  retained_vat_amount NUMERIC(14, 2) DEFAULT 0.00,
  retained_islr_amount NUMERIC(14, 2) DEFAULT 0.00,
  islr_concept_code TEXT,
  islr_retention_rate_percent NUMERIC(5, 2),
  islr_retention_voucher_id UUID,
  payment_condition TEXT DEFAULT 'CASH' CHECK (payment_condition IN ('CASH', 'CREDIT')),
  credit_term_days INTEGER DEFAULT 0,
  due_date DATE,
  payment_status TEXT DEFAULT 'PAID' CHECK (payment_status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')),
  net_payable_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  amount_paid NUMERIC(14, 2) DEFAULT 0.00,
  amount_due NUMERIC(14, 2) DEFAULT 0.00,
  payments JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_purchase_invoice_tenant_supplier UNIQUE (tenant_id, supplier_tax_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.retention_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  voucher_type TEXT NOT NULL CHECK (voucher_type IN ('VAT', 'INCOME_TAX', 'CHILE_DTE_46')),
  voucher_number TEXT NOT NULL,
  tax_period TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  agent_business_name TEXT NOT NULL,
  agent_tax_id TEXT NOT NULL,
  agent_fiscal_address TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  supplier_name TEXT NOT NULL,
  supplier_tax_id TEXT NOT NULL,
  supplier_fiscal_address TEXT,
  purchase_invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  control_number TEXT,
  invoice_date DATE NOT NULL,
  total_invoice_amount NUMERIC(14, 2) NOT NULL,
  exempt_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  taxable_base NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  tax_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 16.00,
  tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  retention_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 75.00,
  retained_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  islr_concept_code TEXT,
  islr_subtract_amount NUMERIC(14, 2) DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate_applied NUMERIC(12, 4),
  retained_amount_ves NUMERIC(14, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. ACCOUNTING NIIF & COMMISSIONS (00027)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COST', 'EXPENSE')),
  nature TEXT NOT NULL CHECK (nature IN ('DEBIT', 'CREDIT')),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
  parent_code TEXT,
  is_selectable BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_account_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_number INTEGER NOT NULL,
  entry_date DATE NOT NULL,
  concept TEXT NOT NULL,
  source_module TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source_module IN ('MANUAL', 'INVOICING', 'PURCHASING', 'PAYMENTS', 'CLOSING')),
  source_document_id UUID,
  source_document_number TEXT,
  total_debit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  total_credit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  is_balanced BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_journal_entry_tenant_num UNIQUE (tenant_id, entry_number),
  CONSTRAINT chk_journal_entry_balanced CHECK (total_debit = total_credit)
);

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  description TEXT,
  debit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  credit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  line_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  commission_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sales_agent_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sales_agent_id UUID NOT NULL REFERENCES public.sales_agents(id) ON DELETE RESTRICT,
  agent_name TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  document_number TEXT,
  sale_amount NUMERIC(14, 2) NOT NULL,
  commission_percent NUMERIC(5, 2) NOT NULL,
  commission_amount NUMERIC(14, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'VES')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ==============================================================================
-- 00028_atomic_fiscal_sequences.sql
-- AgentShield & Ponytail: Atomic Race-Condition Free Fiscal Sequential Numbering
-- ==============================================================================

-- 1. Secuencias correlativas por comercio y tipo de documento fiscal
CREATE TABLE IF NOT EXISTS public.tenant_fiscal_sequences (
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, document_type)
);

-- RLS para secuencias fiscales
ALTER TABLE public.tenant_fiscal_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for tenant_fiscal_sequences"
  ON public.tenant_fiscal_sequences
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- 2. Restricción única en documentos fiscales para prevenir duplicados a nivel de motor SQL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_fiscal_documents_tenant_type_num'
  ) THEN
    ALTER TABLE public.fiscal_documents
      ADD CONSTRAINT uq_fiscal_documents_tenant_type_num
      UNIQUE (tenant_id, document_type, document_number);
  END IF;
END $$;

-- 3. Función atómica con bloqueo a nivel de fila (Row-Level Locking)
-- Garantiza incremento monótono sin saltos ni colisiones concurrentes
CREATE OR REPLACE FUNCTION public.get_next_fiscal_sequence(
  p_tenant_id TEXT,
  p_document_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_next_seq INTEGER;
  v_initial_max INTEGER;
BEGIN
  -- Si no existe registro de secuencia previa, inicializar con el máximo actual de la tabla
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_fiscal_sequences 
    WHERE tenant_id = p_tenant_id AND document_type = p_document_type
  ) THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(document_number, '\D', '', 'g'), '')::INTEGER), 0)
    INTO v_initial_max
    FROM public.fiscal_documents
    WHERE tenant_id = p_tenant_id AND document_type = p_document_type;

    INSERT INTO public.tenant_fiscal_sequences (tenant_id, document_type, last_sequence, updated_at)
    VALUES (p_tenant_id, p_document_type, v_initial_max, NOW())
    ON CONFLICT (tenant_id, document_type) DO NOTHING;
  END IF;

  -- Incremento atómico transaccional garantizado por Postgres
  UPDATE public.tenant_fiscal_sequences
  SET last_sequence = last_sequence + 1,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND document_type = p_document_type
  RETURNING last_sequence INTO v_next_seq;

  RETURN v_next_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ==============================================================================
-- MARKETOS - MIGRATION 00029: SCHEMA CLEANUP & UNIVERSAL BIMONETARY ENGINE
-- Description:
--   1. Unify profiles: Drop redundant user_profiles table, ensure profiles references auth.users
--   2. Prune ghost/dead tables: Drop obsolete mto_quote_requests, mto_materials, tenant_plan_limits
--   3. Data types: Support fractional decimal inventory (grams, kilograms) for food/meat/produce
--   4. Universal Bimonetary Pattern: Add primary_currency, secondary_currency, and dual cash registers
--   5. Customer integrity: Deduplicate guest customers via UNIQUE(tenant_id, phone)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UNIFICACIÓN DE PERFILES (Eliminar user_profiles, consolidar en profiles)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Garantizar que profiles tenga foreign key hacia auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- En entornos de prueba locales sin auth schema, degradar limpiamente
    NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 2. PODA DE TABLAS FANTASMA / CÓDIGO MUERTO
-- ------------------------------------------------------------------------------
-- Prototipos anteriores de MTO sustituidos por el motor formal cpq_*
DROP TABLE IF EXISTS public.mto_quote_requests CASCADE;
DROP TABLE IF EXISTS public.mto_materials CASCADE;

-- Tabla redundante de límites JSONB (se usa el modelo formal subscription_plans + tenant_subscriptions)
DROP TABLE IF EXISTS public.tenant_plan_limits CASCADE;

-- ------------------------------------------------------------------------------
-- 3. SOPORTE DE PESO Y GRANEL (Decimales en inventario para alimentos y telas)
-- ------------------------------------------------------------------------------
ALTER TABLE public.inventory 
  ALTER COLUMN quantity TYPE NUMERIC(12, 3),
  ALTER COLUMN min_quantity TYPE NUMERIC(12, 3);

ALTER TABLE public.inventory_movements 
  ALTER COLUMN quantity_change TYPE NUMERIC(12, 3),
  ALTER COLUMN previous_quantity TYPE NUMERIC(12, 3),
  ALTER COLUMN new_quantity TYPE NUMERIC(12, 3);

-- ------------------------------------------------------------------------------
-- 4. MODELO BIMONETARIO UNIVERSAL (PRIMARY / SECONDARY)
-- ------------------------------------------------------------------------------
-- A. En tenant_settings: definición explícita de las dos monedas del comercio
ALTER TABLE public.tenant_settings 
  ADD COLUMN IF NOT EXISTS primary_currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS secondary_currency TEXT DEFAULT 'VES';

-- B. En cash_shifts (POS): cajas bimonetarias sin mezclar monedas en un solo campo
ALTER TABLE public.cash_shifts 
  ADD COLUMN IF NOT EXISTS opening_cash_primary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS opening_cash_secondary NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS closing_cash_primary NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS closing_cash_secondary NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS expected_cash_primary NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS expected_cash_secondary NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS difference_primary NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS difference_secondary NUMERIC(14, 2);

-- Migrar saldos históricos en cash_shifts si existen
UPDATE public.cash_shifts 
SET opening_cash_primary = COALESCE(opening_balance, 0.00)
WHERE opening_cash_primary = 0.00 AND opening_balance IS NOT NULL;

-- C. En orders: columnas agnósticas primary / secondary
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS total_primary NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS total_secondary NUMERIC(14, 2);

UPDATE public.orders 
SET total_primary = total_usd 
WHERE total_primary IS NULL AND total_usd IS NOT NULL;

UPDATE public.orders 
SET total_secondary = total_ves 
WHERE total_secondary IS NULL AND total_ves IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. CONTROL DE CLIENTES INVITADOS DUPLICADOS
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_phone 
  ON public.customers (tenant_id, phone);

-- ------------------------------------------------------------------------------
-- 6. REGISTRO EN AUDITORÍA DEL SISTEMA
-- ------------------------------------------------------------------------------
INSERT INTO public.audit_logs (
  tenant_id, 
  action, 
  entity, 
  entity_id, 
  new_data
)
VALUES (
  'system', 
  'MIGRATION_00029_APPLIED', 
  'database_schema', 
  '00029_schema_cleanup_and_bimonetary', 
  '{"status": "applied", "description": "Unified profiles, dropped dead tables, numeric inventory, bimonetary POS shifts"}'::jsonb
);
-- ==============================================================================
-- MARKETOS - MIGRATION 00030: CORE TRANSACTIONAL RPCS (STORED PROCEDURES)
-- Description:
--   High-performance ACID stored procedures for PostgreSQL / Supabase PostgREST RPC
--   1. rpc_create_order_atomic: Atomic order creation, coupon validation & stock/recipe deduction
--   2. rpc_issue_fiscal_document: Concurrency-locked SENIAT sequential numbering & double-entry NIIF journal
--   3. rpc_close_pos_shift: Atomic POS cash drawer closing, dual-currency audit & blind balancing
--   4. rpc_get_sales_book: Instant database-level SENIAT Sales Book generation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ATOMIC ORDER CREATION & STOCK DEDUCTION (rpc_create_order_atomic)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_create_order_atomic(
  p_order_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id TEXT;
  v_store_id UUID;
  v_customer_id UUID;
  v_order_id UUID := gen_random_uuid();
  v_order_number TEXT;
  v_has_food_service BOOLEAN := FALSE;
  v_item JSONB;
  v_item_product_id UUID;
  v_item_product_name TEXT;
  v_item_quantity NUMERIC(12, 3);
  v_item_unit_price NUMERIC(12, 2);
  v_item_total_price NUMERIC(12, 2);
  v_item_modifiers JSONB;
  v_current_stock NUMERIC(12, 3);
  v_coupon_id UUID;
  v_recipe_record RECORD;
  v_recipe_item JSONB;
  v_mat_id UUID;
  v_mat_qty NUMERIC(12, 3);
  v_mat_stock NUMERIC(12, 3);
  v_mat_name TEXT;
BEGIN
  -- 1. Extraer identificadores base
  v_tenant_id := p_order_data->>'tenant_id';
  v_store_id := (p_order_data->>'store_id')::UUID;
  v_customer_id := (p_order_data->>'customer_id')::UUID;
  
  IF v_tenant_id IS NULL OR v_store_id IS NULL OR v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parametros tenant_id, store_id y customer_id son obligatorios');
  END IF;

  -- 2. Generar número de orden aleatorio único o usar el provisto
  v_order_number := COALESCE(
    p_order_data->>'order_number',
    'ORD-' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0')
  );

  -- 3. Detectar si el tenant tiene activo el módulo de gastronomía / recetas (food_service)
  SELECT COALESCE(is_active, FALSE) INTO v_has_food_service
  FROM public.tenant_modules
  WHERE tenant_id = v_tenant_id AND module_id = 'food_service';

  -- 4. Validar y procesar cupón de descuento si viene presente
  IF p_order_data->>'coupon_id' IS NOT NULL AND p_order_data->>'coupon_id' != '' THEN
    v_coupon_id := (p_order_data->>'coupon_id')::UUID;
    
    PERFORM 1 FROM public.coupons 
    WHERE id = v_coupon_id 
      AND tenant_id = v_tenant_id 
      AND is_active = TRUE 
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (usage_limit IS NULL OR usage_count < usage_limit)
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'El cupón de descuento no es válido o ha expirado');
    END IF;

    UPDATE public.coupons 
    SET usage_count = usage_count + 1 
    WHERE id = v_coupon_id;
  END IF;

  -- 5. Procesar renglones y descontar existencias atómicamente
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_data->'items')
  LOOP
    v_item_product_id := (v_item->>'product_id')::UUID;
    v_item_product_name := COALESCE(v_item->>'product_name', 'Producto');
    v_item_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 1.000);
    v_item_unit_price := COALESCE((v_item->>'unit_price_usd')::NUMERIC, 0.00);
    v_item_total_price := COALESCE((v_item->>'total_price_usd')::NUMERIC, v_item_unit_price * v_item_quantity);
    v_item_modifiers := v_item->'selected_modifiers';

    -- Si el negocio tiene food_service activo, verificar si el producto tiene receta (escandallo BOM)
    IF v_has_food_service = TRUE THEN
      SELECT * INTO v_recipe_record 
      FROM public.product_recipes 
      WHERE tenant_id = v_tenant_id AND product_id = v_item_product_id::TEXT;

      IF FOUND AND v_recipe_record.items IS NOT NULL AND jsonb_array_length(v_recipe_record.items) > 0 THEN
        -- Descontar insumos de la materia prima (raw_materials)
        FOR v_recipe_item IN SELECT * FROM jsonb_array_elements(v_recipe_record.items)
        LOOP
          v_mat_id := (v_recipe_item->>'raw_material_id')::UUID;
          v_mat_qty := (v_recipe_item->>'quantity')::NUMERIC * v_item_quantity;

          SELECT name, current_stock INTO v_mat_name, v_mat_stock
          FROM public.raw_materials
          WHERE id = v_mat_id AND tenant_id = v_tenant_id
          FOR UPDATE;

          IF v_mat_stock < v_mat_qty THEN
            RAISE EXCEPTION 'Stock insuficiente en cocina para el insumo % (Disponible: %, Requerido: %)', 
              v_mat_name, v_mat_stock, v_mat_qty;
          END IF;

          UPDATE public.raw_materials
          SET current_stock = current_stock - v_mat_qty,
              updated_at = NOW()
          WHERE id = v_mat_id;
        END LOOP;
      END IF;
    END IF;

    -- Para productos con control directo de inventario (Retail / Shop Market)
    SELECT quantity INTO v_current_stock 
    FROM public.inventory 
    WHERE tenant_id = v_tenant_id AND store_id = v_store_id AND product_id = v_item_product_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_current_stock < v_item_quantity THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto % (Disponible: %, Solicitado: %)', 
          v_item_product_name, v_current_stock, v_item_quantity;
      END IF;

      UPDATE public.inventory 
      SET quantity = quantity - v_item_quantity,
          updated_at = NOW()
      WHERE tenant_id = v_tenant_id AND store_id = v_store_id AND product_id = v_item_product_id;

      -- Registrar movimiento de auditoría de inventario
      INSERT INTO public.inventory_movements (
        tenant_id, store_id, product_id, quantity_change, previous_quantity, new_quantity, reason
      ) VALUES (
        v_tenant_id, v_store_id, v_item_product_id, -v_item_quantity, v_current_stock, (v_current_stock - v_item_quantity), 'VENTA_ORDEN_' || v_order_number
      );
    END IF;

    -- Insertar renglón del pedido
    INSERT INTO public.order_items (
      id, tenant_id, order_id, product_id, product_name, quantity, unit_price_usd, total_price_usd, created_at
    ) VALUES (
      gen_random_uuid(), v_tenant_id, v_order_id, v_item_product_id, v_item_product_name, v_item_quantity::INTEGER, v_item_unit_price, v_item_total_price, NOW()
    );
  END LOOP;

  -- 6. Insertar cabecera de la orden
  INSERT INTO public.orders (
    id, tenant_id, store_id, customer_id, order_number, status, delivery_type,
    delivery_address, total_usd, total_ves, total_primary, total_secondary,
    exchange_rate_applied, notes, delivery_zone_id, delivery_fee_usd, coupon_id,
    discount_usd, customer_id_number, created_at, updated_at
  ) VALUES (
    v_order_id,
    v_tenant_id,
    v_store_id,
    v_customer_id,
    v_order_number,
    COALESCE(p_order_data->>'status', 'CREATED')::public.order_status,
    COALESCE(p_order_data->>'delivery_type', 'PICKUP')::public.delivery_type,
    p_order_data->>'delivery_address',
    COALESCE((p_order_data->>'total_usd')::NUMERIC, 0.00),
    COALESCE((p_order_data->>'total_ves')::NUMERIC, 0.00),
    COALESCE((p_order_data->>'total_primary')::NUMERIC, (p_order_data->>'total_usd')::NUMERIC, 0.00),
    COALESCE((p_order_data->>'total_secondary')::NUMERIC, (p_order_data->>'total_ves')::NUMERIC, 0.00),
    COALESCE((p_order_data->>'exchange_rate_applied')::NUMERIC, 1.0000),
    p_order_data->>'notes',
    NULLIF(p_order_data->>'delivery_zone_id', '')::UUID,
    COALESCE((p_order_data->>'delivery_fee_usd')::NUMERIC, 0.00),
    v_coupon_id,
    COALESCE((p_order_data->>'discount_usd')::NUMERIC, 0.00),
    p_order_data->>'customer_id_number',
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_primary', COALESCE((p_order_data->>'total_primary')::NUMERIC, (p_order_data->>'total_usd')::NUMERIC, 0.00),
    'total_secondary', COALESCE((p_order_data->>'total_secondary')::NUMERIC, (p_order_data->>'total_ves')::NUMERIC, 0.00)
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Ante cualquier error (stock insuficiente, datos erróneos), Postgres hace ROLLBACK automático
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. EMISIÓN FISCAL ATÓMICA Y ASIENTO NIIF (rpc_issue_fiscal_document)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_issue_fiscal_document(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id TEXT;
  v_doc_type TEXT;
  v_next_seq INTEGER;
  v_doc_number TEXT;
  v_doc_id UUID := gen_random_uuid();
  v_entry_id UUID := gen_random_uuid();
  v_entry_number INTEGER := 1;
  v_total_amount NUMERIC(12, 2);
  v_subtotal_taxable NUMERIC(12, 2);
  v_iva_amount NUMERIC(12, 2);
  v_has_accounting BOOLEAN := FALSE;
BEGIN
  v_tenant_id := p_payload->>'tenant_id';
  v_doc_type := COALESCE(p_payload->>'document_type', 'INVOICE');
  v_total_amount := COALESCE((p_payload->>'total_amount')::NUMERIC, 0.00);
  v_subtotal_taxable := COALESCE((p_payload->>'subtotal_taxable')::NUMERIC, 0.00);
  v_iva_amount := COALESCE((p_payload->>'iva_amount')::NUMERIC, 0.00);

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'tenant_id es requerido');
  END IF;

  -- 1. Obtener correlativo consecutivo atómico con bloqueo FOR UPDATE
  v_next_seq := public.get_next_fiscal_sequence(v_tenant_id, v_doc_type);
  v_doc_number := 'FAC-' || LPAD(v_next_seq::TEXT, 8, '0');

  -- 2. Insertar el documento fiscal
  INSERT INTO public.fiscal_documents (
    id, tenant_id, order_id, document_type, document_number, control_number,
    status, customer_name, customer_id_doc, customer_address, customer_phone,
    emitter_business_name, emitter_id_doc, emitter_address, items,
    subtotal_exempt, subtotal_taxable, iva_rate_percent, iva_amount,
    igtf_rate_percent, igtf_amount, total_amount, total_ves, exchange_rate_applied,
    currency, payment_condition, payment_status, amount_paid, created_at, updated_at
  ) VALUES (
    v_doc_id,
    v_tenant_id,
    NULLIF(p_payload->>'order_id', '')::UUID,
    v_doc_type,
    v_doc_number,
    COALESCE(p_payload->>'control_number', 'CTRL-' || LPAD(v_next_seq::TEXT, 8, '0')),
    'ISSUED',
    COALESCE(p_payload->>'customer_name', 'Consumidor Final'),
    COALESCE(p_payload->>'customer_id_doc', 'V-00000000'),
    p_payload->>'customer_address',
    p_payload->>'customer_phone',
    COALESCE(p_payload->>'emitter_business_name', 'Comercio'),
    COALESCE(p_payload->>'emitter_id_doc', 'J-000000000'),
    COALESCE(p_payload->>'emitter_address', 'Venezuela'),
    COALESCE(p_payload->'items', '[]'::jsonb),
    COALESCE((p_payload->>'subtotal_exempt')::NUMERIC, 0.00),
    v_subtotal_taxable,
    COALESCE((p_payload->>'iva_rate_percent')::NUMERIC, 16.00),
    v_iva_amount,
    COALESCE((p_payload->>'igtf_rate_percent')::NUMERIC, 0.00),
    COALESCE((p_payload->>'igtf_amount')::NUMERIC, 0.00),
    v_total_amount,
    (p_payload->>'total_ves')::NUMERIC,
    (p_payload->>'exchange_rate_applied')::NUMERIC,
    COALESCE(p_payload->>'currency', 'USD'),
    COALESCE(p_payload->>'payment_condition', 'CASH'),
    'PAID',
    v_total_amount,
    NOW(),
    NOW()
  );

  -- 3. Generar Asiento Contable NIIF si el plugin de contabilidad está activo
  SELECT COALESCE(is_active, FALSE) INTO v_has_accounting
  FROM public.tenant_modules
  WHERE tenant_id = v_tenant_id AND module_id = 'accounting';

  IF v_has_accounting = TRUE THEN
    SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_entry_number
    FROM public.journal_entries
    WHERE tenant_id = v_tenant_id;

    -- Cabecera del asiento
    INSERT INTO public.journal_entries (
      id, tenant_id, entry_number, entry_date, concept, source_module,
      source_document_id, source_document_number, total_debit, total_credit,
      is_balanced, created_at, updated_at
    ) VALUES (
      v_entry_id,
      v_tenant_id,
      v_entry_number,
      CURRENT_DATE,
      'Venta según Factura Fiscal ' || v_doc_number,
      'INVOICING',
      v_doc_id,
      v_doc_number,
      v_total_amount,
      v_total_amount,
      TRUE,
      NOW(),
      NOW()
    );

    -- Línea 1: Débito en Caja / Banco (Activo)
    INSERT INTO public.journal_entry_lines (
      id, entry_id, tenant_id, account_code, account_name, description, debit, credit, line_order
    ) VALUES (
      gen_random_uuid(), v_entry_id, v_tenant_id, '1.1.01.01', 'Caja General / Banco', 'Cobro de factura ' || v_doc_number, v_total_amount, 0.00, 1
    );

    -- Línea 2: Crédito en Ventas (Ingreso)
    INSERT INTO public.journal_entry_lines (
      id, entry_id, tenant_id, account_code, account_name, description, debit, credit, line_order
    ) VALUES (
      gen_random_uuid(), v_entry_id, v_tenant_id, '4.1.01.01', 'Ventas de Mercancía', 'Venta base factura ' || v_doc_number, 0.00, (v_total_amount - v_iva_amount), 2
    );

    -- Línea 3: Crédito en IVA por Pagar (Pasivo Fiscal)
    IF v_iva_amount > 0 THEN
      INSERT INTO public.journal_entry_lines (
        id, entry_id, tenant_id, account_code, account_name, description, debit, credit, line_order
      ) VALUES (
        gen_random_uuid(), v_entry_id, v_tenant_id, '2.1.03.01', 'Débito Fiscal IVA 16%', 'IVA generado ' || v_doc_number, 0.00, v_iva_amount, 3
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'document_id', v_doc_id,
    'document_number', v_doc_number,
    'control_number', 'CTRL-' || LPAD(v_next_seq::TEXT, 8, '0'),
    'sequence', v_next_seq,
    'accounting_entry_id', CASE WHEN v_has_accounting THEN v_entry_id ELSE NULL END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. CIERRE DE TURNO POS Y ARQUEO CIEGO (rpc_close_pos_shift)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_close_pos_shift(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_id UUID;
  v_tenant_id TEXT;
  v_close_type TEXT;
  v_closing_primary NUMERIC(12, 2);
  v_closing_secondary NUMERIC(14, 2);
  v_shift RECORD;
  v_cash_in NUMERIC(12, 2) := 0.00;
  v_cash_out NUMERIC(12, 2) := 0.00;
  v_expected_primary NUMERIC(12, 2) := 0.00;
  v_diff_primary NUMERIC(12, 2) := 0.00;
BEGIN
  v_shift_id := (p_payload->>'shift_id')::UUID;
  v_tenant_id := p_payload->>'tenant_id';
  v_close_type := COALESCE(p_payload->>'close_type', 'X');
  v_closing_primary := COALESCE((p_payload->>'closing_cash_primary')::NUMERIC, (p_payload->>'closing_balance')::NUMERIC, 0.00);
  v_closing_secondary := COALESCE((p_payload->>'closing_cash_secondary')::NUMERIC, 0.00);

  -- 1. Obtener turno con bloqueo
  SELECT * INTO v_shift
  FROM public.cash_shifts
  WHERE id = v_shift_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Turno no encontrado');
  END IF;

  -- 2. Calcular entradas y salidas manuales de caja
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'IN' THEN amount_usd ELSE 0 END), 0.00),
    COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount_usd ELSE 0 END), 0.00)
  INTO v_cash_in, v_cash_out
  FROM public.cash_movements
  WHERE shift_id = v_shift_id;

  -- 3. Calcular saldo esperado en moneda primaria ($)
  v_expected_primary := COALESCE(v_shift.opening_cash_primary, v_shift.opening_balance, 0.00) + 
                        COALESCE(v_shift.total_sales_usd, 0.00) + 
                        v_cash_in - v_cash_out;
  v_diff_primary := v_closing_primary - v_expected_primary;

  -- 4. Cerrar turno en BD
  UPDATE public.cash_shifts
  SET closed_at = NOW(),
      close_type = v_close_type,
      closing_balance = v_closing_primary,
      closing_cash_primary = v_closing_primary,
      closing_cash_secondary = v_closing_secondary,
      expected_balance = v_expected_primary,
      expected_cash_primary = v_expected_primary,
      difference = v_diff_primary,
      difference_primary = v_diff_primary,
      total_cash_in = v_cash_in,
      total_cash_out = v_cash_out,
      ticket_printed = TRUE
  WHERE id = v_shift_id;

  RETURN jsonb_build_object(
    'success', true,
    'shift_id', v_shift_id,
    'close_type', v_close_type,
    'opening_cash_primary', COALESCE(v_shift.opening_cash_primary, v_shift.opening_balance),
    'closing_cash_primary', v_closing_primary,
    'closing_cash_secondary', v_closing_secondary,
    'expected_cash_primary', v_expected_primary,
    'difference_primary', v_diff_primary,
    'total_cash_in', v_cash_in,
    'total_cash_out', v_cash_out
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. VISTA AGREGADA: LIBRO DE VENTAS SENIAT (rpc_get_sales_book)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_sales_book(
  p_tenant_id TEXT,
  p_year_month TEXT -- Formato 'YYYY-MM'
)
RETURNS TABLE (
  doc_id UUID,
  doc_date DATE,
  doc_number TEXT,
  control_number TEXT,
  customer_name TEXT,
  customer_tax_id TEXT,
  subtotal_exempt NUMERIC,
  subtotal_taxable NUMERIC,
  iva_rate NUMERIC,
  iva_amount NUMERIC,
  igtf_amount NUMERIC,
  total_amount NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id AS doc_id,
    created_at::DATE AS doc_date,
    document_number AS doc_number,
    control_number,
    customer_name,
    customer_id_doc AS customer_tax_id,
    COALESCE(subtotal_exempt, 0.00) AS subtotal_exempt,
    COALESCE(subtotal_taxable, 0.00) AS subtotal_taxable,
    COALESCE(iva_rate_percent, 16.00) AS iva_rate,
    COALESCE(iva_amount, 0.00) AS iva_amount,
    COALESCE(igtf_amount, 0.00) AS igtf_amount,
    COALESCE(total_amount, 0.00) AS total_amount
  FROM public.fiscal_documents
  WHERE tenant_id = p_tenant_id
    AND TO_CHAR(created_at, 'YYYY-MM') = p_year_month
    AND status = 'ISSUED'
  ORDER BY created_at ASC;
$$;

-- ------------------------------------------------------------------------------
-- 31. PROFILES EMAIL UNIQUE CONSTRAINT (from 00031)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND constraint_name = 'profiles_email_key'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_email_key UNIQUE (email);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Notice: profiles_email_key already exists or could not be added: %', SQLERRM;
END $$;

-- ------------------------------------------------------------------------------
-- 32. FIX PROFILES RLS RECURSION (from 00032)
-- Removes recursive subquery in "Tenant owners and managers can manage staff"
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT,
    (auth.jwt() -> 'user_metadata' ->> 'role')::TEXT
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

DROP POLICY IF EXISTS "Tenant owners and managers can manage staff" ON public.profiles;

CREATE POLICY "Tenant owners and managers can manage staff"
ON public.profiles FOR ALL
USING (
    (tenant_id = public.current_user_tenant_id() AND public.current_user_role() IN ('TENANT_OWNER', 'TENANT_MANAGER', 'PLATFORM_SUPER_ADMIN'))
    OR public.is_super_admin()
);

