"use client";

import React, { useState, useMemo } from "react";
import {
  Product,
  ProductModifierGroup,
  ProductModifierOption,
  SelectedModifier,
} from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import { X, Plus, Minus, Check, Sparkles, Utensils } from "lucide-react";

interface ModifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  modifierGroups: ProductModifierGroup[];
  exchangeRate: number;
  onConfirmAddToCart: (
    product: Product,
    quantity: number,
    selectedModifiers: SelectedModifier[],
    calculatedUnitPriceUsd: number
  ) => void;
}

export function ModifierModal({
  isOpen,
  onClose,
  product,
  modifierGroups,
  exchangeRate,
  onConfirmAddToCart,
}: ModifierModalProps) {
  const [quantity, setQuantity] = useState(1);
  // Track selected option IDs by group ID: { [groupId]: string[] }
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const group of modifierGroups) {
      const defaults = group.options
        .filter((o) => o.is_default)
        .slice(0, group.max_selectable)
        .map((o) => o.id);
      initial[group.id] = defaults;
    }
    return initial;
  });

  if (!isOpen) return null;

  const toggleOption = (group: ProductModifierGroup, option: ProductModifierOption) => {
    const currentSelected = selections[group.id] || [];
    const isAlreadySelected = currentSelected.includes(option.id);

    if (isAlreadySelected) {
      setSelections({
        ...selections,
        [group.id]: currentSelected.filter((id) => id !== option.id),
      });
    } else {
      // If max_selectable is 1, acts as radio button
      if (group.max_selectable === 1) {
        setSelections({
          ...selections,
          [group.id]: [option.id],
        });
      } else if (currentSelected.length < group.max_selectable) {
        setSelections({
          ...selections,
          [group.id]: [...currentSelected, option.id],
        });
      }
    }
  };

  // Calculate unit price including selected extra toppings
  const { unitPriceUsd, selectedModifiersList } = useMemo(() => {
    let price = product.price_usd;
    const selectedMods: SelectedModifier[] = [];

    for (const group of modifierGroups) {
      const selectedOptionIds = selections[group.id] || [];
      for (const optId of selectedOptionIds) {
        const option = group.options.find((o) => o.id === optId);
        if (option) {
          price += option.price_adjustment_usd;
          selectedMods.push({
            group_id: group.id,
            group_name: group.name,
            option_id: option.id,
            option_name: option.name,
            price_usd: option.price_adjustment_usd,
            raw_material_id: option.raw_material_id,
          });
        }
      }
    }

    return {
      unitPriceUsd: price,
      selectedModifiersList: selectedMods,
    };
  }, [product, modifierGroups, selections]);

  const totalPriceUsd = unitPriceUsd * quantity;
  const totalPriceVes = totalPriceUsd * exchangeRate;

  // Validation: Check if any required group is missing a selection
  const isValidationPassing = modifierGroups.every((group) => {
    if (!group.required) return true;
    const count = (selections[group.id] || []).length;
    return count >= group.min_selectable;
  });

  const handleAdd = () => {
    if (!isValidationPassing) return;
    onConfirmAddToCart(product, quantity, selectedModifiersList, unitPriceUsd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full sm:max-w-lg bg-card text-foreground rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] z-10 animate-in slide-in-from-bottom-5 duration-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Utensils className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-foreground truncate">
                Personalizar: {product.name}
              </h3>
              <p className="text-[11px] font-semibold text-muted-foreground">
                Base: {formatCurrency(product.price_usd, "USD")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Groups Section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {modifierGroups.map((group) => {
            const selectedIds = selections[group.id] || [];
            const remaining = group.max_selectable - selectedIds.length;

            return (
              <div key={group.id} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <span>{group.name}</span>
                      {group.required && (
                        <span className="text-[10px] bg-rose-500/10 text-rose-500 border border-rose-500/20 px-1.5 py-0.2 rounded font-bold">
                          Obligatorio
                        </span>
                      )}
                    </h4>
                    {group.description && (
                      <p className="text-[11px] text-muted-foreground">{group.description}</p>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {group.max_selectable === 1
                      ? "Elige 1"
                      : `Hasta ${group.max_selectable} (${selectedIds.length}/${group.max_selectable})`}
                  </span>
                </div>

                {/* Options List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.options.map((option) => {
                    const isSelected = selectedIds.includes(option.id);
                    const canSelectMore = isSelected || remaining > 0 || group.max_selectable === 1;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={!canSelectMore}
                        onClick={() => toggleOption(group, option)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary/10 border-primary text-primary font-bold shadow-2xs"
                            : canSelectMore
                            ? "bg-card hover:bg-muted border-border text-foreground"
                            : "opacity-40 border-border/50 cursor-not-allowed bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/40 bg-background"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="text-xs truncate">{option.name}</span>
                        </div>
                        {option.price_adjustment_usd > 0 && (
                          <span className="text-[11px] font-black shrink-0 text-amber-600 dark:text-amber-400">
                            +{formatCurrency(option.price_adjustment_usd, "USD")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with Quantity Counter & Add Button */}
        <div className="p-4 border-t border-border bg-card/90 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Cantidad:</span>
            <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-lg bg-card hover:bg-background border border-border flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Disminuir cantidad"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center text-xs font-black">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-7 h-7 rounded-lg bg-card hover:bg-background border border-border flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Aumentar cantidad"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={!isValidationPassing}
            onClick={handleAdd}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-black text-xs sm:text-sm flex items-center justify-between px-4 shadow-lg hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Agregar al pedido</span>
            <div className="text-right">
              <span className="text-xs sm:text-sm">
                {formatCurrency(totalPriceUsd, "USD")}
              </span>
              <span className="text-[10px] opacity-80 ml-1.5 font-normal">
                (Bs. {totalPriceVes.toFixed(2)})
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
