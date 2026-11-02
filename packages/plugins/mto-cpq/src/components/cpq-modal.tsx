"use client";

import React from "react";
import {
  Product,
  CpqPricingMatrix,
  CpqCostSettings,
  CpqAttributeOption,
  CpqVolumeTier,
  SelectedModifier,
} from "@marketos/types";
import { CustomProductConfigurator } from "./custom-product-configurator";
import { X, Sparkles } from "lucide-react";

export interface CpqModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  matrix: CpqPricingMatrix;
  costSettings: CpqCostSettings;
  availableOptions?: CpqAttributeOption[];
  volumeTiers?: CpqVolumeTier[];
  businessName?: string;
  businessPhone?: string;
  formatCurrency?: (val: number) => string;
  onConfirmAddToCart: (
    product: Product,
    quantity: number,
    selectedModifiers: SelectedModifier[],
    calculatedUnitPriceUsd: number
  ) => void;
  onRequestWhatsAppQuote?: (quoteUrl: string) => void;
}

export function CpqModal({
  isOpen,
  onClose,
  product,
  matrix,
  costSettings,
  availableOptions = [],
  volumeTiers = [],
  businessName = "Taller & Sublimación",
  businessPhone,
  formatCurrency,
  onConfirmAddToCart,
  onRequestWhatsAppQuote,
}: CpqModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cpq-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2
                id="cpq-modal-title"
                className="text-base font-bold text-zinc-900 dark:text-zinc-100"
              >
                Personalizar: {product.name}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ajuste dimensiones, materiales y acabados con cálculo dinámico
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Cerrar modal de personalización"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain">
          <CustomProductConfigurator
            matrix={matrix}
            costSettings={costSettings}
            availableOptions={availableOptions}
            volumeTiers={volumeTiers}
            productName={product.name}
            businessName={businessName}
            businessPhone={businessPhone}
            formatCurrency={formatCurrency}
            onRequestWhatsAppQuote={onRequestWhatsAppQuote}
            onAddToCart={(config) => {
              const selectedMods: SelectedModifier[] = [];

              // 1. Dimensions modifier
              if (matrix.calculation_type === "AREA" && config.dimensions.width && config.dimensions.height) {
                const areaM2 = (
                  (config.dimensions.width * config.dimensions.height) /
                  (config.dimensions.unit === "m" ? 1 : 10000)
                ).toFixed(2);
                selectedMods.push({
                  group_id: "cpq_dimensions",
                  group_name: "Dimensiones",
                  option_id: "dim_area",
                  option_name: `${config.dimensions.width}×${config.dimensions.height} ${config.dimensions.unit || "cm"} (${areaM2} m²)`,
                  price_usd: 0,
                });
              } else if (matrix.calculation_type === "LINEAR" && (config.dimensions.length || config.dimensions.width)) {
                const len = config.dimensions.length || config.dimensions.width;
                selectedMods.push({
                  group_id: "cpq_dimensions",
                  group_name: "Longitud",
                  option_id: "dim_linear",
                  option_name: `${len} ${config.dimensions.unit || "cm"} lineales`,
                  price_usd: 0,
                });
              }

              // 2. Selected options / materials / techniques
              for (const opt of config.selectedOptions) {
                selectedMods.push({
                  group_id: `cpq_${opt.attribute_name.toLowerCase().replace(/\s+/g, "_")}`,
                  group_name: opt.attribute_name,
                  option_id: opt.id,
                  option_name: opt.label,
                  price_usd: opt.material_cost,
                });
              }

              // 3. Deposit summary note
              if (config.calculation.depositPercentage < 100) {
                selectedMods.push({
                  group_id: "cpq_deposit_condition",
                  group_name: "Condición de Fabricación",
                  option_id: "dep_summary",
                  option_name: `Anticipo ${config.calculation.depositPercentage}% ($${config.calculation.depositAmount.toFixed(2)}) • Saldo contra entrega`,
                  price_usd: 0,
                });
              }

              onConfirmAddToCart(
                product,
                config.quantity,
                selectedMods,
                config.calculation.unitPrice
              );
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
