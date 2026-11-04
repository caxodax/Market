-- =====================================================================
-- MIGRATION: 00032_fix_profiles_rls_recursion.sql
-- Fixes PostgreSQL Error 42P17 (infinite recursion in profiles RLS policy)
-- =====================================================================

-- 1. Helper function to read user role from JWT claims without querying profiles table
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT,
    (auth.jwt() -> 'user_metadata' ->> 'role')::TEXT
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Drop the recursive policy that performed "SELECT 1 FROM public.profiles" inside public.profiles
DROP POLICY IF EXISTS "Tenant owners and managers can manage staff" ON public.profiles;

-- 3. Re-create non-recursive policy using JWT claims and SECURITY DEFINER helpers
CREATE POLICY "Tenant owners and managers can manage staff"
ON public.profiles FOR ALL
USING (
    (tenant_id = public.current_user_tenant_id() AND public.current_user_role() IN ('TENANT_OWNER', 'TENANT_MANAGER', 'PLATFORM_SUPER_ADMIN'))
    OR public.is_super_admin()
);
