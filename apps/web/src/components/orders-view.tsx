"use client";

import React, { useState, useMemo } from "react";
import {
  Order,
  OrderStatus,
  TenantSettings,
  Driver,
  Store,
  TenantModuleId,
} from "@marketos/types";
import {
  formatCurrency,
  generateOrderStatusNotificationWhatsAppLink,
} from "@marketos/utils";
import { updateOrderStatusAction } from "@/app/admin/actions";
import { toast } from "sonner";
import {
  PackageCheck,
  Search,
  Filter,
  Eye,
  MessageCircle,
  Truck,
  MapPin,
  UserCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  ReceiptText,
  DollarSign,
} from "lucide-react";
import dynamic from "next/dynamic";
import { EmptyState } from "./ui/empty-state";

const OrderDetailsModal = dynamic(
  () => import("./order-details-modal").then((m) => m.OrderDetailsModal)
);

interface OrdersViewProps {
  initialOrders: Order[];
  initialDrivers?: Driver[];
  settings: TenantSettings;
  stores?: Store[];
  activeModuleIds?: TenantModuleId[];
}

export function OrdersView({
  initialOrders,
  initialDrivers = [],
  settings,
  stores = [],
  activeModuleIds = [],
}: OrdersViewProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");
  const [storeFilter, setStoreFilter] = useState<string>("ALL");
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (orderStatusFilter !== "ALL" && order.status !== orderStatusFilter) {
        return false;
      }
      if (storeFilter !== "ALL" && order.store_id && order.store_id !== storeFilter) {
        return false;
      }
      if (!orderSearchQuery.trim()) return true;
      const q = orderSearchQuery.toLowerCase().trim();
      const matchNumber = order.order_number?.toLowerCase().includes(q);
      const matchName = order.customer_name?.toLowerCase().includes(q);
      const matchPhone = order.customer_phone?.toLowerCase().includes(q);
      const matchAddress = order.delivery_address?.toLowerCase().includes(q);
      const matchItem = order.items?.some((it) => it.product_name.toLowerCase().includes(q));
      return Boolean(matchNumber || matchName || matchPhone || matchAddress || matchItem);
    });
  }, [orders, orderStatusFilter, storeFilter, orderSearchQuery]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);

  const paginatedOrders = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, activePage, pageSize]);

  const stats = useMemo(() => {
    let pendingAction = 0;
    let completedCount = 0;
    let totalRevenueUsd = 0;
    let totalRevenueVes = 0;

    for (const o of orders) {
      if (o.status !== "CANCELLED") {
        totalRevenueUsd += o.total_usd || 0;
        totalRevenueVes += o.total_ves || 0;
      }
      if (["PAYMENT_APPROVED", "PREPARING", "READY", "DELIVERING"].includes(o.status)) {
        pendingAction++;
      }
      if (o.status === "COMPLETED") {
        completedCount++;
      }
    }

    const nonCancelledCount = orders.filter((o) => o.status !== "CANCELLED").length;
    const avgTicket = nonCancelledCount > 0 ? totalRevenueUsd / nonCancelledCount : 0;

    return {
      pendingAction,
      completedCount,
      totalRevenueUsd,
      totalRevenueVes,
      avgTicket,
    };
  }, [orders]);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus, driverId?: string) => {
    try {
      const res = await updateOrderStatusAction(settings.tenant_id, orderId, newStatus, driverId);
      if (res?.success && res.order) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
        toast.success(`Pedido actualizado a ${newStatus}`);
      } else {
        toast.error(res?.error || "Error al actualizar pedido");
      }
    } catch {
      toast.error("Error de comunicación al actualizar pedido");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-view-enter">
      {/* 1. Header & KPI Cards: Big Number / Small Label */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Pedidos */}
        <div
          onClick={() => {
            setOrderStatusFilter("ALL");
            setCurrentPage(1);
          }}
          className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            orderStatusFilter === "ALL"
              ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20 shadow-md"
              : "border-border bg-card hover:border-primary/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Total Pedidos
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Histórico
            </span>
          </div>
          <div className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mt-2">
            {orders.length}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <PackageCheck className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Todos los pedidos</span>
          </p>
        </div>

        {/* KPI 2: Por Atender / En Proceso */}
        <div
          onClick={() => {
            setOrderStatusFilter("PREPARING");
            setCurrentPage(1);
          }}
          className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            ["PAYMENT_APPROVED", "PREPARING", "READY", "DELIVERING"].includes(orderStatusFilter)
              ? "border-amber-500/50 bg-amber-500/5 ring-2 ring-amber-500/20 shadow-md"
              : "border-border bg-card hover:border-amber-500/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Por Atender
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              En Curso
            </span>
          </div>
          <div className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mt-2">
            {stats.pendingAction}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Requieren preparación o despacho</span>
          </p>
        </div>

        {/* KPI 3: Ventas Totales */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Ventas Totales
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              USD
            </span>
          </div>
          <div className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mt-2">
            {formatCurrency(stats.totalRevenueUsd, "USD")}
          </div>
          {activeModuleIds.includes("local_venezuela") ? (
            <p className="text-xs font-mono font-bold text-emerald-600 mt-1 truncate">
              Bs. {stats.totalRevenueVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Pedidos confirmados</span>
            </p>
          )}
        </div>

        {/* KPI 4: Ticket Promedio */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Ticket Promedio
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Promedio
            </span>
          </div>
          <div className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mt-2">
            {formatCurrency(stats.avgTicket, "USD")}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <ReceiptText className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{stats.completedCount} pedidos completados</span>
          </p>
        </div>
      </div>

      {/* 2. Filter Bar & Status Pills */}
      <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por cliente, teléfono, orden o producto..."
              value={orderSearchQuery}
              onChange={(e) => {
                setOrderSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
            />
            {orderSearchQuery && (
              <button
                type="button"
                onClick={() => setOrderSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Limpiar
              </button>
            )}
          </div>

          {stores.length > 1 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <select
                value={storeFilter}
                onChange={(e) => {
                  setStoreFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-11 px-3 rounded-xl border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer w-full sm:w-auto"
              >
                <option value="ALL">Todas las sucursales</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs sm:text-sm">
          {[
            { id: "ALL", label: `Todos (${orders.length})` },
            { id: "PAYMENT_PENDING", label: `Pendientes (${orders.filter((o) => o.status === "PAYMENT_PENDING").length})` },
            { id: "PAYMENT_APPROVED", label: `Pagados (${orders.filter((o) => o.status === "PAYMENT_APPROVED").length})` },
            { id: "PREPARING", label: `En Preparación (${orders.filter((o) => o.status === "PREPARING").length})` },
            { id: "READY", label: `Listos (${orders.filter((o) => o.status === "READY").length})` },
            { id: "DELIVERING", label: `En Camino (${orders.filter((o) => o.status === "DELIVERING").length})` },
            { id: "COMPLETED", label: `Entregados (${orders.filter((o) => o.status === "COMPLETED").length})` },
            { id: "CANCELLED", label: `Cancelados (${orders.filter((o) => o.status === "CANCELLED").length})` },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => {
                setOrderStatusFilter(pill.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-extrabold whitespace-nowrap transition-all cursor-pointer text-xs ${
                orderStatusFilter === pill.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Orders Cards List */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title={
            orderSearchQuery || orderStatusFilter !== "ALL" || storeFilter !== "ALL"
              ? "No se encontraron pedidos con estos filtros"
              : "Aún no tienes pedidos registrados"
          }
          description={
            orderSearchQuery || orderStatusFilter !== "ALL" || storeFilter !== "ALL"
              ? "Prueba cambiando el estado seleccionado o limpiando la barra de búsqueda para ver más órdenes."
              : "Los pedidos que tus clientes realicen a través de la vitrina digital o WhatsApp aparecerán aquí de inmediato."
          }
          action={
            orderSearchQuery || orderStatusFilter !== "ALL" || storeFilter !== "ALL"
              ? {
                  label: "Restablecer Filtros",
                  onClick: () => {
                    setOrderSearchQuery("");
                    setOrderStatusFilter("ALL");
                    setStoreFilter("ALL");
                    setCurrentPage(1);
                  },
                }
              : {
                  label: "Ver Catálogo de Productos",
                  href: "/admin/inventory",
                }
          }
          secondaryAction={
            orderSearchQuery || orderStatusFilter !== "ALL" || storeFilter !== "ALL"
              ? undefined
              : {
                  label: "Ver Vitrina Web",
                  href: "/",
                }
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3.5">
            {paginatedOrders.map((order) => {
              const driver = drivers.find((d) => d.id === order.driver_id) || drivers[0];

              return (
                <div
                  key={order.id}
                  className="p-4 sm:p-5 rounded-2xl border border-border bg-card space-y-3.5 hover:border-primary/40 transition-all shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-base sm:text-lg text-foreground">
                        {order.order_number}
                      </span>
                      <span className="text-xs font-black uppercase tracking-wide px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {order.status}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-foreground/90 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/60">
                        {order.delivery_type === "DELIVERY" ? "🛵 Delivery" : "🏬 Retiro Tienda"}
                      </span>
                      {order.payment_status && (
                        <span
                          className={`text-xs font-black uppercase tracking-wide px-2.5 py-1 rounded-full border ${
                            order.payment_status === "APPROVED"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : order.payment_status === "REJECTED"
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}
                        >
                          Pago {order.payment_status}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-base sm:text-xl font-black text-primary font-mono">
                        {formatCurrency(order.total_usd, "USD")}
                      </span>
                      {activeModuleIds.includes("local_venezuela") && (
                        <span className="block text-xs sm:text-sm font-bold font-mono text-foreground/80">
                          Bs. {order.total_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer info & Delivery Address */}
                  <div className="grid sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                    {(order.customer_name || order.customer_phone || order.customer_id_number) && (
                      <div className="flex items-center gap-2 text-foreground font-semibold flex-wrap">
                        <UserCheck className="w-4 h-4 text-primary shrink-0" />
                        <span>
                          <strong className="font-bold text-foreground">Cliente:</strong> {order.customer_name || "Cliente"}
                          {order.customer_id_number ? ` • CI: ${order.customer_id_number}` : ""}
                          {order.customer_phone ? ` (${order.customer_phone})` : ""}
                        </span>
                      </div>
                    )}

                    {order.delivery_address && (
                      <div className="flex items-center gap-2 text-foreground/85 font-medium">
                        <MapPin className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">{order.delivery_address}</span>
                      </div>
                    )}
                  </div>

                  {/* Purchased Items summary preview */}
                  {order.items && order.items.length > 0 && (
                    <div className="bg-muted/40 p-3 rounded-xl border border-border/70 text-xs sm:text-sm space-y-1.5">
                      <span className="font-black text-xs uppercase tracking-wider text-muted-foreground/90">
                        Artículos ({order.items.reduce((s, it) => s + it.quantity, 0)} unid.):
                      </span>
                      <p className="text-foreground text-xs sm:text-sm font-medium leading-relaxed line-clamp-2">
                        {order.items.map((it) => `${it.quantity}x ${it.product_name}`).join(" • ")}
                      </p>
                    </div>
                  )}

                  {/* State transition workflow & action buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5 border-t border-border/50">
                    <div className="text-xs sm:text-sm text-foreground/80 flex items-center gap-2 font-medium">
                      <Truck className="w-4 h-4 text-primary" />
                      <span>
                        Repartidor: <strong className="font-bold text-foreground">{driver ? driver.name : "Por asignar"}</strong>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderForModal(order)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs sm:text-sm font-bold border border-primary/20 transition-all cursor-pointer shadow-2xs active:scale-95"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Ver Detalle</span>
                      </button>

                      <a
                        href={generateOrderStatusNotificationWhatsAppLink({
                          customerName: order.customer_name || "Cliente",
                          customerPhone: order.customer_phone || settings.whatsapp_number || settings.phone,
                          businessName: settings.business_name,
                          orderNumber: order.order_number,
                          status: order.status,
                          deliveryType: order.delivery_type,
                        })}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs sm:text-sm font-bold border border-emerald-500/20 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="Notificar estado por WhatsApp al cliente"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-border">
              <span className="text-xs font-semibold text-muted-foreground">
                Página {activePage} de {totalPages} ({filteredOrders.length} pedidos)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-2 rounded-xl border border-border text-foreground hover:bg-muted disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={activePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-2 rounded-xl border border-border text-foreground hover:bg-muted disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrderForModal && (
        <OrderDetailsModal
          order={selectedOrderForModal}
          isOpen={Boolean(selectedOrderForModal)}
          onClose={() => setSelectedOrderForModal(null)}
          settings={settings}
          drivers={drivers}
          activeModuleIds={activeModuleIds}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  );
}
