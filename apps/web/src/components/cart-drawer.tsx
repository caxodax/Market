"use client";

import React from "react";
import { useCart } from "../context/cart-context";
import { formatCurrency, convertUsdToVes } from "@marketos/utils";
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag } from "lucide-react";

interface CartDrawerProps {
  exchangeRate: number;
  onProceedToCheckout: () => void;
}

export function CartDrawer({
  exchangeRate,
  onProceedToCheckout,
}: CartDrawerProps) {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, totalUsd, totalItems } =
    useCart();

  if (!isOpen) return null;

  const totalVes = convertUsdToVes(totalUsd, exchangeRate);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md bg-background shadow-2xl flex flex-col border-l border-border">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">
                Tu Carrito ({totalItems})
              </h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <ShoppingBag className="w-12 h-12 stroke-[1.2] mb-3 text-muted-foreground/60" />
                <p className="font-semibold text-foreground">Tu carrito está vacío</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Agrega productos del catálogo para comenzar tu pedido.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const itemLineKey = item.id || item.product.id;
                const unitPrice = item.unit_price_usd ?? item.product.price_usd;
                const lineTotalUsd = unitPrice * item.quantity;

                return (
                  <div
                    key={itemLineKey}
                    className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card/60"
                  >
                    <img
                      src={item.product.image_url || ""}
                      alt={item.product.name}
                      className="w-16 h-16 rounded-lg object-cover bg-muted shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-foreground truncate">
                        {item.product.name}
                      </h4>

                      {/* Modifiers Pill Display */}
                      {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.selected_modifiers.map((mod, i) => (
                            <span
                              key={i}
                              className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground font-medium"
                            >
                              {mod.option_name}
                              {mod.price_usd > 0 && ` (+$${mod.price_usd.toFixed(2)})`}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-sm font-bold text-primary">
                          {formatCurrency(lineTotalUsd, "USD")}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          (Bs.{" "}
                          {convertUsdToVes(
                            lineTotalUsd,
                            exchangeRate
                          ).toLocaleString("es-VE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          )
                        </span>
                      </div>

                      {/* Quantity controls */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-border bg-background">
                          <button
                            onClick={() => updateQuantity(itemLineKey, item.quantity - 1)}
                            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 text-xs font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(itemLineKey, item.quantity + 1)}
                            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(itemLineKey)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors ml-auto cursor-pointer"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with Totals */}
          {items.length > 0 && (
            <div className="p-6 border-t border-border bg-muted/20 space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline text-sm">
                  <span className="text-muted-foreground font-medium">
                    Total en Dólares:
                  </span>
                  <span className="text-lg font-black text-foreground">
                    {formatCurrency(totalUsd, "USD")}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-muted-foreground">
                    Total al cambio BCV:
                  </span>
                  <span className="font-bold text-primary">
                    Bs.{" "}
                    {totalVes.toLocaleString("es-VE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsOpen(false);
                  onProceedToCheckout();
                }}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-transform active:scale-[0.98] shadow-sm"
              >
                <span>Proceder al Pago</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
