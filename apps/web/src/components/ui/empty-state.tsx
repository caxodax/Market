"use client";

import React from "react";
import Link from "next/link";

export interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: React.ComponentType<{ className?: string }>;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

/**
 * Reusable EmptyState with purposeful call-to-action
 * Aligns with MarketOS Modernization Plan Phase 5.3
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`p-8 sm:p-14 text-center rounded-3xl border border-dashed border-border bg-card/60 backdrop-blur-xs flex flex-col items-center justify-center space-y-4 animate-view-enter ${className}`}
    >
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-xs">
        <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
      </div>

      <div className="space-y-1.5 max-w-md">
        <h3 className="font-heading text-base sm:text-lg font-black text-foreground tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {action && (
            action.href ? (
              <Link
                href={action.href}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold shadow-xs hover:opacity-90 active:scale-95 transition-all inline-flex items-center gap-2"
              >
                {action.icon && <action.icon className="w-4 h-4" />}
                <span>{action.label}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold shadow-xs hover:opacity-90 active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                {action.icon && <action.icon className="w-4 h-4" />}
                <span>{action.label}</span>
              </button>
            )
          )}

          {secondaryAction && (
            secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-border bg-muted/60 text-foreground hover:bg-muted text-xs sm:text-sm font-bold transition-all inline-flex items-center"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-border bg-muted/60 text-foreground hover:bg-muted text-xs sm:text-sm font-bold transition-all inline-flex items-center cursor-pointer"
              >
                {secondaryAction.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
