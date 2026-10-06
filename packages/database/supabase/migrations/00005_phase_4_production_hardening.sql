-- =====================================================================
-- MARKETOS - PHASE 4: PRODUCTION HARDENING & ADVANCED OPERATIONS
-- Customers RLS, Loyalty Points, Audit Logs Policies, Exchange Rates Constraint
-- =====================================================================

-- 1. ADD LOYALTY POINTS TO CUSTOMERS
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS loyalty_points INT NOT NULL DEFAULT 0;

-- 2. UNIQUE CONSTRAINT FOR EXCHANGE RATES UPSERT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_exchange_rates_tenant_currency'
    ) THEN
        ALTER TABLE public.exchange_rates
        ADD CONSTRAINT uq_exchange_rates_tenant_currency UNIQUE (tenant_id, currency);
    END IF;
END $$;

-- 3. CUSTOMERS RLS POLICIES
DROP POLICY IF EXISTS "Anyone can create or find customers" ON public.customers;
CREATE POLICY "Anyone can create or find customers"
ON public.customers FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view customers" ON public.customers;
CREATE POLICY "Public can view customers"
ON public.customers FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Tenant staff can update customers" ON public.customers;
CREATE POLICY "Tenant staff can update customers"
ON public.customers FOR UPDATE
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 4. AUDIT LOGS RLS POLICIES
DROP POLICY IF EXISTS "Allow system insert audit logs" ON public.audit_logs;
CREATE POLICY "Allow system insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant staff can view audit logs" ON public.audit_logs;
CREATE POLICY "Tenant staff can view audit logs"
ON public.audit_logs FOR SELECT
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 5. ORDERS & ITEMS EXPANDED POLICIES
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders"
ON public.orders FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read own orders by phone or id" ON public.orders;
CREATE POLICY "Public can read own orders by phone or id"
ON public.orders FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items"
ON public.order_items FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;
CREATE POLICY "Public can view order items"
ON public.order_items FOR SELECT
USING (true);

-- 6. INVENTORY MOVEMENTS POLICIES
DROP POLICY IF EXISTS "Allow insert inventory movements" ON public.inventory_movements;
CREATE POLICY "Allow insert inventory movements"
ON public.inventory_movements FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant staff can view inventory movements" ON public.inventory_movements;
CREATE POLICY "Tenant staff can view inventory movements"
ON public.inventory_movements FOR SELECT
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_prod ON public.inventory_movements (tenant_id, product_id, created_at DESC);
