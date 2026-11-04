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
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 my-6 sm:my-8 space-y-4">
      <div className="flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-primary shrink-0" />
        <div>
          <h3 className="text-base sm:text-xl font-black text-black dark:text-white tracking-tight">
            {config.title || "Preguntas Frecuentes"}
          </h3>
          {config.subtitle && (
            <p className="text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 font-medium">
              {config.subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <details
            key={item.id}
            className="group rounded-2xl border border-border/80 bg-card text-card-foreground shadow-xs overflow-hidden transition-all [&[open]]:border-primary/50 [&[open]]:shadow-sm"
          >
            <summary className="flex items-center justify-between p-4 sm:p-5 text-sm sm:text-base font-bold text-black dark:text-white cursor-pointer select-none hover:bg-muted/40 transition-colors list-none [&::-webkit-details-marker]:hidden gap-3">
              <span className="pr-2 leading-snug">{item.question}</span>
              <ChevronDown className="w-4.5 h-4.5 text-neutral-600 dark:text-neutral-400 shrink-0 transition-transform duration-200 group-open:rotate-180 group-open:text-primary" />
            </summary>
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 text-sm sm:text-base text-black dark:text-neutral-100 font-normal leading-relaxed border-t border-border/50">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
