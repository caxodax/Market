"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { TenantSettings, ExchangeRate, Store } from "@marketos/types";
import { formatCurrency, calculateEffectiveExchangeRate } from "@marketos/utils";
import { useCart } from "../context/cart-context";
import { useFavorites } from "../context/favorites-context";
import {
  ShoppingBag,
  MapPin,
  TrendingUp,
  Package,
  ChevronDown,
  ShieldCheck,
  Heart,
  MoreVertical,
  Download,
  Search,
  X,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

interface StoreHeaderProps {
  settings: TenantSettings;
  exchangeRate: ExchangeRate;
  selectedStore?: Store;
  locationLabel?: string;
  activeModuleIds?: import("@marketos/types").TenantModuleId[];
  onOpenBranchSelector?: () => void;
  onOpenTracker?: () => void;
  onOpenAccount?: () => void;
  onOpenFavorites?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function StoreHeader({
  settings,
  exchangeRate,
  selectedStore,
  locationLabel,
  activeModuleIds = [],
  onOpenBranchSelector,
  onOpenTracker,
  onOpenAccount,
  onOpenFavorites,
  searchQuery,
  onSearchChange,
}: StoreHeaderProps) {
  const { totalItems, setIsOpen } = useCart();
  const { favoritesCount } = useFavorites();
  const [logoError, setLogoError] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const effectiveRateInfo = useMemo(() => {
    return calculateEffectiveExchangeRate(exchangeRate, settings.currency_settings);
  }, [exchangeRate, settings.currency_settings]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background shadow-md transition-colors">
      {/* Announcement Banner */}
      {settings.operational_settings?.show_announcement_banner !== false &&
        Boolean(settings.operational_settings?.announcement_banner?.trim()) && (
          <div className="bg-primary text-primary-foreground text-xs sm:text-sm py-2 px-3 sm:px-4 text-center font-bold tracking-tight shadow-xs truncate">
            {settings.operational_settings?.announcement_banner}
          </div>
        )}

      {/* Store Closed Warning */}
      {settings.operational_settings?.is_open === false && (
        <div className="bg-amber-600 text-white text-xs sm:text-sm py-2 px-3 sm:px-4 text-center font-bold">
          ⏰ {settings.operational_settings?.closed_message || "Actualmente nos encontramos fuera de horario de atención comercial."}
        </div>
      )}

      {/* Top Banner - BCV Rate & Branch Selection (Compact & Clean) */}
      <div className="bg-secondary text-secondary-foreground text-xs sm:text-sm py-1.5 px-3 sm:px-4 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {onOpenBranchSelector ? (
            <button
              onClick={onOpenBranchSelector}
              className="flex items-center gap-1.5 font-medium hover:text-white transition-colors cursor-pointer group text-left truncate min-w-0"
              title="Cambiar sucursal física o detectar con GPS"
            >
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate">
                Sede: <strong className="font-bold">{selectedStore ? selectedStore.name : settings.address}</strong>
                {locationLabel && (
                  <span className="ml-1.5 text-xs text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/15">
                    {locationLabel}
                  </span>
                )}
              </span>
              <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 font-medium truncate min-w-0">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{settings.address}</span>
            </div>
          )}

          {(activeModuleIds?.includes("local_venezuela") || Boolean(settings.currency_settings?.base_currency)) && (
            <div
              className="flex items-center gap-1.5 shrink-0 font-mono text-xs sm:text-sm"
              title={effectiveRateInfo.label}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-white/80 flex items-center gap-1">
                {effectiveRateInfo.baseCurrency === "EUR" ? (
                  <>
                    <span className="text-xs sm:text-sm">🇪🇺</span>
                    <span className="hidden xs:inline">BCV EUR:</span>
                    <span className="xs:hidden">EUR:</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs sm:text-sm">🇺🇸</span>
                    <span className="hidden xs:inline">BCV USD:</span>
                    <span className="xs:hidden">USD:</span>
                  </>
                )}
              </span>
              <strong className="text-white font-black">
                Bs. {effectiveRateInfo.effectiveRate.toFixed(2)}
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* Main Nav */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand identity - High visual impact & presence */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 shrink-0 md:max-w-xs lg:max-w-sm">
          {settings.logo_url && !logoError ? (
            <img
              src={settings.logo_url}
              alt={settings.business_name}
              width={56}
              height={56}
              loading="eager"
              decoding="sync"
              onError={() => setLogoError(true)}
              className="h-11 w-11 sm:h-13 sm:w-13 md:h-14 md:w-14 object-contain rounded-2xl bg-card border border-border/80 p-1 shadow-sm shrink-0 transition-transform hover:scale-105"
            />
          ) : (
            <div className="h-11 w-11 sm:h-13 sm:w-13 md:h-14 md:w-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-black text-lg sm:text-2xl shadow-sm tracking-tighter shrink-0">
              {settings.business_name ? settings.business_name.substring(0, 2).toUpperCase() : "SM"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="font-black text-base sm:text-lg md:text-2xl tracking-tight leading-none text-foreground truncate block">
                {settings.business_name}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Oficial
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 font-semibold truncate block mt-0.5 sm:mt-1">
              {selectedStore?.name ? `Sede ${selectedStore.name}` : settings.category || "Catálogo Digital & Despacho Directo"}
            </p>
          </div>
        </div>

        {/* Desktop Central Sticky Search Bar */}
        {onSearchChange && (
          <div className="hidden lg:flex flex-1 max-w-md xl:max-w-lg mx-2 xl:mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar productos (ej. Harina, Queso, Café)..."
                value={searchQuery || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full h-11 pl-10 pr-10 rounded-xl border border-input bg-card text-sm font-medium placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Actions Cluster */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Admin link (desktop only) */}
          <Link
            href={settings.tenant_id ? `/admin?tenant=${settings.tenant_id}` : "/admin"}
            className="hidden md:inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm font-bold transition-all shadow-2xs hover:shadow-xs active:scale-95"
            title="Acceso administrativo de tienda y personal"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Admin</span>
          </Link>

          {/* Rastrear Pedido (desktop only) */}
          {onOpenTracker && (
            <button
              onClick={onOpenTracker}
              className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
              title="Rastrear pedido en tiempo real"
            >
              <Package className="w-4 h-4 text-primary" />
              <span>Rastrear</span>
            </button>
          )}

          {/* Quick Menu Button (Mobile Only) */}
          <div className="sm:hidden relative">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
              title="Más opciones (Rastreo, Puntos, Admin)"
              aria-label="Más opciones"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Mobile Dropdown Menu */}
            {isMobileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-card border border-border shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 space-y-1 text-sm">
                  {onOpenTracker && (
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenTracker();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-foreground hover:bg-muted font-bold transition-colors text-left cursor-pointer"
                    >
                      <Package className="w-4 h-4 text-primary" />
                      <span>Rastrear Pedido</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("marketos-trigger-install"));
                        window.dispatchEvent(new Event("open-marketos-pwa-banner"));
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-foreground hover:bg-muted font-bold transition-colors text-left cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-500" />
                    <span>Instalar App en Móvil</span>
                  </button>
                  <Link
                    href={settings.tenant_id ? `/admin?tenant=${settings.tenant_id}` : "/admin"}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-foreground hover:bg-muted font-bold transition-colors text-left"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Acceso Personal / Admin</span>
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Favorites Button - 32px Heart with Ample Breathing Room */}
          {onOpenFavorites && (
            <button
              onClick={onOpenFavorites}
              className={`min-h-[44px] min-w-[44px] sm:min-w-0 px-2 sm:px-3 py-1.5 flex items-center justify-center gap-2 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 shadow-2xs hover:shadow-xs ${
                favoritesCount > 0
                  ? "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60"
                  : "border-border text-foreground bg-card hover:bg-muted"
              }`}
              title={favoritesCount > 0 ? `${favoritesCount} productos favoritos` : "Mis productos favoritos"}
              aria-label={favoritesCount > 0 ? `${favoritesCount} productos favoritos` : "Mis favoritos"}
            >
              <div className="relative flex items-center justify-center shrink-0">
                <Heart
                  className={`transition-all duration-200 ${
                    favoritesCount > 0
                      ? "w-8 h-8 sm:w-8.5 sm:h-8.5 fill-rose-500 text-rose-500 drop-shadow-xs"
                      : "w-6 h-6 text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                {favoritesCount > 0 && (
                  <span
                    key={favoritesCount}
                    className="absolute inset-0 flex items-center justify-center -translate-y-[2px] text-xs font-black text-white font-mono leading-none select-none pointer-events-none animate-in zoom-in-75 duration-150"
                  >
                    {favoritesCount > 99 ? "99+" : favoritesCount}
                  </span>
                )}
              </div>
              <span className="hidden md:inline">Favoritos</span>
            </button>
          )}

          {/* Dark / Light Mode Switcher */}
          <ThemeToggle />

          {/* Cart Trigger Button (Primary conversion action) */}
          <button
            onClick={() => {
              setIsOpen(true);
              if (typeof window !== "undefined" && window.innerWidth >= 1024) {
                const el = document.getElementById("desktop-side-cart");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  el.classList.add("ring-2", "ring-primary");
                  setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1200);
                }
              }
            }}
            className="relative min-h-[44px] min-w-[44px] sm:min-w-0 sm:px-4 sm:py-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95 shadow-sm cursor-pointer text-xs sm:text-sm font-bold"
            aria-label="Abrir carrito de compras"
          >
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline font-bold">Carrito</span>
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-secondary text-secondary-foreground text-xs font-black h-5 min-w-5 px-1 rounded-full flex items-center justify-center border-2 border-background">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Sticky Search Bar (Always pinned at top when scrolling down) */}
      {onSearchChange && (
        <div className="lg:hidden px-3 pb-2.5 pt-0.5 max-w-7xl mx-auto">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar productos en el catálogo..."
              value={searchQuery || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-10 pl-10 pr-9 rounded-xl border border-input bg-card text-sm font-medium placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
