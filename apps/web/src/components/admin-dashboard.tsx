"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
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
  Store as StoreType,
  TenantWithDetails,
  TenantPlanLimits,
  SubscriptionPlanTier,
  TenantStorageTelemetry,
  TenantModuleId,
  RawMaterial,
  ProductRecipe,
} from "@marketos/types";
import { RawMaterialsAdmin, RecipeManagerAdmin } from "@marketos/plugin-food-service";
import { MtoCpqAdminPanel } from "@marketos/plugin-mto-cpq";

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
  revokeStaffMemberAction,
  getLatestOrdersAction,
  getLatestPaymentsAction,
  createStoreAction,
  updateStoreAction,
  saveRawMaterialAction,
  deleteRawMaterialAction,
  saveProductRecipeAction,
  updateTenantSettingsAction,
} from "../app/admin/actions";
import { AdminStorefrontStudio } from "@marketos/plugin-storefront-pro";
import { stopImpersonationAction } from "../app/platform/actions";
import { logoutUserAction } from "../app/login/actions";
import { ProductModal } from "./product-modal";
import { StaffModal, ROLE_LABELS } from "./staff-modal";
import { ExchangeRateManager } from "./exchange-rate-manager";
import { StoreSettingsTab } from "./store-settings-tab";
import { CouponManager } from "./coupon-manager";
import { PushNotificationsManager } from "./push-notifications-manager";
import { OrderDetailsModal } from "./order-details-modal";
import { SalesReportsTab } from "./sales-reports-tab";
import { DeliveryManager } from "./delivery-manager";
import { AuditTrailViewer } from "./audit-trail-viewer";
import { PlanUpgradeModal } from "./plan-upgrade-modal";
import { TenantPluginsModal, AVAILABLE_PLUGINS, PluginMetadata } from "./tenant-plugins-modal";
import { PluginDetailModal } from "./plugin-detail-modal";
import { useAutoRefresh } from "../lib/use-auto-refresh";
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
  UserX,
  History,
  Volume2,
  VolumeX,
  MessageCircle,
  ShieldCheck,
  ShieldAlert,
  Users,
  LogOut,
  User,
  Pencil,
  Image as ImageIcon,
  Sparkles,
  Landmark,
  Sliders,
  LayoutTemplate,
  Ticket,
  BellRing,
  BarChart3,
  Eye,
  ChevronDown,
  Check,
  Search,
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  Smartphone,
  Layers,
  Building2,
  Phone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Zap,
  Crown,
  Cloud,
  Utensils,
  ChefHat,
  Puzzle,
  ScanBarcode,
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
  stores?: StoreType[];
  allTenants?: TenantWithDetails[];
  currentStoreId?: string;
  planLimits?: TenantPlanLimits;
  storageTelemetry?: TenantStorageTelemetry;
  activeModuleIds?: TenantModuleId[];
  initialRawMaterials?: RawMaterial[];
  initialRecipes?: ProductRecipe[];
}

interface AdminToast {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
  durationMs?: number;
}

