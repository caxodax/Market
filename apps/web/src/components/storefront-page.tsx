"use client";

import React, { useState } from "react";
import {
  TenantSettings,
  Category,
  Product,
  Store,
  ExchangeRate,
  DeliveryZone,
} from "@marketos/types";
import { CartProvider } from "../context/cart-context";
import { StoreHeader } from "./store-header";
import { CatalogView } from "./catalog-view";
import { CustomerLookupModal } from "./customer-lookup-modal";

interface StorefrontPageProps {
  settings: TenantSettings;
  categories: Category[];
  products: (Product & { stock: number })[];
  stores: Store[];
  deliveryZones: DeliveryZone[];
  exchangeRate: ExchangeRate;
}

export function StorefrontPage({
  settings,
  categories,
  products,
  stores,
  deliveryZones,
  exchangeRate,
}: StorefrontPageProps) {
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  return (
    <CartProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Brand Header with Live BCV exchange rate, Cart trigger and Tracker button */}
        <StoreHeader
          settings={settings}
          exchangeRate={exchangeRate}
          onOpenTracker={() => setIsTrackerOpen(true)}
          onOpenAccount={() => setIsAccountOpen(true)}
        />

        {/* Dynamic Catalog with Search, Category Filter, Promo banner, Cart and Delivery Zones */}
        <CatalogView
          categories={categories}
          products={products}
          settings={settings}
          stores={stores}
          deliveryZones={deliveryZones}
          exchangeRate={exchangeRate}
          isTrackerOpen={isTrackerOpen}
          setIsTrackerOpen={setIsTrackerOpen}
        />

        {/* Customer Profile & Loyalty Lookup Modal */}
        <CustomerLookupModal
          tenantId={settings.tenant_id}
          settings={settings}
          isOpen={isAccountOpen}
          onClose={() => setIsAccountOpen(false)}
        />
      </div>
    </CartProvider>
  );
}
