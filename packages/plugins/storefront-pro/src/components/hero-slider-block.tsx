"use client";

import React, { useState, useEffect, useRef } from "react";
import { HeroSliderConfig } from "@marketos/types";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

interface HeroSliderBlockProps {
  config: HeroSliderConfig;
  onActionClick?: (link?: string) => void;
}

export function HeroSliderBlock({ config, onActionClick }: HeroSliderBlockProps) {
  const slides = config.slides || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const total = slides.length;

  useEffect(() => {
    if (total <= 1 || !config.autoplayIntervalMs || config.autoplayIntervalMs <= 0 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % total);
    }, config.autoplayIntervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [total, config.autoplayIntervalMs, isPaused]);

  if (total === 0) return null;

  const currentSlide = slides[currentIndex] || slides[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  const aspectClass = {
    "16:9": "aspect-[16/9] min-h-[190px] sm:min-h-[280px]",
    "21:9": "aspect-[16/9] sm:aspect-[21/9] min-h-[200px] sm:min-h-[300px]",
    "4:3": "aspect-[4/3] sm:aspect-[16/9] min-h-[200px]",
  }[config.aspectRatio || "21:9"];

  const textAlignmentClass = {
    left: "text-left items-start",
    center: "text-center items-center",
    right: "text-right items-end",
  }[currentSlide.textAlignment || "left"];

  const hasCta = Boolean(currentSlide.ctaLink);

  const handleCardClick = () => {
    if (hasCta && onActionClick) {
      onActionClick(currentSlide.ctaLink);
    }
  };

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="Banners promocionales destacados"
      className="relative w-full max-w-7xl mx-auto px-3 sm:px-4 my-2 sm:my-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div
        onClick={handleCardClick}
        className={`relative w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-md border border-border/60 ${aspectClass} group bg-muted ${
          hasCta ? "cursor-pointer" : ""
        }`}
      >
        {/* Background Image with Fallback */}
        <img
          key={currentSlide.id}
          src={currentSlide.imageUrl}
          alt={currentSlide.title}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 animate-in fade-in"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1600&auto=format&fit=crop&q=80";
          }}
        />

        {/* Dynamic Gradient Overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent transition-opacity"
          style={{ opacity: (currentSlide.overlayOpacity ?? 50) / 100 }}
        />

        {/* Slide Content */}
        <div
          aria-live="polite"
          className={`absolute inset-0 flex flex-col justify-end p-4 sm:p-8 md:p-12 z-10 ${textAlignmentClass}`}
        >
          {currentSlide.badgeText && (
            <span className="inline-block px-2.5 py-0.5 mb-1.5 sm:mb-3 text-[10px] sm:text-xs font-black tracking-wider uppercase bg-primary text-primary-foreground rounded-full shadow-xs">
              {currentSlide.badgeText}
            </span>
          )}

          <h2 className="text-base sm:text-2xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-md max-w-2xl leading-tight">
            {currentSlide.title}
          </h2>

          {currentSlide.subtitle && (
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-zinc-200 line-clamp-2 max-w-xl drop-shadow-xs font-medium">
              {currentSlide.subtitle}
            </p>
          )}

          {currentSlide.ctaText && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onActionClick) onActionClick(currentSlide.ctaLink);
              }}
              className="mt-2.5 sm:mt-4 inline-flex items-center gap-1.5 px-3.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold shadow-md hover:scale-[1.02] active:scale-98 transition-all cursor-pointer"
            >
              <span>{currentSlide.ctaText}</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}
        </div>

        {/* Navigation Arrows (if > 1 slide) */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Diapositiva anterior"
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm flex items-center justify-center opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-20 cursor-pointer shadow-md focus:opacity-100"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Diapositiva siguiente"
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm flex items-center justify-center opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-20 cursor-pointer shadow-md focus:opacity-100"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Dots Indicator */}
            <div className="absolute bottom-2.5 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(i);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    i === currentIndex
                      ? "w-5 sm:w-6 bg-primary"
                      : "w-1.5 bg-white/50 hover:bg-white/80"
                  }`}
                  aria-label={`Ir a diapositiva ${i + 1} de ${total}`}
                  aria-current={i === currentIndex ? "true" : undefined}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
