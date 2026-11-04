-- ==============================================================================
-- MIGRATION: 00031_profiles_email_unique.sql
-- Module: Profiles & Staff Management Hardening
-- Enforces standard UNIQUE (email) constraint on public.profiles
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND constraint_name = 'profiles_email_key'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_email_key UNIQUE (email);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Notice: profiles_email_key already exists or could not be added: %', SQLERRM;
END $$;
