-- ==============================================================================
-- MIGRACIÓN 00012: CONFIGURACIÓN FISCAL SENIAT (PROVIDENCIA 00071 & FACTURACIÓN DIGITAL)
-- MARKETOS DIGITAL COMMERCE - CUMPLIMIENTO TRIBUTARIO MODULAR
-- ==============================================================================

-- 1. AGREGAR COLUMNA billing_settings A tenant_settings
-- Viene por DEFECTO EN OFF ("fiscal_billing_enabled": false)
-- para no interrumpir comercios que ya poseen máquina fiscal física o ERP local.
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS billing_settings JSONB DEFAULT '{
  "fiscal_billing_enabled": false,
  "billing_mode": "TICKET_ONLY",
  "tax_payer_type": "ORDINARY",
  "apply_igtf": false,
  "default_iva_rate": 16.0,
  "fiscal_provider": "THE_FACTORY_HKA",
  "emitter_fiscal_data": {
    "rif": "J-50123456-7",
    "business_name": "Shop Market C.A.",
    "fiscal_address": "Calle 3 entre Carreras 1 y 2, Urb. Nueva Segovia, Barquisimeto, Edo. Lara, Venezuela",
    "phone": "+58 424-5919577"
  },
  "provider_credentials": {
    "api_key": "",
    "token": "",
    "environment": "SANDBOX"
  }
}'::jsonb;

COMMENT ON COLUMN public.tenant_settings.billing_settings IS 
  'Configuración fiscal por comercio (SENIAT Providencia 00071, Facturación Digital con imprenta autorizada, IGTF e IVA)';

-- 2. AGREGAR CAMPOS FISCALES A LA TABLA DE PEDIDOS (orders)
-- Permite almacenar de forma inmutable los datos fiscales de la factura digital cuando se emita
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS is_fiscal_invoice BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fiscal_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_control_number TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_qr_url TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_cuv TEXT,
  ADD COLUMN IF NOT EXISTS subtotal_exempt_usd NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_taxable_usd NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_amount_usd NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_amount_ves NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igtf_amount_usd NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igtf_amount_ves NUMERIC(14, 2) DEFAULT 0;

COMMENT ON COLUMN public.orders.is_fiscal_invoice IS 
  'Indica si la orden fue facturada formalmente ante el SENIAT mediante Factura Digital';

COMMENT ON COLUMN public.orders.fiscal_invoice_number IS 
  'Número consecutivo legal de factura (ej. FACT-00012345)';

COMMENT ON COLUMN public.orders.fiscal_control_number IS 
  'Número de control fiscal único asignado por imprenta digital autorizada por el SENIAT (ej. 00-00123456)';

COMMENT ON COLUMN public.orders.fiscal_cuv IS 
  'Código Único de Validación / Firma electrónica del documento fiscal emitido por la imprenta digital';

-- 3. ÍNDICES DE RENDIMIENTO PARA REPORTES Y LIBROS DE VENTAS FISCALES
CREATE INDEX IF NOT EXISTS idx_orders_fiscal_invoice 
  ON public.orders(tenant_id, is_fiscal_invoice, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_fiscal_control_number 
  ON public.orders(tenant_id, fiscal_control_number);
