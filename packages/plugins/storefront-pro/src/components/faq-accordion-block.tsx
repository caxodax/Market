"use client";

import React from "react";
import { FaqAccordionConfig } from "@marketos/types";
import { HelpCircle, ChevronDown } from "lucide-react";

interface FaqAccordionBlockProps {
  config: FaqAccordionConfig;
}

export function FaqAccordionBlock({ config }: FaqAccordionBlockProps) {
  const items = config.items || [];
  if (items.length === 0) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 my-4 sm:my-6 space-y-3">
      <div className="flex items-center gap-1.5">
        <HelpCircle className="w-4 h-4 text-primary" />
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-foreground">
            {config.title || "Preguntas Frecuentes"}
          </h3>
          {config.subtitle && (
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">
              {config.subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <details
            key={item.id}
            className="group rounded-2xl border border-border bg-card text-card-foreground shadow-2xs overflow-hidden transition-all [&[open]]:border-primary/40 [&[open]]:shadow-xs"
          >
            <summary className="flex items-center justify-between p-3.5 sm:p-4 text-xs sm:text-sm font-bold text-foreground cursor-pointer select-none hover:bg-muted/40 transition-colors list-none [&::-webkit-details-marker]:hidden">
              <span className="pr-4">{item.question}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 group-open:rotate-180 group-open:text-primary" />
            </summary>
            <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/40">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
