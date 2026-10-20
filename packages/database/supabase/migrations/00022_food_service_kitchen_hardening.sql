-- Migration: 00022_food_service_kitchen_hardening.sql
-- Description: Adds selected_modifiers and notes to order_items, plus kitchen_status to orders for Food Service KDS.
-- Architecture: Safe idempotent additions (ADD COLUMN IF NOT EXISTS), zero downtime.

-- 1. Add selected_modifiers JSONB to order_items
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS selected_modifiers JSONB DEFAULT '[]'::jsonb;

-- 2. Add notes to order_items (e.g. "Sin cebolla", "Término medio")
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Add kitchen_status to orders for real-time KDS (Kitchen Display System)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS kitchen_status TEXT DEFAULT 'PENDING';

-- 4. Fast GIN index for modifier queries
CREATE INDEX IF NOT EXISTS idx_order_items_modifiers 
ON public.order_items USING gin (selected_modifiers);

-- 5. Fast Composite Index for Kitchen Comandas
CREATE INDEX IF NOT EXISTS idx_orders_kitchen_lookup 
ON public.orders (tenant_id, store_id, kitchen_status, created_at DESC);
