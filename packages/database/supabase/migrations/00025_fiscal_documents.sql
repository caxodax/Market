-- ==============================================================================
-- 00025_fiscal_documents.sql
-- Universal Fiscal Invoicing, Credit Notes, Dispatch Guides, CxC & PAC Certification
-- ==============================================================================

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

  -- Customer Info
  customer_name TEXT NOT NULL,
  customer_id_doc TEXT NOT NULL,
  customer_address TEXT,
  customer_phone TEXT,

  -- Emitter Info
  emitter_business_name TEXT NOT NULL,
  emitter_id_doc TEXT NOT NULL,
  emitter_address TEXT NOT NULL,

  -- Breakdown & Financial Amounts
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

  -- Transport & Dispatch Info
  transport_info JSONB,

  -- Payment Terms & Accounts Receivable (CxC)
  payment_condition TEXT DEFAULT 'CASH' CHECK (payment_condition IN ('CASH', 'CREDIT')),
  credit_term_days INTEGER DEFAULT 0,
  due_date DATE,
  payment_status TEXT DEFAULT 'PAID' CHECK (payment_status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')),
  amount_paid NUMERIC(14, 2) DEFAULT 0.00,
  amount_due NUMERIC(14, 2) DEFAULT 0.00,
  payments JSONB DEFAULT '[]'::jsonb,

  -- Digital PAC Certification (Providencia SNAT/00093 TFHKA / Novus)
  pac_status TEXT DEFAULT 'NOT_CONFIGURED' CHECK (pac_status IN ('NOT_CONFIGURED', 'PENDING', 'CERTIFIED', 'FAILED')),
  pac_certification JSONB,
  pac_error_message TEXT,

  -- Legal & QR Meta
  qr_data TEXT,
  legal_legend TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Multi-Tenant Indexes
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_tenant_type ON public.fiscal_documents(tenant_id, document_type);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_tenant_date ON public.fiscal_documents(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_tenant_docnum ON public.fiscal_documents(tenant_id, document_number);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_order_id ON public.fiscal_documents(order_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_cxc_status ON public.fiscal_documents(tenant_id, payment_status) WHERE payment_condition = 'CREDIT';

-- Row Level Security
ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for fiscal_documents"
  ON public.fiscal_documents
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
