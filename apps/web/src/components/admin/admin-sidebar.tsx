"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UserProfile,
  TenantSettings,
  TenantPlanLimits,
  TenantModuleId,
  UserRole,
} from "@marketos/types";
import {
  FileCheck2,
  PackageCheck,
  Truck,
  Boxes,
  Utensils,
  Ticket,
  BellRing,
  LayoutTemplate,
  Layers,
  Printer,
  Calculator,
  BarChart3,
  Landmark,
  ReceiptText,
  ShoppingBag,
  BookOpen,
  Building2,
  ShieldCheck,
  History,
  Sliders,
  Puzzle,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  ExternalLink,
  Zap,
  Sparkles,
  Crown,
  Store as StoreIcon,
} from "lucide-react";
import { logoutUserAction } from "@/app/login/actions";
import { PlanUpgradeModal } from "../plan-upgrade-modal";

interface NavItem {
  id: string;
  href: string;
  category: "OPERATIONS" | "CATALOG" | "FINANCE" | "MANAGEMENT";
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  badge?: string | number | null;
  badgeClassName?: string;
  requiredModule?: TenantModuleId;
}

interface AdminSidebarProps {
  currentUser: UserProfile;
  settings: TenantSettings;
  planLimits: TenantPlanLimits | null;
  activeModuleIds: TenantModuleId[];
  pendingPaymentsCount?: number;
  ordersCount?: number;
  productsCount?: number;
  bcvRate?: number;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
  className?: string;
}

const CATEGORIES = [
  { id: "OPERATIONS", title: "Operaciones del Día" },
  { id: "CATALOG", title: "Catálogo & Stock" },
  { id: "FINANCE", title: "Finanzas & Fiscal" },
  { id: "MANAGEMENT", title: "Administración & Tienda" },
] as const;

// Matriz de permisos RBAC
const MODULE_ROLE_PERMISSIONS: Record<string, UserRole[]> = {
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
  POS: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_CASHIER"],
  INVENTORY: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_INVENTORY"],
  FOOD_SERVICE: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_INVENTORY"],
  MTO_CPQ: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_INVENTORY"],
  CRAFT_WORKSHOP: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_INVENTORY"],
  PRINTOPINK_CALCULATOR: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_INVENTORY"],
  COUPONS: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER"],
  PUSH: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER"],
  STOREFRONT_STUDIO: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER"],
  REPORTS: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER"],
  RATES: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_CASHIER"],
  INVOICING: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER", "TENANT_CASHIER"],
  PURCHASING: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER"],
  ACCOUNTING: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER", "TENANT_MANAGER"],
  STORES: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER"],
  STAFF: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER"],
  AUDIT: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER"],
  SETTINGS: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER"],
  PLUGINS: ["PLATFORM_SUPER_ADMIN", "TENANT_OWNER"],
};

