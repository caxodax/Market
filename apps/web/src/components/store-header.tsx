"use client";

import React, { useState } from "react";
import Link from "next/link";
import { TenantSettings, ExchangeRate, Store } from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import { useCart } from "../context/cart-context";
import { useFavorites } from "../context/favorites-context";
import {
  ShoppingBag,
  MapPin,
  TrendingUp,
  Package,
  Award,
  ChevronDown,
  ShieldCheck,
  Heart,
  MoreVertical,
  Download,
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
}: StoreHeaderProps) {
  const { totalItems, setIsOpen } = useCart();
  const { favoritesCount } = useFavorites();
  const [logoError, setLogoError] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      {/* Announcement Banner */}
      {settings.operational_settings?.show_announcement_banner !== false &&
        Boolean(settings.operational_settings?.announcement_banner?.trim()) && (
          <div className="bg-primary text-primary-foreground text-[11px] sm:text-xs py-1.5 px-3 sm:px-4 text-center font-bold tracking-tight shadow-xs truncate">
            {settings.operational_settings?.announcement_banner}
          </div>
        )}

      {/* Store Closed Warning */}
      {settings.operational_settings?.is_open === false && (
        <div className="bg-amber-600 text-white text-[11px] sm:text-xs py-1.5 px-3 sm:px-4 text-center font-semibold">
          ⏰ {settings.operational_settings?.closed_message || "Actualmente nos encontramos fuera de horario de atención comercial."}
        </div>
      )}

      {/* Top Banner - BCV Rate & Branch Selection (Compact & Clean) */}
      <div className="bg-secondary text-secondary-foreground text-[11px] py-1 px-3 sm:px-4 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {onOpenBranchSelector ? (
            <button
              onClick={onOpenBranchSelector}
              className="flex items-center gap-1 font-medium hover:text-white transition-colors cursor-pointer group text-left truncate min-w-0"
              title="Cambiar sucursal física o detectar con GPS"
            >
              <MapPin className="w-3 h-3 text-primary shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate">
                Sede: <strong>{selectedStore ? selectedStore.name : settings.address}</strong>
                {locationLabel && (
                  <span className="ml-1.5 text-[10px] text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15">
                    {locationLabel}
                  </span>
                )}
              </span>
              <ChevronDown className="w-2.5 h-2.5 opacity-70 shrink-0" />
            </button>
          ) : (
            <div className="flex items-center gap-1 font-medium truncate min-w-0">
              <MapPin className="w-3 h-3 text-primary shrink-0" />
              <span className="truncate">{settings.address}</span>
            </div>
          )}

          {activeModuleIds?.includes("local_venezuela") && (
            <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="hidden xs:inline text-white/70">BCV:</span>
              <strong className="text-white">
                Bs. {exchangeRate.value.toFixed(2)}
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* Main Nav */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand identity - Prioritized space in mobile without wrapping or cut-offs */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {settings.logo_url && !logoError ? (
            <img
              src={settings.logo_url}
              alt={settings.business_name}
              width={40}
              height={40}
              loading="eager"
              decoding="sync"
              onError={() => setLogoError(true)}
              className="h-9 w-9 sm:h-10 sm:w-10 object-contain rounded-xl bg-card border border-border p-0.5 shadow-xs shrink-0"
            />
          ) : (
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-base sm:text-xl shadow-sm tracking-tighter shrink-0">
              {settings.business_name ? settings.business_name.substring(0, 2).toUpperCase() : "SM"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-black text-sm sm:text-base md:text-xl tracking-tight leading-tight text-foreground truncate block">
              {settings.business_name}
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate block">
              {selectedStore?.name || settings.category || "Tienda Oficial"}
            </p>
          </div>
        </div>

        {/* Actions Cluster */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Admin link (desktop only) */}
          <Link
            href="/login"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold transition-colors"
            title="Acceso administrativo de tienda y personal"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Admin</span>
          </Link>

          {/* Mis Puntos (desktop only) */}
          {onOpenAccount && (
            <button
              onClick={onOpenAccount}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold transition-colors cursor-pointer"
              title="Consultar puntos de fidelidad y compras"
            >
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>Mis Puntos</span>
            </button>
          )}

          {/* Rastrear Pedido (desktop only) */}
          {onOpenTracker && (
            <button
              onClick={onOpenTracker}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold transition-colors cursor-pointer"
              title="Rastrear pedido en tiempo real"
            >
              <Package className="w-3.5 h-3.5 text-primary" />
              <span>Rastrear</span>
            </button>
          )}

          {/* Quick Menu Button (Mobile Only) */}
          <div className="sm:hidden relative">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
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
                <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-card border border-border shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 space-y-1 text-xs">
                  {onOpenTracker && (
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenTracker();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground hover:bg-muted font-semibold transition-colors text-left cursor-pointer"
                    >
                      <Package className="w-4 h-4 text-primary" />
                      <span>Rastrear Pedido</span>
                    </button>
                  )}
                  {onOpenAccount && (
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenAccount();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground hover:bg-muted font-semibold transition-colors text-left cursor-pointer"
                    >
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Mis Puntos y Compras</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("open-marketos-pwa-banner"));
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground hover:bg-muted font-semibold transition-colors text-left cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-500" />
                    <span>Instalar App en Móvil</span>
                  </button>
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground hover:bg-muted font-semibold transition-colors text-left"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Acceso Personal / Admin</span>
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Favorites Button */}
          {onOpenFavorites && (
            <button
              onClick={onOpenFavorites}
              className={`min-h-[38px] min-w-[38px] sm:min-w-0 sm:px-3 sm:py-1.5 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                favoritesCount > 0
                  ? "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
                  : "border-border text-foreground hover:bg-muted"
              }`}
              title="Mis productos favoritos"
              aria-label="Mis favoritos"
            >
              <Heart
                className={`w-4 h-4 ${
                  favoritesCount > 0 ? "fill-rose-500 text-rose-500" : "text-muted-foreground"
                }`}
              />
              <span className="hidden md:inline">Favoritos</span>
              {favoritesCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white">
                  {favoritesCount}
                </span>
              )}
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
            className="relative min-h-[38px] min-w-[38px] sm:min-w-0 sm:px-3.5 sm:py-1.5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95 shadow-sm cursor-pointer"
            aria-label="Abrir carrito de compras"
          >
            <ShoppingBag className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span className="hidden sm:inline font-bold text-xs">Carrito</span>
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-secondary text-secondary-foreground text-[10px] font-bold h-4.5 min-w-4.5 px-1 rounded-full flex items-center justify-center border-2 border-background">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
