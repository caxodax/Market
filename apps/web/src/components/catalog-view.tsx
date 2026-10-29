"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Category,
  Product,
  TenantSettings,
  Store,
  ExchangeRate,
  Order,
  DeliveryZone,
  ProductModifierGroup,
  TenantModuleId,
  SelectedModifier,
} from "@marketos/types";
import {
  formatCurrency,
  convertUsdToVes,
  calculateEffectiveExchangeRate,
} from "@marketos/utils";
import { useCart } from "../context/cart-context";
import { ProductCard } from "./product-card";
import { CartDrawer } from "./cart-drawer";
import { CheckoutDialog } from "./checkout-dialog";
import { OrderSuccessModal } from "./order-success-modal";
import { OrderTrackerModal } from "./order-tracker-modal";
import { CustomerOrderTicketModal } from "./customer-order-ticket-modal";
import { useFavorites } from "../context/favorites-context";
import { StorefrontProRenderer, createDefaultStorefrontConfig, normalizeStorefrontConfig } from "@marketos/plugin-storefront-pro";
import { ModifierModal } from "@marketos/plugin-food-service";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Truck,
  ShoppingBag,
  ArrowRight,
  RotateCcw,
  Heart,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  LayoutGrid,
  Trash2,
  Plus,
  Minus,
  ShieldCheck,
} from "lucide-react";

interface CatalogViewProps {
  categories: Category[];
  products: (Product & { stock: number })[];
  settings: TenantSettings;
  stores: Store[];
  deliveryZones: DeliveryZone[];
  exchangeRate: ExchangeRate;
  isTrackerOpen: boolean;
  setIsTrackerOpen: (open: boolean) => void;
  selectedCategory?: string | null;
  setSelectedCategory?: (cat: string | null) => void;
  activeModuleIds?: TenantModuleId[];
  modifierGroups?: ProductModifierGroup[];
}

