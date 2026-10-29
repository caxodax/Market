"use client";

import React from "react";
import { TestimonialsConfig } from "@marketos/types";
import { Star, CheckCircle, MessageSquareQuote } from "lucide-react";

interface TestimonialsBlockProps {
  config: TestimonialsConfig;
}

export function TestimonialsBlock({ config }: TestimonialsBlockProps) {
  const items = config.items || [];
  if (items.length === 0) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 my-4 sm:my-6 space-y-3 sm:space-y-4">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-foreground flex items-center gap-1.5">
            <MessageSquareQuote className="w-4 h-4 text-primary" />
            <span>{config.title || "Lo que opinan nuestros clientes"}</span>
          </h3>
          {config.subtitle && (
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">
              {config.subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Testimonials Rail / Grid */}
      <div className="flex sm:grid sm:grid-cols-3 gap-3 overflow-x-auto no-scrollbar py-1 scroll-smooth snap-x snap-mandatory">
        {items.map((item) => (
          <div
            key={item.id}
            className="w-72 sm:w-auto shrink-0 snap-start p-4 rounded-2xl border border-border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3"
          >
            {/* Stars & Date */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${
                      i < item.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              {item.dateText && (
                <span className="text-[10px] text-muted-foreground font-medium">
                  {item.dateText}
                </span>
              )}
            </div>

            {/* Comment */}
            <p className="text-xs text-foreground/90 leading-relaxed italic">
              "{item.comment}"
            </p>

            {/* Author */}
            <div className="flex items-center gap-2.5 pt-2 border-t border-border/60">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                {item.avatarUrl ? (
                  <img
                    src={item.avatarUrl}
                    alt={item.authorName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{item.authorName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-foreground truncate">
                    {item.authorName}
                  </span>
                  {item.verifiedBuyer && (
                    <span title="Comprador Verificado" className="inline-flex">
                      <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                    </span>
                  )}
                </div>
                {item.authorLocation && (
                  <span className="text-[10px] text-muted-foreground block truncate">
                    {item.authorLocation}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
