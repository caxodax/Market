"use client";

import React, { useState, useMemo } from "react";
import {
  Boxes,
  Plus,
  Minus,
  Pencil,
  Search,
  X,
  LayoutGrid,
  List,
  Download,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Image as ImageIcon,
  Tag,
} from "lucide-react";
import type {
  Product,
  Category,
  ExchangeRate,
  TenantPlanLimits,
  StoreCurrencySettings,
} from "@marketos/types";
import { formatCurrency, calculateEffectiveExchangeRate } from "@marketos/utils";
import { downloadProductImportTemplate } from "../lib/productExcel";
import { ProductImportModal } from "./product-import-modal";

interface InventoryTabProps {
  tenantId: string;
  products: (Product & { stock: number })[];
  categories: Category[];
  rate: ExchangeRate;
  activeModuleIds: string[];
  currencySettings?: StoreCurrencySettings | null;
  planLimitsState?: TenantPlanLimits | null;
  onStockChange: (productId: string, delta: number) => void;
  onEditProduct: (product: Product & { stock: number }) => void;
  onNewProduct: () => void;
  onTriggerUpgrade: (type: "products") => void;
  onProductsImported?: (count: number) => void;
}

export function InventoryTab({
  tenantId,
  products,
  categories,
  rate,
  activeModuleIds,
  currencySettings,
  planLimitsState,
  onStockChange,
  onEditProduct,
  onNewProduct,
  onTriggerUpgrade,
  onProductsImported,
}: InventoryTabProps) {
  const effectiveRateInfo = useMemo(() => {
    return calculateEffectiveExchangeRate(rate, currencySettings);
  }, [rate, currencySettings]);

  // ── State: Filters & View ────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // ── SaaS Quota Checks ────────────────────────────────────────────────────────
  const maxProducts = planLimitsState?.plan.max_products || 60;
  const currentProductsCount = products.length;
  const isAtCapacity = currentProductsCount >= maxProducts;
  const productUsagePct = Math.min(100, Math.round((currentProductsCount / maxProducts) * 100));

  // ── Category Map ─────────────────────────────────────────────────────────────
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // ── Filtered Products ────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return products.filter((prod) => {
      // Category filter
      if (selectedCategory !== "ALL" && prod.category_id !== selectedCategory) {
        return false;
      }
      // Search query
      if (!term) return true;
      const catName = (categoryMap.get(prod.category_id) || "").toLowerCase();
      const nameMatch = prod.name.toLowerCase().includes(term);
      const skuMatch = prod.sku ? prod.sku.toLowerCase().includes(term) : false;
      const barcodeMatch = prod.barcode ? prod.barcode.toLowerCase().includes(term) : false;
      const catMatch = catName.includes(term);

      return nameMatch || skuMatch || barcodeMatch || catMatch;
    });
  }, [products, searchQuery, selectedCategory, categoryMap]);

  // ── Pagination Calculation ───────────────────────────────────────────────────
  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, activePage, pageSize]);

  // Reset page when search or category changes
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* ── Main Inventory Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card p-4 sm:p-5 rounded-3xl border border-border">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Boxes className="w-4 h-4 text-primary" />
            Catálogo & Control de Inventario
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Administra existencias, códigos de barra, precios en USD/Bs y catálogo de productos.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Download Excel Template */}
          <button
            type="button"
            onClick={() => downloadProductImportTemplate(categories)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer min-h-[44px] sm:min-h-0"
            title="Descargar plantilla de Excel oficial"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Plantilla Excel</span>
            <span className="sm:hidden">Plantilla</span>
          </button>

          {/* Import Excel Button */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer min-h-[44px] sm:min-h-0"
            title="Carga masiva desde archivo Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Importar Excel</span>
          </button>

          {/* New Product Button */}
          <button
            type="button"
            onClick={() => {
              if (isAtCapacity) {
                onTriggerUpgrade("products");
                return;
              }
              onNewProduct();
            }}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all shrink-0 min-h-[44px] sm:min-h-0 ${
              isAtCapacity
                ? "bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-500/30"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
            }`}
            title={isAtCapacity ? "Cupo máximo alcanzado. Clic para actualizar plan" : "Registrar nuevo producto"}
          >
            {isAtCapacity ? (
              <>
                <Zap className="w-4 h-4" />
                <span>Límite Alcanzado (Mejorar Plan)</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>+ Nuevo Producto</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── SaaS Catalog Quota Indicator Card ─────────────────────────────────── */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          isAtCapacity
            ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
            : productUsagePct >= 80
            ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
            : "bg-card border-border text-foreground"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isAtCapacity
                  ? "bg-rose-500/20 text-rose-500"
                  : productUsagePct >= 80
                  ? "bg-amber-500/20 text-amber-500"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-foreground">
                  Capacidad de Catálogo ({currentProductsCount} / {maxProducts} productos)
                </span>
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isAtCapacity
                      ? "bg-rose-500 text-white"
                      : productUsagePct >= 80
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  }`}
                >
                  {isAtCapacity
                    ? "Límite Alcanzado (100%)"
                    : productUsagePct >= 80
                    ? `${productUsagePct}% En Uso (Cerca del Límite)`
                    : `${productUsagePct}% En Uso`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Plan actual: <strong className="text-foreground">{planLimitsState?.plan.name || "Starter"}</strong>.
                {isAtCapacity
                  ? " Has alcanzado el cupo máximo de tu plan. No podrás agregar más artículos hasta actualizar a un plan superior."
                  : ` Te quedan ${Math.max(0, maxProducts - currentProductsCount)} espacios para nuevos productos en tu catálogo.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onTriggerUpgrade("products")}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer min-h-[44px] sm:min-h-0 ${
              isAtCapacity
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-sm hover:scale-105 active:scale-95"
                : "bg-muted hover:bg-muted/80 text-foreground border border-border"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{isAtCapacity ? "Actualizar Plan Ahora" : "Ver Opciones de Upgrade"}</span>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 w-full h-2 rounded-full bg-muted overflow-hidden border border-border/50">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isAtCapacity
                ? "bg-rose-500"
                : productUsagePct >= 80
                ? "bg-amber-500"
                : "bg-gradient-to-r from-emerald-500 to-teal-500"
            }`}
            style={{ width: `${productUsagePct}%` }}
          />
        </div>
      </div>

      {/* ── Filter Bar: Search, Category & View Switcher ──────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU, código de barra..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary min-h-[44px] sm:min-h-0"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground font-medium focus:outline-hidden focus:ring-1 focus:ring-primary min-h-[44px] sm:min-h-0 cursor-pointer"
            >
              <option value="ALL">Todas las Categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle: Cards vs List */}
          <div className="flex items-center border border-border rounded-xl p-1 bg-muted/40 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center ${
                viewMode === "list"
                  ? "bg-card text-primary shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vista de Lista Tabular"
              aria-label="Ver como lista"
            >
              <List className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center ${
                viewMode === "cards"
                  ? "bg-card text-primary shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vista de Cuadrícula / Tarjetas"
              aria-label="Ver como cuadrícula"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Empty State ───────────────────────────────────────────────────────── */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-border bg-card space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mx-auto text-muted-foreground">
            <Boxes className="w-6 h-6 opacity-40" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-foreground text-sm">No se encontraron productos</p>
            <p className="text-xs text-muted-foreground">
              {searchQuery
                ? `No hay coincidencias para "${searchQuery}". Prueba con otro término o categoría.`
                : "Aún no tienes productos registrados en tu catálogo."}
            </p>
          </div>
          {searchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar Búsqueda</span>
            </button>
          )}
        </div>
      ) : viewMode === "list" ? (
        /* ── VIEW 1: COMPACT LIST / TABULAR VIEW ─────────────────────────────── */
        <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                  <th className="p-3 w-16">Foto</th>
                  <th className="p-3">Producto & Códigos</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3 text-right">Precio ({effectiveRateInfo.baseCurrency})</th>
                  {activeModuleIds.includes("local_venezuela") && (
                    <th className="p-3 text-right">Precio VES</th>
                  )}
                  <th className="p-3 text-center">Stock / Control</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-center w-20">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedProducts.map((prod) => {
                  const categoryName = categoryMap.get(prod.category_id) || "General";
                  const priceVes = prod.price_usd * effectiveRateInfo.effectiveRate;
                  const isLowStock = prod.stock <= 5 && prod.stock > 0;
                  const isZeroStock = prod.stock <= 0;

                  return (
                    <tr key={prod.id} className="hover:bg-muted/20 transition-colors">
                      {/* Thumbnail */}
                      <td className="p-3">
                        {prod.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="w-10 h-10 object-cover rounded-xl border border-border bg-muted shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
                            <ImageIcon className="w-4 h-4 opacity-40" />
                          </div>
                        )}
                      </td>

                      {/* Product details */}
                      <td className="p-3">
                        <p className="font-bold text-foreground text-xs">{prod.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                          {prod.sku && <span>SKU: {prod.sku}</span>}
                          {prod.barcode && <span>• Barra: {prod.barcode}</span>}
                        </p>
                      </td>

                      {/* Category */}
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          <Tag className="w-2.5 h-2.5" />
                          <span>{categoryName}</span>
                        </span>
                      </td>

                      {/* Price in Base Currency */}
                      <td className="p-3 text-right font-mono font-bold text-foreground">
                        {formatCurrency(prod.price_usd, effectiveRateInfo.baseCurrency)}
                      </td>

                      {/* Price VES */}
                      {activeModuleIds.includes("local_venezuela") && (
                        <td className="p-3 text-right font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          Bs. {priceVes.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      )}

                      {/* Stock controls */}
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
                          <button
                            type="button"
                            onClick={() => onStockChange(prod.id, -1)}
                            className="w-6 h-6 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-foreground transition-all cursor-pointer min-h-[32px] min-w-[32px] sm:min-h-0 sm:min-w-0"
                            title="Restar 1 unidad"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <div className="w-10 text-center font-mono font-black text-xs">
                            <span
                              className={
                                isZeroStock
                                  ? "text-rose-500 font-bold"
                                  : isLowStock
                                  ? "text-amber-500 font-bold"
                                  : "text-foreground"
                              }
                            >
                              {prod.stock}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onStockChange(prod.id, 1)}
                            className="w-6 h-6 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-foreground transition-all cursor-pointer min-h-[32px] min-w-[32px] sm:min-h-0 sm:min-w-0"
                            title="Sumar 1 unidad"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Active Status */}
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            prod.is_active
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                          }`}
                        >
                          {prod.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onEditProduct(prod)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer min-h-[36px] sm:min-h-0"
                          title="Editar producto"
                        >
                          <Pencil className="w-3.5 h-3.5 text-primary" />
                          <span>Editar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── VIEW 2: CARDS GRID VIEW ─────────────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {paginatedProducts.map((prod) => {
            const categoryName = categoryMap.get(prod.category_id) || "General";
            const priceVes = prod.price_usd * effectiveRateInfo.effectiveRate;
            const isLowStock = prod.stock <= 5 && prod.stock > 0;
            const isZeroStock = prod.stock <= 0;

            return (
              <div
                key={prod.id}
                className="p-3.5 rounded-2xl border border-border bg-card flex flex-col justify-between gap-3 transition-all hover:border-border/80 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  {prod.image_url ? (
                    <img
                      src={prod.image_url}
                      alt={prod.name}
                      className="w-14 h-14 object-cover rounded-xl border border-border shrink-0 bg-muted"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
                      <ImageIcon className="w-6 h-6 opacity-40" />
                    </div>
                  )}

                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-xs font-bold text-foreground truncate">{prod.name}</h3>
                      {!prod.is_active && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 font-semibold">
                          Inactivo
                        </span>
                      )}
                    </div>

                    <span className="inline-block text-[10px] px-2 py-0.2 rounded-full bg-primary/10 text-primary font-semibold">
                      {categoryName}
                    </span>

                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                      {prod.sku ? `SKU: ${prod.sku}` : prod.barcode ? `Barra: ${prod.barcode}` : ""}
                    </p>

                    <p className="text-xs font-mono font-bold text-primary mt-1">
                      {formatCurrency(prod.price_usd, effectiveRateInfo.baseCurrency)}
                      {activeModuleIds.includes("local_venezuela") && (
                        <span className="text-[10px] text-muted-foreground font-normal block sm:inline">
                          {" "}(Bs. {priceVes.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => onEditProduct(prod)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer min-h-[36px] sm:min-h-0"
                    title="Editar producto"
                  >
                    <Pencil className="w-3 h-3 text-primary" />
                    <span>Editar</span>
                  </button>

                  <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => onStockChange(prod.id, -1)}
                      className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-foreground transition-all cursor-pointer min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0"
                      title="Restar 1 unidad"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <div className="w-9 text-center">
                      <span
                        className={`font-mono font-black text-xs block ${
                          isZeroStock ? "text-rose-500" : isLowStock ? "text-amber-500" : "text-foreground"
                        }`}
                      >
                        {prod.stock}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onStockChange(prod.id, 1)}
                      className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-foreground transition-all cursor-pointer min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0"
                      title="Sumar 1 unidad"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination Controls ───────────────────────────────────────────────── */}
      {filteredProducts.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3.5 rounded-2xl border border-border text-xs">
          {/* Info & Page Size */}
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              Mostrando{" "}
              <strong className="text-foreground">
                {(activePage - 1) * pageSize + 1}–{Math.min(activePage * pageSize, totalItems)}
              </strong>{" "}
              de <strong className="text-foreground">{totalItems}</strong> productos
            </span>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span>Por página:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1 rounded-lg bg-background border border-border text-xs text-foreground font-semibold cursor-pointer focus:outline-hidden"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={activePage <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[44px] sm:min-h-0"
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <span className="px-3 py-1.5 rounded-xl bg-muted/40 border border-border font-mono font-bold text-foreground">
              {activePage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={activePage >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[44px] sm:min-h-0"
              aria-label="Página siguiente"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Mass Excel Import Modal ───────────────────────────────────────────── */}
      <ProductImportModal
        tenantId={tenantId}
        categories={categories}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(count) => {
          setIsImportModalOpen(false);
          if (onProductsImported) {
            onProductsImported(count);
          } else {
            window.location.reload();
          }
        }}
        onQuotaExceeded={() => {
          setIsImportModalOpen(false);
          onTriggerUpgrade("products");
        }}
      />
    </div>
  );
}
