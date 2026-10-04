"use client";

import React, { useState } from "react";
import {
  TenantSettings,
  Product,
  Order,
  PaymentProof,
  ExchangeRate,
} from "@marketos/types";
import { formatCurrency, convertUsdToVes } from "@marketos/utils";
import { reviewPaymentAction, adjustStockAction } from "../app/actions";
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
} from "lucide-react";

interface AdminDashboardProps {
  settings: TenantSettings;
  products: (Product & { stock: number })[];
  orders: Order[];
  payments: PaymentProof[];
  exchangeRate: ExchangeRate;
}

export function AdminDashboard({
  settings,
  products: initialProducts,
  orders: initialOrders,
  payments: initialPayments,
  exchangeRate,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"PAYMENTS" | "INVENTORY">("PAYMENTS");
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [payments, setPayments] = useState(initialPayments);
  const [processingId, setProcessingId] = useState<string | null>(null);

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
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-muted px-3 py-1 rounded-lg font-mono">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>BCV:</span>
              <strong className="text-foreground">
                Bs. {exchangeRate.value.toFixed(2)}/USD
              </strong>
            </span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm">
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

          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm">
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

          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold">Productos Activos</span>
              <Boxes className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-foreground">
              {products.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              En catálogo Shop Market
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold">Tasa Cambiaria</span>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-black text-foreground font-mono">
              Bs. {exchangeRate.value.toFixed(2)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Fuente: bcv.today
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-border gap-4">
          <button
            onClick={() => setActiveTab("PAYMENTS")}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "PAYMENTS"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Validación de Pagos y Pedidos</span>
            {pendingPaymentsCount > 0 && (
              <span className="bg-amber-500 text-white text-[11px] font-black px-1.5 py-0.2 rounded-full">
                {pendingPaymentsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("INVENTORY")}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "INVENTORY"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Gestión de Inventario ({products.length})</span>
          </button>
        </div>

        {/* Tab 1: Payment Validation & Orders */}
        {activeTab === "PAYMENTS" && (
          <div className="space-y-4">
            {payments.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card">
                <FileCheck2 className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-sm text-foreground">
                  No hay pagos registrados aún
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cuando un cliente realice un pedido desde el catálogo PWA, su comprobante aparecerá aquí para validación manual.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => {
                  const relatedOrder = orders.find((o) => o.id === payment.order_id);
                  const isPending = payment.status === "PENDING";

                  return (
                    <div
                      key={payment.id}
                      className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-primary">
                            {relatedOrder?.order_number || "ORD-XXXXXX"}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              payment.status === "APPROVED"
                                ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/20"
                                : payment.status === "REJECTED"
                                ? "bg-destructive/15 text-destructive border border-destructive/20"
                                : "bg-amber-500/15 text-amber-600 border border-amber-500/20"
                            }`}
                          >
                            {payment.status === "APPROVED"
                              ? "APROBADO"
                              : payment.status === "REJECTED"
                              ? "RECHAZADO"
                              : "PENDIENTE"}
                          </span>
                        </div>

                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            Método: <strong>{payment.method}</strong>
                          </span>
                          <span>
                            Banco: <strong>{payment.bank_name || "N/A"}</strong>
                          </span>
                          <span>
                            Ref: <strong>{payment.reference_number}</strong>
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-foreground">
                          Monto pagado:{" "}
                          <span className="font-black text-primary">
                            {payment.currency === "VES"
                              ? `Bs. ${payment.amount.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`
                              : formatCurrency(payment.amount, "USD")}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {isPending ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleReview(payment.id, "APPROVED")}
                            disabled={processingId === payment.id}
                            className="h-10 px-4 rounded-xl bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1.5 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {processingId === payment.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            <span>Aprobar Pago</span>
                          </button>

                          <button
                            onClick={() => handleReview(payment.id, "REJECTED")}
                            disabled={processingId === payment.id}
                            className="h-10 px-4 rounded-xl border border-destructive/30 text-destructive font-semibold text-xs flex items-center gap-1.5 hover:bg-destructive/10 transition-all active:scale-95 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Rechazar</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground italic">
                          Validado el {payment.reviewed_at ? new Date(payment.reviewed_at).toLocaleTimeString() : "recientemente"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Inventory & Products Management */}
        {activeTab === "INVENTORY" && (
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">
                  Inventario en Tienda: Sucursal Nueva Segovia
                </h3>
                <p className="text-xs text-muted-foreground">
                  Ajuste de existencias en tiempo real
                </p>
              </div>
            </div>

            <div className="divide-y divide-border">
              {products.map((prod) => {
                const priceVes = convertUsdToVes(prod.price_usd, exchangeRate.value);

                return (
                  <div
                    key={prod.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={prod.image_url || ""}
                        alt={prod.name}
                        className="w-12 h-12 rounded-xl object-cover bg-muted shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-foreground">
                            {prod.name}
                          </h4>
                          {prod.sku && (
                            <span className="font-mono text-[10px] text-muted-foreground uppercase bg-muted px-1.5 py-0.2 rounded">
                              {prod.sku}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-bold text-foreground">
                            {formatCurrency(prod.price_usd, "USD")}
                          </span>{" "}
                          • Bs. {priceVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {/* Stock stepper controls */}
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className="text-xs font-medium text-muted-foreground">
                        Stock:
                      </span>
                      <div className="flex items-center rounded-xl border border-border bg-background p-1">
                        <button
                          onClick={() => handleStockChange(prod.id, -1)}
                          disabled={prod.stock <= 0}
                          className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                          title="Restar 1 unidad"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span
                          className={`w-12 text-center text-xs font-black font-mono ${
                            prod.stock <= 5 ? "text-amber-600" : "text-foreground"
                          }`}
                        >
                          {prod.stock}
                        </span>
                        <button
                          onClick={() => handleStockChange(prod.id, 1)}
                          className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
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
          </div>
        )}
      </main>
    </div>
  );
}
