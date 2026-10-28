import { unstable_cache, revalidateTag } from "next/cache";
import { MarketOSRepository } from "@marketos/database";
import type {
  Tenant,
  TenantSettings,
  Category,
  Product,
  Store,
  ExchangeRate,
  DeliveryZone,
  TenantModuleId,
} from "@marketos/types";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * MarketOS — Native Edge Data Cache (Zero Redis Dependency)
 * ═══════════════════════════════════════════════════════════════════════
 * Utiliza Next.js Data Cache nativo (unstable_cache) con SWR y Tags.
 * Los datos se sirven desde la memoria/CDN de Vercel en <15ms sin tocar
 * la base de datos de PostgreSQL en cada petición de catálogo.
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * Obtener Tenant con caché de 5 minutos
 */
export const getCachedTenant = (slugOrId: string): Promise<Tenant | null> => {
  return unstable_cache(
    async () => MarketOSRepository.getTenant(slugOrId),
    [`tenant-lookup-${slugOrId.toLowerCase()}`],
    {
      revalidate: 300,
      tags: [`tenant-info-${slugOrId.toLowerCase()}`],
    }
  )();
};

/**
 * Obtener Configuración de Tenant con caché de 5 minutos
 */
export const getCachedTenantSettings = (tenantId: string): Promise<TenantSettings> => {
  return unstable_cache(
    async () => MarketOSRepository.getTenantSettings(tenantId),
    [`tenant-settings-${tenantId}`],
    {
      revalidate: 60,
      tags: [`tenant-settings-${tenantId}`],
    }
  )();
};

/**
 * Obtener Categorías con caché de 10 minutos
 */
export const getCachedCategories = (tenantId: string): Promise<Category[]> => {
  return unstable_cache(
    async () => MarketOSRepository.getCategories(tenantId),
    [`tenant-categories-${tenantId}`],
    {
      revalidate: 600,
      tags: [`tenant-categories-${tenantId}`],
    }
  )();
};

/**
 * Obtener Productos del Catálogo con caché de 3 minutos
 */
export const getCachedProducts = (
  tenantId: string,
  categoryId?: string,
  query?: string
): Promise<(Product & { stock: number })[]> => {
  const cacheKey = `tenant-products-${tenantId}-${categoryId || "all"}-${query ? encodeURIComponent(query) : "all"}`;
  return unstable_cache(
    async () => MarketOSRepository.getProducts(tenantId, categoryId, query),
    [cacheKey],
    {
      revalidate: 180,
      tags: [`tenant-products-${tenantId}`],
    }
  )();
};

/**
 * Obtener Sucursales con caché de 10 minutos
 */
export const getCachedStores = (tenantId: string): Promise<Store[]> => {
  return unstable_cache(
    async () => MarketOSRepository.getStores(tenantId),
    [`tenant-stores-${tenantId}`],
    {
      revalidate: 600,
      tags: [`tenant-stores-${tenantId}`],
    }
  )();
};

/**
 * Obtener Tasa de Cambio con caché de 60 segundos
 */
export const getCachedExchangeRate = (tenantId: string): Promise<ExchangeRate> => {
  return unstable_cache(
    async () => MarketOSRepository.getExchangeRate(tenantId),
    [`tenant-rate-${tenantId}`],
    {
      revalidate: 60,
      tags: [`tenant-rate-${tenantId}`],
    }
  )();
};

/**
 * Obtener Zonas de Entrega con caché de 10 minutos
 */
export const getCachedDeliveryZones = (tenantId: string): Promise<DeliveryZone[]> => {
  return unstable_cache(
    async () => MarketOSRepository.getDeliveryZones(tenantId),
    [`tenant-delivery-zones-${tenantId}`],
    {
      revalidate: 600,
      tags: [`tenant-delivery-zones-${tenantId}`],
    }
  )();
};

/**
 * Obtener Módulos Activos del Tenant con caché de 60 segundos
 */
export const getCachedTenantActiveModuleIds = (tenantId: string): Promise<TenantModuleId[]> => {
  return unstable_cache(
    async () => MarketOSRepository.getTenantActiveModuleIds(tenantId),
    [`tenant-modules-${tenantId}`],
    {
      revalidate: 60,
      tags: [`tenant-modules-${tenantId}`],
    }
  )();
};

/**
 * ═══════════════════════════════════════════════════════════════════════
 * Invalidadores de Caché (Llamados desde Server Actions)
 * ═══════════════════════════════════════════════════════════════════════
 */

export function invalidateProductsCache(tenantId: string) {
  try {
    revalidateTag(`tenant-products-${tenantId}`, { expire: 0 });
  } catch (e) {
    // Ignored in non-server action contexts
  }
}

export function invalidateCategoriesCache(tenantId: string) {
  try {
    revalidateTag(`tenant-categories-${tenantId}`, { expire: 0 });
  } catch (e) {
    // Ignored
  }
}

export function invalidateSettingsCache(tenantId: string) {
  try {
    revalidateTag(`tenant-settings-${tenantId}`, { expire: 0 });
    revalidateTag(`tenant-info-${tenantId.toLowerCase()}`, { expire: 0 });
    revalidateTag(`tenant-modules-${tenantId}`, { expire: 0 });
    revalidateTag(`tenant-rate-${tenantId}`, { expire: 0 });
  } catch (e) {
    // Ignored
  }
}

export function invalidateExchangeRateCache(tenantId: string) {
  try {
    revalidateTag(`tenant-rate-${tenantId}`, { expire: 0 });
  } catch (e) {
    // Ignored
  }
}

export function invalidateDeliveryZonesCache(tenantId: string) {
  try {
    revalidateTag(`tenant-delivery-zones-${tenantId}`, { expire: 0 });
  } catch (e) {
    // Ignored
  }
}

/**
 * Invalidar toda la caché relacionada con un Tenant (estado, suscripción, settings, productos)
 */
export function invalidateTenantCache(tenantIdOrSlug: string, optionalSlug?: string) {
  try {
    const key = tenantIdOrSlug.toLowerCase();
    revalidateTag(`tenant-info-${key}`, { expire: 0 });
    revalidateTag(`tenant-settings-${tenantIdOrSlug}`, { expire: 0 });
    revalidateTag(`tenant-products-${tenantIdOrSlug}`, { expire: 0 });
    revalidateTag(`tenant-categories-${tenantIdOrSlug}`, { expire: 0 });
    revalidateTag(`tenant-stores-${tenantIdOrSlug}`, { expire: 0 });
    revalidateTag(`tenant-modules-${tenantIdOrSlug}`, { expire: 0 });
    if (optionalSlug && optionalSlug.toLowerCase() !== key) {
      revalidateTag(`tenant-info-${optionalSlug.toLowerCase()}`, { expire: 0 });
      revalidateTag(`tenant-settings-${optionalSlug}`, { expire: 0 });
      revalidateTag(`tenant-modules-${optionalSlug}`, { expire: 0 });
    }
  } catch (e) {
    // Ignored in non-server action contexts
  }
}

