-- Migration: 00023_pos_registers.sql
-- Description: Plugin Multi-Caja & Turnos POS — cash_registers, cash_register_sessions, cash_movements tables + atomic inventory function.
-- Architecture: Safe idempotent additions (CREATE TABLE IF NOT EXISTS), zero downtime.

-- ============================================================
-- 1. CAJAS REGISTRADORAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cash_registers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id     UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  pin_hash     TEXT,           -- bcrypt hash del PIN (NULL = sin PIN)
  is_virtual   BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = Caja Virtual/Web
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. SESIONES / TURNOS DE CAJA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cash_register_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id         UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cashier_user_id     UUID NOT NULL REFERENCES public.profiles(id),
  cashier_name        TEXT NOT NULL,
  opened_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at           TIMESTAMPTZ,                          -- NULL = turno abierto
  opening_balance     NUMERIC(12,2) NOT NULL DEFAULT 0,     -- fondo inicial USD
  closing_balance     NUMERIC(12,2),                        -- efectivo contado al cierre
  expected_balance    NUMERIC(12,2),                        -- calculado por el sistema
  difference          NUMERIC(12,2),                        -- closing - expected
  total_sales_usd     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cash_in       NUMERIC(12,2) NOT NULL DEFAULT 0,     -- entradas manuales
  total_cash_out      NUMERIC(12,2) NOT NULL DEFAULT 0,     -- retiros manuales
  transaction_count   INTEGER NOT NULL DEFAULT 0,
  close_type          TEXT CHECK (close_type IN ('X', 'Z')), -- X=parcial, Z=definitivo
  notes               TEXT,
  ticket_printed      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. MOVIMIENTOS DE CAJA (entradas/salidas manuales)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES public.cash_register_sessions(id) ON DELETE CASCADE,
  tenant_id    TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
  amount_usd   NUMERIC(12,2) NOT NULL CHECK (amount_usd > 0),
  reason       TEXT NOT NULL,
  created_by   UUID NOT NULL REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cash_registers_tenant    ON public.cash_registers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_store     ON public.cash_registers(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_register   ON public.cash_register_sessions(register_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_open       ON public.cash_register_sessions(register_id)
  WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cash_movements_session   ON public.cash_movements(session_id);

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.cash_registers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_register_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements           ENABLE ROW LEVEL SECURITY;

-- Política: Solo el tenant propietario puede acceder
CREATE POLICY "pos_tenant_isolation_registers"
  ON public.cash_registers FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY "pos_tenant_isolation_sessions"
  ON public.cash_register_sessions FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY "pos_tenant_isolation_movements"
  ON public.cash_movements FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

-- ============================================================
-- 6. TRIGGERS updated_at (reutiliza función si ya existe)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cash_registers_updated
  BEFORE UPDATE ON public.cash_registers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_cash_sessions_updated
  BEFORE UPDATE ON public.cash_register_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. FUNCIÓN: Descuento atómico de inventario
--    Lanza excepción si no hay stock suficiente.
--    Llamada desde createOrder en packages/database/src/services.ts
-- ============================================================
CREATE OR REPLACE FUNCTION public.deduct_inventory_atomic(
  p_product_id UUID,
  p_store_id   UUID,
  p_quantity   INTEGER
) RETURNS VOID AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE public.inventory
  SET
    quantity   = quantity - p_quantity,
    updated_at = NOW()
  WHERE product_id = p_product_id
    AND store_id   = p_store_id
    AND quantity  >= p_quantity;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK'
      USING HINT = p_product_id::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. FUNCIÓN: Incrementar campo numérico en sesión (cash in/out)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_session_amount(
  p_session_id UUID,
  p_field      TEXT,
  p_amount     NUMERIC
) RETURNS VOID AS $$
BEGIN
  -- Solo permite campos seguros para prevenir SQL injection
  IF p_field NOT IN ('total_cash_in', 'total_cash_out', 'total_sales_usd', 'transaction_count') THEN
    RAISE EXCEPTION 'Campo no permitido: %', p_field;
  END IF;

  EXECUTE format(
    'UPDATE public.cash_register_sessions SET %I = %I + $1 WHERE id = $2',
    p_field, p_field
  ) USING p_amount, p_session_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. SEED: Caja Virtual/Web por defecto (se crea al activar el plugin)
--    Comentado — se inserta via Server Action al activar el plugin
-- ============================================================
-- INSERT INTO public.cash_registers (tenant_id, store_id, name, is_virtual)
-- VALUES ('shop-market-ca', '<store_id>', 'Caja Web', TRUE)
-- ON CONFLICT DO NOTHING;
