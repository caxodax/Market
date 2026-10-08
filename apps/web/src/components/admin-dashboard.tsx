"use client";

import React, { useState } from "react";
import {
  TenantSettings,
  Product,
  Category,
  Order,
  PaymentProof,
  ExchangeRate,
  DeliveryZone,
  Driver,
  OrderStatus,
  AuditLog,
  UserProfile,
  UserRole,
} from "@marketos/types";
import {
  formatCurrency,
  generateOrderStatusNotificationWhatsAppLink,
} from "@marketos/utils";
import {
  reviewPaymentAction,
  adjustStockAction,
  syncBcvRateAction,
  updateOrderStatusAction,
  updateStaffRoleAction,
} from "../app/admin/actions";
import { logoutUserAction } from "../app/login/actions";
import { ProductModal } from "./product-modal";
import { StaffModal, ROLE_LABELS } from "./staff-modal";
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
  History,
  Volume2,
  VolumeX,
  MessageCircle,
  ShieldCheck,
  Users,
  LogOut,
  User,
  Pencil,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";

interface AdminDashboardProps {
  settings: TenantSettings;
  products: (Product & { stock: number })[];
  categories?: Category[];
  orders: Order[];
  payments: PaymentProof[];
  exchangeRate: ExchangeRate;
  deliveryZones: DeliveryZone[];
  drivers: Driver[];
  auditLogs?: AuditLog[];
  currentUser?: UserProfile;
  staffMembers?: UserProfile[];
}

