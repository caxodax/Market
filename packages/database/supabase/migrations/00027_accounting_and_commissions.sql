-- ==============================================================================
-- 00027_accounting_and_commissions.sql
-- NIIF Double-Entry Accounting (PUC, Journal, Lines) & Sales Commissions Ledger
-- ==============================================================================

-- 1. Chart of Accounts (PUC NIIF)
CREATE TABLE IF NOT EXISTS public.accounts (
  id TEXT PRIMARY KEY, -- ej. acc_tenant_1_1_01_01
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,  -- ej. 1.1.01.01
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

CREATE INDEX IF NOT EXISTS idx_accounts_tenant_code ON public.accounts(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_class ON public.accounts(tenant_id, classification);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for accounts"
  ON public.accounts FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- 2. General Journal Header (Libro Diario)
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

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_date ON public.journal_entries(tenant_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON public.journal_entries(tenant_id, source_module, source_document_id);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for journal_entries"
  ON public.journal_entries FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- 3. General Journal Lines (Líneas de Movimiento por Cuenta)
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

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_entry_lines(entry_id, line_order);
CREATE INDEX IF NOT EXISTS idx_journal_lines_tenant_account ON public.journal_entry_lines(tenant_id, account_code);
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for journal_entry_lines"
  ON public.journal_entry_lines FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- 4. Sales Agents (Vendedores / Asesores Comerciales)
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

CREATE INDEX IF NOT EXISTS idx_sales_agents_tenant ON public.sales_agents(tenant_id, is_active);
ALTER TABLE public.sales_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for sales_agents"
  ON public.sales_agents FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- 5. Commission Records (Libro de Comisiones de Venta)
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

CREATE INDEX IF NOT EXISTS idx_commissions_tenant_agent ON public.commission_records(tenant_id, sales_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_commissions_tenant_date ON public.commission_records(tenant_id, created_at DESC);
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for commission_records"
  ON public.commission_records FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
