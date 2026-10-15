-- =====================================================================
-- GLOBAL AUDIT TRAIL HARDENING & TRACEABILITY
-- Migration: 00014_global_audit_trail_hardening.sql
-- =====================================================================

-- 1. Extend audit_logs table with actor identity attributes
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_email TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT;

-- 2. Performance indexes for audit trail queries (price changes, payment approvals, cancellations)
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action ON public.audit_logs (tenant_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id, created_at DESC);

-- 3. Row Level Security Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow system insert audit logs" ON public.audit_logs;
CREATE POLICY "Allow system insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant staff can view audit logs" ON public.audit_logs;
CREATE POLICY "Tenant staff can view audit logs"
ON public.audit_logs FOR SELECT
USING (
    tenant_id = public.current_user_tenant_id()
    OR public.is_super_admin()
);
