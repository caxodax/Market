"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  Zap,
  Building2,
  Boxes,
  Crown,
  ArrowRight,
  ShieldAlert,
  MessageCircle,
  TrendingUp,
  Globe,
  Bike,
  Ticket,
  Loader2,
} from "lucide-react";
import {
  SubscriptionPlan,
  SubscriptionPlanTier,
  TenantPlanLimits,
} from "@marketos/types";
import { changeTenantPlanAction } from "../app/platform/actions";

export interface PlanUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantName: string;
  tenantId: string;
  planLimits: TenantPlanLimits;
  quotaType?: "products" | "stores" | "coupons" | "drivers" | "custom_domain" | "general";
  isSuperAdmin?: boolean;
  onPlanChanged?: (newTier: SubscriptionPlanTier) => void;
  whatsappContact?: string;
}

export function PlanUpgradeModal({
  isOpen,
  onClose,
  tenantName,
  tenantId,
  planLimits,
  quotaType = "general",
  isSuperAdmin = false,
  onPlanChanged,
  whatsappContact,
}: PlanUpgradeModalProps) {
  const [upgradingTo, setUpgradingTo] = useState<SubscriptionPlanTier | null>(null);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);
  const [adminErrMsg, setAdminErrMsg] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentPlan = planLimits.plan;
  const isStarter = currentPlan.id === "STARTER";
  const isGrowth = currentPlan.id === "GROWTH";

  // Contextual copy based on quotaType
  let modalTitle = "Aumenta la Capacidad de tu Comercio";
  let modalBadge = "Límites del Plan SaaS";
  let modalDescription =
    "Tu negocio está creciendo. Pasa al siguiente nivel para desbloquear más productos, sucursales y herramientas avanzadas de venta.";

  if (quotaType === "products") {
    modalTitle = "Límite de Catálogo Alcanzado";
    modalBadge = "Límite de Productos 📦";
    modalDescription = `Has alcanzado el límite de ${currentPlan.max_products} productos de tu plan actual (${currentPlan.name}). Actualiza para agregar cientos de nuevos productos a tu catálogo.`;
  } else if (quotaType === "stores") {
    modalTitle = "Límite de Sucursales Alcanzado";
    modalBadge = "Límite de Sedes 🏬";
    modalDescription = `Has alcanzado el cupo de ${currentPlan.max_stores} sucursal(es) de tu plan actual (${currentPlan.name}). Pasa a Growth o Enterprise para expandirte con nuevas sedes de despacho.`;
  } else if (quotaType === "coupons") {
    modalTitle = "Módulo de Cupones y Promociones";
    modalBadge = "Funcionalidad Premium 🎟️";
    modalDescription =
      "Los cupones de descuento y promociones por tiempo limitado están disponibles en los planes Growth y Enterprise. Impulsa tus ventas hoy mismo.";
  } else if (quotaType === "drivers") {
    modalTitle = "Gestión de Repartidores Propios";
    modalBadge = "Funcionalidad Premium 🛵";
    modalDescription =
      "El módulo de asignación de motoristas, despacho en tiempo real y métricas de entrega requiere el plan Growth o Enterprise.";
  } else if (quotaType === "custom_domain") {
    modalTitle = "Dominio Web Personalizado";
    modalBadge = "Marca Propia 🌐";
    modalDescription =
      "Conectar tu propio dominio (ej. mitienda.com) está disponible en los planes Growth y Enterprise con certificados SSL automáticos.";
  }

  // Pre-filled WhatsApp message
  const targetPlanName = isStarter ? "MarketOS Growth ($49/mes)" : "MarketOS Enterprise ($99/mes)";
  const cleanPhone = (whatsappContact || "+584245919577").replace(/[^0-9]/g, "");
  const waText = encodeURIComponent(
    `Hola MarketOS, quiero solicitar un Upgrade de Plan para mi comercio "${tenantName}" (ID: ${tenantId}).\n\nPlan Actual: ${currentPlan.name}\nPlan Solicitado: ${targetPlanName}\nMotivo: ${modalTitle}.\n\n¿Podrían indicarme los métodos de pago (Pago Móvil, Zelle o USDT)? Muchas gracias.`
  );
  const waUrl = `https://wa.me/${cleanPhone}?text=${waText}`;

  // Direct upgrade for Super Admin
  const handleDirectUpgrade = async (tier: SubscriptionPlanTier) => {
    setUpgradingTo(tier);
    setAdminSuccessMsg(null);
    setAdminErrMsg(null);
    try {
      const res = await changeTenantPlanAction(tenantId, tier);
      if (res.success) {
        setAdminSuccessMsg(`¡Plan actualizado con éxito a ${tier}!`);
        if (onPlanChanged) onPlanChanged(tier);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setAdminErrMsg(res.error || "No se pudo actualizar el plan.");
      }
    } catch (err: any) {
      setAdminErrMsg(err.message || "Error al actualizar plan.");
    } finally {
      setUpgradingTo(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-950/75 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl p-5 sm:p-7 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-gradient-to-br from-primary/20 via-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Cerrar modal"
          className="absolute top-5 right-5 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-2 pr-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Zap className="w-3.5 h-3.5 fill-amber-500" />
            <span>{modalBadge}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            {modalTitle}
          </h2>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {modalDescription}
          </p>
        </div>

        {/* Current Plan & Quota Usage Banner */}
        <div className="mt-5 p-4 rounded-2xl bg-muted/50 border border-border space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Plan Actual:</span>
              <span className="font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary uppercase text-[11px] tracking-wider">
                {currentPlan.name}
              </span>
              <span className="text-muted-foreground">(${currentPlan.price_usd_monthly}/mes)</span>
            </div>
            <div className="text-muted-foreground">
              Comercio: <strong className="text-foreground">{tenantName}</strong>
            </div>
          </div>

          {/* Progress Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Products bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Boxes className="w-3 h-3 text-primary" />
                  Productos en catálogo:
                </span>
                <span className="font-bold text-foreground">
                  {planLimits.usage.productsCount} / {currentPlan.max_products}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    planLimits.productUsagePercent >= 100
                      ? "bg-rose-500"
                      : planLimits.productUsagePercent >= 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, planLimits.productUsagePercent)}%` }}
                />
              </div>
            </div>

            {/* Stores bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Building2 className="w-3 h-3 text-primary" />
                  Sucursales físicas:
                </span>
                <span className="font-bold text-foreground">
                  {planLimits.usage.storesCount} / {currentPlan.max_stores}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    planLimits.storeUsagePercent >= 100
                      ? "bg-rose-500"
                      : planLimits.storeUsagePercent >= 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, planLimits.storeUsagePercent)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Upgrade Tier Options */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Plan GROWTH */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
              isStarter
                ? "bg-gradient-to-b from-primary/10 via-card to-card border-primary/40 ring-2 ring-primary/20 shadow-md"
                : "bg-card border-border opacity-75"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-foreground flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    MarketOS Growth
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Para comercios con delivery y alto tráfico
                  </p>
                </div>
                {isStarter && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white font-black text-[10px] tracking-wider uppercase shadow-xs">
                    Recomendado
                  </span>
                )}
                {isGrowth && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold text-[10px]">
                    Plan Actual
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-foreground">$49</span>
                <span className="text-xs text-muted-foreground">/ mes</span>
              </div>

              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Hasta <strong>300 productos</strong> (5x más capacidad)</span>
                </li>
                <li className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Hasta <strong>3 sucursales</strong> físicas</span>
                </li>
                <li className="flex items-center gap-2 text-foreground font-medium">
                  <Bike className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Módulo de <strong>Repartidores & Zonas</strong></span>
                </li>
                <li className="flex items-center gap-2 text-foreground font-medium">
                  <Ticket className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Cupones y promociones automáticas</span>
                </li>
                <li className="flex items-center gap-2 text-foreground font-medium">
                  <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Dominio web personalizado</span>
                </li>
              </ul>
            </div>

            {/* CTA or Super Admin switch button */}
            {isSuperAdmin && !isGrowth ? (
              <button
                type="button"
                disabled={upgradingTo !== null}
                onClick={() => handleDirectUpgrade("GROWTH")}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {upgradingTo === "GROWTH" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Aplicando Plan Growth...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>(Admin) Cambiar a Growth Ya</span>
                  </>
                )}
              </button>
            ) : null}
          </div>

          {/* Plan ENTERPRISE */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
              isGrowth
                ? "bg-gradient-to-b from-purple-500/10 via-card to-card border-purple-500/40 ring-2 ring-purple-500/20 shadow-md"
                : "bg-card border-border"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-foreground flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-purple-500" />
                    MarketOS Enterprise
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Para cadenas, franquicias y supermercados
                  </p>
                </div>
                {isGrowth && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white font-black text-[10px] tracking-wider uppercase shadow-xs">
                    Recomendado
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-foreground">$99</span>
                <span className="text-xs text-muted-foreground">/ mes</span>
              </div>

              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>Hasta <strong>2,000 productos</strong> / sin límites</span>
                </li>
                <li className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>Hasta <strong>10 sucursales</strong> simultáneas</span>
                </li>
                <li className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>Roles avanzados & multi-cajero POS</span>
                </li>
                <li className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>Facturación fiscal SENIAT & ERP</span>
                </li>
                <li className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>Soporte prioritario 24/7 en WhatsApp</span>
                </li>
              </ul>
            </div>

            {/* CTA or Super Admin switch button */}
            {isSuperAdmin && currentPlan.id !== "ENTERPRISE" ? (
              <button
                type="button"
                disabled={upgradingTo !== null}
                onClick={() => handleDirectUpgrade("ENTERPRISE")}
                className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {upgradingTo === "ENTERPRISE" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Aplicando Enterprise...</span>
                  </>
                ) : (
                  <>
                    <Crown className="w-3.5 h-3.5" />
                    <span>(Admin) Cambiar a Enterprise Ya</span>
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>

        {/* Super admin alert feedback */}
        {adminSuccessMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold text-center">
            {adminSuccessMsg}
          </div>
        )}
        {adminErrMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-bold text-center">
            {adminErrMsg}
          </div>
        )}

        {/* Action Footer */}
        <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors cursor-pointer"
          >
            Tal vez más tarde
          </button>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Solicitar Upgrade vía WhatsApp</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
