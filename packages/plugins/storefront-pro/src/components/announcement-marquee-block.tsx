"use client";

import React from "react";
import { AnnouncementMarqueeConfig } from "@marketos/types";
import { Zap, Sparkles, Truck, Tag, ShieldCheck } from "lucide-react";

interface AnnouncementMarqueeBlockProps {
  config: AnnouncementMarqueeConfig;
}

const ICONS = {
  Zap,
  Sparkles,
  Truck,
  Tag,
  ShieldCheck,
};

export function AnnouncementMarqueeBlock({ config }: AnnouncementMarqueeBlockProps) {
  if (!config.messages || config.messages.length === 0) return null;

  const IconComponent = config.iconName && ICONS[config.iconName] ? ICONS[config.iconName] : Zap;

  // Background variants
  const bgClasses = {
    primary: "bg-primary text-primary-foreground border-b border-primary/20",
    dark: "bg-zinc-950 text-zinc-100 border-b border-zinc-800",
    amber: "bg-amber-500 text-amber-950 border-b border-amber-600/30",
    muted: "bg-muted text-foreground border-b border-border",
  }[config.bgVariant || "primary"];

  const speed = Math.max(10, config.speedSeconds || 22);

  return (
    <aside
      aria-label="Anuncios destacados de la tienda"
      className={`w-full overflow-hidden py-2 text-xs font-bold select-none ${bgClasses}`}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes marqueeLoop {
              0% { transform: translateX(0%); }
              100% { transform: translateX(-50%); }
            }
            .marketos-marquee-track {
              display: flex;
              width: max-content;
              animation: marqueeLoop var(--marquee-duration, 22s) linear infinite;
            }
            .marketos-marquee-track:hover,
            .marketos-marquee-track:focus-within {
              animation-play-state: paused;
            }
            @media (prefers-reduced-motion: reduce) {
              .marketos-marquee-track {
                animation: none !important;
                transform: none !important;
                overflow-x: auto;
              }
            }
          `,
        }}
      />
      <div
        className="marketos-marquee-track flex items-center gap-8 px-4 cursor-default"
        style={{ ["--marquee-duration" as any]: `${speed}s` }}
      >
        {/* Render twice for continuous infinite seamless loop */}
        {[...config.messages, ...config.messages].map((msg, idx) => (
          <div key={idx} className="flex items-center gap-2 shrink-0">
            <IconComponent className="w-3.5 h-3.5 opacity-90 shrink-0" aria-hidden="true" />
            <span className="tracking-tight">{msg}</span>
            <span className="opacity-40 ml-4 font-normal" aria-hidden="true">
              •
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
