"use client";

import React, { useState } from "react";
import { CpqCalculationResult, CpqCostSettings } from "@marketos/types";
import {
  DollarSign,
  TrendingUp,
  Clock,
  Cpu,
  Scissors,
  Wrench,
  ChevronDown,
  ChevronUp,
  Percent,
  ShieldCheck,
} from "lucide-react";

export interface AdminCostMarginInspectorProps {
  calculation: CpqCalculationResult;
  costSettings: CpqCostSettings;
  currentMarginPercentage: number;
  onMarginChange: (newMargin: number) => void;
  formatCurrency?: (val: number) => string;
  className?: string;
}

const DEFAULT_CURRENCY = (val: number) => val.toFixed(2);

export function AdminCostMarginInspector({
  calculation,
  costSettings,
  currentMarginPercentage,
  onMarginChange,
  formatCurrency = DEFAULT_CURRENCY,
  className = "",
}: AdminCostMarginInspectorProps) {
  const [showBomDetails, setShowBomDetails] = useState(false);

  const { costBreakdown, unitCost, unitPrice, totalPrice, totalCost, netMarginAmount, profitMargin } =
    calculation;

  const quickMargins = [25, 35, 45, 55, 65, 75];

  return (
    <div
      className={`bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-6 ${className}`}
    >
      {/* Header with Admin Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-base text-zinc-100">
              Auditoría de Costos & Margen Neto (Vista Dueño)
            </h4>
            <p className="text-xs text-zinc-400">
              Datos privados de producción interna, cost-plus y rentabilidad en tiempo real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs">
          <span className="text-zinc-400">Margen Comercial:</span>
          <span className="font-bold text-amber-400 text-sm">
            {currentMarginPercentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* KPI Highlight Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Costo Unitario Producción */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
            <Scissors className="w-3.5 h-3.5 text-zinc-400" />
            <span>Costo Producción</span>
          </div>
          <div className="text-lg font-bold text-zinc-100">
            {formatCurrency(unitCost)}
          </div>
          <span className="text-[11px] text-zinc-500 block">
            Total {calculation.quantity}u: {formatCurrency(totalCost)}
          </span>
        </div>

        {/* Mano de Obra */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Mano de Obra</span>
          </div>
          <div className="text-lg font-bold text-blue-400">
            {formatCurrency(costBreakdown.labor)}
          </div>
          <span className="text-[11px] text-zinc-500 block">
            Tasa: {formatCurrency(costSettings.hourly_labor_rate)}/h
          </span>
        </div>

        {/* Depreciación Máquina */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>Máquinas</span>
          </div>
          <div className="text-lg font-bold text-purple-400">
            {formatCurrency(costBreakdown.machine)}
          </div>
          <span className="text-[11px] text-zinc-500 block">
            Tasa: {formatCurrency(costSettings.machine_cost_per_hour)}/h
          </span>
        </div>

        {/* Tu Ganancia Neta */}
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ganancia Neta</span>
          </div>
          <div className="text-lg font-bold text-emerald-400">
            +{formatCurrency(netMarginAmount)}
          </div>
          <span className="text-[11px] text-emerald-500/80 block">
            Margen real: {profitMargin.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Interactive Margin Slider */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5 text-amber-400" />
            <span>Ajustar Margen de Ganancia Comercial al Vuelo:</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="95"
              step="1"
              value={currentMarginPercentage}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) onMarginChange(Math.max(0, Math.min(95, val)));
              }}
              className="w-16 px-2 py-1 text-right text-xs bg-zinc-800 border border-zinc-700 rounded text-amber-300 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="text-xs text-zinc-400">%</span>
          </div>
        </div>

        {/* Range Slider */}
        <input
          type="range"
          min="5"
          max="85"
          step="1"
          value={currentMarginPercentage}
          onChange={(e) => onMarginChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />

        {/* Quick Margin Preset Buttons */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-zinc-500">Presets rápidos:</span>
          <div className="flex gap-1.5">
            {quickMargins.map((margin) => (
              <button
                key={margin}
                type="button"
                onClick={() => onMarginChange(margin)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  Math.round(currentMarginPercentage) === margin
                    ? "bg-amber-500 text-zinc-950 font-semibold"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                }`}
              >
                {margin}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bill of Materials (BOM) Collapsible Section */}
      <div className="border border-zinc-800/80 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBomDetails(!showBomDetails)}
          className="w-full flex items-center justify-between p-3.5 bg-zinc-900/60 hover:bg-zinc-900 transition-colors text-xs text-zinc-300 font-medium"
        >
          <div className="flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5 text-zinc-400" />
            <span>Desglose Técnico de Insumos & Costos (BOM Explosion)</span>
            <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full text-[10px]">
              {costBreakdown.bom_items.length} ítems
            </span>
          </div>
          {showBomDetails ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </button>

        {showBomDetails && (
          <div className="p-3.5 bg-zinc-950 border-t border-zinc-800/80 space-y-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-[11px]">
                  <th className="pb-2 font-normal">Concepto / Insumo</th>
                  <th className="pb-2 font-normal">Tipo</th>
                  <th className="pb-2 font-normal text-right">Cantidad</th>
                  <th className="pb-2 font-normal text-right">Costo Unit</th>
                  <th className="pb-2 font-normal text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {costBreakdown.bom_items.map((item, idx) => (
                  <tr key={idx} className="text-zinc-300">
                    <td className="py-2">{item.name}</td>
                    <td className="py-2">
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-2 text-right text-zinc-400">
                      {formatCurrency(item.unit_cost)}
                    </td>
                    <td className="py-2 text-right font-medium text-zinc-200">
                      {formatCurrency(item.total_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Banner */}
      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-zinc-400">
        <div>
          <span>Fórmula Cost-Plus: </span>
          <code className="text-amber-400 text-[11px] bg-zinc-950 px-1.5 py-0.5 rounded">
            Precio = Costo ({formatCurrency(unitCost)}) / (1 - {currentMarginPercentage.toFixed(1)}%)
          </code>
        </div>
        <div className="text-right">
          <span className="text-zinc-400 text-xs">Precio Venta Recomendado: </span>
          <span className="font-bold text-zinc-100 text-sm">
            {formatCurrency(unitPrice)}
          </span>
        </div>
      </div>
    </div>
  );
}
