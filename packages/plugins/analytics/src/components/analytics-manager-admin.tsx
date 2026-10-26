"use client";

import React, { useState } from "react";
import type { AnalyticsSummary, AnalyticsTimeRange } from "@marketos/types";
import {
  TrendingUp,
  Eye,
  Users,
  ShoppingBag,
  Share2,
  ExternalLink,
  Calendar,
  Sparkles,
  MessageCircle,
  Search,
  Globe,
  Radio,
  ArrowUpRight,
  Copy,
  Check,
} from "lucide-react";

interface AnalyticsManagerAdminProps {
  initialSummary?: AnalyticsSummary | null;
  tenantSlug?: string;
  storeUrl?: string;
  onRefresh?: (days: AnalyticsTimeRange) => Promise<void> | void;
  isLoading?: boolean;
}

export function AnalyticsManagerAdmin({
  initialSummary,
  tenantSlug,
  storeUrl,
  onRefresh,
  isLoading = false,
}: AnalyticsManagerAdminProps) {
  const [selectedRange, setSelectedRange] = useState<AnalyticsTimeRange>(
    initialSummary?.timeRangeDays || 30
  );
  const [chartMode, setChartMode] = useState<"views" | "visitors">("views");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const summary = initialSummary || {
    timeRangeDays: selectedRange,
    totalViews: 0,
    uniqueVisitors: 0,
    dailyAverageViews: 0,
    completedOrdersCount: 0,
    conversionRatePercent: 0,
    topSource: "Tráfico Directo",
    trendData: [],
    topPages: [],
    sources: [],
  };

  const handleRangeChange = (days: AnalyticsTimeRange) => {
    setSelectedRange(days);
    if (onRefresh) {
      onRefresh(days);
    }
  };

  const copyStoreUrl = () => {
    const url = storeUrl || (typeof window !== "undefined" ? window.location.origin : "");
    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const trendData = summary.trendData || [];
  const maxMetricValue = Math.max(
    1,
    ...trendData.map((d) => (chartMode === "views" ? d.views : d.visitors))
  );

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "whatsapp":
        return <MessageCircle className="w-4 h-4 text-emerald-500" />;
      case "instagram":
        return (
          <svg className="w-4 h-4 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
          </svg>
        );
      case "facebook":
        return (
          <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
          </svg>
        );
      case "google":
        return <Search className="w-4 h-4 text-amber-500" />;
      default:
        return <Globe className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "Portada":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "Catálogo":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "Producto":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "Checkout":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "Cuenta":
        return "bg-slate-500/10 text-slate-600 border-slate-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ─── 1. HEADER SECTION ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-card border border-border rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Métricas Activas
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              • Analytics Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-primary" />
            Rendimiento & Tráfico de Tienda
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comportamiento de audiencia en vivo, páginas con mayor interés y canales de captación.
          </p>
        </div>

        {/* Range Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-muted/70 p-1 rounded-xl border border-border">
            {([7, 14, 30, 90] as AnalyticsTimeRange[]).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => handleRangeChange(days)}
                disabled={isLoading}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  selectedRange === days
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {days}D
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={copyStoreUrl}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer"
            title="Copiar enlace de la tienda"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                Copiar Enlace
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── 2. KPI METRIC CARDS ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Views */}
        <div className="p-5 bg-card border border-border rounded-2xl shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Total Visitas
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-foreground font-mono">
              {summary.totalViews.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <span className="font-semibold text-foreground font-mono">
              {summary.dailyAverageViews}
            </span>{" "}
            promedio por día
          </p>
        </div>

        {/* Card 2: Unique Visitors */}
        <div className="p-5 bg-card border border-border rounded-2xl shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Visitantes Únicos
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-foreground font-mono">
              {summary.uniqueVisitors.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sesiones de navegación distintas
          </p>
        </div>

        {/* Card 3: Conversion Rate */}
        <div className="p-5 bg-card border border-border rounded-2xl shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Tasa de Conversión
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-emerald-600 font-mono">
              {summary.conversionRatePercent}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.completedOrdersCount} pedidos completados
          </p>
        </div>

        {/* Card 4: Top Channel */}
        <div className="p-5 bg-card border border-border rounded-2xl shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Canal Líder
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 truncate">
            <span className="text-xl font-black tracking-tight text-foreground truncate block">
              {summary.topSource}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Mayor volumen de captación
          </p>
        </div>
      </div>

      {/* ─── 3. INTERACTIVE TREND CHART ─────────────────────────── */}
      <div className="p-6 bg-card border border-border rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Tendencia de Tráfico Diario
            </h2>
            <p className="text-xs text-muted-foreground">
              Evolución en los últimos {selectedRange} días calendario.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartMode("views")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                chartMode === "views"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Vistas
            </button>
            <button
              type="button"
              onClick={() => setChartMode("visitors")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                chartMode === "visitors"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Visitantes
            </button>
          </div>
        </div>

        {/* Chart Container */}
        {trendData.length > 0 && summary.totalViews > 0 ? (
          <div className="relative pt-6 pb-2">
            {/* Tooltip display on hover */}
            <div className="h-6 mb-2">
              {hoveredIndex !== null && trendData[hoveredIndex] ? (
                <div className="text-xs font-bold text-foreground flex items-center gap-2 animate-fade-in">
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                    {trendData[hoveredIndex].dayLabel}
                  </span>
                  <span className="font-mono">
                    {chartMode === "views"
                      ? `${trendData[hoveredIndex].views} vistas`
                      : `${trendData[hoveredIndex].visitors} visitantes únicos`}
                  </span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Pasa el cursor sobre una columna para ver el detalle por día.
                </div>
              )}
            </div>

            {/* SVG Interactive Bars */}
            <div className="h-56 flex items-end gap-1 sm:gap-2 w-full pt-4">
              {trendData.map((item, idx) => {
                const value = chartMode === "views" ? item.views : item.visitors;
                const heightPercent = Math.max(6, (value / maxMetricValue) * 100);
                const isHovered = hoveredIndex === idx;

                return (
                  <div
                    key={item.date}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <div
                      className={`w-full max-w-[28px] rounded-t-lg transition-all duration-200 ${
                        isHovered
                          ? "bg-primary scale-y-[1.03] shadow-md shadow-primary/20"
                          : value > 0
                          ? "bg-primary/80 hover:bg-primary"
                          : "bg-muted"
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-axis date labels */}
            <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-3 border-t border-border/60 font-mono">
              <span>{trendData[0]?.dayLabel || ""}</span>
              <span>{trendData[Math.floor(trendData.length / 2)]?.dayLabel || ""}</span>
              <span>{trendData[trendData.length - 1]?.dayLabel || ""}</span>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground space-y-2">
            <Radio className="w-8 h-8 mx-auto text-muted-foreground/60 animate-pulse" />
            <p className="text-sm font-semibold">Esperando primeras visitas registradas...</p>
            <p className="text-xs">
              Al compartir el enlace de tu tienda en redes sociales o catálogos, las visitas aparecerán aquí en tiempo real.
            </p>
          </div>
        )}
      </div>

      {/* ─── 4. TWO-COLUMN BREAKDOWN ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Top Pages */}
        <div className="p-6 bg-card border border-border rounded-2xl shadow-xs space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h3 className="text-base font-bold text-foreground">
              Páginas Más Visitadas
            </h3>
            <p className="text-xs text-muted-foreground">
              Secciones y productos que generan mayor interés entre tus clientes.
            </p>
          </div>

          {summary.topPages.length > 0 ? (
            <div className="space-y-3">
              {summary.topPages.map((page) => (
                <div key={page.path} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(
                          page.category
                        )}`}
                      >
                        {page.category}
                      </span>
                      <span className="font-semibold text-foreground truncate" title={page.label}>
                        {page.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono shrink-0">
                      <span className="font-bold text-foreground">{page.views}</span>
                      <span className="text-muted-foreground text-[11px]">({page.percentage}%)</span>
                    </div>
                  </div>
                  {/* Visual Progress Bar */}
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${page.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Sin datos de páginas aún en este rango.
            </p>
          )}
        </div>

        {/* Right Column: Acquisition Sources */}
        <div className="p-6 bg-card border border-border rounded-2xl shadow-xs space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h3 className="text-base font-bold text-foreground">
              Canales de Captación
            </h3>
            <p className="text-xs text-muted-foreground">
              Origen del tráfico y efectividad de tus campañas o enlaces compartidos.
            </p>
          </div>

          {summary.sources.length > 0 ? (
            <div className="space-y-3">
              {summary.sources.map((src) => (
                <div key={src.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      {getSourceIcon(src.type)}
                      <span className="font-semibold text-foreground truncate">
                        {src.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono shrink-0">
                      <span className="font-bold text-foreground">{src.views}</span>
                      <span className="text-muted-foreground text-[11px]">({src.percentage}%)</span>
                    </div>
                  </div>
                  {/* Visual Progress Bar */}
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${src.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Sin canales registrados aún en este rango.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
