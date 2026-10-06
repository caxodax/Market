"use client";

import React, { useState } from "react";
import {
  PlatformMetrics,
  TenantWithDetails,
  SubscriptionPlan,
  SubscriptionPlanTier,
} from "@marketos/types";
import { formatCurrency, slugify } from "@marketos/utils";
import {
  onboardTenantAction,
  updateTenantStatusAction,
} from "../app/actions";
import {
  Building2,
  DollarSign,
  TrendingUp,
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
} from "lucide-react";

interface SuperAdminDashboardProps {
  metrics: PlatformMetrics;
  tenants: TenantWithDetails[];
  plans: SubscriptionPlan[];
}

export function SuperAdminDashboard({
  metrics: initialMetrics,
  tenants: initialTenants,
  plans,
}: SuperAdminDashboardProps) {
  const [tenants, setTenants] = useState<TenantWithDetails[]>(initialTenants);
  const [metrics, setMetrics] = useState<PlatformMetrics>(initialMetrics);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Platform Master Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-sm tracking-tighter">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base tracking-tight text-foreground">
                  MarketOS Master
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Consola Centralizada Multi-Tenant SaaS
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
                <span>Redis: OK</span>
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                <Cloud className="w-3.5 h-3.5" />
                <span>Cloudflare R2: OK</span>
              </span>
            </div>

            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-transform active:scale-95 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Comercio</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Active Tenants */}
          <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold">Comercios Activos</span>
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-black text-foreground">
              {metrics.activeTenants}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">
                / {metrics.totalTenants} total
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Escala multi-tenant activa
            </p>
          </div>

          {/* Monthly Recurring Revenue */}
          <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold">MRR Suscripciones</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-foreground">
              {formatCurrency(metrics.mrrUsd, "USD")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ingresos mensuales recurrentes
            </p>
          </div>

          {/* Platform GMV */}
          <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold">GMV Transaccionado</span>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-foreground">
              {formatCurrency(metrics.totalGmvUsd, "USD")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">
              Bs. {metrics.totalGmvVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Total Orders & Stores */}
          <div className="p-4 rounded-2xl border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold">Pedidos & Sucursales</span>
              <Package className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-foreground">
              {metrics.totalOrders}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">
                en {metrics.totalStores} sucursales
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {metrics.totalProducts} productos catalogados
            </p>
          </div>
        </div>

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
                  filteredTenants.map((tenant) => {
                    const initials = tenant.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    const primaryColor =
                      tenant.settings?.primary_color || "#DC2626";

                    return (
                      <tr
                        key={tenant.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        {/* Tenant Name & Details */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 shadow-xs"
                              style={{ backgroundColor: primaryColor }}
                            >
                              {initials}
                            </div>
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
                          </div>
                        </td>

                        {/* Stores & Products */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-foreground">
                              {tenant.storesCount} {tenant.storesCount === 1 ? "Sucursal" : "Sucursales"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {tenant.productsCount} Productos
                            </p>
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
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`http://localhost:3000/?tenant=${tenant.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-[11px] font-semibold transition-colors"
                              title="Abrir Catálogo PWA en vivo"
                            >
                              <ExternalLink className="w-3 h-3 text-primary" />
                              <span>Ver PWA</span>
                            </a>

                            <button
                              onClick={() =>
                                handleToggleStatus(tenant.id, tenant.status)
                              }
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
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
    </div>
  );
}