const STATUS_SPANISH_LABELS: Record<OrderStatus, string> = {
  CREATED: "Recibido",
  PAYMENT_PENDING: "Validando Pago",
  PAYMENT_APPROVED: "Pago Aprobado",
  PREPARING: "En Preparación",
  READY: "Listo para Despacho",
  DELIVERING: "En Ruta",
  COMPLETED: "Entregado",
  CANCELLED: "Cancelado",
};

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
  stores: initialStores = [],
  allTenants = [],
  currentStoreId,
  planLimits,
  storageTelemetry,
  activeModuleIds = [],
  initialRawMaterials = [],
  initialRecipes = [],
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    | "PAYMENTS"
    | "ORDERS"
    | "REPORTS"
    | "INVENTORY"
    | "DELIVERY"
    | "COUPONS"
    | "PUSH"
    | "RATES"
    | "AUDIT"
    | "STAFF"
    | "SETTINGS"
    | "STORES"
    | "RAW_MATERIALS"
    | "RECIPES"
    | "PLUGINS"
    | "STOREFRONT_STUDIO"
    | "MTO_CPQ"
  >("PAYMENTS");

  const [settingsState, setSettingsState] = useState(settings);
  const [products, setProducts] = useState(initialProducts);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(initialRawMaterials);
  const [recipes, setRecipes] = useState<ProductRecipe[]>(initialRecipes);
  const [orders, setOrders] = useState(initialOrders);
  const [payments, setPayments] = useState(initialPayments);
  const [rate, setRate] = useState(initialRate);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [staff, setStaff] = useState<UserProfile[]>(initialStaffMembers);

  // Ponytail Ultra: Auto-refresh admin data (orders, rate, payments) on tab focus and every 45s
  useAutoRefresh(45000);

  useEffect(() => {
    setRate(initialRate);
  }, [initialRate]);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    setPayments(initialPayments);
  }, [initialPayments]);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    setAuditLogs(initialAuditLogs);
  }, [initialAuditLogs]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [auditFilter, setAuditFilter] = useState<string>("ALL");
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");
  const [stores, setStores] = useState<StoreType[]>(initialStores);
  const [storeFilter, setStoreFilter] = useState<string>(currentStoreId || "ALL");
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreCode, setNewStoreCode] = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");
  const [newStorePhone, setNewStorePhone] = useState("");
  const [savingStore, setSavingStore] = useState(false);

  // SaaS Plan Limits & Quota Control State
  const [planLimitsState, setPlanLimitsState] = useState<TenantPlanLimits | undefined>(planLimits);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [upgradeModalQuotaType, setUpgradeModalQuotaType] = useState<
    "products" | "stores" | "coupons" | "drivers" | "custom_domain" | "general"
  >("general");

  const triggerUpgradeModal = (
    type: "products" | "stores" | "coupons" | "drivers" | "custom_domain" | "general" = "general"
  ) => {
    setUpgradeModalQuotaType(type);
    setIsUpgradeModalOpen(true);
  };

  const [isPluginsModalOpen, setIsPluginsModalOpen] = useState(false);
  const [selectedPluginForDetail, setSelectedPluginForDetail] = useState<PluginMetadata | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [syncingBcv, setSyncingBcv] = useState(false);
  const [bcvMessage, setBcvMessage] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [refreshingOrders, setRefreshingOrders] = useState(false);
  const [isStoppingImpersonation, setIsStoppingImpersonation] = useState(false);

  const handleStopImpersonation = async () => {
    setIsStoppingImpersonation(true);
    try {
      const res = await stopImpersonationAction();
      if (res.success && res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        window.location.href = "/platform";
      }
    } catch {
      window.location.href = "/platform";
    }
  };

  // Reactive Toast Notification with Countdown Progress Bar
  const [toast, setToast] = useState<AdminToast | null>(null);
  const [toastProgress, setToastProgress] = useState(100);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toastProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback(
    (toastData: {
      type: "success" | "error" | "info";
      title: string;
      message: string;
      durationMs?: number;
    }) => {
      const duration = toastData.durationMs || 4000;
      const id = Date.now().toString();

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastProgressIntervalRef.current) clearInterval(toastProgressIntervalRef.current);

      setToast({ ...toastData, id, durationMs: duration });
      setToastProgress(100);

      const startTime = Date.now();
      toastProgressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
        setToastProgress(remaining);
        if (remaining <= 0) {
          if (toastProgressIntervalRef.current) clearInterval(toastProgressIntervalRef.current);
        }
      }, 30);

      toastTimerRef.current = setTimeout(() => {
        setToast(null);
      }, duration);
    },
    []
  );

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (toastProgressIntervalRef.current) clearInterval(toastProgressIntervalRef.current);
    setToast(null);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastProgressIntervalRef.current) clearInterval(toastProgressIntervalRef.current);
    };
  }, []);

  const filteredOrders = orders.filter((order) => {
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
        showToast({
          type: "success",
          title: "Rol Actualizado",
          message: `El permiso se ha modificado a ${newRole}.`,
        });
      } else {
        showToast({
          type: "error",
          title: "Error al cambiar rol",
          message: res.error || "No se pudo actualizar el rol.",
        });
      }
    } catch (err: any) {
      console.error("Error updating role:", err);
      showToast({
        type: "error",
        title: "Error",
        message: err.message || "Error al actualizar rol.",
      });
    } finally {
      setUpdatingStaffId(null);
    }
  };

  const [revokingStaffId, setRevokingStaffId] = useState<string | null>(null);

  const handleRevokeStaff = async (profileId: string, name: string) => {
    if (!window.confirm(`¿Estás seguro de revocar el acceso de "${name}" a esta tienda?`)) {
      return;
    }
    setRevokingStaffId(profileId);
    try {
      const res = await revokeStaffMemberAction(settings.tenant_id, profileId);
      if (res.success) {
        setStaff((prev) => prev.filter((s) => s.id !== profileId));
        showToast({
          type: "success",
          title: "Colaborador Revocado",
          message: `Se ha revocado el acceso de ${name} a este comercio.`,
        });
      } else {
        showToast({
          type: "error",
          title: "Error al revocar acceso",
          message: res.error || "No se pudo revocar al colaborador.",
        });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Error inesperado",
        message: err.message || "Error al procesar revocación.",
      });
    } finally {
      setRevokingStaffId(null);
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

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      showToast({
        type: "error",
        title: "Nombre requerido",
        message: "Por favor ingresa el nombre de la sucursal.",
      });
      return;
    }
    setSavingStore(true);
    try {
      const res = await createStoreAction({
        tenantId: settingsState.tenant_id,
        name: newStoreName.trim(),
        code: newStoreCode.trim() || undefined,
        address: newStoreAddress.trim() || undefined,
        phone: newStorePhone.trim() || undefined,
        isActive: true,
      });
      if (res.success && res.store) {
        setStores((prev) => [...prev, res.store!]);
        setIsStoreModalOpen(false);
        setNewStoreName("");
        setNewStoreCode("");
        setNewStoreAddress("");
        setNewStorePhone("");
        showToast({
          type: "success",
          title: "Sucursal Creada",
          message: `La sucursal "${res.store.name}" fue creada y registrada exitosamente.`,
        });
      } else {
        if (res.quotaExceeded) {
          setIsStoreModalOpen(false);
          triggerUpgradeModal("stores");
        }
        showToast({
          type: "error",
          title: res.quotaExceeded ? "Límite de Sucursales Alcanzado" : "Error al crear sucursal",
          message: res.error || "No se pudo registrar la sucursal.",
        });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Error de conexión",
        message: err.message || "Ocurrió un error al registrar la sucursal.",
      });
    } finally {
      setSavingStore(false);
    }
  };

  const handleToggleStoreStatus = async (store: StoreType) => {
    try {
      const res = await updateStoreAction(store.id, {
        is_active: !store.is_active,
      });
      if (res.success && res.store) {
        setStores((prev) =>
          prev.map((s) => (s.id === store.id ? res.store! : s))
        );
        showToast({
          type: "success",
          title: "Estado de Sucursal Actualizado",
          message: `Sucursal "${store.name}" ahora está ${!store.is_active ? "activa" : "inactiva"}.`,
        });
      } else {
        showToast({
          type: "error",
          title: "Error al actualizar",
          message: res.error || "No se pudo actualizar la sucursal.",
        });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Error",
        message: err.message || "Ocurrió un error al actualizar la sucursal.",
      });
    }
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
    try {
      // 1. Optimistic update
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, status } : p))
      );

      const res = await reviewPaymentAction(settings.tenant_id, paymentId, status);
      if (res.success) {
        // 2. Fresh internal sync of orders and payments without global F5
        const [oRes, pRes] = await Promise.all([
          getLatestOrdersAction(settings.tenant_id),
          getLatestPaymentsAction(settings.tenant_id),
        ]);
        const targetOrderId = res.payment?.order_id || selectedOrderForModal?.id;
        if (oRes.success && oRes.orders) {
          setOrders(oRes.orders);
          if (targetOrderId) {
            const fresh = oRes.orders.find((o) => o.id === targetOrderId);
            if (fresh) setSelectedOrderForModal(fresh);
          }
        }
        if (pRes.success && pRes.payments) {
          setPayments(pRes.payments);
        }

        // 3. Audio & animated alert toast with countdown progress bar
        playChime();
        showToast({
          type: status === "APPROVED" ? "success" : "error",
          title: status === "APPROVED" ? "¡Pago Aprobado y Conciliado!" : "¡Pago Rechazado!",
          message:
            status === "APPROVED"
              ? "Comprobante verificado. El pedido pasó automáticamente a Preparación."
              : "Comprobante rechazado. El pedido se canceló y se reintegró el stock a inventario.",
        });
      } else {
        showToast({
          type: "error",
          title: "Error al revisar pago",
          message: res.error || "No se pudo actualizar el comprobante.",
        });
      }
    } catch (err: any) {
      console.error(err);
      showToast({
        type: "error",
        title: "Error inesperado",
        message: err.message || "Ocurrió un error al procesar el pago.",
      });
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
      // 1. Optimistic local update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus, driver_id: driverId || o.driver_id } : o))
      );
      if (selectedOrderForModal?.id === orderId) {
        setSelectedOrderForModal((prev) =>
          prev ? { ...prev, status: newStatus, driver_id: driverId || prev.driver_id } : null
        );
      }

      const res = await updateOrderStatusAction(
        settings.tenant_id,
        orderId,
        newStatus,
        driverId
      );

      if (res.success) {
        // 2. Refresh latest orders and payments internally from server (No global F5 needed!)
        const [oRes, pRes] = await Promise.all([
          getLatestOrdersAction(settings.tenant_id),
          getLatestPaymentsAction(settings.tenant_id),
        ]);
        if (oRes.success && oRes.orders) {
          setOrders(oRes.orders);
          const freshOrder = oRes.orders.find((o) => o.id === orderId);
          if (freshOrder && selectedOrderForModal?.id === orderId) {
            setSelectedOrderForModal(freshOrder);
          }
        }
        if (pRes.success && pRes.payments) {
          setPayments(pRes.payments);
        }

        // 3. Audio & animated alert toast with countdown progress bar
        playChime();
        const readableStatus = STATUS_SPANISH_LABELS[newStatus] || newStatus;
        showToast({
          type: "success",
          title: "¡Estado de Pedido Actualizado!",
          message: `El pedido fue cambiado a "${readableStatus}" exitosamente. Sincronizado en tiempo real.`,
        });
      } else {
        showToast({
          type: "error",
          title: "Error al actualizar estado",
          message: res.error || "No se pudo actualizar el estado de la orden.",
        });
      }
    } catch (err: any) {
      console.error(err);
      showToast({
        type: "error",
        title: "Error de conexión",
        message: err.message || "Ocurrió un error inesperado al actualizar el pedido.",
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Food Service Plugin Handlers
  const handleSaveRawMaterial = async (
    material: Partial<RawMaterial> & { tenant_id: string; store_id: string; name: string }
  ) => {
    try {
      const res = await saveRawMaterialAction(material);
      if (res.success && res.rawMaterial) {
        setRawMaterials((prev) => {
          const idx = prev.findIndex((m) => m.id === res.rawMaterial!.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = res.rawMaterial!;
            return next;
          }
          return [res.rawMaterial!, ...prev];
        });
        showToast({
          type: "success",
          title: "Insumo Guardado",
          message: `Insumo de cocina "${res.rawMaterial.name}" guardado exitosamente.`,
        });
      } else {
        showToast({
          type: "error",
          title: "Error al guardar",
          message: res.error || "No se pudo guardar el insumo.",
        });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Error",
        message: err.message || "Error al guardar insumo.",
      });
    }
  };

  const handleDeleteRawMaterial = async (id: string) => {
    try {
      const res = await deleteRawMaterialAction(settings.tenant_id, id);
      if (res.success) {
        setRawMaterials((prev) => prev.filter((m) => m.id !== id));
        showToast({
          type: "success",
          title: "Insumo Eliminado",
          message: "El insumo fue removido de la cocina.",
        });
      } else {
        showToast({
          type: "error",
          title: "Error al eliminar",
          message: res.error || "No se pudo eliminar el insumo.",
        });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Error",
        message: err.message || "Error al eliminar insumo.",
      });
    }
  };

  const handleSaveRecipe = async (recipe: ProductRecipe) => {
    try {
      const res = await saveProductRecipeAction(recipe);
      if (res.success && res.recipe) {
        setRecipes((prev) => {
          const idx = prev.findIndex(
            (r) => r.id === res.recipe!.id || r.product_id === res.recipe!.product_id
          );
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = res.recipe!;
            return next;
          }
          return [...prev, res.recipe!];
        });
        showToast({
          type: "success",
          title: "Receta Guardada",
          message: "Ficha técnica y escandallo de costos actualizados exitosamente.",
        });
      } else {
        showToast({
          type: "error",
          title: "Error al guardar receta",
          message: res.error || "No se pudo guardar la receta.",
        });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Error",
        message: err.message || "Error inesperado al guardar receta.",
      });
    }
  };

  const pendingPaymentsCount = payments.filter((p) => p.status === "PENDING").length;

  type ModuleCategory = "OPERATIONS" | "CATALOG" | "FINANCE" | "MANAGEMENT";

  interface ModuleItem {
    id:
      | "PAYMENTS"
      | "ORDERS"
      | "REPORTS"
      | "INVENTORY"
      | "DELIVERY"
      | "COUPONS"
      | "PUSH"
      | "RATES"
      | "AUDIT"
      | "STAFF"
      | "SETTINGS"
      | "STORES"
      | "RAW_MATERIALS"
      | "RECIPES"
      | "PLUGINS"
      | "STOREFRONT_STUDIO"
      | "MTO_CPQ";

    category: ModuleCategory;
    label: string;
    shortLabel: string;
    description: string;
    icon: React.ReactNode;
    badge: string | null;
    badgeClassName: string;
  }

  const moduleCategories: {
    id: ModuleCategory;
    title: string;
  }[] = [
    { id: "OPERATIONS", title: "Operaciones" },
    { id: "CATALOG", title: "Catálogo & Marketing" },
    { id: "FINANCE", title: "Finanzas" },
    { id: "MANAGEMENT", title: "Administración" },
  ];

  const rawModulesList: ModuleItem[] = [
    // 1. Operaciones
    {
      id: "PAYMENTS",
      category: "OPERATIONS",
      label: "Validación de Pagos",
      shortLabel: "Pagos",
      description: activeModuleIds.includes("local_venezuela")
        ? "Pago Móvil, Zelle y transferencias"
        : "Validación de comprobantes y transferencias",
      icon: <FileCheck2 className="w-4 h-4 shrink-0" />,
      badge: pendingPaymentsCount > 0 ? `${pendingPaymentsCount}` : null,
      badgeClassName: "bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black",
    },
    {
      id: "ORDERS",
      category: "OPERATIONS",
      label: `Gestión y Despacho (${orders.length})`,
      shortLabel: `Pedidos (${orders.length})`,
      description: "Estados, rutas y contacto WhatsApp",
      icon: <PackageCheck className="w-4 h-4 shrink-0" />,
      badge: orders.length > 0 ? `${orders.length}` : null,
      badgeClassName: "bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    ...(activeModuleIds.includes("delivery_fleet")
      ? [
          {
            id: "DELIVERY" as const,
            category: "OPERATIONS" as const,
            label: "Delivery y Repartidores",
            shortLabel: "Delivery",
            description: "Zonas, tarifas y motorizados",
            icon: <Truck className="w-4 h-4 shrink-0" />,
            badge: deliveryZones.length > 0 ? `${deliveryZones.length}` : null,
            badgeClassName: "bg-blue-500/10 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
          },
        ]
      : []),

    // 2. Catálogo & Marketing
    {
      id: "INVENTORY",
      category: "CATALOG",
      label: `Inventario en Tienda (${products.length})`,
      shortLabel: `Inventario (${products.length})`,
      description: "Productos, precios y existencias",
      icon: <Boxes className="w-4 h-4 shrink-0" />,
      badge: `${products.length}`,
      badgeClassName: "bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    ...(activeModuleIds.includes("food_service")
      ? [
          {
            id: "RAW_MATERIALS" as const,
            category: "CATALOG" as const,
            label: "Insumos de Cocina",
            shortLabel: "Insumos",
            description: "Carnes, panes, salsas y materia prima",
            icon: <Utensils className="w-4 h-4 shrink-0" />,
            badge: "Cocina",
            badgeClassName:
              "bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
          },
          {
            id: "RECIPES" as const,
            category: "CATALOG" as const,
            label: "Recetas & Escandallo",
            shortLabel: "Recetas",
            description: "Fichas técnicas, costo unitario y margen bruto",
            icon: <ChefHat className="w-4 h-4 shrink-0" />,
            badge: "BOM",
            badgeClassName:
              "bg-orange-500/10 text-orange-600 border border-orange-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
          },
        ]
      : []),
    ...(activeModuleIds.includes("promotions_coupons")
      ? [
          {
            id: "COUPONS" as const,
            category: "CATALOG" as const,
            label: `Cupones de Descuento (${initialCoupons.length})`,
            shortLabel: `Cupones (${initialCoupons.length})`,
            description: "Descuentos en $ o % y fechas límite",
            icon: <Ticket className="w-4 h-4 shrink-0" />,
            badge: initialCoupons.length > 0 ? `${initialCoupons.length}` : null,
            badgeClassName: "bg-purple-500/10 text-purple-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
          },
        ]
      : []),
    {
      id: "PUSH",
      category: "CATALOG",
      label: "Notificaciones Push",
      shortLabel: "Push",
      description: "Difusiones Web Push a móviles",
      icon: <BellRing className="w-4 h-4 shrink-0" />,
      badge: "PWA",
      badgeClassName: "bg-amber-500/10 text-amber-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    ...(activeModuleIds.includes("storefront_pro")
      ? [
          {
            id: "STOREFRONT_STUDIO" as const,
            category: "CATALOG" as const,
            label: "Vitrina Visual Pro & Studio",
            shortLabel: "Vitrina Pro",
            description: "Banners, sliders, reseñas y maquetador",
            icon: <LayoutTemplate className="w-4 h-4 shrink-0" />,
            badge: "10 Bloques",
            badgeClassName: "bg-rose-500/10 text-rose-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
          },
        ]
      : []),
    ...(activeModuleIds.includes("mto_cpq")
      ? [
          {
            id: "MTO_CPQ" as const,
            category: "CATALOG" as const,
            label: "Cotizador MTO / Taller",
            shortLabel: "Taller & MTO",
            description: "Matrices por m²/lineal, costeo CPQ y anticipos",
            icon: <Layers className="w-4 h-4 shrink-0" />,
            badge: "Taller Activo",
            badgeClassName: "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
          },
        ]
      : []),


    // 3. Finanzas
    {
      id: "REPORTS",
      category: "FINANCE",
      label: "Reportes & Ventas",
      shortLabel: "Reportes",
      description: activeModuleIds.includes("local_venezuela")
        ? "Ingresos en $ y Bs, métodos y top ventas"
        : "Ingresos en $, métodos y top ventas",
      icon: <BarChart3 className="w-4 h-4 shrink-0" />,
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
    ...(activeModuleIds.includes("local_venezuela")
      ? [
          {
            id: "RATES" as const,
            category: "FINANCE" as const,
            label: `Tasas y Divisas (${ratesHistory.length})`,
            shortLabel: "Tasas & BCV",
            description: "Monitor oficial BCV e histórico",
            icon: <Landmark className="w-4 h-4 shrink-0" />,
            badge: `Bs. ${rate.value.toFixed(2)}`,
            badgeClassName: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold",
          },
        ]
      : []),

    // 4. Administración
    {
      id: "STORES",
      category: "MANAGEMENT",
      label: `Sucursales (${stores.length})`,
      shortLabel: `Sucursales (${stores.length})`,
      description: "Sedes físicas y puntos de despacho",
      icon: <Building2 className="w-4 h-4 shrink-0" />,
      badge: stores.length > 0 ? `${stores.length}` : null,
      badgeClassName: "bg-indigo-500/10 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "STAFF",
      category: "MANAGEMENT",
      label: `Equipo y Roles (${staff.length})`,
      shortLabel: `Equipo (${staff.length})`,
      description: "Colaboradores y permisos RBAC",
      icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
      badge: `${staff.length}`,
      badgeClassName: "bg-emerald-500/10 text-emerald-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "AUDIT",
      category: "MANAGEMENT",
      label: `Auditoría & Logs (${auditLogs.length})`,
      shortLabel: `Auditoría (${auditLogs.length})`,
      description: "Registro cronológico inmutable",
      icon: <History className="w-4 h-4 shrink-0" />,
      badge: auditLogs.length > 0 ? `${auditLogs.length}` : null,
      badgeClassName: "bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "SETTINGS",
      category: "MANAGEMENT",
      label: "Configuración & Marca",
      shortLabel: "Ajustes",
      description: "Dirección, cuentas, pagos y diseño",
      icon: <Sliders className="w-4 h-4 shrink-0" />,
      badge: "Tienda",
      badgeClassName: "bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "PLUGINS",
      category: "MANAGEMENT",
      label: `Módulos & Plugins (${activeModuleIds.length})`,
      shortLabel: "Plugins",
      description: "Extensiones y capacidades activas",
      icon: <Puzzle className="w-4 h-4 shrink-0" />,
      badge: `${activeModuleIds.length} activos`,
      badgeClassName: "bg-purple-500/10 text-purple-600 border border-purple-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
  ];

  // Matriz estricta de permisos por rol (RBAC)
  const MODULE_ROLE_PERMISSIONS: Record<string, UserRole[]> = {
    // 1. Operaciones
    PAYMENTS: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_CASHIER"],
    ORDERS: [
      "PLATFORM_SUPER_ADMIN",
      "TENANT_OWNER",
      "TENANT_MANAGER",
      "TENANT_CASHIER",
      "TENANT_INVENTORY",
      "TENANT_DELIVERY",
    ],
    DELIVERY: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_DELIVERY"],

    // 2. Catálogo & Marketing
    INVENTORY: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_INVENTORY"],
    RAW_MATERIALS: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_INVENTORY"],
    RECIPES: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_INVENTORY"],
    MTO_CPQ: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_INVENTORY"],
    COUPONS: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER"],

    PUSH: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER"],

    // 3. Finanzas
    REPORTS: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER"],
    RATES: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_CASHIER"],

    // 4. Administración & Gobierno (Exclusivo Dueño / Super Admin / Gerente)
    STORES: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER"],
    STAFF: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER"],
    AUDIT: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER"],
    SETTINGS: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER"],
    PLUGINS: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER"],
  };

  const userRole: UserRole = currentUser?.role || "TENANT_OWNER";
  const isSuperAdminOrImpersonating =
    userRole === "PLATFORM_SUPER_ADMIN" || Boolean(currentUser?.impersonation);

  const modulesList: ModuleItem[] = rawModulesList.filter((m) => {
    if (isSuperAdminOrImpersonating) return true;
    const allowed = MODULE_ROLE_PERMISSIONS[m.id];
    return !allowed || allowed.includes(userRole);
  });

  const currentModule = modulesList.find((m) => m.id === activeTab) || modulesList[0];

  // Auto-correct activeTab if current tab is not permitted or enabled for this role/tenant
  useEffect(() => {
    const isCurrentTabValid = modulesList.some((m) => m.id === activeTab);
    if (!isCurrentTabValid && modulesList.length > 0) {
      setActiveTab(modulesList[0].id);
    }
  }, [activeModuleIds, activeTab, modulesList]);

  return (
    <div className="min-h-screen bg-background text-foreground flex w-full max-w-full overflow-x-hidden">
      {/* 1. DESKTOP LEFT SIDEBAR */}
      <aside
        className={`hidden lg:flex flex-col border-r border-border bg-card/75 backdrop-blur sticky top-0 h-screen shrink-0 transition-all duration-300 z-30 select-none ${
          isSidebarCollapsed ? "w-20" : "w-64 xl:w-72"
        }`}
      >
        {/* Sidebar Header: Logo, Name, Toggle */}
        <div className={`p-3.5 border-b border-border flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-between"} gap-2`}>
          {!isSidebarCollapsed ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                {settingsState.logo_url ? (
                  <img
                    src={settingsState.logo_url}
                    alt={settingsState.business_name}
                    className="h-9 w-9 object-contain rounded-xl bg-card border border-border p-0.5 shadow-xs shrink-0"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shadow-sm tracking-tighter shrink-0">
                    {settingsState.business_name ? settingsState.business_name.substring(0, 2).toUpperCase() : "SM"}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-extrabold text-sm tracking-tight text-foreground truncate">
                    {settingsState.business_name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.2 rounded-full shrink-0">
                      Tenant
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {settingsState.tenant_id}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => triggerUpgradeModal("general")}
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-xs ${
                        planLimitsState?.plan.id === "ENTERPRISE"
                          ? "bg-purple-500/10 text-purple-600 border-purple-500/30"
                          : planLimitsState?.plan.id === "GROWTH"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                      }`}
                      title="Plan SaaS Activo - Clic para ver cuotas y planes"
                    >
                      {planLimitsState?.plan.id === "ENTERPRISE" ? (
                        <Crown className="w-3 h-3 text-purple-500" />
                      ) : planLimitsState?.plan.id === "GROWTH" ? (
                        <Sparkles className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Zap className="w-3 h-3 text-amber-500" />
                      )}
                      <span>{planLimitsState?.plan.name || "Plan Starter"}</span>
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                title="Colapsar menú lateral"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              {settingsState.logo_url ? (
                <img
                  src={settingsState.logo_url}
                  alt={settingsState.business_name}
                  className="h-9 w-9 object-contain rounded-xl bg-card border border-border p-0.5 shadow-xs shrink-0"
                />
              ) : (
                <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shadow-sm tracking-tighter shrink-0">
                  {settingsState.business_name ? settingsState.business_name.substring(0, 2).toUpperCase() : "SM"}
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Expandir menú lateral"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Nav: Categorized list */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
          {moduleCategories.map((cat) => {
            const catModules = modulesList.filter((m) => m.category === cat.id);
            if (catModules.length === 0) return null;
            return (
              <div key={cat.id} className="space-y-1">
                {!isSidebarCollapsed ? (
                  <div className="px-2.5 pt-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">
                    {cat.title}
                  </div>
                ) : (
                  <div className="border-t border-border/60 my-2 mx-1" />
                )}
                <div className="space-y-0.5">
                  {catModules.map((mod) => {
                    const isActive = activeTab === mod.id;
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => setActiveTab(mod.id)}
                        title={isSidebarCollapsed ? `${mod.label} ${mod.badge ? `(${mod.badge})` : ""}` : mod.description}
                        className={`w-full flex items-center rounded-xl transition-all cursor-pointer ${
                          isSidebarCollapsed
                            ? "justify-center p-2.5 relative"
                            : "justify-between px-3 py-2 text-left"
                        } ${
                          isActive
                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        }`}
                      >
                        <div className={`flex items-center min-w-0 ${isSidebarCollapsed ? "" : "gap-2.5"}`}>
                          <span className={isActive ? "text-primary-foreground" : "text-muted-foreground"}>
                            {mod.icon}
                          </span>
                          {!isSidebarCollapsed && (
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate leading-tight">
                                {mod.shortLabel}
                              </div>
                            </div>
                          )}
                        </div>

                        {!isSidebarCollapsed ? (
                          mod.badge && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-1.5 ${
                                isActive ? "bg-white text-primary" : mod.badgeClassName
                              }`}
                            >
                              {mod.badge}
                            </span>
                          )
                        ) : (
                          mod.badge && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-card" />
                          )
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-2.5 border-t border-border bg-card/40 flex flex-col gap-1">
          <a
            href={`/?tenant=${settingsState.tenant_id}`}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors ${
              isSidebarCollapsed ? "justify-center p-2.5" : "gap-2 px-3 py-2"
            }`}
            title="Abrir tienda pública PWA"
          >
            <Smartphone className="w-4 h-4 text-primary shrink-0" />
            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="truncate">Ver Tienda PWA</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </div>
            )}
          </a>
        </div>
      </aside>

      {/* 2. MOBILE DRAWER SLIDE-OVER */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-[85%] max-w-xs bg-card border-r border-border shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                {settingsState.logo_url ? (
                  <img
                    src={settingsState.logo_url}
                    alt={settingsState.business_name}
                    className="h-8 w-8 object-contain rounded-xl bg-card border border-border p-0.5 shrink-0"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xs shrink-0">
                    {settingsState.business_name ? settingsState.business_name.substring(0, 2).toUpperCase() : "SM"}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-extrabold text-xs text-foreground truncate">
                    {settingsState.business_name}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    Módulos Administrativos
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Modules */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {moduleCategories.map((cat) => {
                const catModules = modulesList.filter((m) => m.category === cat.id);
                if (catModules.length === 0) return null;
                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="px-2 pt-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      {cat.title}
                    </div>
                    <div className="space-y-0.5">
                      {catModules.map((mod) => {
                        const isActive = activeTab === mod.id;
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => {
                              setActiveTab(mod.id);
                              setIsMobileNavOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                              isActive
                                ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={isActive ? "text-primary-foreground" : "text-muted-foreground"}>
                                {mod.icon}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate leading-tight">
                                  {mod.label}
                                </div>
                                <div
                                  className={`text-[10px] truncate ${
                                    isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                                  }`}
                                >
                                  {mod.description}
                                </div>
                              </div>
                            </div>
                            {mod.badge && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                                  isActive ? "bg-white text-primary" : mod.badgeClassName
                                }`}
                              >
                                {mod.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-border bg-muted/20">
              <a
                href={`/?tenant=${settingsState.tenant_id}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-card border border-border text-xs font-bold text-foreground hover:bg-muted transition-colors"
              >
                <Smartphone className="w-4 h-4 text-primary" />
                <span>Ver Tienda PWA</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>
            </div>
          </aside>
        </div>
      )}

      {/* 3. RIGHT MAIN CONTENT COLUMN */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-background">
        {/* Top Header */}
        <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20 w-full">
          <div className="px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
            {/* Left: Mobile hamburger + Active module title */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground cursor-pointer shrink-0"
                title="Abrir menú"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground hidden sm:inline">
                    {moduleCategories.find((c) => c.id === currentModule.category)?.title || "Dashboard"} /
                  </span>
                  <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-foreground truncate flex items-center gap-2">
                    <span>{currentModule.label}</span>
                    {currentModule.badge && (
                      <span className={currentModule.badgeClassName}>
                        {currentModule.badge}
                      </span>
                    )}
                  </h1>
                </div>
                <p className="text-[11px] text-muted-foreground truncate hidden md:block">
                  {currentModule.description}
                </p>
              </div>
            </div>

            {/* Right: Quick actions (Plan SaaS, BCV, Sonido, Sync, Refresh, User, Logout) */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* SaaS Plan Tier Indicator Button */}
              <button
                type="button"
                onClick={() => triggerUpgradeModal("general")}
                className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs ${
                  planLimitsState?.plan.id === "ENTERPRISE"
                    ? "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400"
                    : planLimitsState?.plan.id === "GROWTH"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
                }`}
                title="Límites y Cuotas de tu Plan SaaS - Clic para ver opciones"
              >
                {planLimitsState?.plan.id === "ENTERPRISE" ? (
                  <Crown className="w-3.5 h-3.5 text-purple-500" />
                ) : planLimitsState?.plan.id === "GROWTH" ? (
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>{planLimitsState?.plan.name || "Plan Starter"}</span>
              </button>

              {activeModuleIds.includes("local_venezuela") && (
                <button
                  onClick={() => setActiveTab("RATES")}
                  className="hidden md:flex items-center gap-1.5 text-xs bg-muted/60 hover:bg-muted border border-border px-2.5 py-1.5 rounded-xl font-mono transition-colors cursor-pointer"
                  title="Clic para ver monitor de tasas e histórico"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span>BCV:</span>
                  <strong className="text-foreground">
                    Bs. {rate.value.toFixed(2)}
                  </strong>
                </button>
              )}

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

              {activeModuleIds.includes("local_venezuela") && (
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
              )}

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
                <span className="hidden sm:inline">Actualizar</span>
              </button>

              {/* Cloudflare R2 Storage Usage Meter */}
              {storageTelemetry && (
                <button
                  type="button"
                  onClick={() => setIsStorageModalOpen(true)}
                  className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-border bg-card hover:bg-muted/60 text-foreground transition-all shadow-xs cursor-pointer"
                  title={`Almacenamiento Cloudflare R2: ${storageTelemetry.totalSizeFormatted} de ${storageTelemetry.quotaFormatted} (${storageTelemetry.percentUsed}% en uso). Clic para ver desglose.`}
                >
                  <Cloud className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-1 font-bold text-[11px] leading-tight">
                      <span>R2: {storageTelemetry.totalSizeFormatted}</span>
                      <span className="text-muted-foreground font-normal">/ {storageTelemetry.quotaFormatted}</span>
                    </div>
                    <div className="w-16 h-1 bg-muted rounded-full overflow-hidden mt-0.5">
                      <div
                        className={`h-full rounded-full transition-all ${
                          storageTelemetry.percentUsed >= 95
                            ? "bg-red-500"
                            : storageTelemetry.percentUsed >= 80
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(2, storageTelemetry.percentUsed))}%` }}
                      />
                    </div>
                  </div>
                </button>
              )}

              {currentUser && (
                <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-border">
                  <div className="hidden 2xl:flex flex-col text-right">
                    <span className="text-xs font-bold text-foreground truncate max-w-[120px]">
                      {currentUser.full_name}
                    </span>
                    {currentUser.impersonation ? (
                      <span className="text-[10px] text-purple-400 font-extrabold flex items-center justify-end gap-1">
                        <span>🎭 Modo Soporte</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {ROLE_LABELS[currentUser.role]?.label || currentUser.role}
                      </span>
                    )}
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
        <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex-1 w-full space-y-5 overflow-x-hidden">
        {/* PLATFORM SUPPORT IMPERSONATION BANNER ("LOGIN AS") */}
        {currentUser?.impersonation ? (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 border border-purple-500/50 text-white shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0 text-xl shadow-inner text-purple-300">
                🎭
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500 text-black px-2 py-0.5 rounded-md shadow-xs">
                    Modo Soporte Activo ("Login As")
                  </span>
                  <span className="text-xs text-purple-200">
                    Operando con permisos completos de Dueño
                  </span>
                </div>
                <div className="text-sm font-bold text-white truncate flex items-center gap-2 mt-0.5">
                  <span>{settingsState.business_name}</span>
                  <span className="text-xs font-mono text-purple-300">({settingsState.tenant_id})</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-purple-200 font-normal truncate">
                    Auditado bajo Super Admin: <strong className="text-white">{currentUser.impersonation.originalSuperAdmin.fullName}</strong> ({currentUser.impersonation.originalSuperAdmin.email})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {allTenants && allTenants.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-purple-200 font-medium hidden lg:inline">Cambiar Comercio:</span>
                  <select
                    value={settingsState.tenant_id}
                    onChange={(e) => {
                      window.location.href = `/admin?tenant=${e.target.value}`;
                    }}
                    className="h-9 px-3 rounded-xl bg-slate-900 border border-purple-500/30 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    {allTenants.map((t) => (
                      <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                        {t.name} ({t.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={handleStopImpersonation}
                disabled={isStoppingImpersonation}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all cursor-pointer shadow-md hover:shadow-lg disabled:opacity-50"
                title="Cerrar la sesión de soporte técnico y regresar a la Consola Master"
              >
                {isStoppingImpersonation ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saliendo...</span>
                  </>
                ) : (
                  <>
                    <span>🚪 Salir de Modo Soporte</span>
                  </>
                )}
              </button>

              <a
                href={`/?tenant=${settingsState.tenant_id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Ver Tienda PWA</span>
                <ExternalLink className="w-3 h-3 text-purple-300" />
              </a>
            </div>
          </div>
        ) : currentUser?.role === "PLATFORM_SUPER_ADMIN" ? (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/40 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500 text-white px-2 py-0.5 rounded-md">
                    Modo Super Admin Maestro
                  </span>
                  <span className="text-xs text-indigo-200">
                    Inspección activa de Comercio y Sucursales
                  </span>
                </div>
                <div className="text-sm font-bold text-white truncate flex items-center gap-2 mt-0.5">
                  <span>{settingsState.business_name}</span>
                  <span className="text-xs font-mono text-indigo-300">({settingsState.tenant_id})</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {allTenants && allTenants.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-indigo-200 font-medium hidden lg:inline">Cambiar Comercio:</span>
                  <select
                    value={settingsState.tenant_id}
                    onChange={(e) => {
                      window.location.href = `/admin?tenant=${e.target.value}`;
                    }}
                    className="h-9 px-3 rounded-xl bg-slate-900 border border-indigo-500/30 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {allTenants.map((t) => (
                      <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                        {t.name} ({t.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <a
                href="/platform"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                <span>← Consola Master SaaS</span>
              </a>

              <a
                href={`/?tenant=${settingsState.tenant_id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Ver Tienda PWA</span>
                <ExternalLink className="w-3 h-3 text-indigo-300" />
              </a>
            </div>
          </div>
        ) : null}
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

          {activeModuleIds.includes("delivery_fleet") ? (
            <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-xs font-semibold">Zonas de Entrega</span>
                <Truck className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-black text-foreground">
                {deliveryZones.length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Rutas y Despacho Activos
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-xs font-semibold">Inventario Activo</span>
                <Boxes className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-black text-foreground">
                {products.length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Productos en Catálogo Core
              </p>
            </div>
          )}

          {activeModuleIds.includes("local_venezuela") ? (
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
          ) : (
            <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-xs font-semibold">Sedes & Puntos</span>
                <Building2 className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-black text-foreground">
                {stores.length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Puntos de Retiro en Tienda
              </p>
            </div>
          )}
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
                              : payment.currency === "VES"
                              ? `Bs. ${payment.amount.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`
                              : formatCurrency(payment.amount, payment.currency as any)}
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

              {/* Branch Filter if stores exist */}
              {stores.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-semibold">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    <span>Sucursal:</span>
                  </div>
                  <select
                    value={storeFilter}
                    onChange={(e) => setStoreFilter(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-border bg-background text-[11px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="ALL">Todas las sucursales ({orders.length} pedidos)</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({orders.filter((o) => o.store_id === s.id).length} pedidos)
                      </option>
                    ))}
                  </select>
                  {storeFilter !== "ALL" && (
                    <button
                      type="button"
                      onClick={() => setStoreFilter("ALL")}
                      className="text-[11px] text-primary hover:underline font-bold"
                    >
                      Ver todas
                    </button>
                  )}
                </div>
              )}
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
                          {activeModuleIds.includes("local_venezuela") && (
                            <span className="block text-[11px] text-muted-foreground font-mono">
                              Bs. {order.total_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Customer info & Delivery Address */}
                      <div className="grid sm:grid-cols-2 gap-2 text-xs">
                        {(order.customer_name || order.customer_phone || order.customer_id_number) && (
                          <div className="flex items-center gap-1.5 text-foreground font-medium flex-wrap">
                            <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>
                              <strong>Cliente:</strong> {order.customer_name || "Cliente"}
                              {order.customer_id_number ? ` • CI: ${order.customer_id_number}` : ""}
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
            activeModuleIds={activeModuleIds}
          />
        )}

        {/* TAB 3: INVENTORY */}
        {activeTab === "INVENTORY" && (() => {
          const maxProducts = planLimitsState?.plan.max_products || 60;
          const currentProductsCount = products.length;
          const isAtCapacity = currentProductsCount >= maxProducts;
          const productUsagePct = Math.min(100, Math.round((currentProductsCount / maxProducts) * 100));

          return (
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
                    if (isAtCapacity) {
                      triggerUpgradeModal("products");
                      return;
                    }
                    setEditingProduct(null);
                    setIsProductModalOpen(true);
                  }}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all shrink-0 ${
                    isAtCapacity
                      ? "bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-500/30"
                      : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
                  }`}
                  title={isAtCapacity ? "Cupo máximo alcanzado. Clic para actualizar plan" : "Registrar nuevo producto"}
                >
                  {isAtCapacity ? (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Límite Alcanzado (Mejorar Plan)</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>+ Nuevo Producto</span>
                    </>
                  )}
                </button>
              </div>

              {/* SaaS Catalog Quota Indicator Card */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  isAtCapacity
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                    : productUsagePct >= 80
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                    : "bg-card border-border text-foreground"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isAtCapacity
                          ? "bg-rose-500/20 text-rose-500"
                          : productUsagePct >= 80
                          ? "bg-amber-500/20 text-amber-500"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-foreground">
                          Capacidad de Catálogo ({currentProductsCount} / {maxProducts} productos)
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isAtCapacity
                              ? "bg-rose-500 text-white"
                              : productUsagePct >= 80
                              ? "bg-amber-500 text-white"
                              : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          }`}
                        >
                          {isAtCapacity
                            ? "Límite Alcanzado (100%)"
                            : productUsagePct >= 80
                            ? `${productUsagePct}% En Uso (Cerca del Límite)`
                            : `${productUsagePct}% En Uso`}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Plan actual: <strong className="text-foreground">{planLimitsState?.plan.name || "Starter"}</strong>.
                        {isAtCapacity
                          ? " Has alcanzado el cupo máximo de tu plan. No podrás agregar más artículos hasta actualizar a un plan superior."
                          : ` Te quedan ${maxProducts - currentProductsCount} espacios para nuevos productos en tu catálogo.`}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => triggerUpgradeModal("products")}
                    className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isAtCapacity
                        ? "bg-rose-600 hover:bg-rose-500 text-white shadow-sm hover:scale-105 active:scale-95"
                        : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isAtCapacity ? "Actualizar Plan Ahora" : "Ver Opciones de Upgrade"}</span>
                  </button>
                </div>

                {/* Progress bar */}
                <div className="mt-3 w-full h-2 rounded-full bg-muted overflow-hidden border border-border/50">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      isAtCapacity
                        ? "bg-rose-500"
                        : productUsagePct >= 80
                        ? "bg-amber-500"
                        : "bg-gradient-to-r from-emerald-500 to-teal-500"
                    }`}
                    style={{ width: `${productUsagePct}%` }}
                  />
                </div>
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
                          {formatCurrency(prod.price_usd, "USD")}
                          {activeModuleIds.includes("local_venezuela") && (
                            <span className="text-[11px] text-muted-foreground font-normal">
                              {" "}(Bs. {priceVes.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                            </span>
                          )}
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
        ); })()}

        {/* PLUGIN FOOD SERVICE: RAW MATERIALS */}
        {activeTab === "RAW_MATERIALS" && (
          <RawMaterialsAdmin
            tenantId={settings.tenant_id}
            stores={stores}
            rawMaterials={rawMaterials}
            onSaveRawMaterial={handleSaveRawMaterial}
            onDeleteRawMaterial={handleDeleteRawMaterial}
          />
        )}

        {/* PLUGIN FOOD SERVICE: RECIPES & BOM */}
        {activeTab === "RECIPES" && (
          <RecipeManagerAdmin
            tenantId={settings.tenant_id}
            products={products}
            rawMaterials={rawMaterials}
            existingRecipes={recipes}
            onSaveRecipe={handleSaveRecipe}
          />
        )}

        {/* PLUGIN MTO & CPQ: WORKSHOP & CUSTOM FABRICATION */}
        {activeTab === "MTO_CPQ" && (
          <MtoCpqAdminPanel
            tenantId={settings.tenant_id}
            businessName={settingsState.business_name}
            businessPhone={settingsState.whatsapp_number || settingsState.phone}
            orders={orders}
            formatCurrency={(val) => `$${val.toFixed(2)}`}
          />
        )}


        {/* TAB 4: DELIVERY & DRIVERS */}
        {activeTab === "DELIVERY" && (
          <DeliveryManager
            tenantId={settings.tenant_id}
            initialDeliveryZones={deliveryZones}
            initialDrivers={drivers}
            exchangeRate={rate}
            activeModuleIds={activeModuleIds}
            orders={orders}
          />
        )}

        {/* TAB 5: DISCOUNT COUPONS */}
        {activeTab === "COUPONS" && (
          <div className="space-y-4">
            {planLimitsState?.plan.id === "STARTER" && (
              <div className="p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                      <span>Módulo de Cupones Exclusivo de Growth & Enterprise</span>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-full">
                        Premium
                      </span>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tu plan actual ({planLimitsState.plan.name}) no incluye campañas de cupones ni promociones con descuento. Pasa a Growth ($49/mes) para activar cupones ilimitados.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => triggerUpgradeModal("coupons")}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Desbloquear con Growth</span>
                </button>
              </div>
            )}
            <CouponManager
              tenantId={settings.tenant_id}
              initialCoupons={initialCoupons}
            />
          </div>
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
              onRateUpdated={(newRate) => setRate(newRate)}
            />
          </div>
        )}

        {/* TAB 6: AUDIT LOGS & TRACEABILITY */}
        {activeTab === "AUDIT" && (
          <div className="animate-in fade-in">
            <AuditTrailViewer
              initialLogs={auditLogs}
              tenantId={settings.tenant_id}
              isSuperAdmin={currentUser?.role === "PLATFORM_SUPER_ADMIN"}
              allTenants={allTenants as any}
            />
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
                          disabled={
                            updatingStaffId === member.id ||
                            revokingStaffId === member.id ||
                            member.id === currentUser?.id ||
                            (member.role === "TENANT_OWNER" &&
                              currentUser?.role !== "PLATFORM_SUPER_ADMIN" &&
                              currentUser?.role !== "TENANT_OWNER")
                          }
                          onChange={(e) =>
                            handleRoleChange(member.id, e.target.value as UserRole)
                          }
                          className="bg-muted border border-border text-foreground text-xs rounded-xl px-3 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
                        >
                          {(currentUser?.role === "PLATFORM_SUPER_ADMIN" ||
                            currentUser?.role === "TENANT_OWNER") && (
                            <option value="TENANT_OWNER">Dueño del Comercio</option>
                          )}
                          <option value="TENANT_MANAGER">Encargada de Sucursal</option>
                          <option value="TENANT_CASHIER">Cajero / Operador</option>
                          <option value="TENANT_INVENTORY">Control de Inventario</option>
                          <option value="TENANT_DELIVERY">Repartidor / Delivery</option>
                        </select>
                      </div>

                      {member.id !== currentUser?.id && member.role !== "TENANT_OWNER" && (
                        <button
                          type="button"
                          disabled={revokingStaffId === member.id || updatingStaffId === member.id}
                          onClick={() => handleRevokeStaff(member.id, member.full_name)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 border border-border hover:border-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                          title="Revocar acceso al comercio"
                        >
                          {revokingStaffId === member.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UserX className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">Revocar</span>
                        </button>
                      )}

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

        {/* TAB: STORES & BRANCH MANAGEMENT */}
        {activeTab === "STORES" && (() => {
          const maxStores = planLimitsState?.plan.max_stores || 1;
          const currentStoresCount = stores.length;
          const isAtCapacity = currentStoresCount >= maxStores;
          const storeUsagePct = Math.min(100, Math.round((currentStoresCount / maxStores) * 100));

          return (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border">
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    Sucursales y Sedes de Despacho ({stores.length})
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gestiona las sedes físicas de este comercio para zonificación de inventario y despacho de pedidos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isAtCapacity) {
                      triggerUpgradeModal("stores");
                      return;
                    }
                    setIsStoreModalOpen(true);
                  }}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all shrink-0 ${
                    isAtCapacity
                      ? "bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-500/30"
                      : "bg-primary hover:bg-primary/90 text-primary-foreground"
                  }`}
                  title={isAtCapacity ? "Cupo máximo alcanzado. Clic para actualizar plan" : "Registrar nueva sucursal"}
                >
                  {isAtCapacity ? (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Límite de Sedes Alcanzado</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>+ Registrar Nueva Sucursal</span>
                    </>
                  )}
                </button>
              </div>

              {/* SaaS Store Quota Card */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  isAtCapacity
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                    : storeUsagePct >= 80
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                    : "bg-card border-border text-foreground"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isAtCapacity
                          ? "bg-rose-500/20 text-rose-500"
                          : storeUsagePct >= 80
                          ? "bg-amber-500/20 text-amber-500"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-foreground">
                          Límite de Sedes Físicas ({currentStoresCount} / {maxStores} sucursales)
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isAtCapacity
                              ? "bg-rose-500 text-white"
                              : storeUsagePct >= 80
                              ? "bg-amber-500 text-white"
                              : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          }`}
                        >
                          {isAtCapacity
                            ? "Límite Alcanzado (100%)"
                            : storeUsagePct >= 80
                            ? `${storeUsagePct}% En Uso`
                            : `${storeUsagePct}% En Uso`}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Plan actual: <strong className="text-foreground">{planLimitsState?.plan.name || "Starter"}</strong>.
                        {isAtCapacity
                          ? " Has alcanzado el límite máximo de sucursales permitido por tu suscripción actual. Actualiza a Growth (hasta 3) o Enterprise (hasta 10) para abrir nuevas sedes."
                          : ` Puedes registrar ${maxStores - currentStoresCount} sucursales adicionales en tu plan.`}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => triggerUpgradeModal("stores")}
                    className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isAtCapacity
                        ? "bg-rose-600 hover:bg-rose-500 text-white shadow-sm hover:scale-105 active:scale-95"
                        : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isAtCapacity ? "Aumentar Límite de Sedes" : "Ver Planes SaaS"}</span>
                  </button>
                </div>

                {/* Progress bar */}
                <div className="mt-3 w-full h-2 rounded-full bg-muted overflow-hidden border border-border/50">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      isAtCapacity
                        ? "bg-rose-500"
                        : storeUsagePct >= 80
                        ? "bg-amber-500"
                        : "bg-gradient-to-r from-emerald-500 to-teal-500"
                    }`}
                    style={{ width: `${storeUsagePct}%` }}
                  />
                </div>
              </div>

              {stores.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-foreground text-sm">No hay sucursales registradas aún</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Registra la primera sede física de este comercio (ej: Sede Principal, Sucursal Este, etc.) para asociar inventario y pedidos.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (isAtCapacity) {
                        triggerUpgradeModal("stores");
                        return;
                      }
                      setIsStoreModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Crear Primera Sucursal</span>
                  </button>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.map((st) => {
                  const branchOrdersCount = orders.filter((o) => o.store_id === st.id).length;
                  return (
                    <div
                      key={st.id}
                      className="p-4 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all flex flex-col justify-between gap-4 shadow-xs"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-foreground leading-tight">
                                {st.name}
                              </h3>
                              {st.code && (
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  Cód: {st.code}
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              st.is_active
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                            }`}
                          >
                            {st.is_active ? "Activa" : "Inactiva"}
                          </span>
                        </div>

                        {st.address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{st.address}</span>
                          </p>
                        )}

                        {st.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span>{st.phone}</span>
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                        <div className="text-[11px] text-muted-foreground">
                          <strong>{branchOrdersCount}</strong> {branchOrdersCount === 1 ? "pedido" : "pedidos"}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setStoreFilter(st.id);
                              setActiveTab("ORDERS");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Ver Pedidos
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStoreStatus(st)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                              st.is_active
                                ? "border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                                : "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                            }`}
                          >
                            {st.is_active ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ); })()}

        {/* TAB: STOREFRONT STUDIO (VITRINA PRO) */}
        {activeTab === "STOREFRONT_STUDIO" && (
          <div className="space-y-6 animate-in fade-in">
            <AdminStorefrontStudio
              initialConfig={settingsState.storefront_config}
              businessName={settingsState.business_name}
              categories={categories}
              products={products}
              stores={stores}
              exchangeRate={rate}
              onSave={async (newConfig) => {
                const res = await updateTenantSettingsAction(settings.tenant_id, {
                  storefront_config: newConfig,
                });
                if (res.success && res.settings) {
                  setSettingsState(res.settings);
                  setToast({
                    id: String(Date.now()),
                    type: "success",
                    title: "Vitrina Visual Actualizada",
                    message: "Los bloques y el diseño de la tienda pública se han publicado con éxito.",
                  });
                } else {
                  throw new Error(res.error || "Error al guardar");
                }
              }}
            />
          </div>
        )}

        {/* TAB 8: STORE SETTINGS & BRANDING */}
        {activeTab === "SETTINGS" && (
          <StoreSettingsTab
            settings={settingsState}
            activeModuleIds={activeModuleIds}
            onUpdateSuccess={(updated) => setSettingsState(updated)}
            isSuperAdmin={currentUser?.role === "PLATFORM_SUPER_ADMIN" || Boolean(currentUser?.impersonation)}
          />
        )}

        {/* TAB: PLUGINS & EXTENSIONES ACTIVAS */}
        {activeTab === "PLUGINS" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 rounded-2xl bg-card border border-border shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                  <Puzzle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    Módulos y Plugins de la Tienda
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Extensiones y capacidades especializadas para <strong className="text-foreground">{settingsState.business_name}</strong>.
                  </p>
                </div>
              </div>

              {(currentUser?.role === "PLATFORM_SUPER_ADMIN" || currentUser?.impersonation) ? (
                <button
                  type="button"
                  onClick={() => setIsPluginsModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                  title="Abrir gestor para activar o desactivar plugins"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Gestionar Plugins (Activar / Desactivar)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPluginsModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                  title="Ver catálogo y cotizar módulos para tu comercio"
                >
                  <Puzzle className="w-4 h-4" />
                  <span>Ver Catálogo Completo & Cotizar</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {AVAILABLE_PLUGINS.map((plugin) => {
                const isActive = activeModuleIds.includes(plugin.id);
                return (
                  <div
                    key={plugin.id}
                    onClick={() => setSelectedPluginForDetail(plugin)}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer group hover:shadow-md ${
                      isActive
                        ? "bg-card border-emerald-500/40 shadow-xs hover:border-emerald-500/80 ring-1 ring-emerald-500/20"
                        : "bg-card/70 border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-muted/80 border border-border/80 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          {plugin.icon}
                        </div>
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Activo
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border/60">
                            Inactivo
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider block">
                          {plugin.categoryShort}
                        </span>
                        <h3 className="font-black text-sm sm:text-base text-foreground group-hover:text-primary transition-colors leading-snug">
                          {plugin.name}
                        </h3>
                      </div>
                    </div>

                    <div
                      className="pt-3 mt-4 border-t border-border flex items-center justify-between text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedPluginForDetail(plugin)}
                        className="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>Ver Ficha & Detalles</span>
                      </button>

                      {isActive ? (
                        plugin.id === "delivery_fleet" ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab("DELIVERY")}
                            className="text-xs font-bold text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                          >
                            Ir a Delivery →
                          </button>
                        ) : plugin.id === "promotions_coupons" ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab("COUPONS")}
                            className="text-xs font-bold text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                          >
                            Ir a Cupones →
                          </button>
                        ) : plugin.id === "local_venezuela" ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab("RATES")}
                            className="text-xs font-bold text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                          >
                            Ir a Tasas & BCV →
                          </button>
                        ) : plugin.id === "food_service" ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab("RAW_MATERIALS")}
                            className="text-xs font-bold text-amber-600 hover:underline cursor-pointer"
                          >
                            Ir a Insumos →
                          </button>
                        ) : plugin.id === "mto_cpq" ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab("MTO_CPQ")}
                            className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                          >
                            Ir a Taller MTO →
                          </button>
                        ) : plugin.id === "pos_registers" ? (
                          <Link
                            href="/admin/pos"
                            className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                          >
                            Ir a Cajas POS →
                          </Link>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-medium">
                            Habilitado
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedPluginForDetail(plugin)}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-500 cursor-pointer"
                        >
                          Cotizar →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Banner Informativo */}
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-200 text-xs flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Arquitectura Modular MarketOS</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Los módulos especializados se activan de forma independiente para cada comercio. Si un plugin está desactivado, su código y controles no se ejecutan, garantizando que el sistema opere exclusivamente con su núcleo (Core) base.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FALLBACK: UNAUTHORIZED TAB / ROLE RESTRICTION */}
        {!modulesList.some((m) => m.id === activeTab) && (
          <div className="p-8 rounded-3xl border border-destructive/20 bg-destructive/5 text-center space-y-4 max-w-lg mx-auto my-12 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                Acceso Restringido por Rol (RBAC)
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tu rol de usuario actual ({currentUser?.role ? (ROLE_LABELS[currentUser.role]?.label || currentUser.role) : "Invitado"}) no dispone de permisos para acceder a esta sección.
              </p>
            </div>
            {modulesList.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab(modulesList[0].id)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
              >
                Volver a {modulesList[0].label}
              </button>
            )}
          </div>
        )}
      </main>
      </div>

      {/* Product Creation & Editing Modal with WebP Compression */}
      <ProductModal
        key={editingProduct ? editingProduct.id : "new-product"}
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
        onQuotaExceeded={() => triggerUpgradeModal("products")}
      />

      {/* Staff Invitation & Role Assignment Modal */}
      <StaffModal
        tenantId={settings.tenant_id}
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        onStaffAdded={handleStaffAdded}
        callerRole={currentUser?.role}
      />

      {/* Order Details & Operational Modal */}
      <OrderDetailsModal
        order={selectedOrderForModal}
        isOpen={Boolean(selectedOrderForModal)}
        onClose={() => setSelectedOrderForModal(null)}
        settings={settingsState}
        drivers={drivers}
        activeModuleIds={activeModuleIds}
        onUpdateStatus={handleUpdateOrderStatus}
        onReviewPayment={async (paymentId, status) => {
          await handleReview(paymentId, status);
        }}
        paymentId={
          payments.find((p) => p.order_id === selectedOrderForModal?.id)?.id
        }
        isProcessing={processingId !== null}
        onOrderUpdated={(updated) => {
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
          setSelectedOrderForModal(updated);
        }}
      />

      {/* Tenant Plugins Modal for Super Admin & Support Impersonation */}
      <TenantPluginsModal
        tenant={
          allTenants.find((t) => t.id === settings.tenant_id) || {
            id: settings.tenant_id,
            name: settings.business_name,
            slug: settings.tenant_id,
            status: "active",
            logo_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            settings,
            stores,
            storesCount: stores.length,
            productsCount: products.length,
            ordersCount: orders.length,
            totalRevenueUsd: 0,
          }
        }
        isOpen={isPluginsModalOpen}
        onClose={() => setIsPluginsModalOpen(false)}
        isSuperAdmin={currentUser?.role === "PLATFORM_SUPER_ADMIN" || Boolean(currentUser?.impersonation)}
        supportPhone={settingsState.whatsapp_number || settingsState.phone}
        onModulesUpdated={() => {
          setIsPluginsModalOpen(false);
          window.location.reload();
        }}
      />

      {/* Full Plugin Detail Modal (Progressive Disclosure - Uncut Details) */}
      {selectedPluginForDetail && (
        <PluginDetailModal
          plugin={selectedPluginForDetail}
          isOpen={Boolean(selectedPluginForDetail)}
          onClose={() => setSelectedPluginForDetail(null)}
          isActive={activeModuleIds.includes(selectedPluginForDetail.id)}
          isSuperAdmin={currentUser?.role === "PLATFORM_SUPER_ADMIN" || Boolean(currentUser?.impersonation)}
          onNavigateToModule={(pluginId) => {
            if (pluginId === "delivery_fleet") setActiveTab("DELIVERY");
            else if (pluginId === "promotions_coupons") setActiveTab("COUPONS");
            else if (pluginId === "local_venezuela") setActiveTab("RATES");
            else if (pluginId === "food_service") setActiveTab("RAW_MATERIALS");
            else if (pluginId === "storefront_pro") setActiveTab("STOREFRONT_STUDIO");
            else if (pluginId === "mto_cpq") setActiveTab("MTO_CPQ");
            else if (pluginId === "pos_registers") window.location.href = "/admin/pos";
            else setActiveTab("PLUGINS");

          }}
          supportPhone={settingsState.whatsapp_number || settingsState.phone}
          tenantName={settingsState.business_name}
          tenantId={settingsState.tenant_id}
        />
      )}

      {/* Create Store Modal */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Nueva Sucursal
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    Registra una sede física o punto de despacho
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStoreModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xs p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="p-4 space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Nombre de la Sucursal *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Sucursal Nueva Segovia, Sede Centro"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Código de Sucursal (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="ej. SUC-01, CEN-02"
                  value={newStoreCode}
                  onChange={(e) => setNewStoreCode(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary uppercase font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Dirección Física (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="ej. Av. Lara c/c 5, CC Nueva Segovia"
                  value={newStoreAddress}
                  onChange={(e) => setNewStoreAddress(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Teléfono / WhatsApp de Contacto (Opcional)
                </label>
                <input
                  type="tel"
                  placeholder="ej. +58 412 1234567"
                  value={newStorePhone}
                  onChange={(e) => setNewStorePhone(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingStore || !newStoreName.trim()}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingStore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingStore ? "Guardando..." : "Guardar Sucursal"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SaaS Plan Quota & Upgrade Modal */}
      {planLimitsState && (
        <PlanUpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          tenantName={settingsState.business_name}
          tenantId={settingsState.tenant_id}
          planLimits={planLimitsState}
          quotaType={upgradeModalQuotaType}
          isSuperAdmin={currentUser?.role === "PLATFORM_SUPER_ADMIN"}
          whatsappContact={settingsState.whatsapp_number || settingsState.phone}
          onPlanChanged={(newTier) => {
            showToast({
              type: "success",
              title: "Plan Actualizado",
              message: `El comercio ahora está en el plan ${newTier}. Actualizando cuotas...`,
            });
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }}
        />
      )}

      {/* Cloudflare R2 Storage Details Modal */}
      {isStorageModalOpen && storageTelemetry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">Almacenamiento Cloudflare R2</h3>
                  <p className="text-xs text-muted-foreground">Medidor de fotos de productos y comprobantes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStorageModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-foreground">Espacio Consumido</span>
                  <span className={storageTelemetry.percentUsed >= 80 ? "text-amber-500" : "text-emerald-500"}>
                    {storageTelemetry.totalSizeFormatted} de {storageTelemetry.quotaFormatted} ({storageTelemetry.percentUsed}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      storageTelemetry.percentUsed >= 95
                        ? "bg-red-500"
                        : storageTelemetry.percentUsed >= 80
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, storageTelemetry.percentUsed))}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Plan actual: <strong>{storageTelemetry.planName}</strong> ({storageTelemetry.quotaFormatted} de cuota R2).
                </p>
              </div>

              {/* Breakdown */}
              <div className="space-y-2 text-xs">
                <p className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                  Desglose por tipo de archivo
                </p>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-foreground">Fotos de Productos</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-foreground">{storageTelemetry.byFolder.products.sizeFormatted}</span>
                    <span className="text-[11px] text-muted-foreground ml-1.5">({storageTelemetry.byFolder.products.count} fotos)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium text-foreground">Comprobantes de Pago</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-foreground">{storageTelemetry.byFolder.proofs.sizeFormatted}</span>
                    <span className="text-[11px] text-muted-foreground ml-1.5">({storageTelemetry.byFolder.proofs.count} recibos)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-500" />
                    <span className="font-medium text-foreground">Logos & Banners</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-foreground">{storageTelemetry.byFolder.branding.sizeFormatted}</span>
                    <span className="text-[11px] text-muted-foreground ml-1.5">({storageTelemetry.byFolder.branding.count} logos)</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
                💡 <strong>Optimización WebP:</strong> Todas las fotos se optimizan y comprimen automáticamente antes de alojarse en Cloudflare R2 sin costo de transferencia (0$ Egress).
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsStorageModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactive Alert Toast with Countdown Progress Bar */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-4 sm:right-6 z-50 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
        >
          <div className="p-4 flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                toast.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  : toast.type === "error"
                  ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                  : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : toast.type === "error" ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <h4 className="font-extrabold text-sm text-foreground leading-tight">
                {toast.title}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {toast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={dismissToast}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer shrink-0"
              title="Cerrar notificación"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Animated Countdown Progress Bar */}
          <div className="h-1.5 w-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ease-linear ${
                toast.type === "success"
                  ? "bg-emerald-600"
                  : toast.type === "error"
                  ? "bg-rose-600"
                  : "bg-blue-600"
              }`}
              style={{ width: `${toastProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
