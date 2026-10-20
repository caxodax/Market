-- Migration: 00020_barcode_retail_engine.sql
-- Description: Barcode Retail Engine, Packaging Hierarchies (Units/Packs/Cases), GS1 Barcode Indexing, and Warehouse Picking Locations
-- Safe, Idempotent, and Core-isolated.

-- 1. Ensure Uniqueness and High-Performance Indexing on Base Products Barcode
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_barcode 
ON public.products (tenant_id, barcode) 
WHERE barcode IS NOT NULL;

-- 2. Packaging Hierarchies & Secondary Barcodes (e.g. Unit vs 6-Pack vs Case of 24)
CREATE TABLE IF NOT EXISTS public.product_barcodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    barcode TEXT NOT NULL,
    pack_name TEXT NOT NULL DEFAULT 'UNIDAD', -- 'UNIDAD', 'SIX_PACK', 'DOCENA', 'BULTO_24', 'CAJA', 'DISPLAY'
    units_per_pack INT NOT NULL DEFAULT 1 CHECK (units_per_pack >= 1),
    price_usd NUMERIC(12, 2) NULL, -- Optional package price override; if null, defaults to units_per_pack * product.price_usd
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_barcode UNIQUE (tenant_id, barcode)
);

-- 3. Warehouse Coordinates in Inventory (Aisle / Shelf / Bin) for Rapid Picking Routes
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS aisle TEXT DEFAULT '01',
ADD COLUMN IF NOT EXISTS shelf TEXT DEFAULT 'A',
ADD COLUMN IF NOT EXISTS bin TEXT DEFAULT '01';

-- 4. High-Performance B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_product_barcodes_lookup 
ON public.product_barcodes (tenant_id, barcode);

CREATE INDEX IF NOT EXISTS idx_product_barcodes_product 
ON public.product_barcodes (product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_locations 
ON public.inventory (store_id, aisle, shelf, bin);

-- 5. Row Level Security for product_barcodes
ALTER TABLE public.product_barcodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff manage barcodes" ON public.product_barcodes;
CREATE POLICY "Tenant staff manage barcodes" ON public.product_barcodes
  FOR ALL USING (
    tenant_id = public.current_user_tenant_id() 
    OR public.is_super_admin() 
    OR tenant_id = current_setting('app.current_tenant_id', true) 
    OR current_setting('app.is_super_admin', true) = 'true'
  );

DROP POLICY IF EXISTS "Public can view product barcodes" ON public.product_barcodes;
CREATE POLICY "Public can view product barcodes" ON public.product_barcodes
  FOR SELECT USING (true);
