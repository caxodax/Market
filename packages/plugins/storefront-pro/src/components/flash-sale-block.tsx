"use client";

import React, { useState, useEffect } from "react";
import { FlashSaleConfig } from "@marketos/types";
import { Timer, Zap, ArrowRight } from "lucide-react";

interface FlashSaleBlockProps {
  config: FlashSaleConfig;
  onExploreSale?: (categoryId?: string | null) => void;
}

export function FlashSaleBlock({ config, onExploreSale }: FlashSaleBlockProps) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({ hours: 0, minutes: 0, seconds: 0, isExpired: false });

  useEffect(() => {
    function calculate() {
      const targetTime = new Date(config.endsAt).getTime();
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, isExpired: false });
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [config.endsAt]);

  if (timeLeft.isExpired) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 my-2 sm:my-3">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Glow ambient accent */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-[10px] sm:text-xs font-black uppercase tracking-wider">
              <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
              <span>{config.discountBadgeText || "OFERTA RELÁMPAGO"}</span>
            </span>
          </div>
          <h3 className="text-base sm:text-xl font-extrabold tracking-tight">
            {config.title}
          </h3>
          <p className="text-xs sm:text-sm text-white/85 max-w-lg font-medium">
            {config.subtitle}
          </p>
        </div>

        {/* Live Countdown Clock */}
        <div className="flex items-center gap-3 sm:gap-4 self-start sm:self-auto z-10">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Hours */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black/40 backdrop-blur-xs border border-white/20 flex items-center justify-center font-mono font-black text-sm sm:text-lg shadow-inner">
                {pad(timeLeft.hours)}
              </div>
              <span className="text-[9px] font-bold text-white/70 uppercase mt-0.5">Horas</span>
            </div>

            <span className="font-mono font-black text-lg sm:text-xl mb-3 text-white/80">:</span>

            {/* Minutes */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black/40 backdrop-blur-xs border border-white/20 flex items-center justify-center font-mono font-black text-sm sm:text-lg shadow-inner">
                {pad(timeLeft.minutes)}
              </div>
              <span className="text-[9px] font-bold text-white/70 uppercase mt-0.5">Min</span>
            </div>

            <span className="font-mono font-black text-lg sm:text-xl mb-3 text-white/80">:</span>

            {/* Seconds */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black/40 backdrop-blur-xs border border-white/20 flex items-center justify-center font-mono font-black text-sm sm:text-lg shadow-inner text-amber-300">
                {pad(timeLeft.seconds)}
              </div>
              <span className="text-[9px] font-bold text-white/70 uppercase mt-0.5">Seg</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onExploreSale && onExploreSale(config.targetCategoryId)}
            className="hidden md:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-zinc-950 text-xs font-extrabold hover:bg-zinc-100 transition-all cursor-pointer shadow-md shrink-0"
          >
            <span>Ver Ofertas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
