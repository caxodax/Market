"use client";

import React from "react";
import Link from "next/link";
import { TenantSettings, ExchangeRate, Store } from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import { useCart } from "../context/cart-context";
import {
  ShoppingBag,
  MapPin,
  TrendingUp,
  Package,
  Award,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";

interface StoreHeaderProps {
  settings: TenantSettings;
  exchangeRate: ExchangeRate;
  selectedStore?: Store;
  onOpenBranchSelector?: () => void;
  onOpenTracker?: () => void;
  onOpenAccount?: () => void;
}

export function StoreHeader({
  settings,
  exchangeRate,
  selectedStore,
  onOpenBranchSelector,
  onOpenTracker,
  onOpenAccount,
}: StoreHeaderProps) {
  const { totalItems, setIsOpen } = useCart();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Top Banner - BCV Rate & Branch Selection */}
      <div className="bg-secondary text-secondary-foreground text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {onOpenBranchSelector ? (
            <button
              onClick={onOpenBranchSelector}
              className="flex items-center gap-1.5 font-medium hover:text-white transition-colors cursor-pointer group text-left truncate"
              title="Cambiar sucursal física o detectar con GPS"
            >
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate">
                Sede: <strong>{selectedStore ? selectedStore.name : settings.address}</strong>
              </span>
              <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 font-medium truncate">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{settings.address}</span>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded text-[11px]">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>Tasa BCV:</span>
              <strong className="font-semibold text-white">
                Bs. {exchangeRate.value.toFixed(2)}/USD
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-sm tracking-tighter">
            SM
          </div>
          <div>
            <h1 className="font-black text-lg sm:text-xl tracking-tight leading-tight text-foreground">
              {settings.business_name}
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Barquisimeto • {settings.category}
            </p>
          </div>
        </div>

        {/* Actions: Admin Access & Account & Tracker & Cart */}
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold transition-colors"
            title="Acceso administrativo de tienda y personal"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Admin</span>
          </Link>

          {onOpenAccount && (
            <button
              onClick={onOpenAccount}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold transition-colors"
              title="Consultar puntos de fidelidad y compras"
            >
              <Award className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">Mis Puntos</span>
            </button>
          )}

          {onOpenTracker && (
            <button
              onClick={onOpenTracker}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold transition-colors"
            >
              <Package className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline">Rastrear Pedido</span>
            </button>
          )}

          {/* Cart Trigger */}
          <button
            onClick={() => setIsOpen(true)}
            className="relative inline-flex items-center justify-center p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95 shadow-sm cursor-pointer"
            aria-label="Abrir carrito de compras"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-secondary text-secondary-foreground text-[11px] font-bold h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center border-2 border-background">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