export function AdminDashboard({
  settings,
  products: initialProducts,
  categories = [],
  orders: initialOrders,
  payments: initialPayments,
  exchangeRate: initialRate,
  deliveryZones,
  drivers,
  auditLogs: initialAuditLogs = [],
  currentUser,
  staffMembers: initialStaffMembers = [],
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    "PAYMENTS" | "ORDERS" | "INVENTORY" | "DELIVERY" | "AUDIT" | "STAFF"
  >("PAYMENTS");
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [payments, setPayments] = useState(initialPayments);
  const [rate, setRate] = useState(initialRate);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [staff, setStaff] = useState<UserProfile[]>(initialStaffMembers);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [auditFilter, setAuditFilter] = useState<string>("ALL");

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [syncingBcv, setSyncingBcv] = useState(false);
  const [bcvMessage, setBcvMessage] = useState<string | null>(null);

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<(Product & { stock: number }) | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [updatingStaffId, setUpdatingStaffId] = useState<string | null>(null);

  const handleLogout = async () => {
    await logoutUserAction();
    window.location.href = "/login";
  };

  const handleRoleChange = async (profileId: string, newRole: UserRole) => {
    setUpdatingStaffId(profileId);
    try {
      const res = await updateStaffRoleAction(settings.tenant_id, profileId, newRole);
      if (res.success && res.profile) {
        setStaff((prev) =>
          prev.map((s) => (s.id === profileId ? res.profile! : s))
        );
      }
    } catch (err) {
      console.error("Error updating role:", err);
    } finally {
      setUpdatingStaffId(null);
    }
  };

  const handleProductSaved = (savedProduct: Product & { stock: number }) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === savedProduct.id);
      if (exists) {
        return prev.map((p) => (p.id === savedProduct.id ? savedProduct : p));
      }
      return [savedProduct, ...prev];
    });
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  const handleProductDeleted = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  const handleStaffAdded = (newStaff: UserProfile) => {
    setStaff((prev) => {
      const exists = prev.some((s) => s.id === newStaff.id || s.email === newStaff.email);
      if (exists) {
        return prev.map((s) =>
          s.id === newStaff.id || s.email === newStaff.email ? newStaff : s
        );
      }
      return [newStaff, ...prev];
    });
    setIsStaffModalOpen(false);
  };



  // Play audio alert chime
  const playChime = () => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // Audio context blocked
    }
  };

  // Review Payment Handler
  const handleReview = async (paymentId: string, status: "APPROVED" | "REJECTED") => {
    setProcessingId(paymentId);
    playChime();
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
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playChime();
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                soundEnabled
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted border-border text-muted-foreground"
              }`}
              title={soundEnabled ? "Audio de alertas activo (clic para silenciar)" : "Audio de alertas silenciado (clic para activar)"}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Sonido Activo</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Silenciado</span>
                </>
              )}
            </button>

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

            {currentUser && (
              <div className="flex items-center gap-2 pl-3 border-l border-border">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-bold text-foreground truncate max-w-[140px]">
                    {currentUser.full_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {ROLE_LABELS[currentUser.role]?.label || currentUser.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-all cursor-pointer"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            )}
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

          <button
            onClick={() => setActiveTab("AUDIT")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "AUDIT"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Auditoría & Trazabilidad ({auditLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("STAFF")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "STAFF"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Equipo y Roles ({staff.length})</span>
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

                        <div className="flex flex-wrap items-center gap-1.5">
                          <a
                            href={generateOrderStatusNotificationWhatsAppLink({
                              customerName: "Cliente",
                              customerPhone: settings.whatsapp_number || settings.phone,
                              businessName: settings.business_name,
                              orderNumber: order.order_number,
                              status: order.status,
                              deliveryType: order.delivery_type,
                              driverName: driver?.name,
                              driverPhone: driver?.phone,
                            })}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs font-bold border border-emerald-500/20 transition-colors"
                            title="Abrir WhatsApp para enviar estado al cliente"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-primary" />
                  Catálogo & Control de Inventario
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Subida directa a Cloudflare R2 con compresión WebP sin pérdida visual.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsProductModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm cursor-pointer transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nuevo Producto</span>
              </button>
            </div>

            <div className="grid gap-3">
              {products.map((prod) => {
                const categoryName =
                  categories.find((c) => c.id === prod.category_id)?.name ||
                  "General";
                const priceVes = prod.price_usd * rate.value;

                return (
                  <div
                    key={prod.id}
                    className="p-3.5 rounded-2xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-border/80"
                  >
                    <div className="flex items-center gap-3">
                      {prod.image_url ? (
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          className="w-14 h-14 object-cover rounded-xl border border-border shrink-0 bg-muted"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
                          <ImageIcon className="w-6 h-6 opacity-40" />
                        </div>
                      )}

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs font-bold text-foreground">
                            {prod.name}
                          </h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                            {categoryName}
                          </span>
                          {!prod.is_active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 font-semibold">
                              Inactivo
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>SKU: <strong className="text-foreground/80">{prod.sku || "N/A"}</strong></span>
                          {prod.barcode && (
                            <span>• Barra: <strong className="text-foreground/80">{prod.barcode}</strong></span>
                          )}
                        </p>

                        <p className="text-xs font-mono font-bold text-primary">
                          {formatCurrency(prod.price_usd, "USD")}{" "}
                          <span className="text-[11px] text-muted-foreground font-normal">
                            (Bs. {priceVes.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                      {/* Edit Button */}
                      <button
                        onClick={() => {
                          setEditingProduct(prod);
                          setIsProductModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
                        title="Editar detalles y fotos del producto"
                      >
                        <Pencil className="w-3.5 h-3.5 text-primary" />
                        <span>Editar</span>
                      </button>

                      {/* Stock controls */}
                      <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border">
                        <button
                          onClick={() => handleStockChange(prod.id, -1)}
                          className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-foreground transition-all cursor-pointer"
                          title="Restar 1 unidad"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <div className="w-12 text-center">
                          <span
                            className={`font-mono font-black text-xs block ${
                              prod.stock <= 5
                                ? "text-amber-500"
                                : "text-foreground"
                            }`}
                          >
                            {prod.stock}
                          </span>
                          <span className="text-[9px] text-muted-foreground block -mt-0.5">
                            unid.
                          </span>
                        </div>

                        <button
                          onClick={() => handleStockChange(prod.id, 1)}
                          className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-foreground transition-all cursor-pointer"
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

        {/* TAB 5: AUDIT LOGS & TRACEABILITY */}
        {activeTab === "AUDIT" && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Registro de Auditoría y Trazabilidad Operativa
                </h2>
                <p className="text-xs text-muted-foreground">
                  Historial inmutable de cambios de inventario, aprobación de pagos, estados de pedidos y tasa BCV.
                </p>
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap gap-1.5">
                {["ALL", "PAYMENT", "ORDER", "STOCK", "BCV"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setAuditFilter(f)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                      auditFilter === f
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {f === "ALL"
                      ? "Todos"
                      : f === "PAYMENT"
                      ? "Pagos"
                      : f === "ORDER"
                      ? "Pedidos"
                      : f === "STOCK"
                      ? "Inventario"
                      : "Tasa BCV"}
                  </button>
                ))}
              </div>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-card">
                <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-xs text-muted-foreground">
                  Aún no se han registrado eventos de auditoría en la plataforma.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {auditLogs
                  .filter((log) => {
                    if (auditFilter === "ALL") return true;
                    if (auditFilter === "PAYMENT") return log.action.includes("PAYMENT");
                    if (auditFilter === "ORDER") return log.action.includes("ORDER");
                    if (auditFilter === "STOCK") return log.action.includes("STOCK");
                    if (auditFilter === "BCV") return log.action.includes("BCV");
                    return true;
                  })
                  .map((log) => {
                    const getBadgeColor = (action: string) => {
                      if (action.includes("APPROVED"))
                        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                      if (action.includes("REJECTED"))
                        return "bg-destructive/10 text-destructive border-destructive/20";
                      if (action.includes("STOCK"))
                        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
                      if (action.includes("BCV"))
                        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
                      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
                    };

                    return (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black border ${getBadgeColor(
                                log.action
                              )}`}
                            >
                              {log.action}
                            </span>
                            <span className="font-semibold text-foreground">
                              {log.entity} •{" "}
                              <span className="font-mono text-muted-foreground">
                                {log.entity_id}
                              </span>
                            </span>
                          </div>

                          <div className="text-[11px] text-muted-foreground">
                            <span>
                              Actor: <strong>{log.actor_name || "Admin Operativo"}</strong>
                            </span>
                            {log.new_data && (
                              <span className="ml-2 font-mono text-[10px] text-foreground/80 bg-muted px-1.5 py-0.5 rounded">
                                {JSON.stringify(log.new_data)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-[11px] text-muted-foreground sm:text-right shrink-0">
                          <Clock className="w-3 h-3 inline mr-1 text-muted-foreground/70" />
                          <span>
                            {new Date(log.created_at).toLocaleString("es-VE")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: STAFF & RBAC ROLES */}
        {activeTab === "STAFF" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Equipo de Trabajo & Permisos (RBAC)
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gestiona colaboradores, asigna roles jerárquicos y audita permisos en tiempo real.
                </p>
              </div>

              <button
                onClick={() => setIsStaffModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm cursor-pointer transition-all shrink-0"
              >
                <Users className="w-4 h-4" />
                <span>+ Asignar Colaborador</span>
              </button>
            </div>

            {/* Staff list */}
            <div className="grid gap-3">
              {staff.map((member) => {
                const roleInfo = ROLE_LABELS[member.role] || {
                  label: member.role,
                  desc: "Sin descripción",
                };

                const getBadgeClass = (r: UserRole) => {
                  switch (r) {
                    case "PLATFORM_SUPER_ADMIN":
                      return "bg-rose-500/10 text-rose-500 border-rose-500/20";
                    case "TENANT_OWNER":
                      return "bg-amber-500/10 text-amber-500 border-amber-500/20";
                    case "TENANT_MANAGER":
                      return "bg-teal-500/10 text-teal-500 border-teal-500/20";
                    case "TENANT_CASHIER":
                      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
                    case "TENANT_INVENTORY":
                      return "bg-purple-500/10 text-purple-500 border-purple-500/20";
                    case "TENANT_DELIVERY":
                      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
                    default:
                      return "bg-muted text-muted-foreground border-border";
                  }
                };

                return (
                  <div
                    key={member.id}
                    className="p-4 rounded-2xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600/20 to-teal-600/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-500 text-sm shrink-0">
                        {member.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-foreground">
                            {member.full_name}
                          </h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeClass(
                              member.role
                            )}`}
                          >
                            {roleInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {member.email} {member.phone && `• ${member.phone}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground/80">
                          {roleInfo.desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-border">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-muted-foreground font-semibold">
                          Cambiar Rol:
                        </label>
                        <select
                          value={member.role}
                          disabled={updatingStaffId === member.id}
                          onChange={(e) =>
                            handleRoleChange(member.id, e.target.value as UserRole)
                          }
                          className="bg-muted border border-border text-foreground text-xs rounded-xl px-3 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
                        >
                          <option value="TENANT_OWNER">Dueño del Comercio</option>
                          <option value="TENANT_MANAGER">Encargada de Sucursal</option>
                          <option value="TENANT_CASHIER">Cajero / Operador</option>
                          <option value="TENANT_INVENTORY">Control de Inventario</option>
                          <option value="TENANT_DELIVERY">Repartidor / Delivery</option>
                        </select>
                      </div>

                      {updatingStaffId === member.id && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Roles explanation card */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Matriz de Control de Acceso Basado en Roles (RBAC):
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 text-[11px] text-muted-foreground">
                <div className="p-2.5 rounded-xl bg-card border border-border">
                  <strong className="text-foreground block">👑 Dueño (TENANT_OWNER)</strong>
                  Acceso financiero irrestricto, auditoría, configuración y gestión de usuarios.
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border">
                  <strong className="text-foreground block">🏢 Encargada (TENANT_MANAGER)</strong>
                  Gestión total de catálogo, ajustes de inventario, aprobación de comprobantes y órdenes.
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border">
                  <strong className="text-foreground block">💳 Cajero (TENANT_CASHIER)</strong>
                  Validación y rechazo de comprobantes Pago Móvil/Zelle y avance de pedidos.
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border">
                  <strong className="text-foreground block">📦 Inventario (TENANT_INVENTORY)</strong>
                  Recepción de mercancía, ajuste de existencias y control de faltantes.
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border">
                  <strong className="text-foreground block">🛵 Delivery (TENANT_DELIVERY)</strong>
                  Rutas de despacho, confirmación de entregas y contacto directo vía WhatsApp.
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border">
                  <strong className="text-foreground block">🛡️ Super Admin (PLATFORM)</strong>
                  Control global de la infraestructura Multi-Tenant de MarketOS.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Product Creation & Editing Modal with WebP Compression */}
      <ProductModal
        tenantId={settings.tenant_id}
        categories={categories}
        product={editingProduct}
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        onSaved={handleProductSaved}
        onDeleted={handleProductDeleted}
      />

      {/* Staff Invitation & Role Assignment Modal */}
      <StaffModal
        tenantId={settings.tenant_id}
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        onStaffAdded={handleStaffAdded}
      />
    </div>
  );
}
