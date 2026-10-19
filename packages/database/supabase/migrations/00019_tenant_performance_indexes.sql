-- =====================================================================
-- MIGRATION 00019: MULTI-TENANT HIGH-CONCURRENCY PERFORMANCE INDEXES
-- Optimizes primary query hot paths for orders, products, items & payments
-- Safe & Idempotent (CREATE INDEX IF NOT EXISTS)
-- =====================================================================

-- 1. PRODUCTS: Accelerates catalog browsing for all active products without category filter
-- Used in: MarketOSRepository.getProducts(tenantId) -> WHERE tenant_id = $1 AND is_active = true
CREATE INDEX IF NOT EXISTS idx_products_tenant_active 
ON public.products (tenant_id, is_active);

-- 2. ORDERS: Accelerates default merchant orders listing sorted by newest first
-- Used in: MarketOSRepository.getTenantOrders(tenantId) -> WHERE tenant_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created 
ON public.orders (tenant_id, created_at DESC);

-- 3. ORDERS: Accelerates idempotency check & customer order history lookup
-- Used in: Deduplication check and customer account history -> WHERE tenant_id = $1 AND customer_id = $2
CREATE INDEX IF NOT EXISTS idx_orders_tenant_customer 
ON public.orders (tenant_id, customer_id, created_at DESC);

-- 4. ORDER ITEMS: Critical foreign-key index to prevent Full Table Scan on batch queries
-- Used in: Promise.all enrichment -> supabase.from("order_items").select("*").in("order_id", orderIds)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_tenant_order 
ON public.order_items (tenant_id, order_id);

-- 5. PAYMENTS: Critical foreign-key index to prevent Full Table Scan on batch queries
-- Used in: Promise.all enrichment -> supabase.from("payments").select("*").in("order_id", orderIds)
CREATE INDEX IF NOT EXISTS idx_payments_order_id 
ON public.payments (order_id);

-- 6. INVENTORY: Accelerates reverse join when embedding inventory stock on product catalog
-- Used in: supabase.from("products").select("*, inventory(quantity)")
CREATE INDEX IF NOT EXISTS idx_inventory_product_id 
ON public.inventory (product_id);
