"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Product, SelectedModifier } from "@marketos/types";

export interface CartItem {
  id?: string;
  product: Product;
  quantity: number;
  selected_modifiers?: SelectedModifier[];
  unit_price_usd?: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (
    product: Product,
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

const CART_STORAGE_KEY = "marketos_cart_shop_market";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load cart from localStorage (Persistent Cart)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to restore persistent cart", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, isInitialized]);

  const addItem = (
    product: Product,
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
        return prev.map((item) =>
          item === existing
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prev,
        {
          id: `${product.id}-${Date.now()}`,
          product,
          quantity,
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
      prev.map((item) =>
        item.product.id === productIdOrLineId || item.id === productIdOrLineId
          ? { ...item, quantity }
          : item
      )
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
