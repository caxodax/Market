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

interface StorefrontProRendererProps {
  config?: StorefrontConfig | null;
  position?: "top" | "body";
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

  // Filter blocks based on position
  const activeBlocks = config.blocks
    .filter((b) => b.enabled)
    .sort((a, b) => a.order - b.order)
    .filter((b) => {
      if (position === "top") {
        return b.type === "announcement_marquee";
      } else {
        return b.type !== "announcement_marquee";
      }
    });

  if (activeBlocks.length === 0) return null;

  return (
    <div className="w-full flex flex-col">
      {activeBlocks.map((block) => {
        switch (block.type) {
          case "announcement_marquee":
            return (
              <AnnouncementMarqueeBlock
                key={block.id}
                config={block.config as import("@marketos/types").AnnouncementMarqueeConfig}
              />
            );

          case "hero_slider":
            return (
              <HeroSliderBlock
                key={block.id}
                config={block.config as import("@marketos/types").HeroSliderConfig}
                onActionClick={onActionClick}
              />
            );

          case "category_bubbles":
            return (
              <CategoryBubblesBlock
                key={block.id}
                config={block.config as import("@marketos/types").CategoryBubblesConfig}
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={onSelectCategory}
              />
            );

          case "flash_sale":
            return (
              <FlashSaleBlock
                key={block.id}
                config={block.config as import("@marketos/types").FlashSaleConfig}
                onExploreSale={(catId) => onSelectCategory(catId ?? null)}
              />
            );

          case "featured_rails":
            return (
              <FeaturedRailsBlock
                key={block.id}
                config={block.config as import("@marketos/types").FeaturedRailsConfig}
                products={products}
                exchangeRate={exchangeRate}
                onAddToCart={onAddToCart}
              />
            );

          case "product_reels":
            return (
              <ProductReelsBlock
                key={block.id}
                config={block.config as import("@marketos/types").ProductReelsConfig}
              />
            );

          case "trust_badges":
            return (
              <TrustBadgesBlock
                key={block.id}
                config={block.config as import("@marketos/types").TrustBadgesConfig}
              />
            );

          case "testimonials":
            return (
              <TestimonialsBlock
                key={block.id}
                config={block.config as import("@marketos/types").TestimonialsConfig}
              />
            );

          case "brand_story":
            return (
              <BrandStoryBlock
                key={block.id}
                config={block.config as import("@marketos/types").BrandStoryConfig}
                selectedStore={selectedStore}
              />
            );

          case "faq_accordion":
            return (
              <FaqAccordionBlock
                key={block.id}
                config={block.config as import("@marketos/types").FaqAccordionConfig}
              />
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
