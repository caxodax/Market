"use client";

import React from "react";
import { BrandStoryConfig, Store } from "@marketos/types";
import { Store as StoreIcon, Clock, MapPin, ExternalLink } from "lucide-react";

interface BrandStoryBlockProps {
  config: BrandStoryConfig;
  selectedStore?: Store;
}

export function BrandStoryBlock({ config, selectedStore }: BrandStoryBlockProps) {
  if (!config.storyContent && !config.title) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 my-4 sm:my-6">
      <div className="rounded-2xl sm:rounded-3xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Photo */}
        <div className="relative min-h-[220px] md:min-h-full bg-muted">
          <img
            src={
              config.imageUrl ||
              "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80"
            }
            alt={config.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80";
            }}
          />
        </div>

        {/* Content */}
        <div className="p-5 sm:p-8 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] sm:text-xs font-black uppercase tracking-wider">
              <StoreIcon className="w-3.5 h-3.5" />
              <span>Nuestra Historia</span>
            </div>
            <h3 className="text-base sm:text-xl font-extrabold text-foreground tracking-tight">
              {config.title}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {config.storyContent}
            </p>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-border/70 text-xs">
            {config.businessHours && (
              <div className="flex items-start gap-2 text-foreground/80">
                <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="font-medium text-[11px] sm:text-xs">{config.businessHours}</span>
              </div>
            )}

            {config.showBranchAddress && selectedStore && (
              <div className="flex items-start gap-2 text-foreground/80">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="font-medium text-[11px] sm:text-xs">{selectedStore.address}</span>
              </div>
            )}

            {config.googleMapsUrl && (
              <a
                href={config.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline pt-1 cursor-pointer"
              >
                <span>Ver ubicación en Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
