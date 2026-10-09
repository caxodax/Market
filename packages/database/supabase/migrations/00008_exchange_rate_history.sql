-- ==============================================================================
-- MIGRATION 00008: HISTORIAL DIARIO DE TASAS DE CAMBIO (BCV / ALCAMBIO / MANUAL)
-- MarketOS • Registro inmutable y consulta histórica de divisas
-- ==============================================================================

-- 1. Tabla de Histórico Diario de Tasas
CREATE TABLE IF NOT EXISTS public.exchange_rate_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL indica tasa global de la plataforma
    date_rate DATE NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    rate NUMERIC(14, 4) NOT NULL,
    rate_eur NUMERIC(14, 4),
    usdt_promedio NUMERIC(14, 4),
    source TEXT NOT NULL DEFAULT 'alcambio.app',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_rate_history_tenant_date_curr UNIQUE (tenant_id, date_rate, currency)
);

-- 2. Índices para acelerar consultas por fecha y tenant
CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_date 
ON public.exchange_rate_history (date_rate DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_tenant_date 
ON public.exchange_rate_history (tenant_id, date_rate DESC);

-- 3. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.exchange_rate_history ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acceso:
-- Lectura pública para cualquier cliente, tenant o storefront
CREATE POLICY "Permitir lectura publica del historico de tasas"
ON public.exchange_rate_history FOR SELECT
USING (true);

-- Escritura restringida al rol de servicio (Cron jobs, Edge Functions) o super admin
CREATE POLICY "Permitir escritura al rol de servicio en historico de tasas"
ON public.exchange_rate_history FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Semilla inicial de tasas históricas oficiales (Barquisimeto / Nacional)
INSERT INTO public.exchange_rate_history (tenant_id, date_rate, currency, rate, rate_eur, usdt_promedio, source, created_at)
VALUES
    ('shop-market-ca', '2026-10-09', 'USD', 875.6505, 980.6147, 1016.7850, 'alcambio.app', '2026-10-09 09:30:02-04'),
    ('shop-market-ca', '2026-10-08', 'USD', 874.7321, 979.0789, 1015.6700, 'alcambio.app', '2026-10-08 16:30:02-04'),
    ('shop-market-ca', '2026-10-07', 'USD', 873.8670, 984.2626, 1008.7650, 'alcambio.app', '2026-10-07 16:30:02-04'),
    ('shop-market-ca', '2026-10-06', 'USD', 872.3927, 977.2194, 993.9900, 'alcambio.app', '2026-10-06 16:30:05-04'),
    ('shop-market-ca', '2026-10-05', 'USD', 871.3689, 981.1788, 975.2450, 'alcambio.app', '2026-10-05 09:30:06-04'),
    ('shop-market-ca', '2026-10-02', 'USD', 866.5612, 973.9281, 971.5750, 'alcambio.app', '2026-10-02 16:30:06-04'),
    ('shop-market-ca', '2026-10-01', 'USD', 860.1753, 976.8409, 959.5500, 'alcambio.app', '2026-10-01 16:30:06-04'),
    ('shop-market-ca', '2026-09-30', 'USD', 859.0629, 973.3097, 954.8100, 'alcambio.app', '2026-09-30 16:30:06-04'),
    ('shop-market-ca', '2026-09-29', 'USD', 857.8876, 974.7147, 958.3600, 'alcambio.app', '2026-09-29 09:30:05-04'),
    ('shop-market-ca', '2026-09-28', 'USD', 857.0058, 976.9009, 965.3350, 'alcambio.app', '2026-09-28 16:30:05-04')
ON CONFLICT (tenant_id, date_rate, currency) DO UPDATE
SET rate = EXCLUDED.rate,
    rate_eur = EXCLUDED.rate_eur,
    usdt_promedio = EXCLUDED.usdt_promedio,
    source = EXCLUDED.source,
    created_at = EXCLUDED.created_at;
