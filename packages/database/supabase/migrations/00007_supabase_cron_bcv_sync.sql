-- ==============================================================================
-- MIGRATION 00007: AUTOMATED DAILY BCV EXCHANGE RATE SYNCHRONIZATION
-- MarketOS • Postgres pg_cron & pg_net native scheduling
-- ==============================================================================

-- 1. Habilitar extensiones necesarias en Supabase (Disponibles de forma nativa)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Conceder permisos de ejecución al rol postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- 3. Crear función de utilidad para disparar la sincronización de la tasa
CREATE OR REPLACE FUNCTION public.trigger_bcv_rate_sync(target_url TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    endpoint_url TEXT;
BEGIN
    -- Si no se pasa URL, usar el webhook configurado o el endpoint de la app
    endpoint_url := COALESCE(
        target_url,
        current_setting('app.settings.bcv_sync_url', true),
        'https://marketos.app/api/cron/bcv-sync'
    );

    -- Ejecuta petición HTTP asíncrona segura vía pg_net sin bloquear Postgres
    PERFORM net.http_get(
        url := endpoint_url,
        headers := '{"Accept": "application/json", "User-Agent": "Supabase-pg_net-MarketOS"}'::jsonb
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Programar Cron Job Diario en Postgres (Supabase pg_cron)
-- Se ejecuta todos los días a las 11:00 UTC (7:00 AM hora Venezuela VET, idéntico a KsaSport)
SELECT cron.schedule(
    'marketos-daily-bcv-sync',
    '0 11 * * *',
    $$ SELECT public.trigger_bcv_rate_sync(); $$
);

-- Para verificar tareas programadas activas:
-- SELECT * FROM cron.job;

-- Para ver el historial de ejecuciones:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Para desprogramar la tarea en el futuro si se requiere:
-- SELECT cron.unschedule('marketos-daily-bcv-sync');
