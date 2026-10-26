-- ==============================================================================
-- 00026_purchasing_and_retentions.sql
-- Procurement, Purchase Invoices, Tax Retentions (SENIAT SPE 75%/100% & ISLR) & CxP
-- ==============================================================================

-- 1. Suppliers / Proveedores
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_id TEXT NOT NULL, -- RIF en VE (ej. J-12345678-0), RUT en CL
  email TEXT,
  phone TEXT,
  address TEXT,
  default_retention_rate NUMERIC(5, 2) DEFAULT 75.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_supplier_tenant_taxid UNIQUE (tenant_id, tax_id)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON public.suppliers(tenant_id, is_active);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for suppliers"
  ON public.suppliers FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- 2. Purchase Invoices / Facturas de Compra de Proveedores
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
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'CLP', 'VES')),
  exchange_rate_applied NUMERIC(12, 4),
  total_ves NUMERIC(14, 2),

  -- Retenciones
  retention_voucher_id UUID,
  retained_vat_amount NUMERIC(14, 2) DEFAULT 0.00,
  retained_islr_amount NUMERIC(14, 2) DEFAULT 0.00,
  islr_concept_code TEXT,
  islr_retention_rate_percent NUMERIC(5, 2),
  islr_retention_voucher_id UUID,

  -- Cuentas por Pagar (CxP)
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

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_tenant_date ON public.purchase_invoices(tenant_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_cxp ON public.purchase_invoices(tenant_id, payment_status) WHERE payment_condition = 'CREDIT';
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for purchase_invoices"
  ON public.purchase_invoices FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- 3. Retention Vouchers / Comprobantes de Retención Fiscal (IVA / ISLR / DTE 46)
CREATE TABLE IF NOT EXISTS public.retention_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  voucher_type TEXT NOT NULL CHECK (voucher_type IN ('VAT', 'INCOME_TAX', 'CHILE_DTE_46')),
  voucher_number TEXT NOT NULL, -- Correlativo SENIAT YYYYMM-XXXXXXXX o Folio DTE
  tax_period TEXT NOT NULL,     -- YYYYMM (ej. 202610)
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Agente de Retención (Comercio)
  agent_business_name TEXT NOT NULL,
  agent_tax_id TEXT NOT NULL,
  agent_fiscal_address TEXT NOT NULL,

  -- Sujeto Retenido (Proveedor)
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  supplier_name TEXT NOT NULL,
  supplier_tax_id TEXT NOT NULL,
  supplier_fiscal_address TEXT,

  -- Factura de Compra
  purchase_invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  control_number TEXT,
  invoice_date DATE NOT NULL,

  -- Desglose Impositivo y Retención
  total_invoice_amount NUMERIC(14, 2) NOT NULL,
  exempt_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  taxable_base NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  tax_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 16.00,
  tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  retention_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 75.00,
  retained_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,

  -- ISLR Específico
  islr_concept_code TEXT,
  islr_subtract_amount NUMERIC(14, 2) DEFAULT 0.00,

  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate_applied NUMERIC(12, 4),
  retained_amount_ves NUMERIC(14, 2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retention_vouchers_tenant_period ON public.retention_vouchers(tenant_id, tax_period, voucher_type);
CREATE INDEX IF NOT EXISTS idx_retention_vouchers_tenant_num ON public.retention_vouchers(tenant_id, voucher_number);
ALTER TABLE public.retention_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for retention_vouchers"
  ON public.retention_vouchers FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
