-- ==============================================================================
-- Migration 00018: Storefront Pro & Visual Layout Studio
-- Adds schema support for modular, customizable storefront sections
-- (Banners, Sliders, Category Stories, Reels, Trust Badges, Testimonials, FAQ, etc.)
-- ==============================================================================

ALTER TABLE IF EXISTS tenant_settings
  ADD COLUMN IF NOT EXISTS storefront_config JSONB DEFAULT NULL;

COMMENT ON COLUMN tenant_settings.storefront_config IS 
  'JSONB container with active/disabled blocks, ordering, and block configurations for Storefront Pro';
