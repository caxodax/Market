"use client";

import React from "react";
import { useCart } from "../context/cart-context";
import { formatCurrency, convertUsdToVes } from "@marketos/utils";
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag } from "lucide-react";

interface CartDrawerProps {
  exchangeRate: number;
  baseCurrency?: "USD" | "EUR";
  showVesPrice?: boolean;
  onProceedToCheckout: () => void;
}

export function CartDrawer({
  exchangeRate,
  baseCurrency = "USD",
  showVesPrice = false,
  onProceedToCheckout,
}: CartDrawerProps) {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, totalUsd, totalItems } =
    useCart();

  // WCAG AA: Handle Escape key to dismiss drawer
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const totalVes = convertUsdToVes(totalUsd, exchangeRate);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Carrito de compras"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md bg-background shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
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
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Cerrar carrito"
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
                <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs">
                  Agrega productos del catálogo para comenzar tu pedido.
                </p>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-colors cursor-pointer"
                >
                  Explorar Catálogo
                </button>
              </div>
            ) : (
              items.map((item) => {
                const itemLineKey = item.id || item.product.id;
                const unitPrice = item.unit_price_usd ?? item.product.price_usd;
                const lineTotalUsd = unitPrice * item.quantity;

                const isMaxStock = item.product.stock !== undefined && item.quantity >= item.product.stock;

                return (
                  <div
                    key={itemLineKey}
                    className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card/60"
                  >
                    <img
                      src={item.product.image_url || ""}
                      alt={item.product.name}
                      width={64}
                      height={64}
                      loading="lazy"
                      decoding="async"
                      className="w-16 h-16 rounded-lg object-cover bg-muted shrink-0"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'/%3E%3Cpath d='M3 6h18'/%3E%3Cpath d='M16 10a4 4 0 0 1-8 0'/%3E%3C/svg%3E";
                        e.currentTarget.className = "w-16 h-16 rounded-lg object-contain p-3 bg-muted/40 shrink-0 opacity-40";
                      }}
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
                              {mod.price_usd > 0 && ` (+${formatCurrency(mod.price_usd, baseCurrency)})`}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-sm font-bold text-primary">
                          {formatCurrency(lineTotalUsd, baseCurrency)}
                        </span>
                        {showVesPrice && (
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
                        )}
                      </div>

                      {/* Quantity controls */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-border bg-background">
                          <button
                            onClick={() => updateQuantity(itemLineKey, item.quantity - 1)}
                            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                            aria-label="Disminuir"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 text-xs font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            disabled={isMaxStock}
                            onClick={() => updateQuantity(itemLineKey, item.quantity + 1)}
                            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isMaxStock ? "Máximo stock disponible alcanzado" : "Aumentar"}
                            aria-label="Aumentar"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {isMaxStock && (
                          <span className="text-[10px] text-amber-500 font-semibold">
                            Máx. ({item.product.stock})
                          </span>
                        )}

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
                    {baseCurrency === "EUR" ? "Total en Euros:" : "Total en Dólares:"}
                  </span>
                  <span className="text-lg font-black text-foreground">
                    {formatCurrency(totalUsd, baseCurrency)}
                  </span>
                </div>
                {showVesPrice && (
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
                )}
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
