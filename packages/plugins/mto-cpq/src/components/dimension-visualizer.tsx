import React, { useState } from "react";
import { CpqDimensions } from "@marketos/types";
import { Eye, User, Layers } from "lucide-react";

export interface DimensionVisualizerProps {
  dimensions: CpqDimensions;
  calculationType?: "AREA" | "LINEAR" | "VOLUME" | "UNITARY_CUSTOM" | "TIERED_VOLUME";
  className?: string;
}

export function DimensionVisualizer({
  dimensions,
  calculationType = "AREA",
  className = "",
}: DimensionVisualizerProps) {
  const [showHumanScale, setShowHumanScale] = useState(false);

  const rawWidth = Math.max(1, dimensions.width || dimensions.length || 100);
  const rawHeight = Math.max(1, dimensions.height || 100);
  const unit = dimensions.unit || "cm";

  // Standardize dimensions to centimeters for visual ratio
  const widthCm = unit === "m" ? rawWidth * 100 : unit === "mm" ? rawWidth / 10 : unit === "in" ? rawWidth * 2.54 : rawWidth;
  const heightCm = unit === "m" ? rawHeight * 100 : unit === "mm" ? rawHeight / 10 : unit === "in" ? rawHeight * 2.54 : rawHeight;

  // Viewport constraints (240px wide max, 140px tall max)
  const maxViewW = 240;
  const maxViewH = 130;

  const ratio = widthCm / heightCm;

  let boxW: number;
  let boxH: number;

  if (ratio >= 1) {
    boxW = Math.min(maxViewW, Math.max(70, maxViewW * (widthCm / Math.max(widthCm, 300))));
    boxH = Math.max(30, boxW / ratio);
    if (boxH > maxViewH) {
      boxH = maxViewH;
      boxW = boxH * ratio;
    }
  } else {
    boxH = Math.min(maxViewH, Math.max(50, maxViewH * (heightCm / Math.max(heightCm, 300))));
    boxW = Math.max(30, boxH * ratio);
    if (boxW > maxViewW) {
      boxW = maxViewW;
      boxH = boxW / ratio;
    }
  }

  // Calculate formatted display area
  const areaM2 = (widthCm * heightCm) / 10_000;

  return (
    <div className={`p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden select-none ${className}`}>
      {/* Top scale controls */}
      <div className="w-full flex items-center justify-between text-[11px] font-bold text-zinc-500 mb-2">
        <span className="flex items-center gap-1.5 uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5 text-indigo-500" />
          Proporción Visual 2D
        </span>
        <button
          type="button"
          onClick={() => setShowHumanScale(!showHumanScale)}
          className={`px-2 py-0.5 rounded-md border text-[10px] flex items-center gap-1 transition-colors ${
            showHumanScale
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
          }`}
          title="Ver escala comparativa con persona (1.75m)"
        >
          <User className="w-3 h-3" />
          <span>Escala Humana</span>
        </button>
      </div>

      {/* SVG Canvas with dynamic aspect ratio */}
      <div className="relative w-full h-40 flex items-center justify-center py-2">
        {/* Horizontal dimension guideline (Width) */}
        <div
          className="absolute text-center flex flex-col items-center pointer-events-none"
          style={{ width: `${boxW}px`, top: "4px" }}
        >
          <div className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-white/90 dark:bg-zinc-900/90 px-1 rounded">
            {rawWidth} {unit}
          </div>
          <div className="w-full h-1 border-t border-b border-indigo-400 relative">
            <span className="absolute -left-1 -top-1 text-[8px] text-indigo-500">◀</span>
            <span className="absolute -right-1 -top-1 text-[8px] text-indigo-500">▶</span>
          </div>
        </div>

        {/* Vertical dimension guideline (Height) */}
        {calculationType !== "LINEAR" && (
          <div
            className="absolute flex items-center pointer-events-none"
            style={{
              height: `${boxH}px`,
              left: `calc(50% - ${boxW / 2 + 32}px)`,
            }}
          >
            <div className="h-full w-1 border-l border-r border-indigo-400 relative">
              <span className="absolute -top-1 -left-1 text-[8px] text-indigo-500">▲</span>
              <span className="absolute -bottom-1 -left-1 text-[8px] text-indigo-500">▼</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 ml-1 whitespace-nowrap">
              {rawHeight} {unit}
            </span>
          </div>
        )}

        {/* The scaled visual bounding box */}
        <div
          className="rounded-lg border-2 border-indigo-500 bg-indigo-500/10 shadow-inner flex flex-col items-center justify-center transition-all duration-200 relative"
          style={{
            width: `${boxW}px`,
            height: calculationType === "LINEAR" ? "14px" : `${boxH}px`,
          }}
        >
          {calculationType === "AREA" && boxH > 40 && (
            <span className="text-xs font-mono font-bold text-indigo-900 dark:text-indigo-200 bg-white/80 dark:bg-zinc-900/80 px-2 py-0.5 rounded-full shadow-xs">
              {areaM2 < 1 ? `${(areaM2 * 10000).toFixed(0)} cm²` : `${areaM2.toFixed(2)} m²`}
            </span>
          )}

          {/* Optional silhouette scale */}
          {showHumanScale && (
            <div
              className="absolute bottom-0 -right-8 flex flex-col items-center opacity-70 pointer-events-none"
              title="Referencia Persona: 175 cm"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
              <div className="w-1.5 h-8 bg-zinc-400 rounded-xs" />
              <span className="text-[8px] text-zinc-400 font-mono mt-0.5">1.75m</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
