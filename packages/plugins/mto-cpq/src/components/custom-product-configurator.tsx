"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  CpqPricingMatrix,
  CpqCostSettings,
  CpqAttributeOption,
  CpqVolumeTier,
  CpqDimensions,
  CpqCalculationResult,
} from "@marketos/types";
import { calculateCpqPrice } from "../services/pricing-engine";
import { Sliders, Check, Layers, Info, ShoppingCart, Tag } from "lucide-react";

export interface CustomProductConfiguratorProps {
  matrix: CpqPricingMatrix;
  costSettings: CpqCostSettings;
  availableOptions?: CpqAttributeOption[];
  volumeTiers?: CpqVolumeTier[];
  initialDimensions?: CpqDimensions;
  initialQuantity?: number;
  isAdmin?: boolean;
  formatCurrency?: (val: number) => string;
  onConfigurationChange?: (config: {
    dimensions: CpqDimensions;
    selectedOptions: CpqAttributeOption[];
    quantity: number;
    calculation: CpqCalculationResult;
  }) => void;
  onAddToCart?: (config: {
    dimensions: CpqDimensions;
    selectedOptions: CpqAttributeOption[];
    quantity: number;
    calculation: CpqCalculationResult;
  }) => void;
}

const DEFAULT_CURRENCY = (val: number) => val.toFixed(2);

