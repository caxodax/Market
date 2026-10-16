"use client";

import React, { useState, useTransition } from "react";
import {
  PlatformBiAnalytics,
  PlatformBiAnalyticsFilter,
  TenantGmvRankingItem,
  ConsolidatedPaymentMethodStat,
  PaymentMethodType,
  DeliveryZoneRankingItem,
} from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import { getPlatformBiAnalyticsAction } from "../app/platform/actions";
import {
  TrendingUp,
  DollarSign,
  Receipt,
  ShoppingBag,
  Building2,
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Smartphone,
  CreditCard,
  Banknote,
  Coins,
  Landmark,
  ArrowUpRight,
  Sparkles,
  Trophy,
  Medal,
  RefreshCw,
  Copy,
  Check,
  Percent,
  Bike,
  Store,
  MapPin,
  Filter,
  Flame,
  X,
  Navigation,
} from "lucide-react";

interface PlatformBiAnalyticsTabProps {
  initialAnalytics?: PlatformBiAnalytics;
}

const DEFAULT_ANALYTICS: PlatformBiAnalytics = {
  dateRange: "all",
  exchangeRate: 52.5,
  appliedDeliveryType: "ALL",
  appliedZoneId: "ALL",
  totalNetworkGmvUsd: 0,
  totalNetworkGmvVes: 0,
  networkAverageTicketUsd: 0,
  networkAverageTicketVes: 0,
  totalNetworkOrders: 0,
  completedOrdersCount: 0,
  pendingOrdersCount: 0,
  cancelledOrdersCount: 0,
  orderSuccessRatePercent: 0,
  activeTenantsCount: 0,
  sellingTenantsCount: 0,
  deliveryBreakdown: {
    deliveryOrdersCount: 0,
    deliveryGmvUsd: 0,
    deliveryGmvVes: 0,
    deliverySharePercent: 0,
    deliveryAverageTicketUsd: 0,
    totalDeliveryFeesUsd: 0,
    totalDeliveryFeesVes: 0,
    pickupOrdersCount: 0,
    pickupGmvUsd: 0,
    pickupGmvVes: 0,
    pickupSharePercent: 0,
    pickupAverageTicketUsd: 0,
  },
  deliveryZoneRankings: [],
  availableDeliveryZones: [],
  tenantRankings: [],
  paymentMethodsConsolidated: [],
  dailyTrend: [],
};

