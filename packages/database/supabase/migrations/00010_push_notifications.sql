-- ==============================================================================
-- MIGRACIÓN 00010: NOTIFICACIONES PUSH PWA (WEB PUSH / VAPID MULTI-TENANT)
-- MARKETOS DIGITAL COMMERCE
-- ==============================================================================

-- 1. Tabla de Suscripciones Push de Dispositivos por Tienda (Tenant)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    customer_id TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_push_subs_tenant_id ON public.push_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

-- 2. Tabla de Bitácora e Historial de Notificaciones Enviadas por Tienda
CREATE TABLE IF NOT EXISTS public.push_notifications_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    url TEXT DEFAULT '/',
    target_type TEXT NOT NULL DEFAULT 'all',
    sent_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_push_log_tenant_id ON public.push_notifications_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_push_log_created_at ON public.push_notifications_log(created_at DESC);

-- 3. Políticas de Seguridad RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notifications_log ENABLE ROW LEVEL SECURITY;

-- Permitir a los clientes suscribir su dispositivo
CREATE POLICY "Permitir registro de suscripciones push"
    ON public.push_subscriptions
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Permitir a usuarios autenticados o backend gestionar
CREATE POLICY "Permitir lectura y actualizacion de suscripciones push"
    ON public.push_subscriptions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permitir historial de notificaciones push a staff"
    ON public.push_notifications_log
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
