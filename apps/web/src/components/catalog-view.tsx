"use client";

import React, { useState, useMemo } from "react";
import { Category, Product, TenantSettings, Store, ExchangeRate, Order } from "@marketos/types";
import { ProductCard } from "./product-card";
import { CartDrawer } from "./cart-drawer";
import { CheckoutDialog } from "./checkout-dialog";
import { OrderSuccessModal } from "./order-success-modal";
import { Search, SlidersHorizontal, Sparkles } from "lucide-react";

interface CatalogViewProps {
  categories: Category[];
  products: (Product & { stock: number })[];
  settings: TenantSettings;
  stores: Store[];
  exchangeRate: ExchangeRate;
}

export function CatalogView({
  categories,
  products,
  settings,
  stores,
  exchangeRate,
}: CatalogViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        !selectedCategory || product.category_id === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Search and Category Bar */}
      <div className="bg-background border-b border-border sticky top-[97px] z-20 shadow-sm/50">
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar productos (ej. Harina, Queso, Café, Coca-Cola)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-muted/40 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Horizontal Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`h-9 px-4 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === null
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Todos los productos ({products.length})
            </button>

            {categories.map((cat) => {
              const count = products.filter((p) => p.category_id === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`h-9 px-4 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Catalog Grid */}
      <main className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>
              {selectedCategory
                ? categories.find((c) => c.id === selectedCategory)?.name
                : "Catálogo Disponible"}
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              ({filteredProducts.length} productos)
            </span>
          </h2>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card">
            <SlidersHorizontal className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-foreground text-sm">
              No se encontraron productos
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Prueba con otro término de búsqueda o selecciona otra categoría.
            </p>
          </div>
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
        exchangeRate={exchangeRate.value}
        onOrderCompleted={(order) => setCompletedOrder(order)}
      />

      {/* Order Success Confirmation with WhatsApp Button */}
      <OrderSuccessModal
        order={completedOrder}
        settings={settings}
        onClose={() => setCompletedOrder(null)}
      />
    </div>
  );
}
