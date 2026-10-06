import React from "react";
import { MarketOSRepository } from "@marketos/database";
import { StorefrontPage } from "../components/storefront-page";

// Tenant 1 ID
const TENANT_ID = process.env.DEFAULT_TENANT_ID || "shop-market-ca";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Fetch tenant data concurrently (products, categories, stores, exchange rate, delivery zones)
  const [settings, categories, products, stores, exchangeRate, deliveryZones] =
    await Promise.all([
      MarketOSRepository.getTenantSettings(TENANT_ID),
      MarketOSRepository.getCategories(TENANT_ID),
      MarketOSRepository.getProducts(TENANT_ID),
      MarketOSRepository.getStores(TENANT_ID),
      MarketOSRepository.getExchangeRate(TENANT_ID),
      MarketOSRepository.getDeliveryZones(TENANT_ID),
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