export function CustomProductConfigurator({
  matrix,
  costSettings,
  availableOptions = [],
  volumeTiers = [],
  initialDimensions,
  initialQuantity = 1,
  isAdmin = false,
  formatCurrency = DEFAULT_CURRENCY,
  onConfigurationChange,
  onAddToCart,
}: CustomProductConfiguratorProps) {
  const [dimensions, setDimensions] = useState<CpqDimensions>(
    initialDimensions || {
      width: matrix.calculation_type === "AREA" ? 100 : 10,
      height: matrix.calculation_type === "AREA" ? 100 : undefined,
      length: matrix.calculation_type === "LINEAR" ? 100 : undefined,
      depth: matrix.calculation_type === "VOLUME" ? 10 : undefined,
      unit: "cm",
    }
  );

  const [quantity, setQuantity] = useState<number>(Math.max(1, initialQuantity));
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(() => {
    const defaultIds = availableOptions.filter((o) => o.is_default).map((o) => o.id);
    return new Set(defaultIds);
  });

  const selectedOptions = useMemo(() => {
    return availableOptions.filter((opt) => selectedOptionIds.has(opt.id));
  }, [availableOptions, selectedOptionIds]);

  // Group attribute options by attribute_name
  const groupedAttributes = useMemo(() => {
    const groups: Record<string, CpqAttributeOption[]> = {};
    for (const opt of availableOptions) {
      if (!groups[opt.attribute_name]) groups[opt.attribute_name] = [];
      groups[opt.attribute_name].push(opt);
    }
    return groups;
  }, [availableOptions]);

  // Dynamic Price Engine Calculation
  const calculation = useMemo<CpqCalculationResult>(() => {
    return calculateCpqPrice({
      matrix,
      costSettings,
      dimensions,
      selectedOptions,
      volumeTiers,
      quantity,
    });
  }, [matrix, costSettings, dimensions, selectedOptions, volumeTiers, quantity]);

  useEffect(() => {
    onConfigurationChange?.({
      dimensions,
      selectedOptions,
      quantity,
      calculation,
    });
  }, [dimensions, selectedOptions, quantity, calculation, onConfigurationChange]);

  const toggleOption = (groupName: string, option: CpqAttributeOption) => {
    setSelectedOptionIds((prev) => {
      const next = new Set(prev);
      const isCurrentlySelected = next.has(option.id);

      // Mutually exclusive single select per attribute group
      const siblingOptions = groupedAttributes[groupName] || [];
      for (const sib of siblingOptions) {
        next.delete(sib.id);
      }

      if (!isCurrentlySelected) {
        next.add(option.id);
      }
      return next;
    });
  };

  const handleApplyPreset = (preset: { width: number; height: number; unit: "cm" | "m" | "mm" | "in" }) => {
    setDimensions((prev) => ({ ...prev, ...preset }));
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">{matrix.name}</h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Configuración y personalización Make-to-Order ({matrix.calculation_type})
          </p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-full w-fit">
          <Tag className="w-3.5 h-3.5" />
          <span>Mínimo facturable: {matrix.min_billable_unit} {matrix.calculation_type === "AREA" ? "m²" : matrix.calculation_type === "LINEAR" ? "m" : "unid"}</span>
        </div>
      </div>

      {/* Dimensional Inputs */}
      {matrix.calculation_type === "AREA" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Dimensiones (Área)
            </label>
            <div className="flex gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleApplyPreset({ width: 21, height: 29.7, unit: "cm" })}
                className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                A4
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset({ width: 29.7, height: 42, unit: "cm" })}
                className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                A3
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset({ width: 100, height: 100, unit: "cm" })}
                className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                1×1 m
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset({ width: 200, height: 100, unit: "cm" })}
                className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                2×1 m
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Ancho</span>
              <input
                type="number"
                min="1"
                step="0.1"
                value={dimensions.width || ""}
                onChange={(e) =>
                  setDimensions({ ...dimensions, width: parseFloat(e.target.value) || 0 })
                }
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Alto</span>
              <input
                type="number"
                min="1"
                step="0.1"
                value={dimensions.height || ""}
                onChange={(e) =>
                  setDimensions({ ...dimensions, height: parseFloat(e.target.value) || 0 })
                }
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Unidad</span>
              <select
                value={dimensions.unit || "cm"}
                onChange={(e) =>
                  setDimensions({
                    ...dimensions,
                    unit: e.target.value as "cm" | "m" | "mm" | "in",
                  })
                }
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="cm">Centímetros (cm)</option>
                <option value="m">Metros (m)</option>
                <option value="mm">Milímetros (mm)</option>
                <option value="in">Pulgadas (in)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {matrix.calculation_type === "LINEAR" && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Largo / Longitud Lineal
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Longitud</span>
              <input
                type="number"
                min="1"
                step="0.1"
                value={dimensions.length || dimensions.width || ""}
                onChange={(e) =>
                  setDimensions({
                    ...dimensions,
                    length: parseFloat(e.target.value) || 0,
                    width: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Unidad</span>
              <select
                value={dimensions.unit || "cm"}
                onChange={(e) =>
                  setDimensions({
                    ...dimensions,
                    unit: e.target.value as "cm" | "m" | "mm" | "in",
                  })
                }
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="cm">Centímetros (cm)</option>
                <option value="m">Metros (m)</option>
                <option value="mm">Milímetros (mm)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Attribute Options Selectors */}
      {Object.keys(groupedAttributes).length > 0 && (
        <div className="space-y-4 pt-2">
          {Object.entries(groupedAttributes).map(([groupName, options]) => (
            <div key={groupName} className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {groupName}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {options.map((opt) => {
                  const isSelected = selectedOptionIds.has(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleOption(groupName, opt)}
                      className={`flex items-center justify-between p-3 rounded-lg border text-left text-sm transition-all ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 shadow-sm"
                          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-zinc-300 dark:border-zinc-600"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="font-medium">{opt.label}</span>
                      </div>
                      {opt.material_cost > 0 && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          +{formatCurrency(opt.material_cost)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quantity & Volume Tiers Notice */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Cantidad</label>
          {calculation.discountPercentage > 0 && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full">
              ¡Ahorro del {calculation.discountPercentage}% aplicado!
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              -
            </button>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-14 text-center text-sm py-2 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none font-medium"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              +
            </button>
          </div>

          {volumeTiers.length > 0 && (
            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 overflow-x-auto py-1">
              <Info className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
              <span>Escalas:</span>
              {volumeTiers.map((tier) => (
                <span
                  key={tier.id}
                  className={`px-2 py-0.5 rounded border text-[11px] whitespace-nowrap ${
                    quantity >= tier.min_quantity &&
                    (tier.max_quantity === null || quantity <= tier.max_quantity)
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50"
                  }`}
                >
                  {tier.min_quantity}{tier.max_quantity ? `-${tier.max_quantity}` : "+"} u: -{tier.discount_percentage}%
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Production Notes / Summary */}
      {calculation.productionNotes && calculation.productionNotes.length > 0 && (
        <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-lg p-3 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
          {calculation.productionNotes.map((note, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer / Total & Action */}
      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 block">Total Estimado ({quantity} u.)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(calculation.totalPrice)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              ({formatCurrency(calculation.unitPrice)} / u)
            </span>
          </div>
        </div>

        {onAddToCart && (
          <button
            type="button"
            onClick={() =>
              onAddToCart({
                dimensions,
                selectedOptions,
                quantity,
                calculation,
              })
            }
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Agregar al Carrito</span>
          </button>
        )}
      </div>
    </div>
  );
}
