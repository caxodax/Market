"use client";

import React, { useState } from "react";
import Link from "next/link";
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
import { BranchSelectorModal } from "./branch-selector-modal";
import { ShieldCheck, MapPin, Heart } from "lucide-react";

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
  const [selectedStore, setSelectedStore] = useState<Store>(
    stores[0] || {
      id: "default-store",
      tenant_id: settings.tenant_id,
      name: "Sucursal Nueva Segovia",
      code: "NS-01",
      address: "Calle 3 entre Carreras 1 y 2, Nueva Segovia",
      phone: "+58 424-5919577",
      is_active: true,
      created_at: new Date().toISOString(),
    }
  );
  const [isBranchSelectorOpen, setIsBranchSelectorOpen] = useState(false);

  return (
    <CartProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Brand Header with Live BCV exchange rate, Cart trigger and Branch Selector */}
        <StoreHeader
          settings={settings}
          exchangeRate={exchangeRate}
          selectedStore={selectedStore}
          onOpenBranchSelector={() => setIsBranchSelectorOpen(true)}
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

        {/* Storefront Footer */}
        <footer className="mt-auto border-t border-border bg-card py-8 px-4 text-xs text-muted-foreground">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <p className="font-bold text-foreground">
                {settings.business_name} • Barquisimeto
              </p>
              <p className="text-[11px]">
                {selectedStore.address} {selectedStore.phone && `• ${selectedStore.phone}`}
              </p>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <button
                onClick={() => setIsBranchSelectorOpen(true)}
                className="hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span>Cambiar Sede</span>
              </button>
              <span className="text-border">|</span>
              <Link
                href="/login"
                className="hover:text-foreground transition-colors flex items-center gap-1"
                title="Acceso administrativo y operadores de caja"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Acceso Personal</span>
              </Link>
            </div>
          </div>
        </footer>

        {/* Branch / Store Selector Modal with GPS Proximity */}
        <BranchSelectorModal
          isOpen={isBranchSelectorOpen}
          onClose={() => setIsBranchSelectorOpen(false)}
          stores={stores}
          selectedStore={selectedStore}
          onSelectStore={(store) => setSelectedStore(store)}
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