export function AdminSidebar({
  currentUser,
  settings,
  planLimits,
  activeModuleIds,
  pendingPaymentsCount = 0,
  ordersCount = 0,
  productsCount = 0,
  bcvRate,
  variant = "desktop",
  onNavigate,
  className = "",
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const isMobile = variant === "mobile";
  const effectiveCollapsed = isMobile ? false : isCollapsed;

  // Restore sidebar state from localStorage (only for desktop)
  useEffect(() => {
    if (isMobile) return;
    const saved = localStorage.getItem("marketos_admin_sidebar_collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, [isMobile]);

  const toggleCollapse = () => {
    if (isMobile) return;
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("marketos_admin_sidebar_collapsed", String(next));
  };

  const userRole = currentUser.role || "TENANT_OWNER";
  const isSuperAdminOrImpersonating =
    userRole === "PLATFORM_SUPER_ADMIN" || Boolean(currentUser.impersonation);
  const isOwner = userRole === "TENANT_OWNER";

  const allItems: NavItem[] = [
    // 1. OPERACIONES
    {
      id: "PAYMENTS",
      href: "/admin/payments",
      category: "OPERATIONS",
      label: "Validación de Pagos",
      shortLabel: "Pagos",
      icon: <FileCheck2 className="w-4 h-4 shrink-0" />,
      badge: pendingPaymentsCount > 0 ? pendingPaymentsCount : null,
      badgeClassName: "bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black",
    },
    {
      id: "ORDERS",
      href: "/admin/orders",
      category: "OPERATIONS",
      label: "Gestión y Despacho",
      shortLabel: "Pedidos",
      icon: <PackageCheck className="w-4 h-4 shrink-0" />,
      badge: ordersCount > 0 ? ordersCount : null,
      badgeClassName: "bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "POS",
      href: "/admin/pos",
      category: "OPERATIONS",
      label: "Punto de Venta (POS)",
      shortLabel: "Cajas POS",
      icon: <StoreIcon className="w-4 h-4 shrink-0" />,
      badge: "POS",
      badgeClassName: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "DELIVERY",
      href: "/admin/delivery",
      category: "OPERATIONS",
      label: "Delivery y Repartidores",
      shortLabel: "Delivery",
      icon: <Truck className="w-4 h-4 shrink-0" />,
      requiredModule: "delivery_fleet",
    },

    // 2. CATÁLOGO & STOCK
    {
      id: "INVENTORY",
      href: "/admin/inventory",
      category: "CATALOG",
      label: "Catálogo & Inventario",
      shortLabel: "Inventario",
      icon: <Boxes className="w-4 h-4 shrink-0" />,
      badge: productsCount > 0 ? productsCount : null,
      badgeClassName: "bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "FOOD_SERVICE",
      href: "/admin/food-service",
      category: "CATALOG",
      label: "Insumos & Recetas Cocina",
      shortLabel: "Food Service",
      icon: <Utensils className="w-4 h-4 shrink-0" />,
      badge: "Cocina",
      badgeClassName: "bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
      requiredModule: "food_service",
    },
    {
      id: "MTO_CPQ",
      href: "/admin/mto-cpq",
      category: "CATALOG",
      label: "Cotizador MTO / Taller",
      shortLabel: "Taller MTO",
      icon: <Layers className="w-4 h-4 shrink-0" />,
      badge: "CPQ",
      badgeClassName: "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
      requiredModule: "mto_cpq",
    },
    {
      id: "CRAFT_WORKSHOP",
      href: "/admin/craft",
      category: "CATALOG",
      label: "Taller Sublimación & DTF",
      shortLabel: "Taller Gráfico",
      icon: <Printer className="w-4 h-4 shrink-0" />,
      badge: "Craft",
      badgeClassName: "bg-fuchsia-500/10 text-fuchsia-600 border border-fuchsia-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
      requiredModule: "craft_workshop",
    },
    {
      id: "PRINTOPINK_CALCULATOR",
      href: "/admin/printopink-calculator",
      category: "CATALOG",
      label: "Calculadora PrintoPink",
      shortLabel: "Costeo PrintoPink",
      icon: <Calculator className="w-4 h-4 shrink-0" />,
      badge: "PrintoPink",
      badgeClassName: "bg-pink-500/10 text-pink-600 border border-pink-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
      requiredModule: "printopink_calculator",
    },

    // 3. FINANZAS & FISCAL
    {
      id: "RATES",
      href: "/admin/rates",
      category: "FINANCE",
      label: "Tasa Oficial BCV & Divisas",
      shortLabel: "Tasas BCV",
      icon: <Landmark className="w-4 h-4 shrink-0" />,
      badge: bcvRate ? `Bs. ${bcvRate.toFixed(2)}` : null,
      badgeClassName: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold",
      requiredModule: "local_venezuela",
    },
    {
      id: "INVOICING",
      href: "/admin/invoicing",
      category: "FINANCE",
      label: "Facturación Fiscal SENIAT",
      shortLabel: "Facturación",
      icon: <ReceiptText className="w-4 h-4 shrink-0" />,
      badge: "SENIAT",
      badgeClassName: "bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
      requiredModule: "invoicing",
    },
    {
      id: "PURCHASING",
      href: "/admin/purchasing",
      category: "FINANCE",
      label: "Compras & Retenciones",
      shortLabel: "Compras",
      icon: <ShoppingBag className="w-4 h-4 shrink-0" />,
      badge: "SPE",
      badgeClassName: "bg-purple-500/10 text-purple-600 border border-purple-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
      requiredModule: "purchasing_retentions",
    },
    {
      id: "ACCOUNTING",
      href: "/admin/accounting",
      category: "FINANCE",
      label: "Contabilidad & Libros",
      shortLabel: "Contabilidad",
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
      badge: "NIIF",
      badgeClassName: "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
      requiredModule: "accounting",
    },
    {
      id: "REPORTS",
      href: "/admin/reports",
      category: "FINANCE",
      label: "Reportes de Venta & Caja",
      shortLabel: "Reportes",
      icon: <BarChart3 className="w-4 h-4 shrink-0" />,
    },

    // 4. ADMINISTRACIÓN & TIENDA
    {
      id: "SETTINGS",
      href: "/admin/settings",
      category: "MANAGEMENT",
      label: "Ajustes del Comercio",
      shortLabel: "Ajustes",
      icon: <Sliders className="w-4 h-4 shrink-0" />,
    },
    {
      id: "STORES",
      href: "/admin/stores",
      category: "MANAGEMENT",
      label: "Sedes Físicas & Sucursales",
      shortLabel: "Sucursales",
      icon: <Building2 className="w-4 h-4 shrink-0" />,
    },
    {
      id: "STAFF",
      href: "/admin/staff",
      category: "MANAGEMENT",
      label: "Equipo de Trabajo & Roles",
      shortLabel: "Equipo",
      icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
    },
    {
      id: "STOREFRONT_STUDIO",
      href: "/admin/storefront-studio",
      category: "MANAGEMENT",
      label: "Tienda Online (Vitrina Pro)",
      shortLabel: "Vitrina Pro",
      icon: <LayoutTemplate className="w-4 h-4 shrink-0" />,
      badge: "Studio",
      badgeClassName: "bg-rose-500/10 text-rose-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
      requiredModule: "storefront_pro",
    },
    {
      id: "COUPONS",
      href: "/admin/coupons",
      category: "MANAGEMENT",
      label: "Cupones de Descuento",
      shortLabel: "Cupones",
      icon: <Ticket className="w-4 h-4 shrink-0" />,
      requiredModule: "promotions_coupons",
    },
    {
      id: "PUSH",
      href: "/admin/push",
      category: "MANAGEMENT",
      label: "Notificaciones Web Push",
      shortLabel: "Push",
      icon: <BellRing className="w-4 h-4 shrink-0" />,
      badge: "PWA",
      badgeClassName: "bg-amber-500/10 text-amber-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
      requiredModule: "push_notifications",
    },
    {
      id: "PLUGINS",
      href: "/admin/plugins",
      category: "MANAGEMENT",
      label: "Módulos & Plugins",
      shortLabel: "Plugins",
      icon: <Puzzle className="w-4 h-4 shrink-0" />,
      badge: `${activeModuleIds.length}`,
      badgeClassName: "bg-purple-500/10 text-purple-600 border border-purple-500/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
    },
    {
      id: "AUDIT",
      href: "/admin/audit",
      category: "MANAGEMENT",
      label: "Auditoría & Logs",
      shortLabel: "Auditoría",
      icon: <History className="w-4 h-4 shrink-0" />,
    },
  ];

  // Filtrado por módulo activo y RBAC
  const visibleItems = allItems.filter((item) => {
    // Si requiere un módulo y no está activo, omitir
    if (item.requiredModule && !activeModuleIds.includes(item.requiredModule)) {
      return false;
    }

    if (isSuperAdminOrImpersonating || isOwner) return true;

    // Granular permissions
    if (currentUser?.custom_permissions && currentUser.custom_permissions.length > 0) {
      const permsUpper = currentUser.custom_permissions.map((p) => p.toUpperCase());
      return permsUpper.includes(item.id.toUpperCase());
    }

    const allowed = MODULE_ROLE_PERMISSIONS[item.id];
    return !allowed || allowed.includes(userRole);
  });

  const RootTag = isMobile ? "div" : "aside";

  return (
    <>
      <RootTag
        className={
          isMobile
            ? `flex flex-col h-full w-full bg-card select-none min-h-0 ${className}`
            : `hidden lg:flex flex-col border-r border-border bg-card/85 backdrop-blur-md sticky top-0 h-screen shrink-0 transition-all duration-300 z-30 select-none ${
                effectiveCollapsed ? "w-20" : "w-64 xl:w-72"
              } ${className}`
        }
      >
        {/* Header: Logo, Name & Collapse toggle (Desktop only) */}
        {!isMobile && (
          <div
            className={`p-3.5 border-b border-border flex items-center ${
              effectiveCollapsed ? "justify-center" : "justify-between"
            } gap-2`}
          >
            {!effectiveCollapsed ? (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  {settings.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt={settings.business_name}
                      className="h-9 w-9 object-contain rounded-xl bg-card border border-border p-0.5 shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shadow-sm tracking-tighter shrink-0">
                      {settings.business_name ? settings.business_name.substring(0, 2).toUpperCase() : "MO"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-black text-sm tracking-tight text-foreground truncate">
                      {settings.business_name || "MarketOS"}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] font-black uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.2 rounded-full shrink-0">
                        Tenant
                      </span>
                      <span className="text-xs font-mono font-medium text-foreground/80 truncate">
                        {settings.tenant_id}
                      </span>
                    </div>
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => setIsUpgradeModalOpen(true)}
                        className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-lg border transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-2xs ${
                          planLimits?.plan.id === "ENTERPRISE"
                            ? "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400"
                            : planLimits?.plan.id === "GROWTH"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
                        }`}
                        title="Plan SaaS Activo - Clic para ver cuotas y planes"
                      >
                        {planLimits?.plan.id === "ENTERPRISE" ? (
                          <Crown className="w-3 h-3 text-purple-500" />
                        ) : planLimits?.plan.id === "GROWTH" ? (
                          <Sparkles className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Zap className="w-3 h-3 text-amber-500" />
                        )}
                        <span>{planLimits?.plan.name || "Plan Starter"}</span>
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                  title="Colapsar menú lateral"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {settings.logo_url ? (
                  <img
                    src={settings.logo_url}
                    alt={settings.business_name}
                    className="h-9 w-9 object-contain rounded-xl bg-card border border-border p-0.5 shadow-xs shrink-0"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shadow-sm tracking-tighter shrink-0">
                    {settings.business_name ? settings.business_name.substring(0, 2).toUpperCase() : "MO"}
                  </div>
                )}
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="Expandir menú lateral"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Plan status indicator for mobile drawer */}
        {isMobile && (
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Plan Activo
            </span>
            <button
              type="button"
              onClick={() => setIsUpgradeModalOpen(true)}
              className={`inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-lg border transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-2xs ${
                planLimits?.plan.id === "ENTERPRISE"
                  ? "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400"
                  : planLimits?.plan.id === "GROWTH"
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
              }`}
              title="Plan SaaS Activo - Clic para ver cuotas y planes"
            >
              {planLimits?.plan.id === "ENTERPRISE" ? (
                <Crown className="w-3.5 h-3.5 text-purple-500" />
              ) : planLimits?.plan.id === "GROWTH" ? (
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>{planLimits?.plan.name || "Plan Starter"}</span>
            </button>
          </div>
        )}

        {/* Categorized Navigation list */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-4 min-h-0">
          {CATEGORIES.map((cat) => {
            const catItems = visibleItems.filter((i) => i.category === cat.id);
            if (catItems.length === 0) return null;

            return (
              <div key={cat.id} className="space-y-1">
                {!effectiveCollapsed ? (
                  <div className="px-3 pt-1 pb-0.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground/90">
                    {cat.title}
                  </div>
                ) : (
                  <div className="border-t border-border/60 my-2 mx-1" />
                )}
                <div className="space-y-0.5">
                  {catItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={onNavigate}
                        title={effectiveCollapsed ? item.label : undefined}
                        className={`w-full flex items-center rounded-xl transition-all cursor-pointer ${
                          effectiveCollapsed
                            ? "justify-center p-2.5 relative"
                            : "justify-between px-3 py-2 text-left"
                        } ${
                          isActive
                            ? "bg-primary text-primary-foreground font-black shadow-xs"
                            : "text-foreground/80 hover:text-foreground hover:bg-muted font-bold"
                        }`}
                      >
                        <div
                          className={`flex items-center min-w-0 ${
                            effectiveCollapsed ? "" : "gap-3"
                          }`}
                        >
                          <span
                            className={
                              isActive
                                ? "text-primary-foreground"
                                : "text-muted-foreground"
                            }
                          >
                            {item.icon}
                          </span>
                          {!effectiveCollapsed && (
                            <span className="text-sm font-extrabold truncate leading-tight">
                              {item.shortLabel}
                            </span>
                          )}
                        </div>

                        {!effectiveCollapsed && item.badge !== undefined && item.badge !== null && (
                          <span
                            className={`shrink-0 ml-2 ${
                              item.badgeClassName ||
                              "text-xs px-2 py-0.5 rounded-full bg-muted text-foreground"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}

                        {effectiveCollapsed && item.badge !== undefined && item.badge !== null && (
                          <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-primary" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: User profile, Storefront link & Logout */}
        <div className="p-3 border-t border-border space-y-2 bg-card/40 shrink-0">
          {!effectiveCollapsed ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
                  {currentUser.full_name ? currentUser.full_name.substring(0, 2).toUpperCase() : "US"}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">
                    {currentUser.full_name || currentUser.email}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate uppercase font-mono">
                    {currentUser.role}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href={settings?.tenant_id ? `/t/${settings.tenant_id}` : "/"}
                  target="_blank"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="Ver vitrina pública"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => logoutUserAction()}
                  className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Link
                href={settings?.tenant_id ? `/t/${settings.tenant_id}` : "/"}
                target="_blank"
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Ver vitrina pública"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => logoutUserAction()}
                className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </RootTag>

      {/* Plan Upgrade Modal */}
      {isUpgradeModalOpen && planLimits && (
        <PlanUpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          tenantName={settings.business_name}
          tenantId={settings.tenant_id}
          planLimits={planLimits}
        />
      )}
    </>
  );
}
