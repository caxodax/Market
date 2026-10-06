import React from "react";
import { MarketOSRepository } from "@marketos/database";
import { StorefrontPage } from "../components/storefront-page";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ tenant?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  // Dynamic multi-tenant resolution: ?tenant=slug or fallback to default
  const tenantSlugOrId =
    params?.tenant || process.env.DEFAULT_TENANT_ID || "shop-market-ca";

  const tenant = await MarketOSRepository.getTenant(tenantSlugOrId);
  const activeTenantId = tenant?.id || "shop-market-ca";

  // Fetch tenant data concurrently (products, categories, stores, exchange rate, delivery zones)
  const [settings, categories, products, stores, exchangeRate, deliveryZones] =
    await Promise.all([
      MarketOSRepository.getTenantSettings(activeTenantId),
      MarketOSRepository.getCategories(activeTenantId),
      MarketOSRepository.getProducts(activeTenantId),
      MarketOSRepository.getStores(activeTenantId),
      MarketOSRepository.getExchangeRate(activeTenantId),
      MarketOSRepository.getDeliveryZones(activeTenantId),
    ]);

  return (
    <StorefrontPage
      settings={settings}
      categories={categories}
      products={products}
      stores={stores}
      deliveryZones={deliveryZones}
      exchangeRate={exchangeRate}
    />
  );
}
