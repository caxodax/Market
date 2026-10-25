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
import { StorefrontProRenderer, createDefaultStorefrontConfig } from "@marketos/plugin-storefront-pro";
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
  const { totalItems, totalUsd, setIsOpen, addItem } = useCart();
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
    ? settings.storefront_config || createDefaultStorefrontConfig(settings.business_name)
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
      {/* Search and Category Combobox Bar - Sticky under StoreHeader */}
      <div className="bg-background/95 backdrop-blur border-b border-border sticky top-[92px] sm:top-[102px] z-20 shadow-xs">
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

      {/* Main Catalog Section */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4">
        {/* Storefront Pro: Body Modular Sections (Hero, Bubbles, Rails, Reels, Badges, etc.) */}
        {isStorefrontProActive && storefrontConfig ? (
          <div className="mb-4">
            <StorefrontProRenderer
              config={storefrontConfig}
              position="body"
              categories={categories}
              products={products}
              selectedStore={stores[0]}
              exchangeRate={exchangeRate}
              selectedCategoryId={selectedCategoryIds[0] || null}
              onSelectCategory={(catId) => {
                if (catId) {
                  setSelectedCategoryIds([catId]);
                  if (setControlledCategory) setControlledCategory(catId);
                } else {
                  setSelectedCategoryIds([]);
                  if (setControlledCategory) setControlledCategory(null);
                }
              }}
              onAddToCart={addItem}
              onActionClick={(link) => {
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
              }}
            />
          </div>
        ) : (
          /* Promotional VIP Banner Capsule (Clean & Compact) */
          <div className="mb-4 p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-primary/10 via-amber-500/10 to-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
                <Tag className="w-4 h-4" />
              </div>
              <div className="min-w-0 text-xs">
                <span className="font-extrabold text-foreground tracking-tight">
                  Cupones Activos:{" "}
                </span>
                <span className="text-muted-foreground text-[11px]">
                  Usa <code className="font-mono font-bold text-primary bg-primary/10 px-1 py-0.5 rounded">BIENVENIDO</code> ($2 OFF) o <code className="font-mono font-bold text-primary bg-primary/10 px-1 py-0.5 rounded">SHOP10</code> (10% OFF).
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-foreground/80 self-end sm:self-auto bg-background/90 px-2.5 py-1 rounded-xl border border-border shadow-2xs shrink-0">
              <Truck className="w-3 h-3 text-primary shrink-0" />
              <span>Delivery gratis en Nueva Segovia</span>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
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
