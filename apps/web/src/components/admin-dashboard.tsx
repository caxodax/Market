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
  RateHistoryItem,
  Coupon,
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
  getLatestOrdersAction,
  getLatestPaymentsAction,
} from "../app/admin/actions";
import { logoutUserAction } from "../app/login/actions";
import { ProductModal } from "./product-modal";
import { StaffModal, ROLE_LABELS } from "./staff-modal";
import { ExchangeRateManager } from "./exchange-rate-manager";
import { StoreSettingsTab } from "./store-settings-tab";
import { CouponManager } from "./coupon-manager";
import { PushNotificationsManager } from "./push-notifications-manager";
import { OrderDetailsModal } from "./order-details-modal";
import { SalesReportsTab } from "./sales-reports-tab";
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
  Landmark,
  Sliders,
  Ticket,
  BellRing,
  BarChart3,
  Eye,
  ChevronDown,
  Check,
  Search,
} from "lucide-react";

interface AdminDashboardProps {
  settings: TenantSettings;
  products: (Product & { stock: number })[];
  categories?: Category[];
  orders: Order[];
  payments: PaymentProof[];
  exchangeRate: ExchangeRate;
  ratesHistory?: RateHistoryItem[];
  deliveryZones: DeliveryZone[];
  drivers: Driver[];
  auditLogs?: AuditLog[];
  currentUser?: UserProfile;
  staffMembers?: UserProfile[];
  coupons?: Coupon[];
}

