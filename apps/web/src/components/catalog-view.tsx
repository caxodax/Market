"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Category,
  Product,
  TenantSettings,
  Store,
  ExchangeRate,
  Order,
  DeliveryZone,
} from "@marketos/types";
import { formatCurrency, convertUsdToVes } from "@marketos/utils";
import { useCart } from "../context/cart-context";
import { ProductCard } from "./product-card";
import { CartDrawer } from "./cart-drawer";
import { CheckoutDialog } from "./checkout-dialog";
import { OrderSuccessModal } from "./order-success-modal";
import { OrderTrackerModal } from "./order-tracker-modal";
import { CustomerOrderTicketModal } from "./customer-order-ticket-modal";
import { useFavorites } from "../context/favorites-context";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Truck,
  ShoppingBag,
  ArrowRight,
  RotateCcw,
  Heart,
} from "lucide-react";

interface CatalogViewProps {
  categories: Category[];
  products: (Product & { stock: number })[];
  settings: TenantSettings;
  stores: Store[];
  deliveryZones: DeliveryZone[];
  exchangeRate: ExchangeRate;
  isTrackerOpen: boolean;
  setIsTrackerOpen: (open: boolean) => void;
  selectedCategory?: string | null;
  setSelectedCategory?: (cat: string | null) => void;
}