export function PlatformBiAnalyticsTab({
  initialAnalytics,
}: PlatformBiAnalyticsTabProps) {
  const [analytics, setAnalytics] = useState<PlatformBiAnalytics>(
    initialAnalytics || DEFAULT_ANALYTICS
  );
  const [selectedRange, setSelectedRange] = useState<"today" | "week" | "month" | "all">(
    initialAnalytics?.dateRange || "all"
  );
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<"ALL" | "DELIVERY" | "PICKUP">(
    initialAnalytics?.appliedDeliveryType || "ALL"
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string | "ALL">(
    initialAnalytics?.appliedZoneId || "ALL"
  );
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Core fetch function
  const fetchFilteredAnalytics = (
    range: "today" | "week" | "month" | "all",
    deliveryType: "ALL" | "DELIVERY" | "PICKUP",
    zoneId: string | "ALL"
  ) => {
    startTransition(async () => {
      const filter: PlatformBiAnalyticsFilter = {
        dateRange: range,
        deliveryType,
        deliveryZoneId: zoneId,
      };
      const res = await getPlatformBiAnalyticsAction(filter);
      if (res.success && res.analytics) {
        setAnalytics(res.analytics);
      }
    });
  };

  React.useEffect(() => {
    if (!initialAnalytics) {
      fetchFilteredAnalytics("all", "ALL", "ALL");
    }
  }, [initialAnalytics]);

  const handleRangeChange = (range: "today" | "week" | "month" | "all") => {
    setSelectedRange(range);
    fetchFilteredAnalytics(range, selectedDeliveryType, selectedZoneId);
  };

  const handleDeliveryTypeChange = (type: "ALL" | "DELIVERY" | "PICKUP") => {
    setSelectedDeliveryType(type);
    // If switching to pickup, reset zone selection since pickup does not have a delivery zone
    const nextZone = type === "PICKUP" ? "ALL" : selectedZoneId;
    if (type === "PICKUP") {
      setSelectedZoneId("ALL");
    }
    fetchFilteredAnalytics(selectedRange, type, nextZone);
  };

  const handleZoneChange = (zoneId: string | "ALL") => {
    setSelectedZoneId(zoneId);
    // If selecting a specific zone, ensure delivery type is set to DELIVERY
    const nextDeliveryType = zoneId !== "ALL" ? "DELIVERY" : selectedDeliveryType;
    if (zoneId !== "ALL") {
      setSelectedDeliveryType("DELIVERY");
    }
    fetchFilteredAnalytics(selectedRange, nextDeliveryType, zoneId);
  };

  const handleClearFulfillmentFilters = () => {
    setSelectedDeliveryType("ALL");
    setSelectedZoneId("ALL");
    fetchFilteredAnalytics(selectedRange, "ALL", "ALL");
  };

  // Copy Executive Summary to clipboard
  const handleCopySummary = () => {
    const delivery = analytics.deliveryBreakdown;
    const topZones = (analytics.deliveryZoneRankings || []).slice(0, 3);

    const summaryText = `📊 MARKETOS BI EXECUTIVE SUMMARY (${selectedRange.toUpperCase()})
• GMV Total Red: $${analytics.totalNetworkGmvUsd.toLocaleString("es-VE", { minimumFractionDigits: 2 })} USD (${formatCurrency(analytics.totalNetworkGmvVes, "VES")})
• Ticket Promedio Global (AOV): $${analytics.networkAverageTicketUsd} USD (${formatCurrency(analytics.networkAverageTicketVes, "VES")})
• Pedidos Totales: ${analytics.totalNetworkOrders} (${analytics.completedOrdersCount} completados, ${analytics.cancelledOrdersCount} cancelados)
• Tasa de Éxito: ${analytics.orderSuccessRatePercent}%
• Comercios Transaccionando: ${analytics.sellingTenantsCount} de ${analytics.activeTenantsCount}

🛵 LOGÍSTICA & DESPACHO:
• Envío a Domicilio: ${delivery?.deliveryOrdersCount ?? 0} pedidos (${delivery?.deliverySharePercent ?? 0}%) • GMV: $${delivery?.deliveryGmvUsd ?? 0} USD • Ticket Prom.: $${delivery?.deliveryAverageTicketUsd ?? 0} USD
• Retiro en Tienda: ${delivery?.pickupOrdersCount ?? 0} pedidos (${delivery?.pickupSharePercent ?? 0}%) • GMV: $${delivery?.pickupGmvUsd ?? 0} USD • Ticket Prom.: $${delivery?.pickupAverageTicketUsd ?? 0} USD
• Fletes Delivery Recaudados: $${delivery?.totalDeliveryFeesUsd ?? 0} USD (${formatCurrency(delivery?.totalDeliveryFeesVes ?? 0, "VES")})

${topZones.length > 0 ? `📍 TOP ZONAS DE DELIVERY CON MAYOR DEMANDA:
${topZones
  .map(
    (z, i) =>
      `${i + 1}. ${z.zoneName} (${z.tenantName}): ${z.ordersCount} pedidos ($${z.gmvUsd} USD, ${z.sharePercent}% de envíos) - Tarifa Prom.: $${z.averageDeliveryFeeUsd} USD`
  )
  .join("\n")}
` : ""}
🏆 TOP TIENDAS:
${analytics.tenantRankings
  .slice(0, 3)
  .map(
    (t, i) =>
      `${i + 1}. ${t.tenantName}: $${t.gmvUsd} USD (${t.sharePercent}% cuota) - AOV: $${t.averageTicketUsd}`
  )
  .join("\n")}

💳 DESGLOSE MÉTODOS DE PAGO:
${analytics.paymentMethodsConsolidated
  .map((m) => `• ${m.label}: $${m.totalUsd} USD (${m.sharePercent}% | ${m.transactionCount} txs)`)
  .join("\n")}`;

    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  // Filter rankings by search
  const filteredRankings = analytics.tenantRankings.filter(
    (t) =>
      t.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tenantSlug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper for Payment Method Icons and Colors
  const getMethodDesign = (method: PaymentMethodType) => {
    switch (method) {
      case "PAGO_MOVIL":
        return {
          icon: <Smartphone className="w-5 h-5 text-indigo-400" />,
          colorBg: "bg-indigo-500/10 border-indigo-500/20",
          barColor: "bg-indigo-500",
          textBadge: "text-indigo-400",
        };
      case "ZELLE":
        return {
          icon: <DollarSign className="w-5 h-5 text-purple-400" />,
          colorBg: "bg-purple-500/10 border-purple-500/20",
          barColor: "bg-purple-500",
          textBadge: "text-purple-400",
        };
      case "BINANCE":
      case "BINANCE_PAY":
        return {
          icon: <Coins className="w-5 h-5 text-amber-400" />,
          colorBg: "bg-amber-500/10 border-amber-500/20",
          barColor: "bg-amber-500",
          textBadge: "text-amber-400",
        };
      case "CASH_USD":
        return {
          icon: <Banknote className="w-5 h-5 text-emerald-400" />,
          colorBg: "bg-emerald-500/10 border-emerald-500/20",
          barColor: "bg-emerald-500",
          textBadge: "text-emerald-400",
        };
      case "CASH_VES":
        return {
          icon: <Banknote className="w-5 h-5 text-teal-400" />,
          colorBg: "bg-teal-500/10 border-teal-500/20",
          barColor: "bg-teal-500",
          textBadge: "text-teal-400",
        };
      case "POS":
        return {
          icon: <CreditCard className="w-5 h-5 text-sky-400" />,
          colorBg: "bg-sky-500/10 border-sky-500/20",
          barColor: "bg-sky-500",
          textBadge: "text-sky-400",
        };
      case "BANK_TRANSFER":
        return {
          icon: <Landmark className="w-5 h-5 text-slate-400" />,
          colorBg: "bg-slate-500/10 border-slate-500/20",
          barColor: "bg-slate-400",
          textBadge: "text-slate-300",
        };
      default:
        return {
          icon: <CreditCard className="w-5 h-5 text-muted-foreground" />,
          colorBg: "bg-muted/30 border-border",
          barColor: "bg-muted-foreground",
          textBadge: "text-muted-foreground",
        };
    }
  };

  // Find max daily GMV for proportional trend chart
  const maxDailyGmv = Math.max(
    ...analytics.dailyTrend.map((d) => d.totalUsd),
    10
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ────────────────────────────────────────────────────────── */}
      {/* TOP CONTROLS & RANGE SELECTOR */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              Inteligencia de Negocios & Métricas Globales
              <span className="text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                BI Analytics
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Consolidación en tiempo real de volumen de ventas (GMV), ticket promedio y métodos de pago
            </p>
          </div>
        </div>

        {/* Date Filter Pills & Refresh */}
        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border">
            <button
              onClick={() => handleRangeChange("today")}
              disabled={isPending}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedRange === "today"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => handleRangeChange("week")}
              disabled={isPending}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedRange === "week"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              7 Días
            </button>
            <button
              onClick={() => handleRangeChange("month")}
              disabled={isPending}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedRange === "month"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              30 Días
            </button>
            <button
              onClick={() => handleRangeChange("all")}
              disabled={isPending}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedRange === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Histórico
            </button>
          </div>

          {/* Copy Summary Button */}
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-all cursor-pointer"
            title="Copiar resumen ejecutivo para WhatsApp o reporte"
          >
            {copiedSummary ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Resumen</span>
              </>
            )}
          </button>

          {/* Loading Indicator */}
          {isPending && (
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Calculando...</span>
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SECONDARY FILTER BAR: MODALIDAD DE ENTREGA Y ZONAS */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Fulfillment Method Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full md:w-auto">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-primary" />
            Modalidad:
          </span>
          <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border flex-wrap gap-1">
            <button
              onClick={() => handleDeliveryTypeChange("ALL")}
              disabled={isPending}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedDeliveryType === "ALL"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>📦 Todos</span>
              <span className="text-[10px] opacity-80">
                ({(analytics.deliveryBreakdown?.deliveryOrdersCount ?? 0) + (analytics.deliveryBreakdown?.pickupOrdersCount ?? 0)})
              </span>
            </button>
            <button
              onClick={() => handleDeliveryTypeChange("DELIVERY")}
              disabled={isPending}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedDeliveryType === "DELIVERY"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Solo Delivery</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-white font-bold">
                {analytics.deliveryBreakdown?.deliveryOrdersCount ?? 0}
              </span>
            </button>
            <button
              onClick={() => handleDeliveryTypeChange("PICKUP")}
              disabled={isPending}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedDeliveryType === "PICKUP"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Solo Retiro</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-white font-bold">
                {analytics.deliveryBreakdown?.pickupOrdersCount ?? 0}
              </span>
            </button>
          </div>
        </div>

        {/* Custom Delivery Zone Filter Dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 shrink-0">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            Zona:
          </span>
          <div className="relative flex-1 md:w-64">
            <select
              value={selectedZoneId}
              onChange={(e) => handleZoneChange(e.target.value)}
              disabled={isPending || selectedDeliveryType === "PICKUP"}
              className="w-full pl-3 pr-8 py-1.5 text-xs bg-muted/60 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed appearance-none cursor-pointer"
            >
              <option value="ALL">
                🌐 Todas las Zonas ({analytics.deliveryBreakdown?.deliveryOrdersCount ?? 0} envíos)
              </option>
              {(analytics.availableDeliveryZones || []).map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} {zone.tenantName ? `(${zone.tenantName})` : ""} {typeof zone.ordersCount === "number" ? `• ${zone.ordersCount} ped.` : ""}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
              ▼
            </div>
          </div>

          {(selectedDeliveryType !== "ALL" || selectedZoneId !== "ALL") && (
            <button
              onClick={handleClearFulfillmentFilters}
              disabled={isPending}
              className="p-1.5 text-xs font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
              title="Restablecer filtros de despacho y zona"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restablecer</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Notice Badge */}
      {(selectedDeliveryType !== "ALL" || selectedZoneId !== "ALL") && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-3 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>
              Filtro Activo:{" "}
              <strong>
                {selectedDeliveryType === "DELIVERY"
                  ? "Solo Envíos a Domicilio (Delivery)"
                  : selectedDeliveryType === "PICKUP"
                  ? "Solo Retiros en Tienda (Pickup)"
                  : "Todos los tipos"}
              </strong>
              {selectedZoneId !== "ALL" && (
                <>
                  {" "}
                  en zona{" "}
                  <strong>
                    {analytics.availableDeliveryZones?.find((z) => z.id === selectedZoneId)?.name ||
                      selectedZoneId}
                  </strong>
                </>
              )}
              . Todos los KPIs, volumen de ventas y rankings reflejan únicamente este segmento.
            </span>
          </div>
          <button
            onClick={handleClearFulfillmentFilters}
            className="text-[11px] font-bold text-primary hover:underline shrink-0 cursor-pointer"
          >
            Quitar Filtro
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* GLOBAL NETWORK KPIS STRIP */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: GMV TOTAL RED */}
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              GMV Total de la Red
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-foreground tracking-tight">
              ${analytics.totalNetworkGmvUsd.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs font-semibold text-emerald-400 mt-0.5">
              {formatCurrency(analytics.totalNetworkGmvVes, "VES")}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Facturación de comercios</span>
            <span className="font-semibold text-foreground">Tasa BCV: {analytics.exchangeRate.toFixed(2)}</span>
          </div>
        </div>

        {/* KPI 2: TICKET PROMEDIO GLOBAL (AOV) */}
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ticket Promedio Global
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-foreground tracking-tight">
              ${analytics.networkAverageTicketUsd.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs font-semibold text-blue-400 mt-0.5">
              {formatCurrency(analytics.networkAverageTicketVes, "VES")}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Gasto medio por pedido</span>
            <span className="font-semibold text-foreground">AOV Red</span>
          </div>
        </div>

        {/* KPI 3: PEDIDOS Y TASA DE ÉXITO */}
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pedidos & Tasa de Éxito
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-foreground tracking-tight flex items-baseline gap-2">
              <span>{analytics.totalNetworkOrders}</span>
              <span className="text-xs font-normal text-muted-foreground">pedidos</span>
            </div>
            <div className="text-xs font-semibold text-purple-400 mt-0.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{analytics.orderSuccessRatePercent}% de efectividad</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{analytics.completedOrdersCount} completados</span>
            <span className="text-rose-400 font-medium">{analytics.cancelledOrdersCount} cancelados</span>
          </div>
        </div>

        {/* KPI 4: COMERCIOS ACTIVOS & VENTAS */}
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Comercios Transaccionando
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-foreground tracking-tight flex items-baseline gap-2">
              <span>{analytics.sellingTenantsCount}</span>
              <span className="text-sm font-normal text-muted-foreground">/ {analytics.activeTenantsCount}</span>
            </div>
            <div className="text-xs font-semibold text-amber-400 mt-0.5">
              {analytics.activeTenantsCount > 0
                ? `${Math.round((analytics.sellingTenantsCount / analytics.activeTenantsCount) * 100)}% de la red vendiendo`
                : "Sin comercios"}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Comercios activos</span>
            <span className="font-semibold text-foreground">SaaS Network</span>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* FULFILLMENT BREAKDOWN: RETIRO EN TIENDA VS DELIVERY */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">
                Desglose Logístico: Retiro en Tienda vs Envío a Domicilio
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparativa de volumen de pedidos, cuota de mercado, ticket promedio (AOV) y recaudación de fletes
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Fletes Totales:</span>
            <span className="font-bold text-foreground bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg">
              ${(analytics.deliveryBreakdown?.totalDeliveryFeesUsd ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })} USD ({formatCurrency(analytics.deliveryBreakdown?.totalDeliveryFeesVes ?? 0, "VES")})
            </span>
          </div>
        </div>

        {/* Proportional Split Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-sky-400 flex items-center gap-1.5">
              <Bike className="w-3.5 h-3.5" />
              Delivery: {analytics.deliveryBreakdown?.deliverySharePercent ?? 0}% ({analytics.deliveryBreakdown?.deliveryOrdersCount ?? 0} pedidos)
            </span>
            <span className="text-emerald-400 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5" />
              Retiro en Tienda: {analytics.deliveryBreakdown?.pickupSharePercent ?? 0}% ({analytics.deliveryBreakdown?.pickupOrdersCount ?? 0} pedidos)
            </span>
          </div>
          <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden flex shadow-inner">
            <div
              className="h-full bg-sky-500 transition-all duration-500"
              style={{ width: `${analytics.deliveryBreakdown?.deliverySharePercent ?? 50}%` }}
              title={`Delivery: ${analytics.deliveryBreakdown?.deliverySharePercent ?? 0}%`}
            />
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${analytics.deliveryBreakdown?.pickupSharePercent ?? 50}%` }}
              title={`Retiro en Tienda: ${analytics.deliveryBreakdown?.pickupSharePercent ?? 0}%`}
            />
          </div>
        </div>

        {/* Two Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Card 1: Delivery */}
          <div
            onClick={() => handleDeliveryTypeChange(selectedDeliveryType === "DELIVERY" ? "ALL" : "DELIVERY")}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedDeliveryType === "DELIVERY"
                ? "bg-sky-500/10 border-sky-500/40 shadow-sm"
                : "bg-muted/20 border-border hover:border-sky-500/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    Envíos a Domicilio (Delivery)
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    Despacho con motorizado o repartidor
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedDeliveryType === "DELIVERY"
                    ? "bg-sky-500 text-black"
                    : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                }`}
              >
                {selectedDeliveryType === "DELIVERY" ? "Filtro Activo" : "Filtrar"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/40">
              <div>
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Pedidos</span>
                <div className="text-lg font-black text-foreground">
                  {analytics.deliveryBreakdown?.deliveryOrdersCount ?? 0}
                </div>
                <div className="text-[10px] text-sky-400 font-semibold">
                  {analytics.deliveryBreakdown?.deliverySharePercent ?? 0}% cuota
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Ventas (GMV)</span>
                <div className="text-lg font-black text-foreground">
                  ${(analytics.deliveryBreakdown?.deliveryGmvUsd ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold">
                  {formatCurrency(analytics.deliveryBreakdown?.deliveryGmvVes ?? 0, "VES")}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Ticket Prom.</span>
                <div className="text-lg font-black text-foreground">
                  ${analytics.deliveryBreakdown?.deliveryAverageTicketUsd ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground font-medium">
                  Fletes: ${analytics.deliveryBreakdown?.totalDeliveryFeesUsd ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Retiro en Tienda */}
          <div
            onClick={() => handleDeliveryTypeChange(selectedDeliveryType === "PICKUP" ? "ALL" : "PICKUP")}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedDeliveryType === "PICKUP"
                ? "bg-emerald-500/10 border-emerald-500/40 shadow-sm"
                : "bg-muted/20 border-border hover:border-emerald-500/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    Retiro en Tienda (Pick-up)
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    Cliente retira directamente en sucursal
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedDeliveryType === "PICKUP"
                    ? "bg-emerald-500 text-black"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {selectedDeliveryType === "PICKUP" ? "Filtro Activo" : "Filtrar"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/40">
              <div>
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Pedidos</span>
                <div className="text-lg font-black text-foreground">
                  {analytics.deliveryBreakdown?.pickupOrdersCount ?? 0}
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold">
                  {analytics.deliveryBreakdown?.pickupSharePercent ?? 0}% cuota
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Ventas (GMV)</span>
                <div className="text-lg font-black text-foreground">
                  ${(analytics.deliveryBreakdown?.pickupGmvUsd ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold">
                  {formatCurrency(analytics.deliveryBreakdown?.pickupGmvVes ?? 0, "VES")}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Ticket Prom.</span>
                <div className="text-lg font-black text-foreground">
                  ${analytics.deliveryBreakdown?.pickupAverageTicketUsd ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground font-medium">
                  $0.00 fletes logísticos
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2-COLUMN SECTION: RANKING DE TIENDAS + MÉTODOS DE PAGO */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ────────────────────────────────────────────────────────── */}
        {/* PILLAR 1: RANKING DE TIENDAS POR VOLUMEN DE VENTAS (GMV) */}
        {/* ────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-7 bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-foreground">
                  Ranking de Tiendas por GMV
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Leaderboard ordenado por ventas brutas acumuladas y cuota de mercado
              </p>
            </div>

            {/* Quick search inside leaderboard */}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filtrar tienda..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {filteredRankings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              No se encontraron comercios con los criterios seleccionados.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRankings.map((tenant, index) => {
                const isTop1 = index === 0 && tenant.gmvUsd > 0;
                const isTop2 = index === 1 && tenant.gmvUsd > 0;
                const isTop3 = index === 2 && tenant.gmvUsd > 0;

                return (
                  <div
                    key={tenant.tenantId}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isTop1
                        ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50"
                        : isTop2
                        ? "bg-slate-400/5 border-slate-400/30 hover:border-slate-400/50"
                        : isTop3
                        ? "bg-amber-700/5 border-amber-700/30 hover:border-amber-700/50"
                        : "bg-muted/20 border-border hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Position Badge & Tenant Identity */}
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Position Badge */}
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                            isTop1
                              ? "bg-amber-500 text-black shadow-sm"
                              : isTop2
                              ? "bg-slate-300 text-black shadow-sm"
                              : isTop3
                              ? "bg-amber-700 text-white shadow-sm"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {index + 1}
                        </div>

                        {/* Tenant Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground truncate">
                              {tenant.tenantName}
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50 shrink-0">
                              {tenant.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span>/{tenant.tenantSlug}</span>
                            <span>•</span>
                            <span className="font-medium text-foreground">
                              {tenant.completedOrders} pedidos
                            </span>
                            <span>•</span>
                            <span>
                              Ticket Prom.: <strong className="text-foreground">${tenant.averageTicketUsd}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: GMV & Cuota */}
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-foreground">
                          ${tenant.gmvUsd.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] font-semibold text-emerald-400">
                          {formatCurrency(tenant.gmvVes, "VES")}
                        </div>
                      </div>
                    </div>

                    {/* Market Share Progress Bar */}
                    <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center gap-2.5">
                      <div className="flex-1 bg-muted/60 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isTop1
                              ? "bg-amber-500"
                              : isTop2
                              ? "bg-slate-300"
                              : isTop3
                              ? "bg-amber-700"
                              : "bg-primary"
                          }`}
                          style={{ width: `${Math.max(tenant.sharePercent, 1)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-muted-foreground shrink-0 w-12 text-right">
                        {tenant.sharePercent}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ────────────────────────────────────────────────────────── */}
        {/* PILLAR 3: DESGLOSE CONSOLIDADO DE MÉTODOS DE PAGO */}
        {/* ────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-5 bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">
                Métodos de Pago Más Usados
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Desglose consolidado de la red: Pago Móvil vs Zelle vs Efectivo vs Binance
            </p>
          </div>

          {/* Segmented Stacked Bar representing relative method volume */}
          {analytics.paymentMethodsConsolidated.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Distribución del volumen</span>
                <span>100% de recaudación</span>
              </div>
              <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden flex shadow-inner">
                {analytics.paymentMethodsConsolidated.map((m) => {
                  const design = getMethodDesign(m.method);
                  return (
                    <div
                      key={m.method}
                      className={`h-full transition-all duration-500 ${design.barColor}`}
                      style={{ width: `${m.sharePercent}%` }}
                      title={`${m.label}: ${m.sharePercent}% ($${m.totalUsd})`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Methods Breakdown List */}
          <div className="space-y-2.5">
            {analytics.paymentMethodsConsolidated.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs">
                No hay transacciones registradas en este período.
              </div>
            ) : (
              analytics.paymentMethodsConsolidated.map((method) => {
                const design = getMethodDesign(method.method);

                return (
                  <div
                    key={method.method}
                    className="p-3 rounded-xl bg-muted/20 border border-border flex items-center justify-between gap-3 hover:border-border/80 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${design.colorBg}`}
                      >
                        {design.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">
                          {method.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {method.transactionCount} transacciones • Ticket Prom.:{" "}
                          <strong className="text-foreground">${method.averageTicketUsd}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-foreground">
                        ${method.totalUsd.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] font-bold text-primary">
                        {method.sharePercent}% del GMV
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Helper Note for Multi-currency Market */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 text-[11px] text-muted-foreground leading-relaxed">
            💡 <strong className="text-foreground">Inteligencia Cambiaria:</strong> Las transacciones en Bolívares
            (Pago Móvil, POS, Efectivo VES) son convertidas automáticamente a USD usando la tasa oficial del BCV
            vigente al momento de cada operación para un análisis consolidado preciso.
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* PILLAR: LEADERBOARD DE ZONAS DE MAYOR DEMANDA DE DELIVERY */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-foreground">
                Zonas de Mayor Demanda de Delivery
              </h3>
              <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                {analytics.deliveryZoneRankings?.length ?? 0} Zonas Activas
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ranking de zonas geográficas con mayor recurrencia de pedidos a domicilio y facturación
            </p>
          </div>
          {selectedZoneId !== "ALL" && (
            <button
              onClick={() => handleZoneChange("ALL")}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Quitar filtro de zona
            </button>
          )}
        </div>

        {(!analytics.deliveryZoneRankings || analytics.deliveryZoneRankings.length === 0) ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No hay pedidos con zonas de delivery registradas en este período.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {analytics.deliveryZoneRankings.map((zone, idx) => {
              const isSelected = selectedZoneId === zone.zoneId;
              const isTop1 = idx === 0;
              const isTop2 = idx === 1;
              const isTop3 = idx === 2;

              return (
                <div
                  key={zone.zoneId}
                  onClick={() => handleZoneChange(isSelected ? "ALL" : zone.zoneId)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-primary/10 border-primary ring-1 ring-primary shadow-sm"
                      : isTop1
                      ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60"
                      : isTop2
                      ? "bg-slate-400/5 border-slate-400/30 hover:border-slate-400/60"
                      : isTop3
                      ? "bg-amber-700/5 border-amber-700/30 hover:border-amber-700/60"
                      : "bg-muted/20 border-border hover:border-border/80"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-[11px] shrink-0 ${
                            isTop1
                              ? "bg-amber-500 text-black"
                              : isTop2
                              ? "bg-slate-300 text-black"
                              : isTop3
                              ? "bg-amber-700 text-white"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          #{idx + 1}
                        </div>
                        <div className="font-bold text-xs text-foreground truncate">
                          {zone.zoneName}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground border border-border/50"
                        }`}
                      >
                        {isSelected ? "Activo" : "Filtrar"}
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground mt-1 truncate">
                      {zone.tenantName}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-border/40 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Pedidos:</span>
                      <span className="font-bold text-foreground">
                        {zone.ordersCount}{" "}
                        <span className="text-[10px] text-sky-400 font-semibold">
                          ({zone.sharePercent}%)
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">GMV Zona:</span>
                      <span className="font-black text-foreground">
                        ${zone.gmvUsd.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Tarifa Prom.:</span>
                      <span className="font-semibold text-emerald-400">
                        ${zone.averageDeliveryFeeUsd} USD
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* DAILY SALES & ORDER TREND CHART */}
      {/* ────────────────────────────────────────────────────────── */}
      {analytics.dailyTrend.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Evolución Diaria de Ventas
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Volumen cronológico de facturación (USD) y cantidad de pedidos diarios
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {analytics.dailyTrend.length} días con actividad
            </span>
          </div>

          {/* Bar Chart Container */}
          <div className="pt-4 pb-2">
            <div className="flex items-end gap-3 h-36 overflow-x-auto pb-2 px-1">
              {analytics.dailyTrend.map((day) => {
                const heightPercent = Math.max(
                  Math.round((day.totalUsd / maxDailyGmv) * 100),
                  8
                );

                return (
                  <div
                    key={day.date}
                    className="flex flex-col items-center gap-2 min-w-[54px] flex-1 group cursor-pointer"
                  >
                    {/* Tooltip on hover */}
                    <div className="text-[10px] font-bold text-foreground opacity-75 group-hover:opacity-100 transition-opacity">
                      ${Math.round(day.totalUsd)}
                    </div>

                    {/* Bar */}
                    <div className="w-full bg-muted/40 rounded-lg h-24 flex items-end p-1">
                      <div
                        className="w-full bg-primary/80 group-hover:bg-primary rounded-md transition-all duration-300"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>

                    {/* Label & Order count */}
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-foreground">
                        {day.label}
                      </div>
                      <div className="text-[9px] text-muted-foreground font-medium">
                        {day.orderCount} ped.
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
