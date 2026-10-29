"use client";

import React, { useRef } from "react";
import { CategoryBubblesConfig, Category } from "@marketos/types";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

interface CategoryBubblesBlockProps {
  config: CategoryBubblesConfig;
  categories: Category[];
  selectedCategoryId?: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export function CategoryBubblesBlock({
  config,
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryBubblesBlockProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // If useAutoCategories is true, map categories directly
  const items = config.useAutoCategories
    ? categories.map((cat) => ({
        id: cat.id,
        categoryId: cat.id,
        customLabel: cat.name,
        imageUrl:
          cat.image_url ||
          `https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=60`,
        isHighlight: false,
      }))
    : config.customItems || [];

  if (items.length === 0) return null;

  const shapeClass = config.bubbleShape === "squircle" ? "rounded-2xl" : "rounded-full";

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const offset = direction === "left" ? -200 : 200;
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 my-2 sm:my-3">
      <div className="relative group/track">
        {/* Scroll Left Button (Desktop only) */}
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="Desplazar categorías a la izquierda"
          className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border border-border bg-card/95 text-foreground items-center justify-center shadow-md hover:bg-muted transition-opacity z-10 opacity-0 group-hover/track:opacity-100 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrollable bubble rail */}
        <div
          ref={scrollRef}
          className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-2 px-1 scroll-smooth"
        >
          {/* All / Reset Bubble */}
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer focus:outline-none"
          >
            <div
              className={`w-13 h-13 sm:w-16 sm:h-16 ${shapeClass} p-0.5 border-2 transition-all flex items-center justify-center ${
                !selectedCategoryId
                  ? "border-primary scale-105 shadow-md bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/50 bg-card text-muted-foreground group-hover:text-foreground shadow-xs"
              }`}
            >
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            {config.showLabels && (
              <span
                className={`text-[11px] font-bold truncate max-w-[68px] sm:max-w-[76px] transition-colors ${
                  !selectedCategoryId ? "text-primary font-black" : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                Todos
              </span>
            )}
          </button>

          {/* Dynamic Category Bubbles */}
          {items.map((item) => {
            const isSelected = selectedCategoryId === item.categoryId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectCategory(item.categoryId)}
                className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer focus:outline-none"
              >
                <div
                  className={`w-13 h-13 sm:w-16 sm:h-16 ${shapeClass} p-0.5 border-2 transition-all relative overflow-hidden bg-muted ${
                    isSelected
                      ? "border-primary scale-105 shadow-md ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50 group-hover:scale-105 shadow-xs"
                  }`}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.customLabel || "Categoría"}
                    className={`w-full h-full object-cover ${shapeClass} transition-transform duration-300 group-hover:scale-110`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=60";
                    }}
                  />
                </div>

                {config.showLabels && (
                  <span
                    className={`text-[11px] font-semibold truncate max-w-[68px] sm:max-w-[76px] transition-colors ${
                      isSelected
                        ? "text-primary font-black"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                    title={item.customLabel}
                  >
                    {item.customLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scroll Right Button (Desktop only) */}
        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="Desplazar categorías a la derecha"
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border border-border bg-card/95 text-foreground items-center justify-center shadow-md hover:bg-muted transition-opacity z-10 opacity-0 group-hover/track:opacity-100 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
