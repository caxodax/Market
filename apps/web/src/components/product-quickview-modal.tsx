"use client";

import React, { useState, useEffect } from "react";
import { Product } from "@marketos/types";
import { formatCurrency, convertUsdToVes } from "@marketos/utils";
import { useCart } from "../context/cart-context";
import { useFavorites } from "../context/favorites-context";
import { X, Plus, Minus, ShoppingCart, Heart, Check, Sparkles, ShieldCheck } from "lucide-react";

export interface ProductQuickViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: (Product & { stock: number }) | null;
  exchangeRate: number;
  baseCurrency?: "USD" | "EUR";
  showVesPrice?: boolean;
  categoryName?: string;
  hasModifiers?: boolean;
  hasCpq?: boolean;
  onOpenModifiers?: (product: Product) => void;
  onOpenCpq?: (product: Product & { stock: number }) => void;
}

export function ProductQuickViewModal({
  isOpen,
  onClose,
  product,
  exchangeRate,
  baseCurrency = "USD",
  showVesPrice = false,
  categoryName,
  hasModifiers = false,
  hasCpq = false,
  onOpenModifiers,
  onOpenCpq,
}: ProductQuickViewModalProps) {
  const { items, addItem, updateQuantity } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Synchronize initial quantity with cart or default to 1
  useEffect(() => {
    if (product) {
      const inCart = items.find((i) => i.product.id === product.id);
      setQuantity(inCart ? inCart.quantity : 1);
      setJustAdded(false);
    }
  }, [product, items]);

  if (!isOpen || !product) return null;

  const cartItem = items.find((i) => i.product.id === product.id);
  const quantityInCart = cartItem ? cartItem.quantity : 0;
  const favorited = isFavorite(product.id);
  const priceVes = convertUsdToVes(product.price_usd, exchangeRate);
  const isOutOfStock = product.stock <= 0;

  const handleAddToCart = () => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(15);
      } catch {}
    }

    if (hasCpq && onOpenCpq) {
      onClose();
      onOpenCpq(product);
      return;
    }

    if (hasModifiers && onOpenModifiers) {
      onClose();
      onOpenModifiers(product);
      return;
    }

    if (quantityInCart > 0) {
      updateQuantity(product.id, quantity);
    } else {
      addItem(product, quantity, false);
    }

    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 1500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col md:flex-row rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-20 w-9 h-9 rounded-full flex items-center justify-center bg-background/80 hover:bg-background border border-border/80 text-foreground transition-all cursor-pointer shadow-sm active:scale-90"
          aria-label="Cerrar vista rápida"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Media / Image Column */}
        <div className="relative w-full md:w-1/2 aspect-square md:aspect-auto md:min-h-[360px] bg-muted/30 flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-border/50 shrink-0">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              width={600}
              height={600}
              className="max-h-full max-w-full object-contain drop-shadow-sm select-none"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'/%3E%3Cpath d='M3 6h18'/%3E%3Cpath d='M16 10a4 4 0 0 1-8 0'/%3E%3C/svg%3E";
                e.currentTarget.className = "h-32 w-32 object-contain opacity-40";
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
              <ShoppingCart className="w-16 h-16 stroke-[1.2]" />
              <span className="text-xs font-semibold">Sin imagen</span>
            </div>
          )}

          {/* Badges on top-left of image */}
          <div className="absolute top-3.5 left-3.5 flex flex-col gap-1 items-start">
            {hasCpq ? (
              <span className="rounded-full bg-indigo-600 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs">
                Fabricación Bajo Pedido
              </span>
            ) : isOutOfStock ? (
              <span className="rounded-full bg-destructive text-destructive-foreground px-2.5 py-1 text-[11px] font-bold shadow-xs">
                Agotado
              </span>
            ) : product.stock <= 5 ? (
              <span className="rounded-full bg-amber-500 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs">
                Últimas {product.stock} unidades
              </span>
            ) : (
              <span className="rounded-full bg-emerald-600/90 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs">
                Disponible
              </span>
            )}

            {quantityInCart > 0 && (
              <span className="rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-[10px] font-bold shadow-xs">
                {quantityInCart} en tu carrito
              </span>
            )}
          </div>
        </div>

        {/* Details & Actions Column */}
        <div className="w-full md:w-1/2 p-5 sm:p-6 flex flex-col justify-between overflow-y-auto max-h-[50vh] md:max-h-[92vh]">
          <div className="space-y-4">
            {/* Category & SKU */}
            <div className="flex items-center justify-between gap-2 text-xs">
              {categoryName && (
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold tracking-tight">
                  {categoryName}
                </span>
              )}
              {product.sku && (
                <span className="font-mono text-muted-foreground text-[11px] uppercase tracking-wider ml-auto">
                  SKU: {product.sku}
                </span>
              )}
            </div>

            {/* Product Title */}
            <h2
              id="quickview-title"
              className="text-lg sm:text-xl font-black text-foreground leading-snug"
            >
              {product.name}
            </h2>

            {/* Price Box */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-primary tracking-tight">
                  {formatCurrency(product.price_usd, baseCurrency)}
                </span>
                <span className="text-xs text-muted-foreground font-bold">
                  {baseCurrency}
                </span>
              </div>
              {showVesPrice && (
                <span className="text-sm font-semibold text-foreground/80">
                  ≈ Bs.{" "}
                  {priceVes.toLocaleString("es-VE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description ? (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Descripción & Detalles
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            ) : null}

            {/* Trust Bullet */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Garantía de calidad y entrega directa del comercio</span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-6 pt-4 border-t border-border/60 space-y-3">
            {hasCpq || hasModifiers ? (
              <button
                type="button"
                onClick={handleAddToCart}
                className={`w-full min-h-[46px] rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer text-white ${
                  hasCpq
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-amber-500 hover:bg-amber-600"
                }`}
              >
                <Sparkles className="w-4 h-4 stroke-[2.5]" />
                <span>
                  {hasCpq
                    ? "Configurar Dimensiones / Cotizar"
                    : "Personalizar Opciones"}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2.5">
                {/* Stepper Quantity Selector */}
                <div className="flex items-center justify-between min-h-[46px] px-2 rounded-2xl bg-muted/60 border border-border/80 w-32 shrink-0">
                  <button
                    type="button"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-foreground hover:bg-card transition-colors disabled:opacity-30 cursor-pointer"
                    aria-label="Disminuir cantidad"
                  >
                    <Minus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <span className="font-mono font-black text-sm text-foreground">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={product.stock > 0 && quantity >= product.stock}
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-foreground hover:bg-card transition-colors disabled:opacity-30 cursor-pointer"
                    aria-label="Aumentar cantidad"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {/* Primary Add to Cart Button */}
                <button
                  type="button"
                  disabled={isOutOfStock}
                  onClick={handleAddToCart}
                  className={`flex-1 min-h-[46px] rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-sm ${
                    isOutOfStock
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : justAdded
                      ? "bg-emerald-600 text-white"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {isOutOfStock ? (
                    <span>Agotado</span>
                  ) : justAdded ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>¡Añadido al Carrito!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        {quantityInCart > 0
                          ? `Actualizar (${quantity})`
                          : `Añadir al Carrito`}
                      </span>
                    </>
                  )}
                </button>

                {/* Favorite Button */}
                <button
                  type="button"
                  onClick={() => toggleFavorite(product.id)}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all cursor-pointer shrink-0 shadow-xs active:scale-90 ${
                    favorited
                      ? "bg-rose-500/15 border-rose-500/30 text-rose-500"
                      : "bg-muted/40 hover:bg-muted border-border text-muted-foreground hover:text-rose-500"
                  }`}
                  aria-label={
                    favorited ? "Quitar de favoritos" : "Guardar en favoritos"
                  }
                  title={
                    favorited ? "Quitar de favoritos" : "Guardar en favoritos"
                  }
                >
                  <Heart
                    className={`w-4 h-4 ${
                      favorited ? "fill-rose-500 stroke-rose-500" : "stroke-[2]"
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