export function CatalogView({
  categories,
  products,
  settings,
  stores,
  deliveryZones,
  exchangeRate,
  isTrackerOpen,
  setIsTrackerOpen,
  selectedCategory: controlledCategory,
  setSelectedCategory: setControlledCategory,
}: CatalogViewProps) {
  const { totalItems, totalUsd, setIsOpen } = useCart();
  const { favorites, favoritesCount } = useFavorites();
  const totalVes = convertUsdToVes(totalUsd, exchangeRate.value);

  const [internalCategory, setInternalCategory] = useState<string | null>(null);
  const activeCategory = controlledCategory !== undefined ? controlledCategory : internalCategory;

  const handleSelectCategory = (cat: string | null) => {
    if (setControlledCategory) {
      setControlledCategory(cat);
    }
    setInternalCategory(cat);
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [ticketOrder, setTicketOrder] = useState<Order | null>(null);
  const [trackingInitialQuery, setTrackingInitialQuery] = useState<string | undefined>(undefined);

  // Auto-open tracker when user scans QR code (e.g. /?track=ORD-123456)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const trackParam = params.get("track");
      if (trackParam && trackParam.trim()) {
        setTrackingInitialQuery(trackParam.trim());
        setIsTrackerOpen(true);
      }
    }
  }, [setIsTrackerOpen]);

  // Filter products by category, favorites and search
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (activeCategory === "favorites") {
        if (!favorites.includes(product.id)) return false;
      } else if (activeCategory && product.category_id !== activeCategory) {
        return false;
      }
      const matchesSearch =
        !searchQuery.trim() ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.sku &&
          product.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSearch;
    });
  }, [products, activeCategory, searchQuery, favorites]);

  return (
    <div
      className={`min-h-screen bg-background transition-all ${
        totalItems > 0 ? "pb-32 sm:pb-24" : "pb-20"
      }`}
    >
      {/* Search and Category Bar - Sticky under StoreHeader */}
      <div className="bg-background/95 backdrop-blur border-b border-border sticky top-[97px] z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar productos (ej. Harina, Queso, Café, Coca-Cola)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-16 rounded-xl border border-input bg-muted/30 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Horizontal Category Pills with Edge Scroll Hint */}
          <div className="relative">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar pr-6">
              <button
                onClick={() => handleSelectCategory(null)}
                className={`h-9 px-4 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === null
                    ? "bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                Todos ({products.length})
              </button>

              {/* Favorites Pill */}
              <button
                onClick={() => handleSelectCategory(activeCategory === "favorites" ? null : "favorites")}
                className={`h-9 px-3.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeCategory === "favorites"
                    ? "bg-rose-500 text-white shadow-xs ring-2 ring-rose-500/25"
                    : favoritesCount > 0
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                title="Ver tus productos guardados en favoritos"
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    activeCategory === "favorites" || favoritesCount > 0
                      ? "fill-current text-current"
                      : "text-muted-foreground"
                  }`}
                />
                <span>Favoritos ({favoritesCount})</span>
              </button>

              {categories.map((cat) => {
                const count = products.filter(
                  (p) => p.category_id === cat.id
                ).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.id)}
                    className={`h-9 px-4 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      activeCategory === cat.id
                        ? "bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20"
                        : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {cat.name} ({count})
                  </button>
                );
              })}
            </div>

            {/* Subtle right fade hint for horizontal scroll */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent" />
          </div>
        </div>
      </div>

      {/* Main Catalog Grid */}
      <main className="max-w-7xl mx-auto px-4 pt-4">
        {/* Promotional Banner */}
        <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-primary/10 via-amber-500/10 to-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-foreground">
                🎉 Promociones Activas en {settings.business_name}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Usa <span className="font-mono font-bold text-primary">BIENVENIDO</span> para <strong>$2 OFF</strong> (&gt;$10) o <span className="font-mono font-bold text-primary">SHOP10</span> para <strong>10% OFF</strong> (&gt;$20).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground/90 self-end sm:self-auto bg-background/80 px-3 py-1.5 rounded-xl border border-border shadow-2xs">
            <Truck className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Delivery gratis en Nueva Segovia</span>
          </div>
        </div>

        {/* Section Heading */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black tracking-tight text-foreground flex items-center gap-1.5">
            {activeCategory === "favorites" ? (
              <>
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                <span>Mis Productos Favoritos</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-primary" />
                <span>
                  {activeCategory
                    ? categories.find((c) => c.id === activeCategory)?.name
                    : "Catálogo Disponible"}
                </span>
              </>
            )}
            <span className="text-xs text-muted-foreground font-semibold">
              ({filteredProducts.length} {filteredProducts.length === 1 ? "producto" : "productos"})
            </span>
          </h2>

          {activeCategory && (
            <button
              onClick={() => handleSelectCategory(null)}
              className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              Ver todo el catálogo
            </button>
          )}
        </div>

        {/* Products Grid or Empty State */}
        {filteredProducts.length === 0 ? (
          activeCategory === "favorites" ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-rose-500/30 bg-rose-500/5 max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-3">
                <Heart className="w-7 h-7 stroke-[1.8]" />
              </div>
              <p className="font-bold text-foreground text-sm">
                Aún no tienes productos favoritos
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Toca el corazón (❤️) en la esquina de cualquier producto para guardarlo aquí y comprarlo en un clic.
              </p>
              <button
                onClick={() => handleSelectCategory(null)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-transform active:scale-95 cursor-pointer shadow-xs"
              >
                <span>Explorar todo el catálogo</span>
              </button>
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/60">
              <SlidersHorizontal className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-bold text-foreground text-sm">
                No se encontraron productos
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Prueba con otro término de búsqueda o selecciona otra categoría.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  handleSelectCategory(null);
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-transform active:scale-95 cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ver todos los productos</span>
              </button>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                exchangeRate={exchangeRate.value}
              />
            ))}
          </div>
        )}
      </main>

      {/* Sticky Mobile Bottom Cart Bar (Thumb-Zone Ergonomics) */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 inset-x-4 z-40 sm:hidden animate-in slide-in-from-bottom-5 duration-200">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="w-full bg-primary text-primary-foreground p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-primary/30 active:scale-[0.99] transition-transform cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center relative shadow-xs">
                <ShoppingBag className="w-5 h-5 text-white" />
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {totalItems}
                </span>
              </div>
              <div className="text-left">
                <p className="text-xs font-black leading-tight text-white">
                  {totalItems} {totalItems === 1 ? "producto" : "productos"} en carrito
                </p>
                <p className="text-[11px] font-bold text-white/90">
                  {formatCurrency(totalUsd, "USD")} • Bs.{" "}
                  {totalVes.toLocaleString("es-VE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-white text-primary px-3 py-1.5 rounded-xl font-black text-xs shadow-xs">
              <span>Ver Carrito</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </button>
        </div>
      )}

      {/* Persistent Cart Drawer */}
      <CartDrawer
        exchangeRate={exchangeRate.value}
        onProceedToCheckout={() => setIsCheckoutOpen(true)}
      />

      {/* Checkout Dialog */}
      <CheckoutDialog
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        settings={settings}
        stores={stores}
        deliveryZones={deliveryZones}
        exchangeRate={exchangeRate.value}
        onOrderCompleted={(order) => setCompletedOrder(order)}
      />

      {/* Order Success Confirmation with WhatsApp Button */}
      <OrderSuccessModal
        order={completedOrder}
        settings={settings}
        onClose={() => setCompletedOrder(null)}
        onViewTicket={(ord) => {
          setCompletedOrder(null);
          setTicketOrder(ord);
        }}
      />

      {/* Customer Ticket & QR Receipt Modal */}
      <CustomerOrderTicketModal
        order={ticketOrder}
        isOpen={Boolean(ticketOrder)}
        onClose={() => setTicketOrder(null)}
        settings={settings}
        store={stores[0]}
      />

      {/* Customer Order Tracker Modal */}
      <OrderTrackerModal
        isOpen={isTrackerOpen}
        onClose={() => {
          setIsTrackerOpen(false);
          setTrackingInitialQuery(undefined);
        }}
        settings={settings}
        initialQuery={trackingInitialQuery}
      />
    </div>
  );
}
