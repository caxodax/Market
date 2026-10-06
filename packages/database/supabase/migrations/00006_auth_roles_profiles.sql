-- =====================================================================
-- MIGRATION: 00006_auth_roles_profiles.sql
-- Module: Supabase Auth, RBAC Roles, Profiles & Tenant Staff Management
-- =====================================================================

-- 1. Ensure app_role enum exists with all platform and tenant roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM (
            'PLATFORM_SUPER_ADMIN',
            'TENANT_OWNER',
            'TENANT_MANAGER',
            'TENANT_INVENTORY',
            'TENANT_CASHIER',
            'TENANT_DELIVERY',
            'CUSTOMER'
        );
    END IF;
END $$;

-- 2. Relax profiles constraints to allow administrative invitations before auth account creation
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Drop rigid foreign key constraint on auth.users(id) if present to allow pre-invitation of staff
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    END IF;
END $$;

-- Ensure unique email per profile (or per tenant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_role ON public.profiles (tenant_id, role);

-- 3. RLS POLICIES FOR PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop previous policies if any exist
DROP POLICY IF EXISTS "Public can view staff profile basics" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Tenant staff can view tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Tenant owners and managers can manage staff" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;

-- Anyone authenticated can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (
    id = auth.uid() 
    OR lower(email) = lower(auth.jwt()->>'email')
);

-- Tenant staff can view team members in their tenant
CREATE POLICY "Tenant staff can view tenant profiles"
ON public.profiles FOR SELECT
USING (
    tenant_id = public.current_user_tenant_id() 
    OR public.is_super_admin()
);

-- Tenant Owners, Managers and Super Admins can insert/invite staff
CREATE POLICY "Tenant owners and managers can manage staff"
ON public.profiles FOR ALL
USING (
    (tenant_id = public.current_user_tenant_id() AND EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE (p.id = auth.uid() OR lower(p.email) = lower(auth.jwt()->>'email'))
        AND p.role IN ('TENANT_OWNER', 'TENANT_MANAGER', 'PLATFORM_SUPER_ADMIN')
    ))
    OR public.is_super_admin()
);

-- 4. FUNCTION & TRIGGER: Sync Supabase auth.users with public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    existing_profile_id UUID;
    target_role public.app_role;
    target_tenant TEXT;
BEGIN
    -- Check if pre-invited profile exists with this email
    SELECT id, role, tenant_id INTO existing_profile_id, target_role, target_tenant
    FROM public.profiles
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;

    IF existing_profile_id IS NOT NULL THEN
        -- Link existing profile to auth.users.id
        UPDATE public.profiles
        SET 
            id = NEW.id,
            updated_at = timezone('utc'::text, now())
        WHERE id = existing_profile_id;
    ELSE
        -- Determine role from metadata or fallback to CUSTOMER
        target_role := COALESCE(
            (NEW.raw_user_meta_data->>'role')::public.app_role, 
            'CUSTOMER'::public.app_role
        );
        target_tenant := NEW.raw_user_meta_data->>'tenant_id';

        INSERT INTO public.profiles (
            id,
            tenant_id,
            email,
            full_name,
            phone,
            role,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            target_tenant,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            NEW.raw_user_meta_data->>'phone',
            target_role,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        )
        ON CONFLICT (lower(email)) DO UPDATE SET
            id = EXCLUDED.id,
            updated_at = timezone('utc'::text, now());
    END IF;

    RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 5. SEED INITIAL PROFILES FOR SHOP MARKET & SUPER ADMIN
-- Note: Uses deterministic UUIDs so foreign key references remain consistent
INSERT INTO public.profiles (id, tenant_id, email, full_name, phone, role, created_at, updated_at)
VALUES
    (
        'e1111111-1111-1111-1111-111111111111',
        'shop-market-ca',
        'owner@shopmarket.com',
        'Luis Montes (Dueño)',
        '+58 424-5919577',
        'TENANT_OWNER',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ),
    (
        'e2222222-2222-2222-2222-222222222222',
        'shop-market-ca',
        'gerente@shopmarket.com',
        'María Rodríguez (Encargada)',
        '+58 414-5551234',
        'TENANT_MANAGER',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ),
    (
        'e3333333-3333-3333-3333-333333333333',
        'shop-market-ca',
        'caja@shopmarket.com',
        'Carlos Pérez (Caja)',
        '+58 412-5559876',
        'TENANT_CASHIER',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ),
    (
        'e4444444-4444-4444-4444-444444444444',
        NULL,
        'superadmin@marketos.com',
        'Super Admin Maestro',
        '+58 412-0000000',
        'PLATFORM_SUPER_ADMIN',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
ON CONFLICT (lower(email)) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    tenant_id = EXCLUDED.tenant_id,
    phone = EXCLUDED.phone,
    updated_at = timezone('utc'::text, now());

-- =====================================================================
-- End of Migration 00006_auth_roles_profiles.sql
-- =====================================================================
