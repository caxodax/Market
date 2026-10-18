"use client";

import React from "react";
import { Product } from "@marketos/types";
import { formatCurrency, convertUsdToVes } from "@marketos/utils";
import { useCart } from "../context/cart-context";
import { useFavorites } from "../context/favorites-context";
import { Plus, Minus, ShoppingCart, Heart, Sparkles } from "lucide-react";

interface ProductCardProps {
  product: Product & { stock: number };
  exchangeRate: number;
  hasModifiers?: boolean;
  showVesPrice?: boolean;
  onOpenModifiers?: (product: Product) => void;
}

export function ProductCard({
  product,
  exchangeRate,
  hasModifiers = false,
  showVesPrice = false,
  onOpenModifiers,
}: ProductCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const cartItem = items.find((i) => i.product.id === product.id);
  const quantityInCart = cartItem ? cartItem.quantity : 0;
  const favorited = isFavorite(product.id);

  const priceVes = convertUsdToVes(product.price_usd, exchangeRate);
  const isOutOfStock = product.stock <= 0;

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md transition-all duration-200">
      {/* Product Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted/30">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
            <ShoppingCart className="w-12 h-12 stroke-[1.2]" />
          </div>
        )}

        {/* Stock & Cart Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
          {isOutOfStock ? (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground shadow-xs">
              Agotado
            </span>
          ) : product.stock <= 5 ? (
            <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-bold shadow-xs">
              Últimas {product.stock} unid
            </span>
          ) : null}

          {quantityInCart > 0 && (
            <span className="rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-bold shadow-xs animate-in zoom-in-75 duration-150">
              {quantityInCart} en carrito
            </span>
          )}
        </div>

        {/* Favorite Wishlist Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(product.id);
          }}
          className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md shadow-2xs active:scale-90 ${
            favorited
              ? "bg-rose-500/15 border border-rose-500/30 text-rose-500 shadow-sm"
              : "bg-background/80 hover:bg-background border border-border/60 text-muted-foreground hover:text-rose-500 hover:scale-105"
          }`}
          aria-label={favorited ? "Quitar de favoritos" : "Guardar en favoritos"}
          title={favorited ? "Quitar de favoritos" : "Guardar en favoritos"}
        >
          <Heart
            className={`w-4 h-4 transition-transform ${
              favorited
                ? "fill-rose-500 text-rose-500 scale-110"
                : "stroke-[2]"
            }`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        {product.sku && (
          <span className="text-[10px] uppercase font-mono font-medium tracking-wider text-muted-foreground">
            {product.sku}
          </span>
        )}

        <h3 className="mt-1 text-xs sm:text-sm font-bold text-foreground line-clamp-2 leading-snug">
          {product.name}
        </h3>

        {/* Price block - High contrast WCAG AA Dual Currency */}
        <div className="mt-auto pt-3 flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-black text-primary tracking-tight">
              {formatCurrency(product.price_usd, "USD")}
            </span>
            <span className="text-[11px] text-muted-foreground font-semibold">
              USD
            </span>
          </div>

          {showVesPrice && (
            <span className="text-xs font-semibold text-foreground/80">
              Bs.{" "}
              {priceVes.toLocaleString("es-VE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          )}
        </div>

        {/* Interactive Action Button / Inline Stepper */}
        <div className="mt-3 pt-1">
          {quantityInCart > 0 ? (
            <div className="flex items-center justify-between h-10 px-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary shadow-2xs">
              <button
                type="button"
                onClick={() => updateQuantity(product.id, quantityInCart - 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors active:scale-95 cursor-pointer"
                aria-label="Disminuir cantidad"
              >
                <Minus className="w-4 h-4 stroke-[2.5]" />
              </button>

              <div className="flex items-center gap-1">
                <span className="font-black text-xs font-mono text-primary">
                  {quantityInCart}
                </span>
                <span className="text-[10px] font-medium opacity-80 hidden sm:inline">
                  unid
                </span>
              </div>

              <button
                type="button"
                disabled={quantityInCart >= product.stock}
                onClick={() => {
                  if (hasModifiers && onOpenModifiers) {
                    onOpenModifiers(product);
                  } else {
                    addItem(product, 1, false);
                  }
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors active:scale-95 disabled:opacity-40 cursor-pointer"
                aria-label="Aumentar cantidad"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (hasModifiers && onOpenModifiers) {
                  onOpenModifiers(product);
                } else {
                  addItem(product, 1, false);
                }
              }}
              disabled={isOutOfStock}
              className={`w-full h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer ${
                isOutOfStock
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : hasModifiers
                  ? "bg-amber-500 text-white hover:bg-amber-600 shadow-2xs"
                  : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground shadow-2xs"
              }`}
            >
              {isOutOfStock ? (
                <span>Sin stock</span>
              ) : hasModifiers ? (
                <>
                  <Sparkles className="w-4 h-4 stroke-[2.5]" />
                  <span>Personalizar</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Agregar</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
