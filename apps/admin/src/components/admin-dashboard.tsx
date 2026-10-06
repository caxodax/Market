"use client";

import React, { useState } from "react";
import {
  TenantSettings,
  Product,
  Order,
  PaymentProof,
  ExchangeRate,
  DeliveryZone,
  Driver,
  OrderStatus,
} from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import {
  reviewPaymentAction,
  adjustStockAction,
  syncBcvRateAction,
  updateOrderStatusAction,
} from "../app/actions";
import {
  PackageCheck,
  Boxes,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Store,
  Plus,
  Minus,
  AlertTriangle,
  Loader2,
  Receipt,
  FileCheck2,
  RefreshCw,
  Truck,
  MapPin,
  ExternalLink,
  UserCheck,
} from "lucide-react";

interface AdminDashboardProps {
  settings: TenantSettings;
  products: (Product & { stock: number })[];
  orders: Order[];
  payments: PaymentProof[];
  exchangeRate: ExchangeRate;
  deliveryZones: DeliveryZone[];
  drivers: Driver[];
}

export function AdminDashboard({
  settings,
  products: initialProducts,
  orders: initialOrders,
  payments: initialPayments,
  exchangeRate: initialRate,
  deliveryZones,
  drivers,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    "PAYMENTS" | "ORDERS" | "INVENTORY" | "DELIVERY"
  >("PAYMENTS");
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [payments, setPayments] = useState(initialPayments);
  const [rate, setRate] = useState(initialRate);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [syncingBcv, setSyncingBcv] = useState(false);
  const [bcvMessage, setBcvMessage] = useState<string | null>(null);

  // Review Payment Handler
  const handleReview = async (paymentId: string, status: "APPROVED" | "REJECTED") => {
    setProcessingId(paymentId);
    try {
      const res = await reviewPaymentAction(settings.tenant_id, paymentId, status);
      if (res.success && res.payment) {
        setPayments((prev) =>
          prev.map((p) => (p.id === paymentId ? { ...p, status } : p))
        );
        // update order state
        setOrders((prev) =>
          prev.map((o) =>
            o.id === res.payment?.order_id
              ? { ...o, status: status === "APPROVED" ? "PREPARING" : "CANCELLED" }
              : o
          )
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  // Stock Adjustment Handler
  const handleStockChange = async (productId: string, delta: number) => {
    try {
      const res = await adjustStockAction(settings.tenant_id, productId, delta);
      if (res.success && res.newStock !== undefined) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, stock: res.newStock! } : p
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Sync BCV Rate
  const handleSyncBcv = async () => {
    setSyncingBcv(true);
    setBcvMessage(null);
    try {
      const res = await syncBcvRateAction(settings.tenant_id);
      if (res.success && res.rate) {
        setRate(res.rate);
        setBcvMessage("¡Tasa BCV sincronizada con éxito!");
      } else {
        setBcvMessage(res.error || "No se pudo sincronizar la tasa");
      }
    } catch (err: any) {
      setBcvMessage(err.message || "Error al sincronizar");
    } finally {
      setSyncingBcv(false);
      setTimeout(() => setBcvMessage(null), 4000);
    }
  };

  // Change Order Status
  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: OrderStatus,
    driverId?: string
  ) => {
    setProcessingId(orderId);
    try {
      const res = await updateOrderStatusAction(
        settings.tenant_id,
        orderId,
        newStatus,
        driverId
      );
      if (res.success && res.order) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingPaymentsCount = payments.filter((p) => p.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Admin Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-sm tracking-tighter">
              SM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-tight text-foreground">
                  {settings.business_name}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  Tenant Admin
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Sucursal Nueva Segovia • Barquisimeto
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs bg-muted/60 border border-border px-3 py-1.5 rounded-xl font-mono">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>BCV BD:</span>
              <strong className="text-foreground">
                Bs. {rate.value.toFixed(2)}/USD
              </strong>
            </div>

            <button
              onClick={handleSyncBcv}
              disabled={syncingBcv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50"
              title="Sincronizar tasa oficial del BCV desde la API a la base de datos"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncingBcv ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">
                {syncingBcv ? "Sincronizando..." : "Sincronizar BCV"}
              </span>
            </button>
          </div>
        </div>

        {bcvMessage && (
          <div className="bg-emerald-500/10 border-t border-emerald-500/20 py-1 text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {bcvMessage}
          </div>
        )}
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold">Validaciones Pendientes</span>
              <Receipt className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-foreground">
              {pendingPaymentsCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Comprobantes por revisar
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold">Total de Pedidos</span>
              <PackageCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-black text-foreground">
              {orders.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Registrados en el sistema
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold">Zonas de Entrega</span>
              <Truck className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-foreground">
              {deliveryZones.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Barquisimeto y Cabudare
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold">Tasa en Base de Datos</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black text-foreground font-mono">
              Bs. {rate.value.toFixed(2)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Fuente: {rate.source}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("PAYMENTS")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "PAYMENTS"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Validación de Pagos</span>
            {pendingPaymentsCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">
                {pendingPaymentsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("ORDERS")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "ORDERS"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Gestión y Despacho de Pedidos ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("INVENTORY")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "INVENTORY"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Inventario en Tienda ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("DELIVERY")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "DELIVERY"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Delivery y Repartidores</span>
          </button>
        </div>

        {/* TAB 1: PAYMENTS VALIDATION */}
        {activeTab === "PAYMENTS" && (
          <div className="space-y-4 animate-in fade-in">
            <h2 className="text-sm font-bold text-foreground">
              Cola de Comprobantes de Pago
            </h2>

            {payments.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-card">
                <p className="text-xs text-muted-foreground">
                  No hay comprobantes de pago registrados aún.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {payments.map((payment) => {
                  const relatedOrder = orders.find((o) => o.id === payment.order_id);

                  return (
                    <div
                      key={payment.id}
                      className="p-4 rounded-2xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-foreground">
                            {relatedOrder?.order_number || payment.order_id}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              payment.status === "APPROVED"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : payment.status === "REJECTED"
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            }`}
                          >
                            {payment.status}
                          </span>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>
                            <strong>Método:</strong> {payment.method} • {payment.bank_name}
                          </p>
                          <p>
                            <strong>Referencia:</strong>{" "}
                            <span className="font-mono font-bold text-foreground">
                              {payment.reference_number}
                            </span>
                          </p>
                          <p>
                            <strong>Monto Reportado:</strong>{" "}
                            {payment.currency === "USD"
                              ? formatCurrency(payment.amount, "USD")
                              : `Bs. ${payment.amount.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`}
                          </p>
                        </div>

                        {payment.proof_image_url && (
                          <div className="pt-1">
                            <a
                              href={payment.proof_image_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Ver captura en Cloudflare R2</span>
                            </a>
                          </div>
                        )}
                      </div>

                      {payment.status === "PENDING" && (
                        <div className="flex items-center gap-2 self-end md:self-center">
                          <button
                            disabled={processingId === payment.id}
                            onClick={() => handleReview(payment.id, "REJECTED")}
                            className="px-3 py-1.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            Rechazar
                          </button>

                          <button
                            disabled={processingId === payment.id}
                            onClick={() => handleReview(payment.id, "APPROVED")}
                            className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {processingId === payment.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            <span>Aprobar Pago</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ORDERS FULFILLMENT & DISPATCH */}
        {activeTab === "ORDERS" && (
          <div className="space-y-4 animate-in fade-in">
            <h2 className="text-sm font-bold text-foreground">
              Despacho y Seguimiento de Pedidos
            </h2>

            {orders.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-card">
                <p className="text-xs text-muted-foreground">No hay pedidos registrados.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {orders.map((order) => {
                  const driver = drivers.find((d) => d.id === order.driver_id) || drivers[0];

                  return (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl border border-border bg-card space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-black text-sm text-foreground">
                            {order.order_number}
                          </span>
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {order.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {order.delivery_type === "DELIVERY"
                              ? "🛵 Delivery"
                              : "🏬 Retiro Tienda"}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black text-primary">
                            {formatCurrency(order.total_usd, "USD")}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            Bs. {order.total_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {order.delivery_address && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{order.delivery_address}</span>
                        </div>
                      )}

                      {/* State transition workflow */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-primary" />
                          <span>Repartidor asignado: <strong>{driver ? driver.name : "Por asignar"}</strong></span>
                        </div>

                        <div className="flex gap-1.5">
                          {order.status === "PREPARING" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "READY")}
                              className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                            >
                              Marcar Listo
                            </button>
                          )}

                          {order.status === "READY" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "DELIVERING", driver?.id)}
                              className="px-3 py-1 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700"
                            >
                              Enviar a Ruta
                            </button>
                          )}

                          {order.status === "DELIVERING" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "COMPLETED")}
                              className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                            >
                              Confirmar Entrega
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: INVENTORY */}
        {activeTab === "INVENTORY" && (
          <div className="space-y-4 animate-in fade-in">
            <h2 className="text-sm font-bold text-foreground">
              Control de Stock en Sucursal Nueva Segovia
            </h2>

            <div className="grid gap-2">
              {products.map((prod) => (
                <div
                  key={prod.id}
                  className="p-3.5 rounded-2xl border border-border bg-card flex items-center justify-between gap-4"
                >
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-bold text-foreground">
                      {prod.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      SKU: {prod.sku || "N/A"} • Precio: {formatCurrency(prod.price_usd, "USD")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStockChange(prod.id, -1)}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <span className="w-10 text-center font-mono font-black text-xs">
                      {prod.stock}
                    </span>

                    <button
                      onClick={() => handleStockChange(prod.id, 1)}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: DELIVERY & DRIVERS */}
        {activeTab === "DELIVERY" && (
          <div className="space-y-6 animate-in fade-in">
            {/* Zones */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-foreground">
                Zonas de Cobertura y Tarifas de Delivery
              </h2>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {deliveryZones.map((zone) => (
                  <div
                    key={zone.id}
                    className="p-3.5 rounded-2xl border border-border bg-card space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-foreground">
                        {zone.name}
                      </span>
                      <span className="font-mono text-xs font-black text-primary">
                        {zone.price_usd === 0 ? "GRATIS" : `$${zone.price_usd.toFixed(2)}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Tiempo estimado: <strong>{zone.estimated_time}</strong>
                    </p>
                    {zone.coverage_description && (
                      <p className="text-[10px] text-muted-foreground opacity-80">
                        {zone.coverage_description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Drivers */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-foreground">
                Repartidores Registrados
              </h2>

              <div className="grid sm:grid-cols-2 gap-3">
                {drivers.map((drv) => (
                  <div
                    key={drv.id}
                    className="p-3.5 rounded-2xl border border-border bg-card flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-foreground">{drv.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Tel: {drv.phone} • {drv.vehicle_type} (Placa: {drv.plate_number || "N/A"})
                      </p>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Activo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
