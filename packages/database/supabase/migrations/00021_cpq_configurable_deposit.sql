-- Migration: 00021_cpq_configurable_deposit.sql
-- Description: Configurable advance deposit percentages across CPQ settings, pricing matrices, quotes, and order milestones.
-- Enables merchants to define custom required down payments (e.g. 30%, 50%, 70%, 100%) instead of a hardcoded 50%.

-- 1. Add configurable default deposit percentage to tenant cost settings
ALTER TABLE public.cpq_cost_settings 
ADD COLUMN IF NOT EXISTS default_deposit_percentage NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (default_deposit_percentage >= 0 AND default_deposit_percentage <= 100);

-- 2. Add optional matrix-level deposit override (e.g. specific to Sublimation or Acrylic signs)
ALTER TABLE public.cpq_pricing_matrices 
ADD COLUMN IF NOT EXISTS deposit_percentage NUMERIC(5,2) NULL CHECK (deposit_percentage IS NULL OR (deposit_percentage >= 0 AND deposit_percentage <= 100));

-- 3. Add required deposit percentage and amount to quotes
ALTER TABLE public.cpq_quotes 
ADD COLUMN IF NOT EXISTS deposit_percentage NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (deposit_percentage >= 0 AND deposit_percentage <= 100),
ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00;

-- 4. Add required deposit percentage and amount to production milestones
ALTER TABLE public.cpq_order_milestones 
ADD COLUMN IF NOT EXISTS required_deposit_percentage NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (required_deposit_percentage >= 0 AND required_deposit_percentage <= 100),
ADD COLUMN IF NOT EXISTS required_deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00;
