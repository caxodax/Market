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
              className="p-3 sm:p-4 rounded-2xl border border-border bg-card text-card-foreground shadow-sm flex items-center gap-3 transition-colors hover:border-primary/40"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <IconComp className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-extrabold text-foreground truncate">
                  {badge.title}
                </h4>
                <p className="text-[11px] text-muted-foreground line-clamp-1 font-medium">
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
