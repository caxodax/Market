"use client";

import React, { useState, useEffect } from "react";
import {
  PlatformMetrics,
  TenantWithDetails,
  SubscriptionPlan,
  SubscriptionPlanTier,
  ExchangeRate,
  RateHistoryItem,
  UserProfile,
  UserRole,
  AuditLog,
  PlatformBiAnalytics,
  PlatformStorageTelemetry,
  PlatformSettings,
} from "@marketos/types";
import { formatCurrency, slugify, formatMediaUrl } from "@marketos/utils";
import {
  onboardTenantAction,
  updateTenantStatusAction,
  createPlatformUserAction,
  updateUserProfileAction,
  deletePlatformUserAction,
  renewTenantSubscriptionAction,
  changeTenantPlanAction,
  impersonateTenantAction,
  stopImpersonationAction,
} from "../app/platform/actions";
import { syncBcvRateAction } from "../app/admin/actions";
import { AuditTrailViewer } from "./audit-trail-viewer";
import { PlatformBiAnalyticsTab } from "./platform-bi-analytics-tab";
import { PlatformStorageTab } from "./platform-storage-tab";
import { PlatformSettingsTab } from "./platform-settings-tab";
import { TenantPluginsModal } from "./tenant-plugins-modal";
import {
  Building2,
  DollarSign,
  TrendingUp,
  Puzzle,
  Package,
  Store,
  Plus,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  CreditCard,
  Layers,
  Sparkles,
  Database,
  Cloud,
  Server,
  Users,
  UserPlus,
  LogOut,
  Landmark,
  Smartphone,
  MapPin,
  Phone,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Trash2,
  Edit2,
  Briefcase,
  Crown,
  Key,
  Calendar,
  Clock,
  RefreshCw,
  Zap,
  Check,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { logoutUserAction } from "../app/login/actions";
import { ExchangeRateManager } from "./exchange-rate-manager";

function TenantAvatar({
  logoUrl,
  name,
  primaryColor = "#DC2626",
  initials,
  className = "w-10 h-10",
}: {
  logoUrl?: string | null;
  name: string;
  primaryColor?: string;
  initials: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const formattedUrl = formatMediaUrl(logoUrl);

  if (formattedUrl && !hasError) {
    return (
      <div className={`${className} rounded-xl bg-card border border-border p-1 shrink-0 flex items-center justify-center shadow-xs overflow-hidden`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={formattedUrl}
          alt={name}
          className="w-full h-full object-contain"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 shadow-xs`}
      style={{ backgroundColor: primaryColor }}
    >
      {initials}
    </div>
  );
}

interface SuperAdminDashboardProps {
  metrics: PlatformMetrics;
  tenants: TenantWithDetails[];
  plans: SubscriptionPlan[];
  currentUser?: UserProfile;
  exchangeRate?: ExchangeRate;
  ratesHistory?: RateHistoryItem[];
  initialProfiles?: UserProfile[];
  initialAuditLogs?: AuditLog[];
  initialBiAnalytics?: PlatformBiAnalytics;
  initialStorageTelemetry?: PlatformStorageTelemetry;
  initialPlatformSettings?: PlatformSettings;
}

export function SuperAdminDashboard({
  metrics: initialMetrics,
  tenants: initialTenants,
  plans,
  currentUser,
  exchangeRate,
  ratesHistory = [],
  initialProfiles = [],
  initialAuditLogs = [],
  initialBiAnalytics,
  initialStorageTelemetry,
  initialPlatformSettings,
}: SuperAdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    "TENANTS" | "BILLING" | "BI" | "STORAGE" | "USERS" | "RATES" | "AUDIT" | "SETTINGS"
  >("TENANTS");
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(
    initialPlatformSettings || {
      id: "default",
      platform_name: "MarketOS",
      platform_tagline: "Consola Centralizada Multi-Tenant SaaS",
      logo_url: null,
      support_phone: "+58 412-0000000",
      support_email: "soporte@marketos.com",
      support_whatsapp: "+58 412-0000000",
      currency_symbol: "$",
      contact_address: "Torre Empresarial, Piso 10",
      updated_at: new Date().toISOString(),
    }
  );
  const [headerLogoError, setHeaderLogoError] = useState(false);
  const [tenants, setTenants] = useState<TenantWithDetails[]>(initialTenants);
  const [metrics, setMetrics] = useState<PlatformMetrics>(initialMetrics);
  const [profiles, setProfiles] = useState<UserProfile[]>(initialProfiles);
  const [storageTelemetry, setStorageTelemetry] = useState<PlatformStorageTelemetry | undefined>(
    initialStorageTelemetry
  );

  // Sincronizar Favicon e icono en la pestaña del navegador en tiempo real
  useEffect(() => {
    const effectiveLogo = formatMediaUrl(platformSettings.logo_url);
    if (effectiveLogo && !headerLogoError) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = effectiveLogo;
    }
    if (platformSettings.platform_name) {
      document.title = `${platformSettings.platform_name} Master`;
    }
  }, [platformSettings.logo_url, platformSettings.platform_name, headerLogoError]);

  // Billing & Subscriptions State
  const [billingSearchQuery, setBillingSearchQuery] = useState("");
  const [billingPlanFilter, setBillingPlanFilter] = useState<string>("ALL");
  const [billingStatusFilter, setBillingStatusFilter] = useState<string>("ALL");
  const [renewingTenant, setRenewingTenant] = useState<TenantWithDetails | null>(null);
  const [renewDurationDays, setRenewDurationDays] = useState<number>(30);
  const [renewMethod, setRenewMethod] = useState<string>("PAGO_MOVIL");
  const [renewReference, setRenewReference] = useState<string>("");
  const [renewLoading, setRenewLoading] = useState(false);

  const [changingPlanTenant, setChangingPlanTenant] = useState<TenantWithDetails | null>(null);
  const [selectedPlanTier, setSelectedPlanTier] = useState<SubscriptionPlanTier>("GROWTH");
  const [changingPlanLoading, setChangingPlanLoading] = useState(false);

  const [billingAlert, setBillingAlert] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (billingAlert) {
      const timer = setTimeout(() => {
        setBillingAlert(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [billingAlert]);

  // User Management State
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userTenantFilter, setUserTenantFilter] = useState<string>("ALL");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("ALL");
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userAlert, setUserAlert] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Support Impersonation State ("Login As")
  const [impersonatingTenantId, setImpersonatingTenantId] = useState<string | null>(null);
  const [isStoppingImpersonation, setIsStoppingImpersonation] = useState(false);
  const [pluginsModalTenant, setPluginsModalTenant] = useState<TenantWithDetails | null>(null);

  // BCV Rate state & Quick Sync
  const [currentRate, setCurrentRate] = useState<ExchangeRate | undefined>(exchangeRate);
  const [isSyncingRate, setIsSyncingRate] = useState(false);

  const handleSyncRate = async () => {
    setIsSyncingRate(true);
    try {
      const primaryTenantId = tenants[0]?.id || "shop-market-ca";
      const res = await syncBcvRateAction(primaryTenantId);
      if (res.success && res.rate) {
        setCurrentRate(res.rate);
      }
    } catch (e) {
      console.warn("Failed to sync rate from header:", e);
    } finally {
      setIsSyncingRate(false);
    }
  };

  // Auto-dismiss user alert
  useEffect(() => {
    if (userAlert) {
      const timer = setTimeout(() => {
        setUserAlert(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [userAlert]);

  // Create User Form State
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserTenantId, setNewUserTenantId] = useState<string>("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("TENANT_OWNER");

  // Edit User Form State
  const [editRole, setEditRole] = useState<UserRole>("TENANT_OWNER");
  const [editTenantId, setEditTenantId] = useState<string>("");
  const [editFullName, setEditFullName] = useState<string>("");
  const [editPhone, setEditPhone] = useState<string>("");

  const handleOpenEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditTenantId(user.tenant_id || "");
    setEditFullName(user.full_name || "");
    setEditPhone(user.phone || "");
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserLoading(true);
    setUserAlert(null);

    try {
      const res = await createPlatformUserAction({
        fullName: newUserName.trim(),
        email: newUserEmail.trim(),
        phone: newUserPhone.trim() || null,
        tenantId: newUserTenantId.trim() || null,
        role: newUserRole,
      });

      if (!res.success || !res.user) {
        throw new Error(res.error || "No se pudo crear el usuario");
      }

      setProfiles((prev) => [res.user!, ...prev]);
      setIsCreateUserOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPhone("");
      setUserAlert({
        type: "success",
        text: `¡Usuario ${res.user.full_name} (${res.user.role}) registrado exitosamente!`,
      });
    } catch (err: any) {
      setUserAlert({
        type: "error",
        text: err.message || "Error al crear usuario",
      });
    } finally {
      setUserLoading(false);
    }
  };

  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUserLoading(true);

    try {
      const res = await updateUserProfileAction(editingUser.id, {
        role: editRole,
        tenant_id: editTenantId.trim() || null,
        full_name: editFullName.trim(),
        phone: editPhone.trim() || null,
      });

      if (!res.success || !res.user) {
        throw new Error(res.error || "No se pudo actualizar el usuario");
      }

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === editingUser.id
            ? {
                ...p,
                role: editRole,
                tenant_id: editTenantId.trim() || null,
                full_name: editFullName.trim(),
                phone: editPhone.trim() || null,
              }
            : p
        )
      );
      setEditingUser(null);
      setUserAlert({
        type: "success",
        text: `¡Usuario ${editFullName.trim()} actualizado exitosamente!`,
      });
    } catch (err: any) {
      setUserAlert({
        type: "error",
        text: err.message || "Error al actualizar usuario",
      });
    } finally {
      setUserLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`¿Estás seguro de que deseas revocar el acceso a ${userName}?`)) {
      return;
    }

    try {
      const res = await deletePlatformUserAction(userId);
      if (res.success) {
        setProfiles((prev) => prev.filter((p) => p.id !== userId));
        setUserAlert({
          type: "success",
          text: `Acceso revocado para ${userName}`,
        });
      } else {
        throw new Error(res.error || "Error al eliminar usuario");
      }
    } catch (err: any) {
      setUserAlert({
        type: "error",
        text: err.message || "Error al revocar acceso",
      });
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      !userSearchQuery.trim() ||
      p.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (p.phone && p.phone.toLowerCase().includes(userSearchQuery.toLowerCase()));

    const matchesTenant =
      userTenantFilter === "ALL"
        ? true
        : userTenantFilter === "GLOBAL"
        ? !p.tenant_id
        : p.tenant_id === userTenantFilter;

    const matchesRole =
      userRoleFilter === "ALL" ? true : p.role === userRoleFilter;

    return matchesSearch && matchesTenant && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "PLATFORM_SUPER_ADMIN":
        return {
          label: "Super Admin",
          icon: ShieldCheck,
          className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
        };
      case "TENANT_OWNER":
        return {
          label: "Dueño de Tienda",
          icon: Crown,
          className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
        };
      case "TENANT_MANAGER":
        return {
          label: "Gerente",
          icon: Briefcase,
          className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
        };
      case "TENANT_CASHIER":
        return {
          label: "Cajero",
          icon: DollarSign,
          className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        };
      case "TENANT_INVENTORY":
        return {
          label: "Inventario",
          icon: Package,
          className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
        };
      case "TENANT_DELIVERY":
        return {
          label: "Repartidor",
          icon: Smartphone,
          className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
        };
      case "CUSTOMER":
      default:
        return {
          label: "Cliente",
          icon: Users,
          className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
        };
    }
  };

  const handleLogout = async () => {
    await logoutUserAction();
    window.location.href = "/login";
  };


  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [tenantsPage, setTenantsPage] = useState(1);
  const TENANTS_PER_PAGE = 8;

  // Reset pagination when search or status filters change
  useEffect(() => {
    setTenantsPage(1);
  }, [searchQuery, statusFilter]);

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [selectedTenantForStores, setSelectedTenantForStores] = useState<TenantWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Onboarding Form State
  const [bizName, setBizName] = useState("");
  const [bizSlug, setBizSlug] = useState("");
  const [bizCategory, setBizCategory] = useState("Minimarket");
  const [bizEmail, setBizEmail] = useState("");
  const [bizPhone, setBizPhone] = useState("+58 414-");
  const [bizWhatsapp, setBizWhatsapp] = useState("58414");
  const [bizAddress, setBizAddress] = useState("");
  const [bizPlan, setBizPlan] = useState<SubscriptionPlanTier>("GROWTH");
  const [bizColor, setBizColor] = useState("#DC2626");
  const [storeName, setStoreName] = useState("Sede Principal");
  const [storeCode, setStoreCode] = useState("MAIN-01");

  // Handle business name input and auto-slug
  const handleNameChange = (val: string) => {
    setBizName(val);
    if (!bizSlug || bizSlug === slugify(bizName)) {
      setBizSlug(slugify(val));
    }
  };

  // Submit Onboarding
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setLoading(true);

    try {
      const res = await onboardTenantAction({
        name: bizName.trim(),
        slug: bizSlug.trim() || slugify(bizName),
        category: bizCategory,
        ownerEmail: bizEmail.trim(),
        phone: bizPhone.trim(),
        whatsapp: bizWhatsapp.trim(),
        address: bizAddress.trim(),
        primaryColor: bizColor,
        planId: bizPlan,
        firstStoreName: storeName.trim(),
        firstStoreCode: storeCode.trim(),
      });

      if (!res.success || !res.tenant) {
        throw new Error(res.error || "No se pudo registrar el negocio");
      }

      // Add to list and update metrics
      setTenants((prev) => [res.tenant!, ...prev]);
      setMetrics((prev) => ({
        ...prev,
        totalTenants: prev.totalTenants + 1,
        activeTenants: prev.activeTenants + 1,
        totalStores: prev.totalStores + 1,
        mrrUsd:
          prev.mrrUsd +
          (plans.find((p) => p.id === bizPlan)?.price_usd_monthly || 49),
      }));

      // Reset form & close
      setIsOnboardingOpen(false);
      setBizName("");
      setBizSlug("");
      setBizEmail("");
      setBizAddress("");
    } catch (err: any) {
      setActionError(err.message || "Error al incorporar el nuevo negocio");
    } finally {
      setLoading(false);
    }
  };

  // Toggle status
  const handleToggleStatus = async (
    tenantId: string,
    currentStatus: string
  ) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      const res = await updateTenantStatusAction(tenantId, nextStatus as any);
      if (res.success) {
        setTenants((prev) =>
          prev.map((t) => (t.id === tenantId ? { ...t, status: nextStatus } : t))
        );
        setMetrics((prev) => ({
          ...prev,
          activeTenants:
            nextStatus === "active"
              ? prev.activeTenants + 1
              : Math.max(0, prev.activeTenants - 1),
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered tenants
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      !searchQuery.trim() ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.settings?.category &&
        t.settings.category.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" || t.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const totalTenants = filteredTenants.length;
  const totalTenantsPages = Math.max(1, Math.ceil(totalTenants / TENANTS_PER_PAGE));
  const paginatedTenants = filteredTenants.slice(
    (tenantsPage - 1) * TENANTS_PER_PAGE,
    tenantsPage * TENANTS_PER_PAGE
  );

  // Helper for computing subscription status and expiration
  const getSubscriptionInfo = (t: TenantWithDetails) => {
    const sub = t.subscription;
    const plan = t.plan || plans.find((p) => p.id === (sub?.plan_id || "GROWTH")) || plans[0];

    const periodEnd = sub?.current_period_end
      ? new Date(sub.current_period_end)
      : new Date(Date.now() + 30 * 86400000);
    const now = new Date();
    const diffMs = periodEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const isSuspended = t.status === "suspended" || sub?.status === "past_due";
    const isTrial = t.status === "trial" || sub?.status === "trial";
    const isExpiringSoon = !isSuspended && diffDays <= 5 && diffDays >= 0;
    const isExpired = !isSuspended && diffDays < 0;

    return {
      sub,
      plan,
      periodEnd,
      diffDays,
      isSuspended,
      isTrial,
      isExpiringSoon,
      isExpired,
    };
  };

  // Billing KPIs calculation
  const billingKpis = React.useMemo(() => {
    let totalMRR = 0;
    let upToDateCount = 0;
    let trialCount = 0;
    let suspendedCount = 0;

    tenants.forEach((t) => {
      const info = getSubscriptionInfo(t);
      if (info.isSuspended) {
        suspendedCount++;
      } else if (info.isTrial) {
        trialCount++;
        totalMRR += info.plan.price_usd_monthly;
      } else {
        upToDateCount++;
        totalMRR += info.plan.price_usd_monthly;
      }
    });

    return { totalMRR, upToDateCount, trialCount, suspendedCount };
  }, [tenants, plans]);

  // Filtered tenants for billing tab
  const filteredBillingTenants = tenants.filter((t) => {
    const matchesSearch =
      !billingSearchQuery.trim() ||
      t.name.toLowerCase().includes(billingSearchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(billingSearchQuery.toLowerCase()) ||
      (t.settings?.email && t.settings.email.toLowerCase().includes(billingSearchQuery.toLowerCase()));

    const info = getSubscriptionInfo(t);

    const matchesPlan =
      billingPlanFilter === "ALL" || info.plan.id === billingPlanFilter;

    let matchesStatus = true;
    if (billingStatusFilter === "UP_TO_DATE") {
      matchesStatus = !info.isSuspended && !info.isTrial && info.diffDays > 5;
    } else if (billingStatusFilter === "EXPIRING_SOON") {
      matchesStatus = !info.isSuspended && (info.diffDays <= 5 || info.diffDays < 0);
    } else if (billingStatusFilter === "TRIAL") {
      matchesStatus = info.isTrial;
    } else if (billingStatusFilter === "SUSPENDED") {
      matchesStatus = info.isSuspended;
    }

    return matchesSearch && matchesPlan && matchesStatus;
  });

  // Handle renewal submit
  const handleRenewSubscriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingTenant) return;
    setRenewLoading(true);
    setBillingAlert(null);

    try {
      const res = await renewTenantSubscriptionAction(
        renewingTenant.id,
        renewDurationDays,
        renewMethod,
        renewReference.trim() || undefined
      );

      if (!res.success || !res.subscription) {
        throw new Error(res.error || "No se pudo registrar la renovación");
      }

      setTenants((prev) =>
        prev.map((t) => {
          if (t.id === renewingTenant.id) {
            return {
              ...t,
              status: "active",
              subscription: res.subscription,
            };
          }
          return t;
        })
      );

      setMetrics((prev) => ({
        ...prev,
        activeTenants:
          renewingTenant.status === "suspended" ? prev.activeTenants + 1 : prev.activeTenants,
      }));

      setBillingAlert({
        type: "success",
        text: `¡Suscripción de "${renewingTenant.name}" renovada por ${renewDurationDays} días y comercio reactivado exitosamente!`,
      });
      setRenewingTenant(null);
      setRenewReference("");
    } catch (err: any) {
      setBillingAlert({
        type: "error",
        text: err.message || "Error al renovar la suscripción",
      });
    } finally {
      setRenewLoading(false);
    }
  };

  // Handle plan change submit
  const handleChangePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changingPlanTenant) return;
    setChangingPlanLoading(true);
    setBillingAlert(null);

    try {
      const res = await changeTenantPlanAction(
        changingPlanTenant.id,
        selectedPlanTier
      );

      if (!res.success || !res.subscription) {
        throw new Error(res.error || "No se pudo actualizar el plan");
      }

      const newPlan = plans.find((p) => p.id === selectedPlanTier) || plans[0];

      setTenants((prev) =>
        prev.map((t) => {
          if (t.id === changingPlanTenant.id) {
            return {
              ...t,
              subscription: res.subscription,
              plan: newPlan,
            };
          }
          return t;
        })
      );

      const oldPlan = changingPlanTenant.plan;
      const priceDiff = newPlan.price_usd_monthly - (oldPlan?.price_usd_monthly || 0);
      setMetrics((prev) => ({
        ...prev,
        mrrUsd: Number((prev.mrrUsd + priceDiff).toFixed(2)),
      }));

      setBillingAlert({
        type: "success",
        text: `¡Plan de "${changingPlanTenant.name}" cambiado exitosamente a ${selectedPlanTier}!`,
      });
      setChangingPlanTenant(null);
    } catch (err: any) {
      setBillingAlert({
        type: "error",
        text: err.message || "Error al cambiar de plan",
      });
    } finally {
      setChangingPlanLoading(false);
    }
  };

  // Quick toggle status from billing tab with notification
  const handleBillingToggleStatus = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      const res = await updateTenantStatusAction(tenantId, nextStatus as any);
      if (res.success) {
        setTenants((prev) =>
          prev.map((t) => {
            if (t.id === tenantId) {
              return {
                ...t,
                status: nextStatus,
                subscription: t.subscription
                  ? {
                      ...t.subscription,
                      status: nextStatus === "active" ? "active" : "past_due",
                    }
                  : t.subscription,
              };
            }
            return t;
          })
        );
        setMetrics((prev) => ({
          ...prev,
          activeTenants:
            nextStatus === "active"
              ? prev.activeTenants + 1
              : Math.max(0, prev.activeTenants - 1),
        }));

        setBillingAlert({
          type: "success",
          text: `Comercio ${nextStatus === "active" ? "reactivado" : "suspendido"} correctamente. El catálogo y panel ahora están ${nextStatus === "active" ? "habilitados" : "bloqueados"}.`,
        });
      }
    } catch (err) {
      console.error(err);
      setBillingAlert({
        type: "error",
        text: "Error al actualizar estado del comercio",
      });
    }
  };

  // Support Impersonation ("Login As") Handlers
  const handleLoginAs = async (tenant: TenantWithDetails) => {
    setImpersonatingTenantId(tenant.id);
    try {
      const res = await impersonateTenantAction(tenant.id);
      if (res.success && res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        alert(res.error || "Error al iniciar sesión como dueño");
        setImpersonatingTenantId(null);
      }
    } catch (err: any) {
      console.error("Error logging in as tenant owner:", err);
      alert(err?.message || "Error al iniciar sesión de soporte");
      setImpersonatingTenantId(null);
    }
  };

  const handleStopActiveImpersonation = async () => {
    setIsStoppingImpersonation(true);
    try {
      const res = await stopImpersonationAction();
      if (res.success && res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Platform Master Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {platformSettings.logo_url && !headerLogoError ? (
              <img
                src={formatMediaUrl(platformSettings.logo_url)}
                alt={platformSettings.platform_name || "Logo"}
                className="h-10 w-10 rounded-xl object-contain bg-card border border-border p-1 shadow-sm shrink-0"
                onError={() => setHeaderLogoError(true)}
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-sm tracking-tighter shrink-0">
                {platformSettings.platform_name ? platformSettings.platform_name.charAt(0).toUpperCase() : "M"}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base tracking-tight text-foreground">
                  {platformSettings.platform_name || "MarketOS"} Master
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {platformSettings.platform_tagline || "Consola Centralizada Multi-Tenant SaaS"}
              </p>
            </div>
          </div>

          {/* Infrastructure Health Indicators */}
          <div className="flex items-center gap-2 text-xs">
            <div className="hidden md:flex items-center gap-3 bg-muted/60 border border-border px-3 py-1.5 rounded-xl font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                <Database className="w-3.5 h-3.5" />
                <span>Supabase: OK</span>
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                <Server className="w-3.5 h-3.5" />
                <span>Edge Cache: OK</span>
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                <Cloud className="w-3.5 h-3.5" />
                <span>Cloudflare R2: OK</span>
              </span>
            </div>

            {currentRate && (
              <div className="hidden sm:flex items-center gap-1 bg-muted/60 border border-border px-2.5 py-1.5 rounded-xl font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("RATES")}
                  className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
                  title="Ver monitor de tasas de cambio e histórico"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span>BCV:</span>
                  <strong className="text-foreground">
                    Bs. {currentRate.value.toFixed(2)}
                  </strong>
                </button>
                <button
                  type="button"
                  onClick={handleSyncRate}
                  disabled={isSyncingRate}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 ml-0.5"
                  title="Sincronizar tasa oficial en vivo desde BD/BCV"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingRate ? "animate-spin text-primary" : ""}`} />
                </button>
              </div>
            )}

            <a
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Entrar a administrar catálogo, pedidos y despacho de tienda"
            >
              <Store className="w-3.5 h-3.5 text-primary" />
              <span className="hidden md:inline">Ir a Panel de Tienda</span>
            </a>

            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-transform active:scale-95 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Comercio</span>
            </button>

            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-border">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-bold text-foreground">
                    {currentUser.full_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    PLATFORM_SUPER_ADMIN
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-all cursor-pointer"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        {/* ACTIVE IMPERSONATION NOTICE ON PLATFORM */}
        {currentUser?.impersonation && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 border border-purple-500/50 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0 text-xl shadow-inner">
                🎭
              </div>
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Sesión de Soporte Técnico Activa ("Login As")</span>
                  <span className="text-[10px] bg-purple-500 text-black font-extrabold px-1.5 py-0.2 rounded">
                    EN CURSO
                  </span>
                </p>
                <p className="text-sm font-black text-purple-200 mt-0.5">
                  {currentUser.impersonation.targetTenantName}
                  <span className="text-xs font-mono font-normal text-purple-300 ml-2">
                    (/{currentUser.impersonation.targetTenantSlug})
                  </span>
                </p>
                <p className="text-[11px] text-purple-300/80">
                  Operador: {currentUser.impersonation.originalSuperAdmin.fullName} ({currentUser.impersonation.originalSuperAdmin.email})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/admin?tenant=${currentUser.impersonation.targetTenantId}`}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-sm transition-colors"
              >
                Ingresar al Panel
              </a>
              <button
                type="button"
                onClick={handleStopActiveImpersonation}
                disabled={isStoppingImpersonation}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isStoppingImpersonation ? "Cerrando..." : "Finalizar Soporte"}
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-border gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setActiveTab("TENANTS")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "TENANTS"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Comercios & Inquilinos ({tenants.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("BILLING")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "BILLING"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Facturación & Suscripciones SaaS ({tenants.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("BI")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "BI"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>BI Analytics & Métricas</span>
          </button>

          <button
            onClick={() => setActiveTab("STORAGE")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "STORAGE"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Cloud className="w-4 h-4 text-orange-500" />
            <span>Telemetría R2 ({storageTelemetry?.totalBucketSizeFormatted || "0 MB"})</span>
            {storageTelemetry?.quotaAlerts && storageTelemetry.quotaAlerts.length > 0 && (
              <span className="bg-amber-500/20 text-amber-500 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {storageTelemetry.quotaAlerts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("USERS")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "USERS"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Usuarios & Personal ({profiles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("RATES")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "RATES"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Landmark className="w-4 h-4" />
            <span>Tasas Globales e Histórico ({ratesHistory.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("AUDIT")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "AUDIT"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Auditoría Global (Audit Trail)</span>
            <span className="relative flex h-2 w-2 ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </button>

          <button
            onClick={() => setActiveTab("SETTINGS")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "SETTINGS"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sliders className="w-4 h-4 text-primary" />
            <span>Ajustes de Plataforma</span>
          </button>
        </div>

        {/* TAB 1: TENANTS DIRECTORY */}
        {activeTab === "TENANTS" && (
          <div className="space-y-6 animate-in fade-in">
            {/* Directory Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar comercio por nombre o categoría..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-xl border border-input bg-background text-xs focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
            {[
              { id: "ALL", label: `Todos (${tenants.length})` },
              { id: "active", label: "Activos" },
              { id: "trial", label: "Prueba" },
              { id: "suspended", label: "Suspendidos" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  statusFilter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tenants Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                  <th className="py-3.5 px-4">Comercio / Inquilino</th>
                  <th className="py-3.5 px-4">Plan SaaS</th>
                  <th className="py-3.5 px-4">Sucursales / Catálogo</th>
                  <th className="py-3.5 px-4">Pedidos & Ventas</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      No se encontraron comercios registrados con ese criterio.
                    </td>
                  </tr>
                ) : (
                  paginatedTenants.map((tenant) => {
                    const initials = tenant.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    const primaryColor =
                      tenant.settings?.primary_color || "#DC2626";
                    const tenantLogo =
                      tenant.settings?.logo_url ||
                      tenant.logo_url ||
                      (tenant.slug === "shop-market-ca" || tenant.id === "shop-market-ca"
                        ? "/brand/logo.png"
                        : null);

                    return (
                      <tr
                        key={tenant.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        {/* Tenant Name & Details */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <TenantAvatar
                              logoUrl={tenantLogo}
                              name={tenant.name}
                              primaryColor={primaryColor}
                              initials={initials}
                            />
                            <div>
                              <p className="font-bold text-foreground text-sm">
                                {tenant.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {tenant.settings?.category || "Comercio"} • Slug:{" "}
                                <code className="font-mono text-primary font-semibold">
                                  {tenant.slug}
                                </code>
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <span className="font-bold text-foreground uppercase tracking-wider text-[11px] bg-secondary px-2 py-0.5 rounded-md text-secondary-foreground">
                              {tenant.plan?.id || "GROWTH"}
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              ${tenant.plan?.price_usd_monthly || 49}/mes
                            </p>
                            <button
                              type="button"
                              onClick={() => setPluginsModalTenant(tenant)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer pt-0.5"
                              title={`Configurar módulos y plugins para ${tenant.name}`}
                            >
                              <Puzzle className="w-2.5 h-2.5" />
                              <span>Plugins</span>
                            </button>
                          </div>
                        </td>

                        {/* Stores & Products */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => setSelectedTenantForStores(tenant)}
                              className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer text-left group"
                              title="Ver y monitorear sucursales de este comercio"
                            >
                              <Store className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span>{tenant.storesCount} {tenant.storesCount === 1 ? "Sucursal" : "Sucursales"}</span>
                              <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                            </button>
                            <p className="text-[11px] text-muted-foreground">
                              {tenant.productsCount} Productos
                            </p>
                            {(() => {
                              const st = storageTelemetry?.tenants.find(
                                (t) =>
                                  t.tenantId.toLowerCase() === tenant.id.toLowerCase() ||
                                  t.tenantSlug.toLowerCase() === tenant.slug.toLowerCase()
                              );
                              if (!st) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab("STORAGE")}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 px-1.5 py-0.5 rounded transition-colors cursor-pointer mt-0.5"
                                  title={`Ver telemetría R2 de ${tenant.name} (${st.totalSizeFormatted} / ${st.quotaFormatted})`}
                                >
                                  <Cloud className="w-2.5 h-2.5 text-orange-500" />
                                  <span>R2: {st.totalSizeFormatted} ({st.percentUsed}%)</span>
                                </button>
                              );
                            })()}
                          </div>
                        </td>

                        {/* Orders & Revenue */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <p className="font-black text-foreground">
                              {formatCurrency(tenant.totalRevenueUsd, "USD")}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {tenant.ordersCount} Pedidos
                            </p>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              tenant.status === "active"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : tenant.status === "trial"
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            }`}
                          >
                            {tenant.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {/* 🎭 "Login As" / Impersonación para Soporte */}
                            <button
                              type="button"
                              onClick={() => handleLoginAs(tenant)}
                              disabled={impersonatingTenantId === tenant.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white text-[11px] font-black transition-all shadow-sm cursor-pointer disabled:opacity-50"
                              title={`Ingresar con 1 solo clic al panel /admin de ${tenant.name} como si fueras el dueño para resolver incidencias técnicas sin pedir contraseñas`}
                            >
                              {impersonatingTenantId === tenant.id ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Accediendo...</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-xs">🎭</span>
                                  <span>Login As (Dueño)</span>
                                </>
                              )}
                            </button>

                            {/* Administrar Tienda */}
                            <a
                              href={`/admin?tenant=${tenant.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-[11px] font-bold transition-all shadow-xs"
                              title={`Entrar al panel de administración de ${tenant.name} como Super Admin`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                              <span>Admin</span>
                            </a>

                            {/* Gestión de Plugins y Módulos */}
                            <button
                              type="button"
                              onClick={() => setPluginsModalTenant(tenant)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
                              title={`Gestionar plugins y módulos activados para ${tenant.name}`}
                            >
                              <Puzzle className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span>Plugins</span>
                            </button>

                            {/* Ver PWA en vivo */}
                            <a
                              href={`/?tenant=${tenant.slug || tenant.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-[11px] font-semibold transition-colors"
                              title="Abrir Catálogo PWA en vivo para clientes"
                            >
                              <Smartphone className="w-3.5 h-3.5 text-primary" />
                              <span>Ver PWA</span>
                            </a>

                            {/* Suspender o Activar */}
                            <button
                              onClick={() =>
                                handleToggleStatus(tenant.id, tenant.status)
                              }
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                tenant.status === "active"
                                  ? "border border-destructive/30 text-destructive hover:bg-destructive/10"
                                  : "bg-emerald-600 text-white hover:bg-emerald-700"
                              }`}
                            >
                              {tenant.status === "active" ? "Suspender" : "Activar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Controls */}
          {totalTenants > 0 && (
            <div className="px-4 py-3 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
              <div>
                Mostrando{" "}
                <strong className="text-foreground">
                  {(tenantsPage - 1) * TENANTS_PER_PAGE + 1}-
                  {Math.min(tenantsPage * TENANTS_PER_PAGE, totalTenants)}
                </strong>{" "}
                de <strong className="text-foreground">{totalTenants}</strong> comercios
              </div>

              {totalTenantsPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={tenantsPage <= 1}
                    onClick={() => setTenantsPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-xs font-semibold"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                  <span className="px-2 font-bold text-foreground">
                    {tenantsPage} / {totalTenantsPages}
                  </span>
                  <button
                    type="button"
                    disabled={tenantsPage >= totalTenantsPages}
                    onClick={() => setTenantsPage((p) => Math.min(totalTenantsPages, p + 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-xs font-semibold"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SaaS Subscription Plans Grid */}
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <span>Planes y Modelos de Monetización SaaS</span>
            </h2>
            <span className="text-xs text-muted-foreground font-medium">
              SaaS Multi-Tenant para 100+ comercios locales
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((p) => (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border bg-card space-y-3 relative ${
                  p.id === "GROWTH"
                    ? "border-primary shadow-sm ring-1 ring-primary/20"
                    : "border-border"
                }`}
              >
                {p.id === "GROWTH" && (
                  <span className="absolute -top-2.5 right-4 bg-primary text-primary-foreground text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                    Más Popular
                  </span>
                )}
                <div>
                  <h3 className="font-extrabold text-sm text-foreground">
                    {p.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.description}
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-foreground">
                    ${p.price_usd_monthly}
                  </span>
                  <span className="text-xs text-muted-foreground">/mes USD</span>
                </div>

                <div className="pt-2 border-t border-border space-y-1.5 text-xs text-muted-foreground">
                  {p.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

      {/* TAB 2: FACTURACIÓN & SUSCRIPCIONES SAAS */}
      {activeTab === "BILLING" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Feedback Alert Message */}
          {billingAlert && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
                billingAlert.type === "success"
                  ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
                  : "bg-rose-950/80 border-rose-500/40 text-rose-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {billingAlert.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{billingAlert.text}</span>
              </div>
              <button
                onClick={() => setBillingAlert(null)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Billing Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total MRR */}
            <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-xs font-semibold">MRR Suscripciones</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-foreground">
                {formatCurrency(billingKpis.totalMRR, "USD")}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Ingresos mensuales recurrentes
              </p>
            </div>

            {/* Up to Date */}
            <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-xs font-semibold">Tiendas Al Día</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-foreground">
                {billingKpis.upToDateCount}
                <span className="text-xs font-normal text-muted-foreground ml-1.5">
                  / {tenants.length} comercios
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Suscripción activa y vigente
              </p>
            </div>

            {/* Trial */}
            <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-xs font-semibold">Periodo de Prueba</span>
                <Sparkles className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-black text-foreground">
                {billingKpis.trialCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Nuevas tiendas en onboarding
              </p>
            </div>

            {/* Suspended / Past Due */}
            <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-xs font-semibold">Mora / Suspendidas</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-rose-500">
                {billingKpis.suspendedCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Servicio cortado / bloqueo activo
              </p>
            </div>
          </div>

          {/* Controls: Search & Filters */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por comercio, slug o email..."
                value={billingSearchQuery}
                onChange={(e) => setBillingSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-3 rounded-xl border border-input bg-background text-xs focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Plan & Status Filters */}
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <select
                value={billingPlanFilter}
                onChange={(e) => setBillingPlanFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-input bg-background text-xs font-semibold focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="ALL">📦 Todos los Planes</option>
                <option value="STARTER">Starter ($19/mes)</option>
                <option value="GROWTH">Growth ($49/mes)</option>
                <option value="ENTERPRISE">Enterprise ($99/mes)</option>
              </select>

              <select
                value={billingStatusFilter}
                onChange={(e) => setBillingStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-input bg-background text-xs font-semibold focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="ALL">🏷️ Todos los Estados</option>
                <option value="UP_TO_DATE">✅ Al Día</option>
                <option value="EXPIRING_SOON">⏳ Por Vencer (≤ 5 días)</option>
                <option value="TRIAL">🕒 Periodo de Prueba</option>
                <option value="SUSPENDED">⚠️ Suspendidas / En Mora</option>
              </select>
            </div>
          </div>

          {/* Subscriptions Table */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Comercio</th>
                    <th className="py-3 px-4">Plan SaaS Actual</th>
                    <th className="py-3 px-4">Ciclo & Vencimiento</th>
                    <th className="py-3 px-4">Estado Servicio</th>
                    <th className="py-3 px-4 text-right">Acciones de Cobro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredBillingTenants.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold">No se encontraron comercios con los filtros seleccionados</p>
                      </td>
                    </tr>
                  ) : (
                    filteredBillingTenants.map((t) => {
                      const info = getSubscriptionInfo(t);
                      const tenantInitials = t.name
                        ? t.name
                            .split(" ")
                            .map((w: string) => w[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()
                        : "TI";
                      const tenantLogo =
                        t.settings?.logo_url ||
                        t.logo_url ||
                        (t.slug === "shop-market-ca" || t.id === "shop-market-ca"
                          ? "/brand/logo.png"
                          : null);

                      return (
                        <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                          {/* Tenant Info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <TenantAvatar
                                logoUrl={tenantLogo}
                                name={t.name}
                                primaryColor={t.settings?.primary_color || "#DC2626"}
                                initials={tenantInitials}
                                className="w-9 h-9"
                              />
                              <div>
                                <p className="font-bold text-foreground text-xs">{t.name}</p>
                                <p className="text-[11px] text-muted-foreground font-mono">
                                  {t.slug} • {t.settings?.email || "Sin email"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-foreground">
                                  {info.plan.name}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-bold">
                                  ${info.plan.price_usd_monthly}/mes
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {info.plan.id === "STARTER" && "1 Sucursal • 100 productos"}
                                {info.plan.id === "GROWTH" && "3 Sucursales • 1,000 productos"}
                                {info.plan.id === "ENTERPRISE" && "10 Sucursales • Productos ilimitados"}
                              </p>
                            </div>
                          </td>

                          {/* Period & Expiration */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>
                                  {info.periodEnd.toLocaleDateString("es-VE", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                              <div>
                                {info.isSuspended ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Suspendido / Bloqueado</span>
                                  </span>
                                ) : info.isTrial ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                    <Sparkles className="w-3 h-3" />
                                    <span>Periodo de Prueba ({info.diffDays}d)</span>
                                  </span>
                                ) : info.isExpired ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                    <Clock className="w-3 h-3" />
                                    <span>Vencido hace {Math.abs(info.diffDays)}d</span>
                                  </span>
                                ) : info.isExpiringSoon ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    <Clock className="w-3 h-3" />
                                    <span>Vence en {info.diffDays} días</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                    <Check className="w-3 h-3" />
                                    <span>Al Día ({info.diffDays}d restantes)</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Operational Status */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                t.status === "active"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : t.status === "trial"
                                  ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                  : "bg-destructive/10 text-destructive border-destructive/20"
                              }`}
                            >
                              {t.status === "active"
                                ? "Activo"
                                : t.status === "trial"
                                ? "En Prueba"
                                : "Suspendido"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              {/* 🎭 Login As Soporte */}
                              <button
                                type="button"
                                onClick={() => handleLoginAs(t)}
                                disabled={impersonatingTenantId === t.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[11px] font-black transition-all shadow-xs cursor-pointer disabled:opacity-50"
                                title={`Ingresar con 1 solo clic al panel /admin de ${t.name} como Dueño`}
                              >
                                {impersonatingTenantId === t.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <span className="text-xs">🎭</span>
                                    <span>Login As</span>
                                  </>
                                )}
                              </button>

                              {/* Registrar Cobro / Renovar */}
                              <button
                                onClick={() => {
                                  setRenewingTenant(t);
                                  setRenewDurationDays(30);
                                  setRenewReference("");
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                                title="Registrar pago o cobro de suscripción y extender tiempo de servicio"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Renovar / Cobro</span>
                              </button>

                              {/* Cambiar Plan */}
                              <button
                                onClick={() => {
                                  setChangingPlanTenant(t);
                                  setSelectedPlanTier((t.subscription?.plan_id || "GROWTH") as SubscriptionPlanTier);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-[11px] font-semibold transition-colors cursor-pointer"
                                title="Actualizar o cambiar nivel de plan SaaS"
                              >
                                <Zap className="w-3.5 h-3.5 text-primary" />
                                <span>Cambiar Plan</span>
                              </button>

                              {/* Suspender o Reactivar */}
                              <button
                                onClick={() => handleBillingToggleStatus(t.id, t.status)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                  t.status === "active"
                                    ? "border border-destructive/30 text-destructive hover:bg-destructive/10"
                                    : "bg-emerald-700 text-white hover:bg-emerald-600"
                                }`}
                                title={
                                  t.status === "active"
                                    ? "Suspender comercio inmediatamente (bloquea catálogo y panel)"
                                    : "Reactivar comercio y habilitar tienda digital"
                                }
                              >
                                {t.status === "active" ? "Suspender" : "Reactivar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: BI ANALYTICS & GLOBAL INTELLIGENCE */}
      {activeTab === "BI" && (
        <PlatformBiAnalyticsTab initialAnalytics={initialBiAnalytics} tenants={tenants} />
      )}

      {/* TAB: CLOUDFLARE R2 STORAGE TELEMETRY */}
      {activeTab === "STORAGE" && (
        <PlatformStorageTab
          initialTelemetry={storageTelemetry}
          onImpersonateTenant={(targetId) => {
            const targetTenant = tenants.find((item) => item.id === targetId);
            if (targetTenant) handleLoginAs(targetTenant);
          }}
        />
      )}

      {/* TAB 3: USERS & MULTI-TENANT STAFF DIRECTORY */}
      {activeTab === "USERS" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Feedback Alert Message */}
          {userAlert && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
                userAlert.type === "success"
                  ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
                  : "bg-rose-950/80 border-rose-500/40 text-rose-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {userAlert.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{userAlert.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setUserAlert(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white cursor-pointer"
                title="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* User Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-[11px] font-semibold">Total Usuarios</span>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-foreground">
                {profiles.length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">En toda la plataforma</p>
            </div>

            <div className="p-3.5 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-[11px] font-semibold">Dueños de Tienda</span>
                <Crown className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-foreground">
                {profiles.filter((p) => p.role === "TENANT_OWNER").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Titulares de comercios</p>
            </div>

            <div className="p-3.5 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-[11px] font-semibold">Staff Operativo</span>
                <Briefcase className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-foreground">
                {
                  profiles.filter(
                    (p) =>
                      p.role === "TENANT_MANAGER" ||
                      p.role === "TENANT_CASHIER" ||
                      p.role === "TENANT_INVENTORY"
                  ).length
                }
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Gerentes, cajas y almacén</p>
            </div>

            <div className="p-3.5 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-[11px] font-semibold">Repartidores / Delivery</span>
                <Smartphone className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-foreground">
                {profiles.filter((p) => p.role === "TENANT_DELIVERY").length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Flota de entregas</p>
            </div>
          </div>

          {/* Directory Toolbar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar usuario por nombre, email o teléfono..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-3 rounded-xl border border-input bg-background text-xs focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Filter by Tenant & Create User CTA */}
            <div className="flex items-center gap-2">
              <select
                value={userTenantFilter}
                onChange={(e) => setUserTenantFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-input bg-background text-xs font-semibold focus:ring-2 focus:ring-primary cursor-pointer max-w-[200px] truncate"
              >
                <option value="ALL">Todas las Tiendas</option>
                <option value="GLOBAL">🛡️ Plataforma Global (Sin Tienda)</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    🏪 {t.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setNewUserName("");
                  setNewUserEmail("");
                  setNewUserPhone("+58 4");
                  setNewUserTenantId(tenants[0]?.id || "");
                  setNewUserRole("TENANT_OWNER");
                  setIsCreateUserOpen(true);
                }}
                className="h-10 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Nuevo Usuario</span>
              </button>
            </div>
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: "ALL", label: `Todos (${profiles.length})` },
              {
                id: "TENANT_OWNER",
                label: `Dueños (${profiles.filter((p) => p.role === "TENANT_OWNER").length})`,
              },
              {
                id: "TENANT_MANAGER",
                label: `Gerentes (${profiles.filter((p) => p.role === "TENANT_MANAGER").length})`,
              },
              {
                id: "TENANT_CASHIER",
                label: `Cajeros (${profiles.filter((p) => p.role === "TENANT_CASHIER").length})`,
              },
              {
                id: "TENANT_INVENTORY",
                label: `Inventario (${profiles.filter((p) => p.role === "TENANT_INVENTORY").length})`,
              },
              {
                id: "TENANT_DELIVERY",
                label: `Repartidores (${profiles.filter((p) => p.role === "TENANT_DELIVERY").length})`,
              },
              {
                id: "PLATFORM_SUPER_ADMIN",
                label: `Super Admins (${profiles.filter((p) => p.role === "PLATFORM_SUPER_ADMIN").length})`,
              },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setUserRoleFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  userRoleFilter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Users Table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border font-bold">
                  <tr>
                    <th className="py-3 px-4">Usuario / Identidad</th>
                    <th className="py-3 px-4">Comercio Asignado</th>
                    <th className="py-3 px-4">Rol en Sistema</th>
                    <th className="py-3 px-4">Contacto</th>
                    <th className="py-3 px-4">Fecha Alta</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">No se encontraron usuarios con los filtros seleccionados.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map((user) => {
                      const roleBadge = getRoleBadge(user.role);
                      const RoleIcon = roleBadge.icon;
                      const tenant = tenants.find((t) => t.id === user.tenant_id);

                      return (
                        <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-xs text-primary shrink-0">
                                {user.full_name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-foreground text-sm truncate flex items-center gap-1.5">
                                  <span>{user.full_name}</span>
                                  {user.id === currentUser?.id && (
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground">
                                      Tú
                                    </span>
                                  )}
                                </div>
                                <p className="text-muted-foreground text-xs truncate">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {user.tenant_id ? (
                              <div className="flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-primary shrink-0" />
                                <div>
                                  <span className="font-semibold text-foreground">
                                    {tenant ? tenant.name : user.tenant_id}
                                  </span>
                                  {tenant && (
                                    <span className="text-[10px] text-muted-foreground block font-mono">
                                      {tenant.slug}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                <ShieldCheck className="w-3 h-3" />
                                Plataforma Global
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${roleBadge.className}`}
                            >
                              <RoleIcon className="w-3.5 h-3.5 shrink-0" />
                              <span>{roleBadge.label}</span>
                            </span>
                          </td>

                          <td className="py-3 px-4 text-muted-foreground">
                            {user.phone ? (
                              <div className="flex items-center gap-1 text-xs">
                                <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span>{user.phone}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/60 italic">Sin teléfono</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(user.created_at).toLocaleDateString("es-VE", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Botón Editar Usuario */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditUser(user)}
                                className="px-2.5 py-1.5 rounded-xl border border-border text-foreground hover:bg-muted font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                                title="Editar nombre, teléfono, rol o tienda"
                              >
                                <Edit2 className="w-3 h-3 text-primary" />
                                <span>Editar</span>
                              </button>

                              {/* Botón Administrar Tienda */}
                              {user.tenant_id && (
                                <a
                                  href={`/admin?tenant=${user.tenant_id}`}
                                  className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-xs flex items-center gap-1 transition-colors"
                                  title="Ir al panel de su tienda"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Panel</span>
                                </a>
                              )}

                              {/* Botón Eliminar / Revocar (excepto a uno mismo) */}
                              {user.id !== currentUser?.id && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user.id, user.full_name)}
                                  className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 cursor-pointer transition-colors"
                                  title="Revocar acceso al usuario"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GLOBAL EXCHANGE RATES & AUDIT LEDGER */}
      {activeTab === "RATES" && (
        <div className="space-y-6 animate-in fade-in">
          <ExchangeRateManager
            tenantId="shop-market-ca"
            initialRate={
              exchangeRate || {
                id: "rate-global",
                currency: "VES",
                value: 875.6505,
                eur_value: 980.6147,
                usdt_value: 1016.785,
                source: "alcambio.app",
                updated_at: new Date().toISOString(),
              }
            }
            initialHistory={ratesHistory}
            isSuperAdmin={true}
            onRateUpdated={(newRate) => setCurrentRate(newRate)}
          />
        </div>
      )}

      {/* TAB 5: GLOBAL AUDIT TRAIL */}
      {activeTab === "AUDIT" && (
        <div className="space-y-6 animate-in fade-in">
          <AuditTrailViewer
            initialLogs={initialAuditLogs}
            isSuperAdmin={true}
            allTenants={tenants}
          />
        </div>
      )}

      {/* TAB 8: PLATFORM & SAAS SETTINGS */}
      {activeTab === "SETTINGS" && (
        <PlatformSettingsTab
          initialSettings={platformSettings}
          currentUser={
            currentUser || {
              id: "master-admin",
              email: "admin@marketos.com",
              full_name: "Super Admin Maestro",
              phone: "+58 412-0000000",
              avatar_url: null,
              role: "PLATFORM_SUPER_ADMIN",
              tenant_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          }
          onSettingsUpdated={(updated) => setPlatformSettings(updated)}
          onProfileUpdated={(updatedUser) => {
            setProfiles((prev) =>
              prev.map((p) => (p.id === updatedUser.id ? { ...p, ...updatedUser } : p))
            );
          }}
        />
      )}
    </main>

      {/* Onboarding Wizard Modal */}
      {isOnboardingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Incorporar Nuevo Comercio a MarketOS
                </h2>
                <p className="text-xs text-muted-foreground">
                  Aprovisionamiento automático de base de datos, tienda PWA y tasa BCV
                </p>
              </div>
              <button
                onClick={() => setIsOnboardingOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleOnboardSubmit}
              className="p-4 overflow-y-auto space-y-4 flex-1 text-xs"
            >
              {actionError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Business Name and Slug */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Nombre del Negocio *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Bodegón El Parral"
                    value={bizName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Slug Identificador *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="bodegon-el-parral"
                    value={bizSlug}
                    onChange={(e) => setBizSlug(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background font-mono text-[11px] focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Category & Plan */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Categoría</label>
                  <select
                    value={bizCategory}
                    onChange={(e) => setBizCategory(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary"
                  >
                    <option value="Minimarket">Minimarket</option>
                    <option value="Bodegón">Bodegón</option>
                    <option value="Panadería">Panadería / Pastelería</option>
                    <option value="Farmacia">Farmacia</option>
                    <option value="Licorería">Licorería</option>
                    <option value="Carnicería">Carnicería</option>
                    <option value="Otro">Otro Comercio</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Plan de Suscripción
                  </label>
                  <select
                    value={bizPlan}
                    onChange={(e) =>
                      setBizPlan(e.target.value as SubscriptionPlanTier)
                    }
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background font-bold focus:ring-2 focus:ring-primary"
                  >
                    <option value="STARTER">Starter ($19/mes)</option>
                    <option value="GROWTH">Growth ($49/mes) - Recomendado</option>
                    <option value="ENTERPRISE">Enterprise ($99/mes)</option>
                  </select>
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Teléfono WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+58 412 1234567"
                    value={bizPhone}
                    onChange={(e) => {
                      setBizPhone(e.target.value);
                      setBizWhatsapp(e.target.value);
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Correo Propietario *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="contacto@negocio.com"
                    value={bizEmail}
                    onChange={(e) => setBizEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Dirección Física de la Tienda *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Av. Los Leones, Barquisimeto, Lara"
                  value={bizAddress}
                  onChange={(e) => setBizAddress(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Initial Store Name & Brand Color */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Nombre Sucursal Inicial
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Sede Principal"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Color Primario de Marca
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bizColor}
                      onChange={(e) => setBizColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border border-border"
                    />
                    <input
                      type="text"
                      value={bizColor}
                      onChange={(e) => setBizColor(e.target.value)}
                      className="flex-1 h-10 px-3 rounded-xl border border-input bg-background font-mono uppercase text-[11px]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsOnboardingOpen(false)}
                  className="w-1/3 h-11 rounded-xl border border-border text-foreground font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 h-11 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Aprovisionando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Crear e Incorporar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUCURSALES INSPECTION MODAL */}
      {selectedTenantForStores && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">
                    Sucursales de {selectedTenantForStores.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Puntos de venta, sedes de retiro físico y despacho de pedidos
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTenantForStores(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of Stores */}
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {(!selectedTenantForStores.stores || selectedTenantForStores.stores.length === 0) ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-border bg-muted/20 space-y-2">
                  <Store className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                  <p className="text-xs font-semibold text-foreground">
                    No hay sucursales registradas aún para este comercio.
                  </p>
                </div>
              ) : (
                selectedTenantForStores.stores.map((st) => (
                  <div
                    key={st.id}
                    className="p-4 rounded-xl border border-border bg-muted/30 hover:border-primary/40 transition-colors space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">
                          {st.name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-semibold">
                          {st.code}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          st.is_active
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }`}
                      >
                        {st.is_active ? "Operativa / Activa" : "Inactiva"}
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{st.address || "Dirección no especificada"}</span>
                      </div>
                      {st.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{st.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                      <a
                        href={`/admin?tenant=${selectedTenantForStores.id}&store=${st.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Administrar esta Sucursal</span>
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedTenantForStores(null)}
                className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
              <a
                href={`/admin?tenant=${selectedTenantForStores.id}`}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold flex items-center gap-1.5"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Entrar al Panel Completo de la Tienda</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: REGISTRAR NUEVO USUARIO */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary" />
                  Registrar Nuevo Usuario en MarketOS
                </h2>
                <p className="text-xs text-muted-foreground">
                  Asigna acceso a un comercio específico o como operador global
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateUserOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateUserSubmit}
              className="p-5 overflow-y-auto space-y-4 text-xs"
            >
              {/* Full Name */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Nombre y Apellido *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Mendoza"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="carlos@negocio.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="+58 412 1234567"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Assigned Tenant */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Comercio / Tienda Asignada
                </label>
                <select
                  value={newUserTenantId}
                  onChange={(e) => setNewUserTenantId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background font-semibold focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="">🛡️ Plataforma Global (Sin Tienda / Super Admin)</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      🏪 {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Selecciona la tienda a la que pertenecerá este usuario o déjalo global si es Super Admin.
                </p>
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Rol y Nivel de Acceso *
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background font-bold focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="TENANT_OWNER">👑 Dueño de Tienda (Acceso total al comercio)</option>
                  <option value="TENANT_MANAGER">👔 Gerente (Inventario, reportes y ventas)</option>
                  <option value="TENANT_CASHIER">💵 Cajero (Validación de pagos y pedidos)</option>
                  <option value="TENANT_INVENTORY">📦 Inventario (Stock y productos)</option>
                  <option value="TENANT_DELIVERY">🛵 Repartidor (Entregas y rutas)</option>
                  <option value="PLATFORM_SUPER_ADMIN">🛡️ Super Administrador (Toda la plataforma SaaS)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={userLoading}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {userLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Registrar Usuario</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR ROL Y ASIGNACIÓN DE USUARIO */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-primary" />
                  Editar Usuario y Acceso
                </h2>
                <p className="text-xs text-muted-foreground truncate max-w-xs">
                  {editingUser.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleUpdateUserSubmit}
              className="p-5 space-y-4 text-xs"
            >
              {/* Full Name */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Nombre y Apellido"
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background font-medium focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Teléfono Móvil
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="ej. +58 412 1234567 o internacional"
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background font-medium font-mono focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Rol Selector */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Rol de Sistema *
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background font-bold focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="TENANT_OWNER">👑 Dueño de Tienda</option>
                  <option value="TENANT_MANAGER">👔 Gerente</option>
                  <option value="TENANT_CASHIER">💵 Cajero</option>
                  <option value="TENANT_INVENTORY">📦 Inventario</option>
                  <option value="TENANT_DELIVERY">🛵 Repartidor</option>
                  <option value="PLATFORM_SUPER_ADMIN">🛡️ Super Administrador</option>
                  <option value="CUSTOMER">👤 Cliente Registrado</option>
                </select>
              </div>

              {/* Tenant Reassignment */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Comercio Asignado
                </label>
                <select
                  value={editTenantId}
                  onChange={(e) => setEditTenantId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background font-semibold focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="">🛡️ Plataforma Global (Sin Tienda)</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      🏪 {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={userLoading}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {userLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Actualizar Acceso</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR COBRO Y RENOVAR SUSCRIPCIÓN */}
      {renewingTenant && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-black text-foreground">
                    Registrar Cobro y Extender Suscripción
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Comercio: <strong className="text-foreground">{renewingTenant.name}</strong> • Plan:{" "}
                  <strong className="text-foreground">{renewingTenant.plan?.name || "Growth"}</strong> (${renewingTenant.plan?.price_usd_monthly || 49}/mes)
                </p>
              </div>
              <button
                onClick={() => setRenewingTenant(null)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenewSubscriptionSubmit} className="space-y-4 text-xs">
              {/* Duration selector presets */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Duración de Extensión
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { days: 30, label: "30 Días", sub: "1 Mes" },
                    { days: 60, label: "60 Días", sub: "2 Meses" },
                    { days: 90, label: "90 Días", sub: "3 Meses" },
                    { days: 365, label: "1 Año", sub: "15% Desc." },
                  ].map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setRenewDurationDays(preset.days)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        renewDurationDays === preset.days
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                          : "border-border bg-background hover:bg-muted text-foreground"
                      }`}
                    >
                      <p className="font-bold text-xs">{preset.label}</p>
                      <p className="text-[10px] text-muted-foreground">{preset.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Breakdown Preview */}
              {(() => {
                const monthlyPrice = renewingTenant.plan?.price_usd_monthly || 49;
                const months = renewDurationDays / 30;
                const discount = renewDurationDays === 365 ? 0.85 : 1;
                const amountUsd = Number((monthlyPrice * months * discount).toFixed(2));
                const bcvRate = exchangeRate?.value || 60;
                const amountVes = Number((amountUsd * bcvRate).toFixed(2));

                return (
                  <div className="bg-muted/50 border border-border p-3.5 rounded-2xl space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Monto de Facturación:</span>
                      <span className="font-black text-base text-foreground">
                        ${amountUsd.toFixed(2)} USD
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                      <span>Equivalente en Bolívares (Tasa BCV {bcvRate.toFixed(2)} Bs/$):</span>
                      <span className="font-bold text-foreground">Bs. {amountVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Payment Method */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Método de Cobro Recibido
                </label>
                <select
                  value={renewMethod}
                  onChange={(e) => setRenewMethod(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background font-semibold focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="PAGO_MOVIL">📲 Pago Móvil (VES)</option>
                  <option value="ZELLE">💳 Zelle (USD)</option>
                  <option value="EFECTIVO_USD">💵 Efectivo Divisas USD</option>
                  <option value="BINANCE_PAY">🪙 Binance Pay (USDT)</option>
                  <option value="TRANSFERENCIA">🏦 Transferencia Bancaria Nacional (VES)</option>
                </select>
              </div>

              {/* Payment Reference */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Nro. de Referencia / Comprobante (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Ref: 894120 / Tel: 0414-9876543"
                  value={renewReference}
                  onChange={(e) => setRenewReference(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary font-mono text-xs"
                />
              </div>

              {/* Info note */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] leading-relaxed">
                ✨ <strong>Reactivación Automática:</strong> Al confirmar el cobro, el comercio se reactivará de inmediato si estaba suspendido, actualizando el catálogo digital para recibir pedidos al instante.
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenewingTenant(null)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={renewLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {renewLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Cobro y Extender</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CAMBIAR PLAN SAAS */}
      {changingPlanTenant && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-black text-foreground">
                    Cambiar Plan SaaS
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Comercio: <strong className="text-foreground">{changingPlanTenant.name}</strong> • Plan Actual:{" "}
                  <strong className="text-foreground">{changingPlanTenant.plan?.name || "Growth"}</strong>
                </p>
              </div>
              <button
                onClick={() => setChangingPlanTenant(null)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePlanSubmit} className="space-y-4 text-xs">
              <div className="space-y-2.5">
                <label className="font-semibold text-foreground">
                  Selecciona el Nivel de Suscripción
                </label>
                <div className="space-y-2">
                  {plans.map((p) => {
                    const isSelected = selectedPlanTier === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPlanTier(p.id as SubscriptionPlanTier)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs"
                            : "border-border bg-background hover:bg-muted/40"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-foreground">
                              {p.name}
                            </span>
                            {p.id === "GROWTH" && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                                Recomendado
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{p.description}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
                            <span>{p.features.slice(0, 2).join(" • ")}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 pl-3">
                          <span className="text-lg font-black text-foreground">
                            ${p.price_usd_monthly}
                          </span>
                          <span className="text-[10px] text-muted-foreground block">/mes USD</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setChangingPlanTenant(null)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={changingPlanLoading}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {changingPlanLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Guardar Cambio de Plan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tenant Plugins & Modules Manager Modal */}
      {pluginsModalTenant && (
        <TenantPluginsModal
          tenant={pluginsModalTenant}
          isOpen={Boolean(pluginsModalTenant)}
          onClose={() => setPluginsModalTenant(null)}
          isSuperAdmin={true}
        />
      )}
    </div>
  );
}
