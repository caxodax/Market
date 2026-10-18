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
import { FavoritesProvider } from "../context/favorites-context";
import { StoreHeader } from "./store-header";
import { CatalogView } from "./catalog-view";
import { CustomerLookupModal } from "./customer-lookup-modal";
import { BranchSelectorModal } from "./branch-selector-modal";
import { PwaPushBanner } from "./pwa/pwa-push-banner";
import { ShieldCheck, MapPin, Heart } from "lucide-react";

interface StorefrontPageProps {
  settings: TenantSettings;
  categories: Category[];
  products: (Product & { stock: number })[];
  stores: Store[];
  deliveryZones: DeliveryZone[];
  exchangeRate: ExchangeRate;
  activeModuleIds?: import("@marketos/types").TenantModuleId[];
  modifierGroups?: import("@marketos/types").ProductModifierGroup[];
}

function hexToHslString(hex: string): string {
  try {
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) {
      hex = hex.split("").map((c) => c + c).join("");
    }
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  } catch {
    return "0 72% 51%";
  }
}

export function StorefrontPage({
  settings,
  categories,
  products,
  stores,
  deliveryZones,
  exchangeRate,
  activeModuleIds = [],
  modifierGroups = [],
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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const primaryHsl = settings.primary_color ? hexToHslString(settings.primary_color) : null;
  const secondaryHsl = settings.secondary_color ? hexToHslString(settings.secondary_color) : null;
  const fontFamilyName = settings.font_family || "Inter";

  return (
    <FavoritesProvider tenantId={settings.tenant_id}>
      <CartProvider>
        {/* Dynamic Brand Themes & Typography */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                ${primaryHsl ? `--primary: ${primaryHsl}; --ring: ${primaryHsl};` : ""}
                ${secondaryHsl ? `--secondary: ${secondaryHsl};` : ""}
                ${fontFamilyName ? `font-family: '${fontFamilyName}', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;` : ""}
              }
            `,
          }}
        />
        <div className="min-h-screen bg-background text-foreground flex flex-col w-full max-w-full overflow-x-hidden">
          {/* Brand Header with Live BCV exchange rate, Cart trigger and Branch Selector */}
          <StoreHeader
            settings={settings}
            exchangeRate={exchangeRate}
            selectedStore={selectedStore}
            onOpenBranchSelector={() => setIsBranchSelectorOpen(true)}
            onOpenTracker={() => setIsTrackerOpen(true)}
            onOpenAccount={() => setIsAccountOpen(true)}
            onOpenFavorites={() => setActiveCategory("favorites")}
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
            selectedCategory={activeCategory}
            setSelectedCategory={setActiveCategory}
            activeModuleIds={activeModuleIds}
            modifierGroups={modifierGroups}
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

        {/* Multi-Tenant PWA & Web Push Notification Prompt */}
        <PwaPushBanner
          tenantId={settings.tenant_id}
          storeName={settings.business_name}
          logoUrl={settings.logo_url}
        />
      </div>
      </CartProvider>
    </FavoritesProvider>
  );
}
