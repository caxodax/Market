import React from "react";
import { MarketOSRepository } from "@marketos/database";
import { CartProvider } from "../context/cart-context";
import { StoreHeader } from "../components/store-header";
import { CatalogView } from "../components/catalog-view";

// Tenant 1 ID
const TENANT_ID = process.env.DEFAULT_TENANT_ID || "shop-market-ca";

export const revalidate = 60; // ISR cache revalidation every minute

export default async function HomePage() {
  // Fetch tenant data concurrently
  const [settings, categories, products, stores, exchangeRate] =
    await Promise.all([
      MarketOSRepository.getTenantSettings(TENANT_ID),
      MarketOSRepository.getCategories(TENANT_ID),
      MarketOSRepository.getProducts(TENANT_ID),
      MarketOSRepository.getStores(TENANT_ID),
      MarketOSRepository.getExchangeRate(TENANT_ID),
    ]);

  return (
    <CartProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Brand Header with Live BCV exchange rate and Cart trigger */}
        <StoreHeader settings={settings} exchangeRate={exchangeRate} />

        {/* Dynamic Catalog with Search, Category Filter and Cart Flow */}
        <CatalogView
          categories={categories}
          products={products}
          settings={settings}
          stores={stores}
          exchangeRate={exchangeRate}
        />
      </div>
    </CartProvider>
  );
}
