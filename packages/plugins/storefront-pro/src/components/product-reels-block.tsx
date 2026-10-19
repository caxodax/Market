"use client";

import React, { useRef, useState } from "react";
import { ProductReelsConfig } from "@marketos/types";
import { Play, Pause, Film } from "lucide-react";

interface ProductReelsBlockProps {
  config: ProductReelsConfig;
}

export function ProductReelsBlock({ config }: ProductReelsBlockProps) {
  const reels = config.reels || [];
  if (reels.length === 0) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 my-3 sm:my-4 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Film className="w-4 h-4 text-primary" />
        <h3 className="text-sm sm:text-base font-extrabold text-foreground">
          Nuestros Productos en Acción
        </h3>
      </div>

      <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar py-1 scroll-smooth snap-x snap-mandatory">
        {reels.map((reel) => (
          <ReelCard key={reel.id} reel={reel} autoplayOnHover={config.autoplayOnHover} />
        ))}
      </div>
    </div>
  );
}

function ReelCard({
  reel,
  autoplayOnHover,
}: {
  reel: {
    id: string;
    title: string;
    videoUrl: string;
    posterUrl?: string;
    badge?: string;
  };
  autoplayOnHover?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleMouseEnter = () => {
    if (autoplayOnHover && videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleMouseLeave = () => {
    if (autoplayOnHover && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div
      onClick={togglePlay}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative w-44 sm:w-52 aspect-[9/16] shrink-0 snap-start rounded-2xl overflow-hidden bg-black shadow-md border border-border/80 group cursor-pointer"
    >
      <video
        ref={videoRef}
        src={reel.videoUrl}
        poster={reel.posterUrl}
        playsInline
        muted
        loop
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
      />

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

      {/* Play/Pause indicator */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-xs text-white flex items-center justify-center shadow-lg">
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
        </div>
      </div>

      {/* Text Info */}
      <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none space-y-1">
        {reel.badge && (
          <span className="inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-primary text-primary-foreground rounded-full shadow-xs">
            {reel.badge}
          </span>
        )}
        <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-2 drop-shadow-sm">
          {reel.title}
        </h4>
      </div>
    </div>
  );
}
