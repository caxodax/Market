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
