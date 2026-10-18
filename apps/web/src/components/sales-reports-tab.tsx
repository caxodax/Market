"use client";

import React, { useState, useEffect } from "react";
import {
  Order,
  PaymentProof,
  ExchangeRate,
  TenantSettings,
  SalesAnalytics,
  PaymentMethodType,
  OrderStatus,
  TenantModuleId,
} from "@marketos/types";
import {
  formatCurrency,
  formatCaracasDateTime,
  formatCaracasDate,
  getCaracasDateKey,
  getCaracasRangeBounds,
} from "@marketos/utils";
import { getSalesAnalyticsAction } from "../app/admin/actions";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  CheckCircle2,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  CreditCard,
  Package,
  Layers,
  ArrowUpRight,
  Filter,
  Eye,
  Search,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { OrderDetailsModal } from "./order-details-modal";

interface SalesReportsTabProps {
  tenantId: string;
  settings: TenantSettings;
  exchangeRate: ExchangeRate;
  initialOrders: Order[];
  initialPayments: PaymentProof[];
  activeModuleIds?: TenantModuleId[];
}

export function SalesReportsTab({
  tenantId,
  settings,
  exchangeRate,
  initialOrders,
  initialPayments,
  activeModuleIds = [],
}: SalesReportsTabProps) {
  const isVenezuelaActive = activeModuleIds.includes("local_venezuela");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("all");
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const fetchAnalytics = async (range: "today" | "week" | "month" | "all") => {
    setLoading(true);
    try {
      const res = await getSalesAnalyticsAction(tenantId, range);
      if (res.success && res.report) {
        setAnalytics(res.report);
      }
    } catch (e) {
      console.error("Error fetching sales analytics:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(dateRange);
  }, [tenantId, dateRange]);

  // Filter orders by active dateRange (normalized to America/Caracas UTC-4)
  const dateFilteredOrders = initialOrders.filter((o) => {
    const { startUtc, endUtc } = getCaracasRangeBounds(dateRange);
    if (startUtc) {
      const orderDate = new Date(o.created_at);
      if (orderDate < startUtc || orderDate > endUtc) return false;
    }
    return true;
  });

  // Filtered orders list for the detailed audit table (dateRange + search query)
  const filteredOrders = dateFilteredOrders.filter((o) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(query) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(query)) ||
      (o.customer_phone && o.customer_phone.includes(query)) ||
      (o.payment_method && o.payment_method.toLowerCase().includes(query)) ||
      (o.payment_reference && o.payment_reference.toLowerCase().includes(query))
    );
  });

  // Export full multi-sheet executive report to Excel (.xlsx)
  const handleExportExcel = async () => {
    if (!dateFilteredOrders || dateFilteredOrders.length === 0) {
      alert("No hay pedidos registrados en el período seleccionado para exportar.");
      return;
    }

    setIsExportingExcel(true);
    try {
      const { exportSalesReportsToExcel } = await import("../lib/exportExcel");
      await exportSalesReportsToExcel({
        settings,
        orders: dateFilteredOrders,
        analytics,
        exchangeRate,
        dateRange,
        activeModuleIds,
      });
    } catch (err) {
      console.error("Error exportando reporte a Excel:", err);
      alert("Ocurrió un error al generar el archivo Excel.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Export report to CSV
  const handleExportCsv = () => {
    if (!dateFilteredOrders || dateFilteredOrders.length === 0) {
      alert("No hay pedidos registrados en el período seleccionado para exportar.");
      return;
    }

    const headers = [
      "Numero_Pedido",
      isVenezuelaActive ? "Fecha_Hora_Caracas" : "Fecha_Hora",
      "Cliente",
      "Telefono",
      "Modalidad",
      "Metodo_Pago",
      "Referencia",
      "Estado",
      "Articulos_Total",
      "Total_USD",
      ...(isVenezuelaActive ? ["Total_VES", "Tasa_BCV"] : []),
    ];

    const rows = dateFilteredOrders.map((o) => [
      o.order_number,
      `"${isVenezuelaActive ? formatCaracasDateTime(o.created_at) : new Date(o.created_at).toLocaleString()}"`,
      `"${o.customer_name || "Cliente General"}"`,
      `"${o.customer_phone || ""}"`,
      o.delivery_type,
      o.payment_method || "",
      `"${o.payment_reference || ""}"`,
      o.status,
      o.items?.reduce((acc, it) => acc + it.quantity, 0) || 0,
      o.total_usd.toFixed(2),
      ...(isVenezuelaActive ? [o.total_ves.toFixed(2), o.exchange_rate_applied.toFixed(2)] : []),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = getCaracasDateKey(new Date()) || new Date().toISOString().split("T")[0];
    link.setAttribute(
      "download",
      `reporte_ventas_${settings.business_name.toLowerCase().replace(/\s+/g, "_")}_${dateRange}_${dateStr}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header con Período y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              <span>Reportes de Ventas e Ingresos</span>
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Finanzas
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Control de ingresos, pedidos facturados y productos más llevados en {settings.business_name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Período */}
          <div className="inline-flex rounded-xl p-1 bg-muted border border-border text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDateRange("today")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                dateRange === "today"
                  ? "bg-background text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setDateRange("week")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                dateRange === "week"
                  ? "bg-background text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setDateRange("month")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                dateRange === "month"
                  ? "bg-background text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => setDateRange("all")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                dateRange === "all"
                  ? "bg-background text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todo
            </button>
          </div>

          {/* Botón Refrescar */}
          <button
            type="button"
            onClick={() => fetchAnalytics(dateRange)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-card border border-border hover:bg-muted text-foreground transition-all cursor-pointer shadow-xs"
            title="Recalcular métricas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>

          {/* Exportar Excel (.xlsx) */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            title="Descargar libro Excel profesional (.xlsx) con hojas ejecutivas"
          >
            {isExportingExcel ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5" />
            )}
            <span>Exportar Excel</span>
          </button>

          {/* Exportar CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-bold text-foreground transition-all cursor-pointer shadow-xs active:scale-95"
            title="Exportar archivo plano CSV"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          {/* Imprimir Reporte */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* 4 KPIs Ejecutivos Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Ingresos Totales */}
        <div className="bg-card border border-border p-4 sm:p-5 rounded-3xl shadow-xs space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Ingresos Totales
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-1">
            <div className="text-2xl sm:text-3xl font-black text-foreground">
              {analytics
                ? formatCurrency(analytics.totalRevenueUsd, "USD")
                : formatCurrency(0, "USD")}
            </div>
            {isVenezuelaActive && (
              <div className="text-xs font-mono font-bold text-emerald-600 mt-0.5">
                Bs.{" "}
                {analytics
                  ? analytics.totalRevenueVes.toLocaleString("es-VE", {
                      minimumFractionDigits: 2,
                    })
                  : "0,00"}
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Ventas netas de pedidos aprobados/completados.
          </p>
        </div>

        {/* KPI 2: Pedidos Facturados */}
        <div className="bg-card border border-border p-4 sm:p-5 rounded-3xl shadow-xs space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Efectividad Pedidos
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-1">
            <div className="text-2xl sm:text-3xl font-black text-foreground">
              {analytics?.completedOrdersCount || 0}
              <span className="text-sm font-semibold text-muted-foreground ml-1">
                / {analytics?.totalOrdersCount || 0}
              </span>
            </div>
            <div className="text-xs font-bold text-primary mt-0.5">
              {analytics && analytics.totalOrdersCount > 0
                ? `${Math.round(
                    (analytics.completedOrdersCount / analytics.totalOrdersCount) * 100
                  )}% completados`
                : "0% completados"}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            {analytics?.pendingOrdersCount || 0} en curso •{" "}
            {analytics?.cancelledOrdersCount || 0} cancelados.
          </p>
        </div>

        {/* KPI 3: Ticket Promedio */}
        <div className="bg-card border border-border p-4 sm:p-5 rounded-3xl shadow-xs space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Ticket Promedio
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-1">
            <div className="text-2xl sm:text-3xl font-black text-foreground">
              {analytics
                ? formatCurrency(analytics.averageTicketUsd, "USD")
                : formatCurrency(0, "USD")}
            </div>
            {isVenezuelaActive && (
              <div className="text-xs font-mono font-bold text-blue-600 mt-0.5">
                Bs.{" "}
                {analytics
                  ? (analytics.averageTicketUsd * exchangeRate.value).toLocaleString(
                      "es-VE",
                      { minimumFractionDigits: 2 }
                    )
                  : "0,00"}
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Gasto promedio por cada cliente.
          </p>
        </div>

        {/* KPI 4: Unidades Llevadas */}
        <div className="bg-card border border-border p-4 sm:p-5 rounded-3xl shadow-xs space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Artículos Llevados
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-1">
            <div className="text-2xl sm:text-3xl font-black text-foreground">
              {analytics?.itemsSoldTotal || 0}
            </div>
            <div className="text-xs font-bold text-purple-600 mt-0.5">
              unidades despachadas
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Volumen físico de productos entregados.
          </p>
        </div>
      </div>

      {/* Grid: Desglose por Método de Pago + Top Productos Más Vendidos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Ingresos por Método de Pago (6 cols) */}
        <div className="lg:col-span-6 bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <span>Ingresos por Método de Pago</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Desglose de recaudación según la vía de pago de los clientes.
            </p>
          </div>

          {!analytics || analytics.revenueByMethod.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
              Aún no hay pagos registrados en este período.
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {analytics.revenueByMethod.map((item) => {
                const totalRev = analytics.totalRevenueUsd || 1;
                const percent = Math.min(
                  100,
                  Math.round((item.totalUsd / totalRev) * 100)
                );

                return (
                  <div key={item.method} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <span>{item.label}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          ({item.count} {item.count === 1 ? "pago" : "pagos"})
                        </span>
                      </span>
                      <div className="text-right">
                        <span className="font-black text-foreground">
                          {formatCurrency(item.totalUsd, "USD")}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono ml-1.5">
                          ({percent}%)
                        </span>
                      </div>
                    </div>
                    {/* Barra de progreso visual */}
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Columna Derecha: Top Productos Más Vendidos (6 cols) */}
        <div className="lg:col-span-6 bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span>Top Productos Más Llevados</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Artículos con mayor demanda y rotación de inventario.
            </p>
          </div>

          {!analytics || analytics.topSellingProducts.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
              Sin ventas de productos registradas en este período.
            </div>
          ) : (
            <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden bg-background">
              {analytics.topSellingProducts.map((prod, index) => (
                <div
                  key={prod.productId}
                  className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                        index === 0
                          ? "bg-amber-500 text-white shadow-xs"
                          : index === 1
                          ? "bg-slate-300 text-slate-800"
                          : index === 2
                          ? "bg-amber-700 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">
                        {prod.productName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {prod.quantitySold}{" "}
                        {prod.quantitySold === 1 ? "unidad llevada" : "unidades llevadas"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-black text-primary">
                      {formatCurrency(prod.totalRevenueUsd, "USD")}
                    </span>
                    {isVenezuelaActive && (
                      <span className="block text-[10px] text-muted-foreground font-mono">
                        Bs. {(prod.totalRevenueUsd * exchangeRate.value).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla Detallada de Auditoría y Control de Pedidos */}
      <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span>Control Histórico de Pedidos ({filteredOrders.length})</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Detalle cronológico de cada compra, cliente y productos llevados.
            </p>
          </div>

          {/* Buscador */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por orden, cliente o ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
            No se encontraron pedidos coincidentes.
          </div>
        ) : (
          <div className="border border-border rounded-2xl overflow-hidden bg-background overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground font-bold">
                  <th className="p-3">Pedido</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Productos Llevados</th>
                  <th className="p-3">Método / Ref</th>
                  <th className="p-3 text-right">Total ($)</th>
                  {isVenezuelaActive && <th className="p-3 text-right">Total (Bs)</th>}
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map((order) => {
                  const itemsCount =
                    order.items?.reduce((acc, it) => acc + it.quantity, 0) || 0;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 font-mono font-black text-foreground whitespace-nowrap">
                        {order.order_number}
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                        {formatCaracasDateTime(order.created_at)}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <p className="font-bold text-foreground">
                          {order.customer_name || "Cliente General"}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {order.customer_phone || ""}
                        </p>
                      </td>
                      <td className="p-3 max-w-[200px] truncate">
                        {order.items && order.items.length > 0 ? (
                          <span
                            title={order.items
                              .map((it) => `${it.quantity}x ${it.product_name}`)
                              .join(", ")}
                          >
                            <strong className="text-primary">{itemsCount} art.</strong>:{" "}
                            {order.items.map((it) => `${it.quantity}x ${it.product_name}`).join(", ")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Sin detalle</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap text-muted-foreground">
                        <p className="font-semibold text-foreground">
                          {order.payment_method || "No especificado"}
                        </p>
                        {order.payment_reference && (
                          <p className="text-[10px] font-mono text-muted-foreground">
                            Ref: {order.payment_reference}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-right font-black text-foreground whitespace-nowrap">
                        {formatCurrency(order.total_usd, "USD")}
                      </td>
                      {isVenezuelaActive && (
                        <td className="p-3 text-right font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          Bs.{" "}
                          {order.total_ves.toLocaleString("es-VE", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      )}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            order.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : order.status === "CANCELLED"
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : order.status === "PAYMENT_APPROVED" ||
                                order.status === "PREPARING"
                              ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Ver</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalle de Pedido */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        settings={settings}
        activeModuleIds={activeModuleIds}
      />
    </div>
  );
}
