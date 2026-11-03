"use client";

import React from "react";
import { TrustBadgesConfig } from "@marketos/types";
import {
  Truck,
  ShieldCheck,
  Clock,
  CreditCard,
  RefreshCw,
  MessageCircle,
  Award,
} from "lucide-react";

interface TrustBadgesBlockProps {
  config: TrustBadgesConfig;
}

const ICONS = {
  Truck,
  ShieldCheck,
  Clock,
  CreditCard,
  RefreshCw,
  MessageCircle,
  Award,
};

export function TrustBadgesBlock({ config }: TrustBadgesBlockProps) {
  const badges = config.badges || [];
  if (badges.length === 0) return null;

  const colClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
  }[config.columns || 4];

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 my-3 sm:my-4">
      <div className={`grid ${colClass} gap-3`}>
        {badges.map((badge) => {
          const IconComp = ICONS[badge.icon] || ShieldCheck;
          return (
            <div
              key={badge.id}
              className="p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex items-center gap-3.5 hover:border-primary/40"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <IconComp className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-black text-foreground truncate">
                  {badge.title}
                </h4>
                <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 font-semibold mt-0.5">
                  {badge.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
