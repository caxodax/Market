"use client";

import React from "react";
import { TrendingUp } from "lucide-react";

export interface BcvRateBadgeProps {
  rate: number;
  source?: string;
  updatedAt?: string;
  className?: string;
}

export function BcvRateBadge({
  rate,
  source = "BCV Oficial",
  updatedAt,
  className = "",
}: BcvRateBadgeProps) {
  if (!rate || rate <= 0) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium ${className}`}
      title={updatedAt ? `Actualizado: ${new Date(updatedAt).toLocaleDateString("es-VE")}` : undefined}
    >
      <TrendingUp className="w-3.5 h-3.5 shrink-0" />
      <span>
        Tasa {source}: <strong className="font-bold">Bs. {rate.toFixed(2)}</strong>
      </span>
    </div>
  );
}
