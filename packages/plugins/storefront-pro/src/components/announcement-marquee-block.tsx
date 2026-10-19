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

  const speed = config.speedSeconds || 25;

  return (
    <div className={`w-full overflow-hidden py-2 text-xs font-bold select-none ${bgClasses}`}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes marqueeLoop {
              0% { transform: translateX(0%); }
              100% { transform: translateX(-50%); }
            }
            .animate-marquee-continuous {
              display: flex;
              width: max-content;
              animation: marqueeLoop ${speed}s linear infinite;
            }
            .animate-marquee-continuous:hover {
              animation-play-state: paused;
            }
          `,
        }}
      />
      <div className="animate-marquee-continuous flex items-center gap-8 px-4 cursor-default">
        {/* Render twice for continuous infinite seamless loop */}
        {[...config.messages, ...config.messages].map((msg, idx) => (
          <div key={idx} className="flex items-center gap-2 shrink-0">
            <IconComponent className="w-3.5 h-3.5 opacity-90 shrink-0" />
            <span className="tracking-tight">{msg}</span>
            <span className="opacity-40 ml-4 font-normal">•</span>
          </div>
        ))}
      </div>
    </div>
  );
}