export function CatalogView({
  categories,
  products,
  settings,
  stores,
  deliveryZones,
  exchangeRate,
  isTrackerOpen,
  setIsTrackerOpen,
  selectedCategory: controlledCategory,
  setSelectedCategory: setControlledCategory,
  activeModuleIds = [],
  modifierGroups = [],
}: CatalogViewProps) {
  const { items, totalItems, totalUsd, setIsOpen, addItem, removeItem, updateQuantity } = useCart();
  const { favorites, favoritesCount } = useFavorites();
  const effectiveRateInfo = useMemo(() => {
    return calculateEffectiveExchangeRate(exchangeRate, settings.currency_settings);
  }, [exchangeRate, settings.currency_settings]);

  const totalVes = Number((totalUsd * effectiveRateInfo.effectiveRate).toFixed(2));

  // Food Service Plugin: Modifier Customizer Modal State
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);

  const isFoodServiceActive = activeModuleIds.includes("food_service");
  const isVenezuelaActive = activeModuleIds.includes("local_venezuela");
  const isStorefrontProActive = activeModuleIds.includes("storefront_pro");
  const storefrontConfig = isStorefrontProActive
    ? normalizeStorefrontConfig(settings.storefront_config) || createDefaultStorefrontConfig(settings.business_name)
    : null;

  const getProductModifierGroups = (prod: Product): ProductModifierGroup[] => {
    if (!isFoodServiceActive || !modifierGroups || modifierGroups.length === 0) return [];
    return modifierGroups.filter((g) => {
      if (g.product_id && g.product_id === prod.id) return true;
      if (g.category_id && prod.category_id && g.category_id === prod.category_id) return true;
      if (!g.product_id && !g.category_id) return true;
      return false;
    });
  };

  // Multi-Category Filter State
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    controlledCategory && controlledCategory !== "favorites" ? [controlledCategory] : []
  );
  const [isFavoritesOnly, setIsFavoritesOnly] = useState<boolean>(
    controlledCategory === "favorites"
  );
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Synchronize when controlled category changes (e.g. user clicked Favorites in navbar)
  useEffect(() => {
    if (controlledCategory === "favorites") {
      setIsFavoritesOnly(true);
      setSelectedCategoryIds([]);
    } else if (controlledCategory) {
      setIsFavoritesOnly(false);
      setSelectedCategoryIds([controlledCategory]);
    } else if (controlledCategory === null) {
      setIsFavoritesOnly(false);
      setSelectedCategoryIds([]);
    }
  }, [controlledCategory]);

  const toggleCategory = (categoryId: string) => {
    setIsFavoritesOnly(false);
    setSelectedCategoryIds((prev) => {
      const exists = prev.includes(categoryId);
      const next = exists ? prev.filter((id) => id !== categoryId) : [...prev, categoryId];
      if (setControlledCategory) {
        setControlledCategory(next.length === 1 ? next[0] : null);
      }
      return next;
    });
  };

  const selectAllCategories = () => {
    setSelectedCategoryIds([]);
    setIsFavoritesOnly(false);
    if (setControlledCategory) setControlledCategory(null);
  };

  const handleStorefrontSelectCategory = (catId: string | null) => {
    if (catId) {
      setSelectedCategoryIds([catId]);
      if (setControlledCategory) setControlledCategory(catId);
    } else {
      setSelectedCategoryIds([]);
      if (setControlledCategory) setControlledCategory(null);
    }
  };

  const handleStorefrontActionClick = (link?: string) => {
    if (link?.startsWith("category:")) {
      const catTarget = link.replace("category:", "").toLowerCase();
      const found = categories.find(
        (c) => c.id.toLowerCase() === catTarget || c.name.toLowerCase().includes(catTarget)
      );
      if (found) {
        setSelectedCategoryIds([found.id]);
        if (setControlledCategory) setControlledCategory(found.id);
      }
    } else if (link === "catalog") {
      document.getElementById("catalog-section")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [ticketOrder, setTicketOrder] = useState<Order | null>(null);
  const [trackingInitialQuery, setTrackingInitialQuery] = useState<string | undefined>(undefined);

  // Auto-open tracker when user arrives via QR scan (e.g. /?track=ORD-123456)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const trackParam = params.get("track");
      if (trackParam && trackParam.trim()) {
        setTrackingInitialQuery(trackParam.trim());
        setIsTrackerOpen(true);
      }
    }
  }, [setIsTrackerOpen]);

  // Section-only reactive filter calculation (No full-page reload)
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // 1. Favorites Filter
      if (isFavoritesOnly && !favorites.includes(product.id)) {
        return false;
      }
      // 2. Multi-Category Filter
      if (selectedCategoryIds.length > 0 && !selectedCategoryIds.includes(product.category_id)) {
        return false;
      }
      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = product.name.toLowerCase().includes(q);
        const matchesSku = product.sku && product.sku.toLowerCase().includes(q);
        if (!matchesName && !matchesSku) return false;
      }
      return true;
    });
  }, [products, selectedCategoryIds, isFavoritesOnly, searchQuery, favorites]);

  const activeFiltersCount = selectedCategoryIds.length + (isFavoritesOnly ? 1 : 0);

  // User-Selectable Pagination State (10, 20, 50)
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Automatically reset to page 1 whenever any filter or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategoryIds, isFavoritesOnly, pageSize]);

  const totalProducts = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredProducts.slice(startIndex, startIndex + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  return (
    <div
      className={`min-h-screen bg-background transition-all ${
        totalItems > 0 ? "pb-32 sm:pb-24" : "pb-20"
      }`}
    >
      {/* Search and Category Combobox Bar - Sticky under StoreHeader (Mobile/Tablet Only) */}
      <div className="bg-background/95 backdrop-blur border-b border-border sticky top-[92px] sm:top-[102px] z-20 shadow-xs lg:hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 space-y-2">
          {/* STEP 1: CATEGORÍAS (Explicitly ABOVE the search bar for both Mobile and Desktop) */}
          <div className="relative">
            <div className="flex items-center gap-2">
              {/* Category Dropdown Trigger Button - Always clearly shows the word 'Categorías' */}
              <button
                type="button"
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                className={`flex-1 sm:flex-initial flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs active:scale-[0.99] ${
                  activeFiltersCount > 0
                    ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/20"
                    : "bg-card hover:bg-muted text-foreground border-border"
                }`}
                aria-expanded={isCategoryDropdownOpen}
                aria-label="Seleccionar Categorías"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <LayoutGrid
                    className={`w-4 h-4 shrink-0 ${
                      activeFiltersCount > 0 ? "text-primary-foreground" : "text-primary"
                    }`}
                  />
                  <span
                    className={`text-[11px] sm:text-xs font-black uppercase tracking-wider ${
                      activeFiltersCount > 0 ? "text-primary-foreground/90" : "text-muted-foreground"
                    }`}
                  >
                    Categorías:
                  </span>
                  <span className="truncate font-black">
                    {isFavoritesOnly
                      ? "Favoritos ❤️"
                      : selectedCategoryIds.length === 0
                      ? "Todas las categorías"
                      : selectedCategoryIds.length === 1
                      ? categories.find((c) => c.id === selectedCategoryIds[0])?.name || "1 Categoría"
                      : `${selectedCategoryIds.length} Categorías`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-2">
                  {activeFiltersCount > 0 && (
                    <span className="text-[10px] font-black h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center bg-white text-primary">
                      {isFavoritesOnly ? "★" : selectedCategoryIds.length}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isCategoryDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Quick 1-tap category chips (Scrollable) */}
              <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={selectAllCategories}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedCategoryIds.length === 0 && !isFavoritesOnly
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Todas
                </button>
                {categories.slice(0, 5).map((cat) => {
                  const isSelected = selectedCategoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                          : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
                {categories.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setIsCategoryDropdownOpen(true)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 shrink-0 cursor-pointer"
                  >
                    +{categories.length - 5} más
                  </button>
                )}
              </div>
            </div>

            {/* Category Dropdown Modal / Popover */}
            {isCategoryDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs sm:bg-transparent sm:backdrop-blur-none"
                  onClick={() => setIsCategoryDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full mt-2 w-full sm:w-88 rounded-2xl bg-card text-foreground border border-border shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <LayoutGrid className="w-3.5 h-3.5 text-primary" />
                      <span>Elige una categoría</span>
                    </span>
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={selectAllCategories}
                        className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        Limpiar todo
                      </button>
                    )}
                  </div>

                  {/* Todas las categorías (Opción por defecto) */}
                  <button
                    type="button"
                    onClick={() => {
                      selectAllCategories();
                      setIsCategoryDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      selectedCategoryIds.length === 0 && !isFavoritesOnly
                        ? "bg-primary/10 text-primary font-bold border border-primary/20"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          selectedCategoryIds.length === 0 && !isFavoritesOnly
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/40 bg-background"
                        }`}
                      >
                        {selectedCategoryIds.length === 0 && !isFavoritesOnly && (
                          <Check className="w-3 h-3 stroke-[3]" />
                        )}
                      </div>
                      <span className="font-bold">Todas las categorías</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-muted-foreground">
                      {products.length}
                    </span>
                  </button>

                  {/* Quick Favorites Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsFavoritesOnly(!isFavoritesOnly);
                      if (!isFavoritesOnly) setSelectedCategoryIds([]);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      isFavoritesOnly
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Heart
                        className={`w-4 h-4 ${
                          isFavoritesOnly ? "fill-rose-500 text-rose-500" : "text-muted-foreground"
                        }`}
                      />
                      <span>Solo Mis Favoritos</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-muted font-bold text-muted-foreground">
                      {favoritesCount}
                    </span>
                  </button>

                  {/* Categories List with Checkboxes */}
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {categories.map((cat) => {
                      const isSelected = selectedCategoryIds.includes(cat.id);
                      const count = products.filter((p) => p.category_id === cat.id).length;

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-primary/10 text-primary font-bold border border-primary/20"
                              : "hover:bg-muted text-foreground"
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
                            <span className="truncate">{cat.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground ml-2 shrink-0">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Action Footer */}
                  <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        selectAllCategories();
                        setIsCategoryDropdownOpen(false);
                      }}
                      className="flex-1 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold cursor-pointer"
                    >
                      Ver Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCategoryDropdownOpen(false)}
                      className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 cursor-pointer shadow-xs"
                    >
                      Listo ({filteredProducts.length})
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* STEP 2: BUSCADOR (Directly UNDER Categories) */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder={
                selectedCategoryIds.length === 1
                  ? `Buscar en ${categories.find((c) => c.id === selectedCategoryIds[0])?.name || "esta categoría"}...`
                  : "Buscar productos (ej. Harina, Queso, Café)..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 sm:h-11 pl-9 sm:pl-10 pr-9 sm:pr-14 rounded-xl border border-input bg-muted/30 text-xs sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Active Filter Removable Chips */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5 animate-in fade-in duration-150">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
                Filtros:
              </span>

              {isFavoritesOnly && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-lg shadow-2xs">
                  <Heart className="w-3 h-3 fill-rose-500" />
                  <span>Favoritos ({favoritesCount})</span>
                  <button
                    type="button"
                    onClick={() => setIsFavoritesOnly(false)}
                    className="hover:opacity-70 p-0.5 cursor-pointer"
                    title="Quitar filtro de favoritos"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedCategoryIds.map((catId) => {
                const cat = categories.find((c) => c.id === catId);
                if (!cat) return null;
                return (
                  <span
                    key={catId}
                    className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-lg shadow-2xs"
                  >
                    <span>{cat.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleCategory(catId)}
                      className="hover:opacity-70 p-0.5 cursor-pointer"
                      title={`Quitar categoría ${cat.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}

              <button
                type="button"
                onClick={selectAllCategories}
                className="text-[10px] font-bold text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer"
              >
                Limpiar todo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Storefront Pro: Above-Catalog Modular Sections (Full Width Banners, Bubbles, Flash Sale, etc.) */}
      {isStorefrontProActive && storefrontConfig && (
        <div className="w-full">
          <StorefrontProRenderer
            config={storefrontConfig}
            position="above_catalog"
            categories={categories}
            products={products}
            selectedStore={stores[0]}
            exchangeRate={exchangeRate}
            selectedCategoryId={selectedCategoryIds[0] || null}
            onSelectCategory={handleStorefrontSelectCategory}
            onAddToCart={addItem}
            onActionClick={handleStorefrontActionClick}
          />
        </div>
      )}

      {/* 3-Column Desktop / Responsive Catalog Container */}
      <div className="max-w-[1536px] mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 xl:gap-6 items-start">
          {/* Left Column: Category Sidebar (Desktop Only) */}
          <aside className="hidden lg:block lg:col-span-3 xl:col-span-2 sticky top-[100px] max-h-[calc(100vh-7.5rem)] overflow-y-auto space-y-3.5 pr-1 scrollbar-thin">
            <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider text-muted-foreground">
                  <LayoutGrid className="w-3.5 h-3.5 text-primary" />
                  <span>Categorías</span>
                </div>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={selectAllCategories}
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Todas las categorías */}
              <button
                type="button"
                onClick={selectAllCategories}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedCategoryIds.length === 0 && !isFavoritesOnly
                    ? "bg-primary text-primary-foreground shadow-xs font-black"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Todas</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
                    selectedCategoryIds.length === 0 && !isFavoritesOnly
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {products.length}
                </span>
              </button>

              {/* Favoritos */}
              <button
                type="button"
                onClick={() => {
                  setIsFavoritesOnly(!isFavoritesOnly);
                  if (!isFavoritesOnly) setSelectedCategoryIds([]);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isFavoritesOnly
                    ? "bg-rose-500 text-white shadow-xs font-black"
                    : "text-foreground hover:bg-rose-500/10 hover:text-rose-600"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Heart
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isFavoritesOnly ? "fill-white text-white" : "text-rose-500"
                    }`}
                  />
                  <span className="truncate">Favoritos</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
                    isFavoritesOnly ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {favoritesCount}
                </span>
              </button>

              {/* List of categories */}
              <div className="space-y-1 pt-1.5 border-t border-border/50 max-h-[calc(100vh-22rem)] overflow-y-auto pr-0.5">
                {categories.map((cat) => {
                  const isSelected = selectedCategoryIds.includes(cat.id);
                  const count = products.filter((p) => p.category_id === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                        isSelected
                          ? "bg-primary/10 text-primary font-black border border-primary/25 shadow-2xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="truncate mr-1.5">{cat.name}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 font-bold ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Store Guarantee Box */}
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 space-y-2 text-[11px]">
              <div className="flex items-center gap-2 text-foreground font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Garantía de Tienda</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Precios oficiales en tiempo real, pesaje exacto y empaque cuidadoso.
              </p>
            </div>
          </aside>

          {/* Center Column: Search, Banner, Catalog & Pagination */}
          <main className="col-span-12 lg:col-span-6 xl:col-span-7 min-w-0">
            {/* Desktop Search Bar (Hidden on mobile because mobile uses the sticky bar) */}
            <div className="hidden lg:block mb-4 space-y-2">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder={
                    selectedCategoryIds.length === 1
                      ? `Buscar en ${categories.find((c) => c.id === selectedCategoryIds[0])?.name || "esta categoría"}...`
                      : "Buscar productos (ej. Harina, Queso, Café, Refresco)..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-12 rounded-xl border border-input bg-card/60 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
                    title="Limpiar búsqueda"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Desktop Active Filter Chips */}
              {activeFiltersCount > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5 animate-in fade-in duration-150">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
                    Filtros:
                  </span>

                  {isFavoritesOnly && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-lg shadow-2xs">
                      <Heart className="w-3 h-3 fill-rose-500" />
                      <span>Favoritos ({favoritesCount})</span>
                      <button
                        type="button"
                        onClick={() => setIsFavoritesOnly(false)}
                        className="hover:opacity-70 p-0.5 cursor-pointer"
                        title="Quitar filtro de favoritos"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {selectedCategoryIds.map((catId) => {
                    const cat = categories.find((c) => c.id === catId);
                    if (!cat) return null;
                    return (
                      <span
                        key={catId}
                        className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-lg shadow-2xs"
                      >
                        <span>{cat.name}</span>
                        <button
                          type="button"
                          onClick={() => toggleCategory(catId)}
                          className="hover:opacity-70 p-0.5 cursor-pointer"
                          title={`Quitar categoría ${cat.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}

                  <button
                    type="button"
                    onClick={selectAllCategories}
                    className="text-[10px] font-bold text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer"
                  >
                    Limpiar todo
                  </button>
                </div>
              )}
            </div>

            {/* Supermarket Pro Promotional VIP Banner Capsule (Only when Storefront Pro is not active) */}
            {!isStorefrontProActive && (
              <div className="mb-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-amber-500/10 border border-primary/20 relative overflow-hidden shadow-xs">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] sm:text-[11px] font-black tracking-wide uppercase">
                      <Sparkles className="w-3 h-3" />
                      <span>Supermarket Pro • Compra Rápida</span>
                    </div>
                    <h1 className="text-sm sm:text-base lg:text-lg font-black text-foreground tracking-tight leading-tight">
                      Todo lo que necesitas, directo a tu puerta
                    </h1>
                    <p className="text-xs text-muted-foreground font-medium">
                      Productos frescos, variedad garantizada y precios oficiales al cambio del día.
                    </p>
                    <div className="pt-1 flex items-center gap-1.5 flex-wrap text-xs">
                      <span className="font-bold text-foreground text-[11px]">Cupones:</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof navigator !== "undefined") navigator.clipboard?.writeText("BIENVENIDO");
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-background border border-primary/30 text-primary font-mono text-[11px] font-black hover:bg-primary/5 transition-colors cursor-pointer"
                        title="Copiar cupón BIENVENIDO"
                      >
                        <Tag className="w-3 h-3" />
                        <span>BIENVENIDO ($2 OFF)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof navigator !== "undefined") navigator.clipboard?.writeText("SHOP10");
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-background border border-primary/30 text-primary font-mono text-[11px] font-black hover:bg-primary/5 transition-colors cursor-pointer"
                        title="Copiar cupón SHOP10"
                      >
                        <Tag className="w-3 h-3" />
                        <span>SHOP10 (10% OFF)</span>
                      </button>
                    </div>
                  </div>

                  <div className="shrink-0 flex md:flex-col items-center md:items-end gap-2">
                    <div className="flex items-center gap-2 bg-background/90 px-3 py-2 rounded-xl border border-border shadow-2xs">
                      <Truck className="w-4 h-4 text-primary shrink-0" />
                      <div className="text-left md:text-right">
                        <p className="text-xs font-black text-foreground leading-tight">Despacho a Domicilio</p>
                        <p className="text-[10px] text-muted-foreground font-semibold">
                          {deliveryZones && deliveryZones.length > 0 ? `${deliveryZones.length} zonas activas` : "Envíos directos"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section Heading with Counter */}
            <div id="catalog-section" className="flex items-center justify-between mb-3 sm:mb-4 scroll-mt-28">
              <h2 className="text-xs sm:text-sm font-black tracking-tight text-foreground flex items-center gap-1.5">
                {isFavoritesOnly ? (
                  <>
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                    <span>Mis Productos Favoritos</span>
                  </>
                ) : selectedCategoryIds.length === 1 ? (
                  <>
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>{categories.find((c) => c.id === selectedCategoryIds[0])?.name || "Catálogo"}</span>
                  </>
                ) : selectedCategoryIds.length > 1 ? (
                  <>
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Categorías Seleccionadas ({selectedCategoryIds.length})</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Catálogo Disponible</span>
                  </>
                )}
                <span className="text-[11px] sm:text-xs text-muted-foreground font-semibold">
                  ({totalProducts} {totalProducts === 1 ? "producto" : "productos"})
                </span>
              </h2>

              {activeFiltersCount > 0 && (
                <button
                  onClick={selectAllCategories}
                  className="text-xs font-bold text-primary hover:underline transition-colors cursor-pointer"
                >
                  Ver todo
                </button>
              )}
            </div>

            {/* Products Grid with Reactive Section Transition */}
            <div
              key={`${selectedCategoryIds.join("-")}-${isFavoritesOnly}-${searchQuery}-${currentPage}-${pageSize}`}
              className="animate-in fade-in duration-200"
            >
              {filteredProducts.length === 0 ? (
                isFavoritesOnly ? (
                  <div className="p-10 text-center rounded-2xl border border-dashed border-rose-500/30 bg-rose-500/5 max-w-lg mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-3">
                      <Heart className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <p className="font-bold text-foreground text-sm">
                      Aún no tienes productos favoritos
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                      Toca el corazón (❤️) en la esquina de cualquier producto para guardarlo aquí y comprarlo en un clic.
                    </p>
                    <button
                      onClick={selectAllCategories}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-transform active:scale-95 cursor-pointer shadow-xs"
                    >
                      <span>Explorar todo el catálogo</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-10 text-center rounded-2xl border border-dashed border-border bg-card/60 max-w-md mx-auto">
                    <SlidersHorizontal className="w-9 h-9 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="font-bold text-foreground text-sm">
                      No se encontraron productos
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                      Prueba con otro término de búsqueda o selecciona otra categoría.
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        selectAllCategories();
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-transform active:scale-95 cursor-pointer shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Ver todos los productos</span>
                    </button>
                  </div>
                )
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-4">
                    {paginatedProducts.map((product) => {
                      const mods = getProductModifierGroups(product);
                      const hasModifiers = mods.length > 0;
                      return (
                        <ProductCard
                          key={product.id}
                          product={product}
                          exchangeRate={effectiveRateInfo.effectiveRate}
                          baseCurrency={effectiveRateInfo.baseCurrency}
                          showVesPrice={isVenezuelaActive}
                          hasModifiers={hasModifiers}
                          onOpenModifiers={(prod) => setCustomizingProduct(prod)}
                        />
                      );
                    })}
                  </div>

                  {/* Responsive User-Selectable Pagination Bar */}
                  {totalProducts > 0 && (
                    <div className="mt-8 mb-4 p-3.5 sm:p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 shadow-xs">
                      {/* Page Size Selector (10, 20, 50) */}
                      <div className="flex items-center gap-2 text-xs w-full sm:w-auto justify-between sm:justify-start">
                        <span className="font-bold text-muted-foreground whitespace-nowrap">
                          Por página:
                        </span>
                        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50">
                          {[10, 20, 50].map((size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => {
                                setPageSize(size);
                                const el = document.getElementById("catalog-section");
                                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                              }}
                              className={`px-2.5 py-1 rounded-lg font-black text-xs transition-all cursor-pointer ${
                                pageSize === size
                                  ? "bg-primary text-primary-foreground shadow-2xs"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Range Counter */}
                      <div className="text-xs text-muted-foreground font-semibold text-center order-last sm:order-none">
                        Mostrando{" "}
                        <span className="font-bold text-foreground">
                          {(currentPage - 1) * pageSize + 1}
                        </span>{" "}
                        -{" "}
                        <span className="font-bold text-foreground">
                          {Math.min(currentPage * pageSize, totalProducts)}
                        </span>{" "}
                        de{" "}
                        <span className="font-bold text-foreground">{totalProducts}</span> productos
                      </div>

                      {/* Page Navigation Buttons */}
                      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentPage((p) => Math.max(1, p - 1));
                            const el = document.getElementById("catalog-section");
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          disabled={currentPage === 1}
                          className="h-9 px-3 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                          aria-label="Página anterior"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Anterior</span>
                        </button>

                        <div className="px-3 py-1.5 rounded-xl bg-muted/60 border border-border/50 text-xs font-black text-foreground min-w-[70px] text-center">
                          {currentPage} / {totalPages}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCurrentPage((p) => Math.min(totalPages, p + 1));
                            const el = document.getElementById("catalog-section");
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          disabled={currentPage === totalPages}
                          className="h-9 px-3 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                          aria-label="Página siguiente"
                        >
                          <span>Siguiente</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </main>

          {/* Right Column: Sticky Side Cart (Desktop Only) */}
          <aside
            id="desktop-side-cart"
            className="hidden lg:flex lg:col-span-3 xl:col-span-3 sticky top-[100px] max-h-[calc(100vh-7.5rem)] rounded-2xl border border-border bg-card shadow-xs flex-col overflow-hidden transition-all duration-300"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                    Tu Pedido
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-semibold">
                    {totalItems} {totalItems === 1 ? "artículo" : "artículos"}
                  </p>
                </div>
              </div>
              {totalItems > 0 && (
                <span className="text-xs font-black text-primary font-mono">
                  {formatCurrency(totalUsd, effectiveRateInfo.baseCurrency)}
                </span>
              )}
            </div>

            {/* Active Delivery Info Banner */}
            <div className="px-3.5 py-2.5 bg-muted/25 border-b border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-foreground font-semibold min-w-0">
                <Truck className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">Despacho a Domicilio</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-semibold shrink-0">
                {deliveryZones && deliveryZones.length > 0 ? `${deliveryZones.length} zonas activas` : "Entrega directa"}
              </span>
            </div>

            {/* Scrollable Items List */}
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center my-auto">
                <div className="w-12 h-12 rounded-2xl bg-muted/70 flex items-center justify-center text-muted-foreground/60 mb-2.5">
                  <ShoppingBag className="w-6 h-6 stroke-[1.5]" />
                </div>
                <p className="text-xs font-bold text-foreground">Tu carrito está vacío</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-[190px]">
                  Agrega productos del catálogo para comenzar tu compra.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-border/40 scrollbar-thin">
                {items.map((item) => {
                  const itemLineKey = item.id || item.product.id;
                  const unitPrice = item.unit_price_usd ?? item.product.price_usd;
                  const lineTotalUsd = unitPrice * item.quantity;
                  const isMaxStock =
                    item.product.stock !== undefined && item.quantity >= item.product.stock;

                  return (
                    <div key={itemLineKey} className="pt-2.5 first:pt-0 flex gap-2.5 items-start">
                      <img
                        src={item.product.image_url || ""}
                        alt={item.product.name}
                        width={48}
                        height={48}
                        loading="lazy"
                        decoding="async"
                        className="w-12 h-12 rounded-lg object-cover bg-muted shrink-0 border border-border/50"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src =
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'/%3E%3Cpath d='M3 6h18'/%3E%3Cpath d='M16 10a4 4 0 0 1-8 0'/%3E%3C/svg%3E";
                          e.currentTarget.className =
                            "w-12 h-12 rounded-lg object-contain p-2 bg-muted/40 shrink-0 opacity-40 border border-border/50";
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-xs font-bold text-foreground truncate" title={item.product.name}>
                            {item.product.name}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeItem(itemLineKey)}
                            className="p-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0 cursor-pointer"
                            title="Eliminar"
                            aria-label="Eliminar producto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {item.selected_modifiers.map((mod, i) => (
                              <span
                                key={i}
                                className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-medium truncate max-w-[140px]"
                              >
                                {mod.option_name}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-1 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-black text-primary">
                              {formatCurrency(lineTotalUsd, effectiveRateInfo.baseCurrency)}
                            </span>
                            {isVenezuelaActive && (
                              <span className="block text-[10px] text-muted-foreground font-mono">
                                Bs.{" "}
                                {convertUsdToVes(
                                  lineTotalUsd,
                                  effectiveRateInfo.effectiveRate
                                ).toLocaleString("es-VE", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center rounded-lg border border-border bg-background shadow-2xs">
                            <button
                              type="button"
                              onClick={() => updateQuantity(itemLineKey, item.quantity - 1)}
                              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                              aria-label="Disminuir"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-1.5 text-xs font-black min-w-[18px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={isMaxStock}
                              onClick={() => updateQuantity(itemLineKey, item.quantity + 1)}
                              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isMaxStock ? "Máximo stock alcanzado" : "Aumentar"}
                              aria-label="Aumentar"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Side Cart Footer with Subtotals & Checkout CTA */}
            {items.length > 0 && (
              <div className="p-3.5 border-t border-border bg-muted/20 space-y-2.5">
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground font-semibold">Subtotal:</span>
                    <span className="text-base font-black text-foreground">
                      {formatCurrency(totalUsd, effectiveRateInfo.baseCurrency)}
                    </span>
                  </div>
                  {isVenezuelaActive && (
                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className="text-muted-foreground font-medium">Tasa oficial BCV:</span>
                      <span className="font-bold text-primary font-mono">
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
                  type="button"
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-primary/90 transition-all active:scale-[0.98] shadow-md cursor-pointer"
                >
                  <span>Continuar al Pago</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Compra 100% segura</span>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Storefront Pro: Below-Catalog Modular Sections (Trust Badges, Testimonials, Brand Story, FAQ, etc. spanning full width) */}
      {isStorefrontProActive && storefrontConfig && (
        <div className="w-full mt-6 mb-8">
          <StorefrontProRenderer
            config={storefrontConfig}
            position="below_catalog"
            categories={categories}
            products={products}
            selectedStore={stores[0]}
            exchangeRate={exchangeRate}
            selectedCategoryId={selectedCategoryIds[0] || null}
            onSelectCategory={handleStorefrontSelectCategory}
            onAddToCart={addItem}
            onActionClick={handleStorefrontActionClick}
          />
        </div>
      )}

      {/* Sticky Mobile Bottom Cart Bar (Thumb-Zone Ergonomics) */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 inset-x-3 sm:inset-x-4 z-40 sm:hidden animate-in slide-in-from-bottom-5 duration-200">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="w-full bg-primary text-primary-foreground p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-primary/30 active:scale-[0.99] transition-transform cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center relative shadow-xs">
                <ShoppingBag className="w-4.5 h-4.5 text-white" />
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {totalItems}
                </span>
              </div>
              <div className="text-left">
                <p className="text-xs font-black leading-tight text-white">
                  {totalItems} {totalItems === 1 ? "producto" : "productos"} en carrito
                </p>
                <p className="text-[10px] font-bold text-white/90">
                  {formatCurrency(totalUsd, effectiveRateInfo.baseCurrency)}
                  {isVenezuelaActive && (
                    <>
                      {" "}• Bs.{" "}
                      {totalVes.toLocaleString("es-VE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-white text-primary px-3 py-1.5 rounded-xl font-black text-xs shadow-xs">
              <span>Ver Carrito</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </button>
        </div>
      )}

      {/* Persistent Cart Drawer */}
      <CartDrawer
        exchangeRate={effectiveRateInfo.effectiveRate}
        baseCurrency={effectiveRateInfo.baseCurrency}
        showVesPrice={isVenezuelaActive}
        onProceedToCheckout={() => setIsCheckoutOpen(true)}
      />

      {/* Checkout Dialog */}
      <CheckoutDialog
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        settings={settings}
        stores={stores}
        deliveryZones={deliveryZones}
        exchangeRate={effectiveRateInfo.effectiveRate}
        activeModuleIds={activeModuleIds}
        onOrderCompleted={(order) => setCompletedOrder(order)}
      />

      {/* Order Success Confirmation with WhatsApp Button */}
      <OrderSuccessModal
        order={completedOrder}
        settings={settings}
        activeModuleIds={activeModuleIds}
        onClose={() => setCompletedOrder(null)}
        onViewTicket={(ord) => {
          setCompletedOrder(null);
          setTicketOrder(ord);
        }}
      />

      {/* Customer Ticket & QR Receipt Modal */}
      <CustomerOrderTicketModal
        order={ticketOrder}
        isOpen={Boolean(ticketOrder)}
        onClose={() => setTicketOrder(null)}
        settings={settings}
        store={stores[0]}
        activeModuleIds={activeModuleIds}
      />

      {/* Customer Order Tracker Modal */}
      <OrderTrackerModal
        isOpen={isTrackerOpen}
        onClose={() => {
          setIsTrackerOpen(false);
          setTrackingInitialQuery(undefined);
        }}
        settings={settings}
        initialQuery={trackingInitialQuery}
      />

      {/* Food Service Plugin: Interactive Modifier Customizer Modal */}
      {customizingProduct && (
        <ModifierModal
          isOpen={Boolean(customizingProduct)}
          onClose={() => setCustomizingProduct(null)}
          product={customizingProduct}
          modifierGroups={getProductModifierGroups(customizingProduct)}
          exchangeRate={effectiveRateInfo.effectiveRate}
          onConfirmAddToCart={(prod: Product, qty: number, selectedModifiers: SelectedModifier[], unitPrice: number) => {
            addItem(prod, qty, true, selectedModifiers, unitPrice);
            setCustomizingProduct(null);
          }}
        />
      )}
    </div>
  );
}
