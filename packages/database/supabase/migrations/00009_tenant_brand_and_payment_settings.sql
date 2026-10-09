-- ==============================================================================
-- Migration 00009: Add branding, typography, payment accounts and operational settings
-- ==============================================================================

-- 1. Add payment_settings JSONB column to tenant_settings
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS payment_settings JSONB DEFAULT '{
  "enabled_methods": ["PAGO_MOVIL", "BANK_TRANSFER", "ZELLE", "CASH_USD"],
  "pago_movil": {
    "bank": "Bancamiga",
    "phone": "04245919577",
    "id_doc": "J-50123456-7",
    "name": "Shop Market C.A."
  },
  "bank_transfer": {
    "bank": "Bancamiga",
    "account_number": "01720111551100012345",
    "account_type": "Corriente",
    "id_doc": "J-50123456-7",
    "name": "Shop Market C.A."
  },
  "zelle": {
    "email": "pagos@shopmarket.com",
    "name": "Shop Market C.A."
  },
  "cash_usd": {
    "instructions": "Billetes en buen estado sin roturas ni marcas. Pago al retirar en tienda o contra entrega."
  },
  "cash_ves": {
    "instructions": "Efectivo en Bolívares en caja según tasa oficial."
  },
  "pos": {
    "instructions": "Punto de venta disponible en caja para tarjetas de débito."
  }
}'::jsonb;

-- 2. Add operational_settings JSONB column to tenant_settings
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS operational_settings JSONB DEFAULT '{
  "is_open": true,
  "closed_message": "Actualmente nos encontramos fuera de horario de atención. Tomaremos tu pedido a primera hora.",
  "schedule": "Lunes a Sábado: 8:00 AM - 9:00 PM | Domingos: 9:00 AM - 6:00 PM",
  "min_order_usd": 0,
  "announcement_banner": "¡Bienvenidos a Shop Market! Delivery rápido en Barquisimeto y Cabudare 🛵",
  "estimated_delivery_time": "30 a 60 minutos",
  "custom_whatsapp_message": "Hola Shop Market, acabo de realizar un pedido por la tienda web:"
}'::jsonb;

-- 3. Add font_family column to tenant_settings
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'Inter';

-- 4. Ensure RLS allows tenant staff to update settings
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tenant_settings' AND policyname = 'Tenant staff can update settings'
  ) THEN
    CREATE POLICY "Tenant staff can update settings"
    ON public.tenant_settings FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