export function AdminDashboard({
  settings,
  products: initialProducts,
  categories = [],
  orders: initialOrders,
  payments: initialPayments,
  exchangeRate: initialRate,
  ratesHistory = [],
  deliveryZones,
  drivers,
  auditLogs: initialAuditLogs = [],
  currentUser,
  staffMembers: initialStaffMembers = [],
  coupons: initialCoupons = [],
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    "PAYMENTS" | "ORDERS" | "REPORTS" | "INVENTORY" | "DELIVERY" | "COUPONS" | "PUSH" | "RATES" | "AUDIT" | "STAFF" | "SETTINGS"
  >("PAYMENTS");
  const [settingsState, setSettingsState] = useState(settings);
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [payments, setPayments] = useState(initialPayments);
  const [rate, setRate] = useState(initialRate);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [staff, setStaff] = useState<UserProfile[]>(initialStaffMembers);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [auditFilter, setAuditFilter] = useState<string>("ALL");
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [syncingBcv, setSyncingBcv] = useState(false);
  const [bcvMessage, setBcvMessage] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [refreshingOrders, setRefreshingOrders] = useState(false);

  const filteredOrders = orders.filter((order) => {
    if (orderStatusFilter !== "ALL" && order.status !== orderStatusFilter) {
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

  // Modals state
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);
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

  // Refresh latest orders and payments from server
  const handleRefreshOrdersAndPayments = async () => {
    setRefreshingOrders(true);
    try {
      const [oRes, pRes] = await Promise.all([
        getLatestOrdersAction(settings.tenant_id),
        getLatestPaymentsAction(settings.tenant_id),
      ]);
      if (oRes.success && oRes.orders) {
        setOrders(oRes.orders);
      }
      if (pRes.success && pRes.payments) {
        setPayments(pRes.payments);
      }
    } catch (e) {
      console.error("Error refreshing data:", e);
    } finally {
      setRefreshingOrders(false);
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
        // Refresh latest orders to ensure newly updated order is displayed with items & status
        const oRes = await getLatestOrdersAction(settings.tenant_id);
        if (oRes.success && oRes.orders) {
          setOrders(oRes.orders);
        } else {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === res.payment?.order_id
                ? {
                    ...o,
                    status: status === "APPROVED" ? "PREPARING" : "CANCELLED",
                    payment_status: status,
                  }
                : o
            )
          );
        }
        if (selectedOrderForModal?.id === res.payment?.order_id) {
          setSelectedOrderForModal((prev) =>
            prev
              ? {
                  ...prev,
                  status: status === "APPROVED" ? "PREPARING" : "CANCELLED",
                  payment_status: status,
                }
              : null
          );
        }
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
        if (selectedOrderForModal?.id === orderId) {
          setSelectedOrderForModal((prev) =>
            prev ? { ...prev, status: newStatus } : null
          );
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingPaymentsCount = payments.filter((p) => p.status === "PENDING").length;

  const modulesList = [
    {
      id: "PAYMENTS" as const,
      label: "Validación de Pagos",
      shortLabel: "Pagos",
      description: "Pago Móvil, Zelle y transferencias",
      icon: <FileCheck2 className="w-4 h-4" />,
      badge: pendingPaymentsCount > 0 ? `${pendingPaymentsCount}` : null,
      badgeClassName: "bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black",
    },
    {
      id: "ORDERS" as const,
      label: `Gestión y Despacho (${orders.length})`,
      shortLabel: `Pedidos (${orders.length})`,
      description: "Estados, rutas y contacto WhatsApp",
      icon: <PackageCheck className="w-4 h-4" />,
      badge: orders.length > 0 ? `${orders.length}` : null,
      badgeClassName: "bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "REPORTS" as const,
      label: "Reportes & Ventas",
      shortLabel: "Reportes",
      description: "Ingresos en $ y Bs, métodos y top ventas",
      icon: <BarChart3 className="w-4 h-4" />,
      badge:
        orders.length > 0
          ? formatCurrency(
              orders.reduce(
                (acc, o) =>
                  [
                    "COMPLETED",
                    "PAYMENT_APPROVED",
                    "PREPARING",
                    "READY",
                    "DELIVERING",
                  ].includes(o.status)
                    ? acc + o.total_usd
                    : acc,
                0
              ),
              "USD"
            )
          : null,
      badgeClassName: "bg-emerald-500/10 text-emerald-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "INVENTORY" as const,
      label: `Inventario en Tienda (${products.length})`,
      shortLabel: `Inventario (${products.length})`,
      description: "Productos, precios y existencias",
      icon: <Boxes className="w-4 h-4" />,
      badge: `${products.length}`,
      badgeClassName: "bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "DELIVERY" as const,
      label: "Delivery y Repartidores",
      shortLabel: "Delivery",
      description: "Zonas, tarifas y motorizados",
      icon: <Truck className="w-4 h-4" />,
      badge: deliveryZones.length > 0 ? `${deliveryZones.length}` : null,
      badgeClassName: "bg-blue-500/10 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "COUPONS" as const,
      label: `Cupones de Descuento (${initialCoupons.length})`,
      shortLabel: `Cupones (${initialCoupons.length})`,
      description: "Descuentos en $ o % y fechas límite",
      icon: <Ticket className="w-4 h-4" />,
      badge: initialCoupons.length > 0 ? `${initialCoupons.length}` : null,
      badgeClassName: "bg-purple-500/10 text-purple-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "PUSH" as const,
      label: "Notificaciones Push",
      shortLabel: "Push",
      description: "Difusiones Web Push a móviles",
      icon: <BellRing className="w-4 h-4" />,
      badge: "PWA",
      badgeClassName: "bg-amber-500/10 text-amber-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "RATES" as const,
      label: `Tasas y Divisas (${ratesHistory.length})`,
      shortLabel: "Tasas & BCV",
      description: "Monitor oficial BCV e histórico",
      icon: <Landmark className="w-4 h-4" />,
      badge: `Bs. ${rate.value.toFixed(2)}`,
      badgeClassName: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold",
    },
    {
      id: "AUDIT" as const,
      label: `Auditoría & Logs (${auditLogs.length})`,
      shortLabel: `Auditoría (${auditLogs.length})`,
      description: "Registro cronológico inmutable",
      icon: <History className="w-4 h-4" />,
      badge: auditLogs.length > 0 ? `${auditLogs.length}` : null,
      badgeClassName: "bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "STAFF" as const,
      label: `Equipo y Roles (${staff.length})`,
      shortLabel: `Equipo (${staff.length})`,
      description: "Colaboradores y permisos RBAC",
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: `${staff.length}`,
      badgeClassName: "bg-emerald-500/10 text-emerald-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "SETTINGS" as const,
      label: "Configuración & Marca",
      shortLabel: "Ajustes",
      description: "Dirección, cuentas, pagos y diseño",
      icon: <Sliders className="w-4 h-4" />,
      badge: "Tienda",
      badgeClassName: "bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
  ];

  const currentModule = modulesList.find((m) => m.id === activeTab) || modulesList[0];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col w-full max-w-full overflow-x-hidden">
      {/* Top Admin Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30 w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {settingsState.logo_url ? (
              <img
                src={settingsState.logo_url}
                alt={settingsState.business_name}
                className="h-9 w-9 sm:h-10 sm:w-10 object-contain rounded-xl bg-card border border-border p-0.5 shadow-xs shrink-0"
              />
            ) : (
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-lg sm:text-xl shadow-sm tracking-tighter shrink-0">
                {settingsState.business_name ? settingsState.business_name.substring(0, 2).toUpperCase() : "SM"}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-foreground truncate">
                  {settingsState.business_name}
                </h1>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                  Tenant
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-[260px] md:max-w-[340px]">
                {settingsState.address || "Sucursal Nueva Segovia • Barquisimeto"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              onClick={() => setActiveTab("RATES")}
              className="hidden lg:flex items-center gap-1.5 text-xs bg-muted/60 hover:bg-muted border border-border px-2.5 py-1.5 rounded-xl font-mono transition-colors cursor-pointer"
              title="Clic para ver monitor de tasas e histórico"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>BCV:</span>
              <strong className="text-foreground">
                Bs. {rate.value.toFixed(2)}
              </strong>
            </button>

            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playChime();
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                soundEnabled
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted border-border text-muted-foreground"
              }`}
              title={soundEnabled ? "Audio de alertas activo (clic para silenciar)" : "Audio de alertas silenciado (clic para activar)"}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden xl:inline">Sonido</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Silenciado</span>
                </>
              )}
            </button>

            <button
              onClick={handleSyncBcv}
              disabled={syncingBcv}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50"
              title="Sincronizar tasa oficial del BCV desde la API a la base de datos"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncingBcv ? "animate-spin" : ""}`}
              />
              <span className="hidden xl:inline">
                {syncingBcv ? "Sincronizando..." : "Sincronizar BCV"}
              </span>
            </button>

            <button
              onClick={handleRefreshOrdersAndPayments}
              disabled={refreshingOrders}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-card border border-border text-foreground text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              title="Refrescar pedidos y pagos más recientes"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-primary ${
                  refreshingOrders ? "animate-spin" : ""
                }`}
              />
              <span className="hidden md:inline">Actualizar</span>
            </button>

            {currentUser && (
              <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-border">
                <div className="hidden 2xl:flex flex-col text-right">
                  <span className="text-xs font-bold text-foreground truncate max-w-[120px]">
                    {currentUser.full_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {ROLE_LABELS[currentUser.role]?.label || currentUser.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-all cursor-pointer"
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
          <div className="bg-emerald-500/10 border-t border-emerald-500/20 py-1 text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium px-4">
            {bcvMessage}
          </div>
        )}
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1 w-full space-y-5 overflow-x-hidden">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full">
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

        {/* Mobile & Tablet Navigation Selector (Zero horizontal scroll) */}
        <div className="xl:hidden relative w-full">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen((prev) => !prev)}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 active:scale-[0.99] transition-all text-left shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
                {currentModule.icon}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Módulo Activo
                </div>
                <div className="text-sm font-extrabold text-foreground truncate flex items-center gap-2">
                  <span>{currentModule.label}</span>
                  {currentModule.badge && (
                    <span className={currentModule.badgeClassName}>
                      {currentModule.badge}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 pl-2">
              <span className="text-xs font-bold text-primary">Cambiar</span>
              <ChevronDown
                className={`w-4 h-4 text-primary transition-transform duration-200 ${
                  isMobileNavOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>

          {/* Mobile Dropdown Panel */}
          {isMobileNavOpen && (
            <>
              <div
                className="fixed inset-0 bg-black/40 z-40 backdrop-blur-xs"
                onClick={() => setIsMobileNavOpen(false)}
              />
              <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-card border border-border rounded-2xl shadow-xl overflow-hidden divide-y divide-border/60 animate-in fade-in zoom-in-95 duration-150 max-h-[72vh] overflow-y-auto">
                <div className="p-3 bg-muted/40 flex items-center justify-between sticky top-0 z-10 backdrop-blur">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Selecciona un Módulo ({modulesList.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMobileNavOpen(false)}
                    className="text-xs text-muted-foreground hover:text-foreground font-bold px-2 py-1 cursor-pointer"
                  >
                    Cerrar ✕
                  </button>
                </div>

                <div className="p-1.5 space-y-1">
                  {modulesList.map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(mod.id);
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all cursor-pointer ${
                        activeTab === mod.id
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            activeTab === mod.id
                              ? "bg-white/20 text-white"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {mod.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {mod.label}
                          </div>
                          <div
                            className={`text-[11px] truncate ${
                              activeTab === mod.id
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground"
                            }`}
                          >
                            {mod.description}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {mod.badge && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              activeTab === mod.id
                                ? "bg-white text-primary"
                                : mod.badgeClassName
                            }`}
                          >
                            {mod.badge}
                          </span>
                        )}
                        {activeTab === mod.id && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Wide Desktop Navigation Tabs (Wraps naturally, ZERO horizontal scroll) */}
        <div className="hidden xl:flex border-b border-border gap-1 flex-wrap pb-1 w-full">
          {modulesList.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => setActiveTab(mod.id)}
              title={mod.label}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === mod.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {mod.icon}
              <span>{mod.shortLabel}</span>
              {mod.badge && (
                <span className={mod.badgeClassName}>
                  {mod.badge}
                </span>
              )}
            </button>
          ))}
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

                      <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                        {relatedOrder && (
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForModal(relatedOrder)}
                            className="px-3 py-1.5 rounded-xl border border-border bg-muted/60 hover:bg-muted text-foreground text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-primary" />
                            <span>Ver Pedido</span>
                          </button>
                        )}

                        {payment.status === "PENDING" && (
                          <>
                            <button
                              disabled={processingId === payment.id}
                              onClick={() => handleReview(payment.id, "REJECTED")}
                              className="px-3 py-1.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              Rechazar
                            </button>

                            <button
                              disabled={processingId === payment.id}
                              onClick={() => handleReview(payment.id, "APPROVED")}
                              className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                            >
                              {processingId === payment.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                              <span>Aprobar Pago</span>
                            </button>
                          </>
                        )}
                      </div>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Despacho y Seguimiento de Pedidos
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Gestiona el estado, comprobantes y entregas de tus clientes en tiempo real
                </p>
              </div>

              <button
                type="button"
                onClick={handleRefreshOrdersAndPayments}
                disabled={refreshingOrders}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingOrders ? "animate-spin" : ""}`} />
                <span>Actualizar</span>
              </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="p-3.5 rounded-2xl border border-border bg-card space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por cliente (ej. Luis Montes), teléfono (04128505629), orden (ORD-...) o producto..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {orderSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setOrderSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Status Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: "ALL", label: `Todos (${orders.length})` },
                  { id: "PAYMENT_PENDING", label: `Pendientes (${orders.filter(o => o.status === "PAYMENT_PENDING").length})` },
                  { id: "PAYMENT_APPROVED", label: `Pagados (${orders.filter(o => o.status === "PAYMENT_APPROVED").length})` },
                  { id: "PREPARING", label: `En Preparación (${orders.filter(o => o.status === "PREPARING").length})` },
                  { id: "READY", label: `Listos (${orders.filter(o => o.status === "READY").length})` },
                  { id: "DELIVERING", label: `En Camino (${orders.filter(o => o.status === "DELIVERING").length})` },
                  { id: "COMPLETED", label: `Entregados (${orders.filter(o => o.status === "COMPLETED").length})` },
                  { id: "CANCELLED", label: `Cancelados (${orders.filter(o => o.status === "CANCELLED").length})` },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setOrderStatusFilter(pill.id)}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer text-[11px] ${
                      orderStatusFilter === pill.id
                        ? "bg-primary text-primary-foreground font-bold"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-card space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  {orders.length === 0
                    ? "No hay pedidos registrados aún."
                    : "No se encontraron pedidos que coincidan con la búsqueda o filtro."}
                </p>
                {(orderSearchQuery || orderStatusFilter !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setOrderSearchQuery("");
                      setOrderStatusFilter("ALL");
                    }}
                    className="text-xs text-primary underline"
                  >
                    Restablecer filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredOrders.map((order) => {
                  const driver = drivers.find((d) => d.id === order.driver_id) || drivers[0];

                  return (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl border border-border bg-card space-y-3 hover:border-primary/30 transition-all shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-sm text-foreground">
                            {order.order_number}
                          </span>
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {order.status}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            {order.delivery_type === "DELIVERY"
                              ? "🛵 Delivery"
                              : "🏬 Retiro Tienda"}
                          </span>
                          {order.payment_status && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
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
                          <span className="text-sm font-black text-primary">
                            {formatCurrency(order.total_usd, "USD")}
                          </span>
                          <span className="block text-[11px] text-muted-foreground font-mono">
                            Bs. {order.total_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Customer info & Delivery Address */}
                      <div className="grid sm:grid-cols-2 gap-2 text-xs">
                        {(order.customer_name || order.customer_phone) && (
                          <div className="flex items-center gap-1.5 text-foreground font-medium">
                            <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>
                              <strong>Cliente:</strong> {order.customer_name || "Cliente"}
                              {order.customer_phone ? ` (${order.customer_phone})` : ""}
                            </span>
                          </div>
                        )}

                        {order.delivery_address && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="truncate">{order.delivery_address}</span>
                          </div>
                        )}
                      </div>

                      {/* Purchased Items summary preview */}
                      {order.items && order.items.length > 0 && (
                        <div className="bg-muted/40 p-2.5 rounded-xl border border-border/60 text-xs space-y-1">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="font-bold text-[10px] uppercase tracking-wider">
                              Artículos Comprados ({order.items.reduce((s, it) => s + it.quantity, 0)} unid.):
                            </span>
                          </div>
                          <p className="text-foreground text-xs leading-relaxed line-clamp-2">
                            {order.items.map((it) => `${it.quantity}x ${it.product_name}`).join(" • ")}
                          </p>
                        </div>
                      )}

                      {/* State transition workflow & action buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5 text-primary" />
                          <span>Repartidor: <strong>{driver ? driver.name : "Por asignar"}</strong></span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Ver Detalle Completo Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForModal(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold border border-primary/20 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
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
                              driverName: driver?.name,
                              driverPhone: driver?.phone,
                            })}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs font-bold border border-emerald-500/20 transition-colors cursor-pointer"
                            title="Abrir WhatsApp para enviar estado al cliente"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>

                          {order.status === "PREPARING" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "READY")}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                            >
                              Marcar Listo
                            </button>
                          )}

                          {order.status === "READY" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "DELIVERING", driver?.id)}
                              className="px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 cursor-pointer"
                            >
                              Enviar a Ruta
                            </button>
                          )}

                          {order.status === "DELIVERING" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "COMPLETED")}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
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

        {/* TAB: SALES & FINANCIAL REPORTS */}
        {activeTab === "REPORTS" && (
          <SalesReportsTab
            tenantId={settings.tenant_id}
            settings={settingsState}
            exchangeRate={rate}
            initialOrders={orders}
            initialPayments={payments}
          />
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

        {/* TAB 5: DISCOUNT COUPONS */}
        {activeTab === "COUPONS" && (
          <CouponManager
            tenantId={settings.tenant_id}
            initialCoupons={initialCoupons}
          />
        )}

        {/* TAB 6: WEB PUSH NOTIFICATIONS BROADCAST HUB */}
        {activeTab === "PUSH" && (
          <PushNotificationsManager
            tenantId={settings.tenant_id}
            settings={settingsState}
            adminEmail={currentUser?.email}
          />
        )}

        {/* TAB 7: EXCHANGE RATES & HISTORICAL LOG */}
        {activeTab === "RATES" && (
          <div className="space-y-4 animate-in fade-in">
            <ExchangeRateManager
              tenantId={settings.tenant_id}
              initialRate={rate}
              initialHistory={ratesHistory}
            />
          </div>
        )}

        {/* TAB 6: AUDIT LOGS & TRACEABILITY */}
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

        {/* TAB 8: STORE SETTINGS & BRANDING */}
        {activeTab === "SETTINGS" && (
          <StoreSettingsTab
            settings={settingsState}
            onUpdateSuccess={(updated) => setSettingsState(updated)}
          />
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

      {/* Order Details & Operational Modal */}
      <OrderDetailsModal
        order={selectedOrderForModal}
        isOpen={Boolean(selectedOrderForModal)}
        onClose={() => setSelectedOrderForModal(null)}
        settings={settingsState}
        drivers={drivers}
        onUpdateStatus={handleUpdateOrderStatus}
        onReviewPayment={async (paymentId, status) => {
          await handleReview(paymentId, status);
        }}
        paymentId={
          payments.find((p) => p.order_id === selectedOrderForModal?.id)?.id
        }
        isProcessing={processingId !== null}
      />
    </div>
  );
}
