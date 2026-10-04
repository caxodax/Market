"use client";

import React, { useState } from "react";
import { Product } from "@marketos/types";
import { formatCurrency, convertUsdToVes } from "@marketos/utils";
import { useCart } from "../context/cart-context";
import { Plus, Check, ShoppingCart } from "lucide-react";

interface ProductCardProps {
  product: Product & { stock: number };
  exchangeRate: number;
}

export function ProductCard({ product, exchangeRate }: ProductCardProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const priceVes = convertUsdToVes(product.price_usd, exchangeRate);
  const isOutOfStock = product.stock <= 0;

  const handleAdd = () => {
    if (isOutOfStock) return;
    addItem(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
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
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ShoppingCart className="w-12 h-12 stroke-[1.2]" />
          </div>
        )}

        {/* Stock Badge */}
        <div className="absolute top-2.5 left-2.5">
          {isOutOfStock ? (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
              Agotado
            </span>
          ) : product.stock <= 5 ? (
            <span className="rounded-full bg-amber-500/90 text-white px-2 py-0.5 text-[10px] font-bold shadow-sm">
              Últimas {product.stock} unid
            </span>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {product.sku && (
          <span className="text-[10px] uppercase font-mono font-medium tracking-wider text-muted-foreground">
            {product.sku}
          </span>
        )}

        <h3 className="mt-1 text-sm font-semibold text-foreground line-clamp-2 leading-snug">
          {product.name}
        </h3>

        {/* Price block */}
        <div className="mt-3 flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black text-primary tracking-tight">
              {formatCurrency(product.price_usd, "USD")}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">
              USD
            </span>
          </div>

          <span className="text-xs font-medium text-muted-foreground">
            Bs. {priceVes.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Action Button */}
        <div className="mt-4 pt-2">
          <button
            onClick={handleAdd}
            disabled={isOutOfStock}
            className={`w-full h-10 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
              added
                ? "bg-emerald-600 text-white"
                : isOutOfStock
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
            }`}
          >
            {added ? (
              <>
                <Check className="w-4 h-4" />
                <span>Agregado</span>
              </>
            ) : isOutOfStock ? (
              <span>Sin stock</span>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
