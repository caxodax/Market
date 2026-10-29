"use client";

import React, { useRef, useState } from "react";
import { FeaturedRailsConfig, Product, ExchangeRate } from "@marketos/types";
import { ChevronLeft, ChevronRight, Plus, Sparkles, Check } from "lucide-react";
import { formatCurrency, convertUsdToVes } from "@marketos/utils";

interface FeaturedRailsBlockProps {
  config: FeaturedRailsConfig;
  products: (Product & { stock: number })[];
  exchangeRate: ExchangeRate;
  onAddToCart: (product: Product) => void;
}

export function FeaturedRailsBlock({
  config,
  products,
  exchangeRate,
  onAddToCart,
}: FeaturedRailsBlockProps) {
  const rails = config.rails || [];
  if (rails.length === 0) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 my-3 sm:my-4 space-y-6">
      {rails.map((rail) => {
        // Filter products for this rail
        let railProducts = [...products];
        if (rail.filterType === "bestsellers") {
          // Top products by stock or available
          railProducts = railProducts.slice(0, rail.maxItems || 8);
        } else if (rail.filterType === "category" && rail.categoryId) {
          railProducts = railProducts.filter((p) => p.category_id === rail.categoryId).slice(0, rail.maxItems || 8);
        } else if (rail.filterType === "custom" && rail.customProductIds?.length) {
          railProducts = railProducts.filter((p) => rail.customProductIds!.includes(p.id));
        } else {
          railProducts = railProducts.slice(0, rail.maxItems || 8);
        }

        if (railProducts.length === 0) return null;

        return (
          <RailItemView
            key={rail.id}
            title={rail.title}
            subtitle={rail.subtitle}
            products={railProducts}
            exchangeRate={exchangeRate}
            onAddToCart={onAddToCart}
          />
        );
      })}
    </div>
  );
}

function RailItemView({
  title,
  subtitle,
  products,
  exchangeRate,
  onAddToCart,
}: {
  title: string;
  subtitle?: string;
  products: (Product & { stock: number })[];
  exchangeRate: ExchangeRate;
  onAddToCart: (product: Product) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const offset = direction === "left" ? -280 : 280;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  const handleAdd = (prod: Product) => {
    onAddToCart(prod);
    setRecentlyAddedId(prod.id);
    setTimeout(() => {
      setRecentlyAddedId((curr) => (curr === prod.id ? null : curr));
    }, 1300);
  };

  return (
    <section aria-label={title} className="space-y-2.5">
      {/* Header with Title and Scroll Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>{title}</span>
          </h3>
          {subtitle && (
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label={`Desplazar hacia la izquierda ${title}`}
            className="w-7 h-7 rounded-lg border border-border bg-card text-foreground flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label={`Desplazar hacia la derecha ${title}`}
            className="w-7 h-7 rounded-lg border border-border bg-card text-foreground flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Snap Horizontal Scroll Container */}
      <div
        ref={scrollContainerRef}
        className="flex items-stretch gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar py-1 scroll-smooth snap-x snap-mandatory"
      >
        {products.map((prod) => {
          const priceVes = convertUsdToVes(prod.price_usd, exchangeRate.value);
          const isOutOfStock = prod.stock <= 0;
          const isJustAdded = recentlyAddedId === prod.id;

          return (
            <div
              key={prod.id}
              className="w-[145px] sm:w-[175px] md:w-[190px] shrink-0 snap-start rounded-2xl border border-border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
            >
              {/* Product Image Container with strict locked dimensions */}
              <div className="relative aspect-square w-full h-36 sm:h-44 bg-muted/40 overflow-hidden flex items-center justify-center p-2 rounded-t-2xl">
                <img
                  src={prod.image_url || "/brand/placeholder.png"}
                  alt={prod.name}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5'><rect width='18' height='18' x='3' y='3' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><path d='m21 15-5-5L5 21'/></svg>";
                  }}
                />
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md">
                      Agotado
                    </span>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {prod.name}
                  </h4>
                  <div className="mt-1">
                    <span className="text-xs sm:text-sm font-black text-foreground">
                      ${formatCurrency(prod.price_usd)}
                    </span>
                    <span className="block text-[10px] font-bold text-muted-foreground">
                      Bs. {formatCurrency(priceVes)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => handleAdd(prod)}
                  className={`w-full h-8 sm:h-9 py-1 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    isOutOfStock
                      ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                      : isJustAdded
                        ? "bg-emerald-600 text-white shadow-sm scale-[1.02]"
                        : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm active:scale-98"
                  }`}
                >
                  {isJustAdded ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>¡Agregado!</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
