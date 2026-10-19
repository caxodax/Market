"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { Product, SelectedModifier } from "@marketos/types";

export interface CartItem {
  id?: string;
  product: Product & { stock?: number };
  quantity: number;
  selected_modifiers?: SelectedModifier[];
  unit_price_usd?: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (
    product: Product & { stock?: number },
    quantity?: number,
    openDrawer?: boolean,
    selected_modifiers?: SelectedModifier[],
    unit_price_usd?: number
  ) => void;
  removeItem: (productIdOrLineId: string) => void;
  updateQuantity: (productIdOrLineId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalUsd: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: React.ReactNode;
  tenantId?: string;
  catalogProducts?: (Product & { stock: number })[];
}

export function CartProvider({ children, tenantId, catalogProducts }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Tenant-isolated storage key to prevent cross-tenant cart bleeding
  const storageKey = useMemo(() => {
    return tenantId ? `marketos_cart_${tenantId}` : "marketos_cart_shop_market";
  }, [tenantId]);

  // Load cart from localStorage (Persistent Cart with tenant isolation)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setItems(JSON.parse(saved));
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error("Failed to restore persistent cart", e);
    } finally {
      setIsInitialized(true);
    }
  }, [storageKey]);

  // Save cart to localStorage
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(storageKey, JSON.stringify(items));
    }
  }, [items, isInitialized, storageKey]);

  // Reconcile stale prices and stock from catalog products on mount / refresh
  useEffect(() => {
    if (!catalogProducts || catalogProducts.length === 0 || !isInitialized) return;
    const productMap = new Map(catalogProducts.map((p) => [p.id, p]));

    setItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const live = productMap.get(item.product.id);
        if (!live) return item;

        const livePrice = live.price_usd;
        const liveStock = live.stock;
        const modPrice = item.selected_modifiers?.reduce((s, m) => s + (m.price_usd || 0), 0) || 0;
        const expectedUnit = Number((livePrice + modPrice).toFixed(2));

        const priceChanged = item.product.price_usd !== livePrice || item.unit_price_usd !== expectedUnit;
        const stockChanged = item.product.stock !== liveStock;

        // Auto-cap quantity to live stock if stock > 0
        const newQty = liveStock > 0 ? Math.min(item.quantity, liveStock) : item.quantity;
        const qtyChanged = newQty !== item.quantity;

        if (priceChanged || stockChanged || qtyChanged) {
          changed = true;
          return {
            ...item,
            quantity: newQty,
            unit_price_usd: expectedUnit,
            product: {
              ...item.product,
              price_usd: livePrice,
              stock: liveStock,
            },
          };
        }
        return item;
      });

      return changed ? next : prev;
    });
  }, [catalogProducts, isInitialized]);

  const addItem = (
    product: Product & { stock?: number },
    quantity = 1,
    openDrawer = false,
    selected_modifiers?: SelectedModifier[],
    unit_price_usd?: number
  ) => {
    const finalUnitPrice = unit_price_usd ?? product.price_usd;
    setItems((prev) => {
      const modSig =
        selected_modifiers && selected_modifiers.length > 0
          ? JSON.stringify(selected_modifiers)
          : "";
      const existing = prev.find(
        (item) =>
          item.product.id === product.id &&
          (item.selected_modifiers && item.selected_modifiers.length > 0
            ? JSON.stringify(item.selected_modifiers) === modSig
            : !modSig)
      );
      if (existing) {
        // Enforce stock ceiling if available
        const maxStock = product.stock ?? 9999;
        const nextQuantity = Math.min(existing.quantity + quantity, maxStock);
        return prev.map((item) =>
          item === existing
            ? { ...item, quantity: nextQuantity }
            : item
        );
      }
      return [
        ...prev,
        {
          id: `${product.id}-${Date.now()}`,
          product,
          quantity: product.stock !== undefined && product.stock > 0 ? Math.min(quantity, product.stock) : quantity,
          selected_modifiers,
          unit_price_usd: finalUnitPrice,
        },
      ];
    });
    if (openDrawer) {
      setIsOpen(true);
    }
  };

  const removeItem = (productIdOrLineId: string) => {
    setItems((prev) =>
      prev.filter(
        (item) => item.product.id !== productIdOrLineId && item.id !== productIdOrLineId
      )
    );
  };

  const updateQuantity = (productIdOrLineId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productIdOrLineId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.product.id === productIdOrLineId || item.id === productIdOrLineId) {
          const maxStock = item.product.stock ?? 9999;
          const cappedQty = Math.min(quantity, maxStock);
          return { ...item, quantity: cappedQty };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalUsd = Number(
    items
      .reduce(
        (sum, item) =>
          sum + (item.unit_price_usd ?? item.product.price_usd) * item.quantity,
        0
      )
      .toFixed(2)
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalUsd,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
