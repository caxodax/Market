-- ==============================================================================
-- MARKETOS - CONSOLIDATED PENDING PRODUCTION MIGRATIONS (00004 -> 00027)
-- Fully idempotent with IF NOT EXISTS, compatible with Supabase SQL Editor
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TENANT PLAN LIMITS & SAAS QUOTAS (from 00004)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_plan_limits (
  tenant_id TEXT PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan JSONB NOT NULL DEFAULT '{"tier": "STARTER", "name": "Starter", "max_products": 50, "max_stores": 1, "max_storage_bytes": 104857600, "allow_custom_domains": false, "allow_delivery_fleet": false, "allow_analytics": false}'::jsonb,
  usage JSONB NOT NULL DEFAULT '{"products_count": 0, "stores_count": 1, "storage_bytes": 0}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TRIAL', 'SUSPENDED', 'OVERDUE')),
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.tenant_plan_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for plan limits" ON public.tenant_plan_limits;
CREATE POLICY "Tenant isolation for plan limits" ON public.tenant_plan_limits
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ------------------------------------------------------------------------------
-- 2. USER PROFILES & RBAC ROLES (from 00006)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'TENANT_OWNER' CHECK (role IN ('PLATFORM_SUPER_ADMIN', 'TENANT_OWNER', 'TENANT_MANAGER', 'TENANT_CASHIER', 'TENANT_INVENTORY', 'TENANT_DISPATCHER')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant ON public.user_profiles(tenant_id, is_active);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. MTO CPQ ENGINE - MAKE-TO-ORDER & COTIZADOR (from 00017)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mto_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  category TEXT NOT NULL,
  unit_of_measure TEXT NOT NULL,
  cost_per_unit NUMERIC(12, 4) NOT NULL DEFAULT 0,
  waste_factor_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mto_quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  total_price_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
