"use client";

import React from "react";
import {
  StorefrontConfig,
  Category,
  Product,
  Store,
  ExchangeRate,
} from "@marketos/types";
import { AnnouncementMarqueeBlock } from "./announcement-marquee-block";
import { HeroSliderBlock } from "./hero-slider-block";
import { CategoryBubblesBlock } from "./category-bubbles-block";
import { FlashSaleBlock } from "./flash-sale-block";
import { FeaturedRailsBlock } from "./featured-rails-block";
import { ProductReelsBlock } from "./product-reels-block";
import { TrustBadgesBlock } from "./trust-badges-block";
import { TestimonialsBlock } from "./testimonials-block";
import { BrandStoryBlock } from "./brand-story-block";
import { FaqAccordionBlock } from "./faq-accordion-block";

import { ensureCatalogBlock } from "../defaults";

// Resilient Error Boundary per block to prevent single block crashes from breaking the whole store
class SafeBlockWrapper extends React.Component<
  { id: string; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.error(`[StorefrontPro] Error rendering block "${this.props.id}":`, error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

interface StorefrontProRendererProps {
  config?: StorefrontConfig | null;
  position?: "top" | "body" | "above_catalog" | "below_catalog";
  categories: Category[];
  products: (Product & { stock: number })[];
  selectedStore?: Store;
  exchangeRate: ExchangeRate;
  selectedCategoryId?: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  onAddToCart: (product: Product) => void;
  onActionClick?: (link?: string) => void;
}

export function StorefrontProRenderer({
  config,
  position = "body",
  categories,
  products,
  selectedStore,
  exchangeRate,
  selectedCategoryId,
  onSelectCategory,
  onAddToCart,
  onActionClick,
}: StorefrontProRendererProps) {
  if (!config || !config.blocks || config.blocks.length === 0) return null;

  // Ensure blocks include catalog_grid if missing, and sort by order
  const allBlocks = ensureCatalogBlock(config.blocks).sort((a, b) => a.order - b.order);
  const catalogBlock = allBlocks.find((b) => b.type === "catalog_grid");
  const catalogOrder = catalogBlock ? catalogBlock.order : 999;

  // Filter blocks based on position
  const activeBlocks = allBlocks
    .filter((b) => b.enabled)
    .filter((b) => {
      if (position === "top") {
        return b.type === "announcement_marquee";
      }
      if (position === "above_catalog") {
        return b.type !== "announcement_marquee" && b.type !== "catalog_grid" && b.order < catalogOrder;
      }
      if (position === "below_catalog") {
        return b.type !== "announcement_marquee" && b.type !== "catalog_grid" && b.order > catalogOrder;
      }
      // "body" mode (used in admin preview simulator)
      return b.type !== "announcement_marquee";
    });

  if (activeBlocks.length === 0) return null;

  return (
    <div className="w-full flex flex-col">
      {activeBlocks.map((block) => (
        <SafeBlockWrapper key={block.id} id={block.id}>
          {(() => {
            switch (block.type) {
              case "announcement_marquee":
                return (
                  <AnnouncementMarqueeBlock
                    config={block.config as import("@marketos/types").AnnouncementMarqueeConfig}
                  />
                );

              case "hero_slider":
                return (
                  <HeroSliderBlock
                    config={block.config as import("@marketos/types").HeroSliderConfig}
                    onActionClick={onActionClick}
                  />
                );

              case "category_bubbles":
                return (
                  <CategoryBubblesBlock
                    config={block.config as import("@marketos/types").CategoryBubblesConfig}
                    categories={categories}
                    selectedCategoryId={selectedCategoryId}
                    onSelectCategory={onSelectCategory}
                  />
                );

              case "flash_sale":
                return (
                  <FlashSaleBlock
                    config={block.config as import("@marketos/types").FlashSaleConfig}
                    onExploreSale={(catId) => onSelectCategory(catId ?? null)}
                  />
                );

              case "featured_rails":
                return (
                  <FeaturedRailsBlock
                    config={block.config as import("@marketos/types").FeaturedRailsConfig}
                    products={products}
                    exchangeRate={exchangeRate}
                    onAddToCart={onAddToCart}
                  />
                );

              case "product_reels":
                return (
                  <ProductReelsBlock
                    config={block.config as import("@marketos/types").ProductReelsConfig}
                  />
                );

              case "trust_badges":
                return (
                  <TrustBadgesBlock
                    config={block.config as import("@marketos/types").TrustBadgesConfig}
                  />
                );

              case "testimonials":
                return (
                  <TestimonialsBlock
                    config={block.config as import("@marketos/types").TestimonialsConfig}
                  />
                );

              case "brand_story":
                return (
                  <BrandStoryBlock
                    config={block.config as import("@marketos/types").BrandStoryConfig}
                    selectedStore={selectedStore}
                  />
                );

              case "faq_accordion":
                return (
                  <FaqAccordionBlock
                    config={block.config as import("@marketos/types").FaqAccordionConfig}
                  />
                );

              case "catalog_grid":
                return (
                  <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 my-4 sm:my-6">
                    <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center space-y-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black">
                        <span>🛍️ Catálogo de Productos y Carrito</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium max-w-sm mx-auto">
                        Los clientes verán aquí el buscador, filtro de categorías, cuadrícula de productos y el carrito de compra lateral.
                      </p>
                    </div>
                  </div>
                );

              default:
                return null;
            }
          })()}
        </SafeBlockWrapper>
      ))}
    </div>
  );
}
