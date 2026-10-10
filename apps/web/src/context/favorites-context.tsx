"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

interface FavoritesContextType {
  favorites: string[];
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => void;
  favoritesCount: number;
  clearFavorites: () => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

interface FavoritesProviderProps {
  children: React.ReactNode;
  tenantId?: string;
}

export function FavoritesProvider({ children, tenantId = "shop-market-ca" }: FavoritesProviderProps) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const storageKey = useMemo(() => `marketos_favorites_${tenantId}`, [tenantId]);

  // Restore favorites from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFavorites(parsed);
        }
      }
    } catch (e) {
      console.warn("[MarketOS] Could not restore favorites from localStorage", e);
    } finally {
      setIsInitialized(true);
    }
  }, [storageKey]);

  // Persist favorites to localStorage on change
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(favorites));
      } catch (e) {
        console.warn("[MarketOS] Could not save favorites to localStorage", e);
      }
    }
  }, [favorites, isInitialized, storageKey]);

  const isFavorite = (productId: string) => favorites.includes(productId);

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const clearFavorites = () => setFavorites([]);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        isFavorite,
        toggleFavorite,
        favoritesCount: favorites.length,
        clearFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
