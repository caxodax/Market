"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Tag,
  CreditCard,
  Ban,
  Package,
  DollarSign,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  Building2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
  FileText,
  Key,
  Radio,
  UserCheck,
  UserPlus,
  Users,
  ShieldAlert,
  LogIn,
  Sliders,
  Copy,
  Check,
} from "lucide-react";
import { AuditLog, AuditActionType, Tenant } from "@marketos/types";
import { getAuditLogsAction } from "@/app/admin/actions";
import { getGlobalAuditLogsAction } from "@/app/platform/actions";

export type AuditCategory =
  | "ALL"
  | "LOGINS"
  | "SUPPORT"
  | "USERS"
  | "STOCK"
  | "PRICES"
  | "PAYMENTS"
  | "CANCELLATIONS"
  | "RATES"
  | "OTHER";

interface AuditTrailViewerProps {
  initialLogs: AuditLog[];
  tenantId?: string;
  isSuperAdmin?: boolean;
  allTenants?: Tenant[];
}

export function AuditTrailViewer({
  initialLogs = [],
  tenantId,
  isSuperAdmin = false,
  allTenants = [],
}: AuditTrailViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLivePolling, setIsLivePolling] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const [selectedTenant, setSelectedTenant] = useState<string>(
    tenantId && !isSuperAdmin ? tenantId : "ALL"
  );
  const [activeCategory, setActiveCategory] = useState<AuditCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  // Quick refresh from server (can be silent for background polling)
  const handleRefresh = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      if (isSuperAdmin) {
        const res = await getGlobalAuditLogsAction({
          tenantId: selectedTenant !== "ALL" ? selectedTenant : undefined,
          limit: 150,
        });
        if (res.success && res.logs) {
          setLogs(res.logs);
          setLastSyncedAt(new Date());
        }
      } else if (tenantId) {
        const res = await getAuditLogsAction(tenantId, 150);
        if (res.success && res.logs) {
          setLogs(res.logs);
          setLastSyncedAt(new Date());
        }
      }
    } catch (err) {
      console.error("Error refreshing audit logs:", err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  // Live Auto-Refresh Heartbeat (every 10s)
  useEffect(() => {
    if (!isLivePolling) return;
    const interval = setInterval(() => {
      handleRefresh(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [isLivePolling, isSuperAdmin, selectedTenant, tenantId]);

  // When selected tenant changes, immediately trigger refresh
  const handleTenantChange = (tId: string) => {
    setSelectedTenant(tId);
    setExpandedLogId(null);
  };

  // Helper formatting for Caracas timezone
  const formatDateTime = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      return d.toLocaleString("es-VE", {
        timeZone: "America/Caracas",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return isoDate;
    }
  };

  // Helper for relative time (e.g. "hace 4 min")
  const formatRelativeTime = (isoDate: string) => {
    try {
      const now = Date.now();
      const past = new Date(isoDate).getTime();
      const diffSec = Math.floor((now - past) / 1000);
      if (diffSec < 45) return "hace unos segundos";
      if (diffSec < 90) return "hace 1 min";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `hace ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `hace ${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      return `hace ${diffDays} d`;
    } catch {
      return "";
    }
  };

  // Copy Log JSON to clipboard
  const handleCopyLogJson = (log: AuditLog) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedLogId(log.id);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  // Tenant-Scoped Logs for Accurate Counts
  const tenantScopedLogs = useMemo(() => {
    return logs.filter((log) => {
      if (isSuperAdmin && selectedTenant !== "ALL") {
        return log.tenant_id === selectedTenant;
      }
      return true;
    });
  }, [logs, selectedTenant, isSuperAdmin]);

  // Category counts based on active tenant scope
  const counts = useMemo(() => {
    return {
      ALL: tenantScopedLogs.length,
      LOGINS: tenantScopedLogs.filter(
        (l) => l.action === "USER_LOGIN" || l.action.includes("LOGIN")
      ).length,
      SUPPORT: tenantScopedLogs.filter(
        (l) =>
          l.action.includes("SUPPORT_IMPERSONATION") ||
          l.action.includes("IMPERSONATION")
      ).length,
      USERS: tenantScopedLogs.filter(
        (l) =>
          (l.action.includes("USER") ||
            l.action.includes("PROFILE") ||
            l.action.includes("STAFF")) &&
          l.action !== "USER_LOGIN"
      ).length,
      STOCK: tenantScopedLogs.filter(
        (l) => l.action.includes("STOCK") || l.action.includes("INVENTORY")
      ).length,
      PRICES: tenantScopedLogs.filter(
        (l) => l.action === "PRICE_CHANGED" || l.action.includes("PRICE")
      ).length,
      PAYMENTS: tenantScopedLogs.filter(
        (l) =>
          l.action.includes("PAYMENT") ||
          l.action === "PAYMENT_APPROVED" ||
          l.action === "PAYMENT_REJECTED"
      ).length,
      CANCELLATIONS: tenantScopedLogs.filter(
        (l) => l.action === "ORDER_CANCELLED" || l.action.includes("CANCEL")
      ).length,
      RATES: tenantScopedLogs.filter(
        (l) => l.action.includes("RATE") || l.action.includes("BCV")
      ).length,
      OTHER: tenantScopedLogs.filter((l) => {
        const isStandard =
          l.action.includes("LOGIN") ||
          l.action.includes("IMPERSONATION") ||
          l.action.includes("USER") ||
          l.action.includes("PROFILE") ||
          l.action.includes("STAFF") ||
          l.action.includes("STOCK") ||
          l.action.includes("INVENTORY") ||
          l.action.includes("PRICE") ||
          l.action.includes("PAYMENT") ||
          l.action.includes("CANCEL") ||
          l.action.includes("RATE") ||
          l.action.includes("BCV");
        return !isStandard;
      }).length,
    };
  }, [tenantScopedLogs]);

  // Filter logs by Category and Search Query
  const filteredLogs = useMemo(() => {
    return tenantScopedLogs.filter((log) => {
      // Category filter
      if (activeCategory === "LOGINS") {
        if (log.action !== "USER_LOGIN" && !log.action.includes("LOGIN")) return false;
      } else if (activeCategory === "SUPPORT") {
        if (
          !log.action.includes("SUPPORT_IMPERSONATION") &&
          !log.action.includes("IMPERSONATION")
        )
          return false;
      } else if (activeCategory === "USERS") {
        if (
          (!log.action.includes("USER") &&
            !log.action.includes("PROFILE") &&
            !log.action.includes("STAFF")) ||
          log.action === "USER_LOGIN"
        )
          return false;
      } else if (activeCategory === "STOCK") {
        if (!log.action.includes("STOCK") && !log.action.includes("INVENTORY"))
          return false;
      } else if (activeCategory === "PRICES") {
        if (log.action !== "PRICE_CHANGED" && !log.action.includes("PRICE")) return false;
      } else if (activeCategory === "PAYMENTS") {
        if (
          !log.action.includes("PAYMENT") &&
          log.action !== "PAYMENT_APPROVED" &&
          log.action !== "PAYMENT_REJECTED"
        )
          return false;
      } else if (activeCategory === "CANCELLATIONS") {
        if (log.action !== "ORDER_CANCELLED" && !log.action.includes("CANCEL"))
          return false;
      } else if (activeCategory === "RATES") {
        if (!log.action.includes("RATE") && !log.action.includes("BCV")) return false;
      } else if (activeCategory === "OTHER") {
        const isStandard =
          log.action.includes("LOGIN") ||
          log.action.includes("IMPERSONATION") ||
          log.action.includes("USER") ||
          log.action.includes("PROFILE") ||
          log.action.includes("STAFF") ||
          log.action.includes("STOCK") ||
          log.action.includes("INVENTORY") ||
          log.action.includes("PRICE") ||
          log.action.includes("PAYMENT") ||
          log.action.includes("CANCEL") ||
          log.action.includes("RATE") ||
          log.action.includes("BCV");
        if (isStandard) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchActor =
          log.actor_name?.toLowerCase().includes(q) ||
          log.actor_email?.toLowerCase().includes(q);
        const matchAction = log.action?.toLowerCase().includes(q);
        const matchEntity =
          log.entity?.toLowerCase().includes(q) ||
          log.entity_id?.toLowerCase().includes(q);
        const matchTenant = log.tenant_name?.toLowerCase().includes(q);
        const matchData = JSON.stringify(log.new_data || {}).toLowerCase().includes(q);
        const matchDetails = log.details?.toLowerCase().includes(q);
        if (
          !matchActor &&
          !matchAction &&
          !matchEntity &&
          !matchTenant &&
          !matchData &&
          !matchDetails
        ) {
          return false;
        }
      }

      return true;
    });
  }, [tenantScopedLogs, activeCategory, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER & REAL-TIME CONTROLS                         */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                  🛡️ Registro de Auditoría Centralizada (Audit Trail Global)
                </h2>
                {isSuperAdmin && (
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/25 text-[10px] font-black uppercase tracking-wider">
                    Red Multi-Tienda
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Bitácora cronológica inmutable y forense en tiempo real de inicios de sesión, cambios de stock masivos,
                impersonaciones técnicas de soporte ("Login As"), altas de usuarios y transacciones críticas.
              </p>
            </div>
          </div>

          {/* Real-time Controls & Refresh */}
          <div className="flex items-center gap-2.5 self-start md:self-center">
            {/* Live Polling Toggle */}
            <button
              onClick={() => setIsLivePolling((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs ${
                isLivePolling
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  : "bg-muted/60 text-muted-foreground border-border hover:text-foreground"
              }`}
              title={
                isLivePolling
                  ? "Sincronización en vivo activa (actualiza cada 10 segundos)"
                  : "Sincronización pausada"
              }
            >
              <span className="relative flex h-2 w-2">
                {isLivePolling && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isLivePolling ? "bg-emerald-400" : "bg-muted-foreground"
                  }`}
                />
              </span>
              <span>{isLivePolling ? "En Vivo (10s)" : "Pausado"}</span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => handleRefresh(false)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-border bg-card hover:bg-muted text-foreground transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Actualizar eventos de auditoría ahora"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-muted-foreground ${
                  isRefreshing ? "animate-spin text-primary" : ""
                }`}
              />
              <span>{isRefreshing ? "Cargando..." : "Refrescar"}</span>
            </button>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────── */}
        {/* 2. KPI METRICS SUMMARY STRIP                               */}
        {/* ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-border">
          {/* KPI 1: TOTAL EVENTOS */}
          <div className="bg-muted/40 rounded-xl p-3 border border-border/60">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Eventos</span>
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-foreground">{counts.ALL}</div>
            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
              En alcance actual
            </span>
          </div>

          {/* KPI 2: INICIOS DE SESIÓN */}
          <div className="bg-indigo-500/5 rounded-xl p-3 border border-indigo-500/20">
            <div className="flex items-center justify-between text-indigo-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Inicios Sesión</span>
              <Key className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-indigo-400">{counts.LOGINS}</div>
            <span className="text-[10px] text-indigo-400/80 block mt-0.5 truncate">
              Accesos a plataforma
            </span>
          </div>

          {/* KPI 3: SOPORTE (LOGIN AS) */}
          <div className="bg-purple-500/5 rounded-xl p-3 border border-purple-500/20">
            <div className="flex items-center justify-between text-purple-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Soporte Login As</span>
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-purple-400">{counts.SUPPORT}</div>
            <span className="text-[10px] text-purple-400/80 block mt-0.5 truncate">
              Impersonaciones Super
            </span>
          </div>

          {/* KPI 4: PERSONAL & ROLES */}
          <div className="bg-teal-500/5 rounded-xl p-3 border border-teal-500/20">
            <div className="flex items-center justify-between text-teal-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Personal & Roles</span>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-teal-400">{counts.USERS}</div>
            <span className="text-[10px] text-teal-400/80 block mt-0.5 truncate">
              Altas y permisos
            </span>
          </div>

          {/* KPI 5: MOVIMIENTOS STOCK */}
          <div className="bg-amber-500/5 rounded-xl p-3 border border-amber-500/20">
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Mov. Inventario</span>
              <Package className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-amber-400">{counts.STOCK}</div>
            <span className="text-[10px] text-amber-400/80 block mt-0.5 truncate">
              Ajustes de existencias
            </span>
          </div>

          {/* KPI 6: OPERACIONES DE PAGO */}
          <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/20">
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Pagos Conciliados</span>
              <CreditCard className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-emerald-400">{counts.PAYMENTS}</div>
            <span className="text-[10px] text-emerald-400/80 block mt-0.5 truncate">
              Aprobados / Rechazados
            </span>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. ACTIVE FILTERS & SELECTOR CONTROLS                       */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Active Tenant Scope Banner if Filtered */}
        {isSuperAdmin && selectedTenant !== "ALL" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-primary/10 border border-primary/25 rounded-2xl text-xs text-primary shadow-xs">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 shrink-0 text-primary" />
              <span>
                Filtrando bitácora exclusivamente para el comercio:{" "}
                <strong className="text-foreground text-sm font-bold ml-1">
                  {allTenants.find((t) => t.id === selectedTenant)?.name || selectedTenant}
                </strong>
              </span>
            </div>
            <button
              onClick={() => handleTenantChange("ALL")}
              className="self-start sm:self-auto px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>Ver Toda la Red</span>
              <span>✕</span>
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Quick Category Buttons with Counters */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {[
              { id: "ALL", label: "Todos", count: counts.ALL, icon: Filter },
              { id: "LOGINS", label: "🔑 Sesiones", count: counts.LOGINS, icon: Key },
              { id: "SUPPORT", label: "🎭 Soporte (Login As)", count: counts.SUPPORT, icon: ShieldAlert },
              { id: "USERS", label: "👥 Usuarios & Personal", count: counts.USERS, icon: Users },
              { id: "STOCK", label: "📦 Stock & Inventario", count: counts.STOCK, icon: Package },
              { id: "PRICES", label: "🏷️ Precios", count: counts.PRICES, icon: Tag },
              { id: "PAYMENTS", label: "💳 Pagos", count: counts.PAYMENTS, icon: CreditCard },
              { id: "CANCELLATIONS", label: "🚫 Anulaciones", count: counts.CANCELLATIONS, icon: Ban },
              { id: "RATES", label: "💵 Tasas BCV", count: counts.RATES, icon: DollarSign },
              { id: "OTHER", label: "⚙️ Otros", count: counts.OTHER, icon: Layers },
            ].map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as AuditCategory)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tenant Selector & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            {/* Multi-Tenant Selector */}
            {isSuperAdmin && allTenants.length > 0 && (
              <div className="relative w-full sm:w-56 shrink-0">
                <select
                  value={selectedTenant}
                  onChange={(e) => handleTenantChange(e.target.value)}
                  className="w-full appearance-none px-3 py-2 pr-8 rounded-xl border border-border bg-card text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs cursor-pointer"
                >
                  <option value="ALL">🌐 Toda la Red ({allTenants.length} comercios)</option>
                  {allTenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      🏪 {t.name}
                    </option>
                  ))}
                </select>
                <Building2 className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por actor, entidad, detalle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. MAIN AUDIT LOGS FEED (EXPANDABLE & FORENSIC)            */}
      {/* ────────────────────────────────────────────────────────── */}
      {filteredLogs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card">
          <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-bold text-foreground">No se encontraron eventos coincidentes</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {searchQuery || activeCategory !== "ALL" || selectedTenant !== "ALL"
              ? "Prueba cambiando de categoría o borrando el término de búsqueda."
              : "Aún no se han registrado eventos auditables en este comercio."}
          </p>
          {(searchQuery || activeCategory !== "ALL" || selectedTenant !== "ALL") && (
            <button
              onClick={() => {
                setActiveCategory("ALL");
                setSelectedTenant("ALL");
                setSearchQuery("");
              }}
              className="mt-4 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition cursor-pointer"
            >
              Restablecer todos los filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const isLogin = log.action === "USER_LOGIN" || log.action.includes("LOGIN");
            const isSupport =
              log.action.includes("SUPPORT_IMPERSONATION") ||
              log.action.includes("IMPERSONATION");
            const isUserManagement =
              (log.action.includes("USER") ||
                log.action.includes("PROFILE") ||
                log.action.includes("STAFF")) &&
              !isLogin;
            const isStockAdjusted =
              log.action === "STOCK_ADJUSTED" || log.action.includes("STOCK");
            const isPriceChanged =
              log.action === "PRICE_CHANGED" || log.action.includes("PRICE");
            const isPaymentApproved = log.action === "PAYMENT_APPROVED";
            const isPaymentRejected = log.action === "PAYMENT_REJECTED";
            const isOrderCancelled = log.action === "ORDER_CANCELLED";
            const isRateEvent =
              log.action === "BCV_RATE_SYNCED" ||
              log.action === "MANUAL_RATE_SAVED" ||
              log.action.includes("RATE");
            const isTenantManagement =
              log.action.includes("TENANT_STATUS") ||
              log.action.includes("SUBSCRIPTION") ||
              log.action.includes("ONBOARD");

            const isExpanded = expandedLogId === log.id;
            const isCopied = copiedLogId === log.id;

            // Extract structured metadata
            const meta = (log.new_data || {}) as Record<string, any>;
            const oldMeta = (log.old_data || {}) as Record<string, any>;

            // Badge styling and categorization
            let badgeBg = "bg-blue-500/10 text-blue-400 border-blue-500/20";
            let cardBorder = "border-border hover:border-border/80";
            let actionIcon = <Layers className="w-3.5 h-3.5" />;
            let actionTitle = log.action;

            if (isLogin) {
              badgeBg = "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
              cardBorder = "border-indigo-500/25 hover:border-indigo-500/50";
              actionIcon = <Key className="w-3.5 h-3.5" />;
              actionTitle = "INICIO DE SESIÓN";
            } else if (isSupport) {
              badgeBg = "bg-purple-500/10 text-purple-400 border-purple-500/30";
              cardBorder = "border-purple-500/30 hover:border-purple-500/60";
              actionIcon = <ShieldAlert className="w-3.5 h-3.5" />;
              actionTitle =
                log.action === "SUPPORT_IMPERSONATION_STARTED"
                  ? "LOGIN AS (INICIADO)"
                  : "LOGIN AS (FINALIZADO)";
            } else if (isUserManagement) {
              badgeBg = "bg-teal-500/10 text-teal-400 border-teal-500/30";
              cardBorder = "border-teal-500/25 hover:border-teal-500/50";
              actionIcon = <UserPlus className="w-3.5 h-3.5" />;
              actionTitle =
                log.action === "PLATFORM_USER_CREATED"
                  ? "USUARIO CREADO"
                  : log.action === "PROFILE_DELETED"
                  ? "USUARIO ELIMINADO"
                  : "USUARIO ACTUALIZADO";
            } else if (isStockAdjusted) {
              badgeBg = "bg-amber-500/10 text-amber-400 border-amber-500/30";
              cardBorder = "border-amber-500/30 hover:border-amber-500/50";
              actionIcon = <Package className="w-3.5 h-3.5" />;
              actionTitle = "AJUSTE INVENTARIO";
            } else if (isPriceChanged) {
              badgeBg = "bg-amber-500/10 text-amber-400 border-amber-500/30";
              cardBorder = "border-amber-500/30 hover:border-amber-500/50";
              actionIcon = <Tag className="w-3.5 h-3.5" />;
              actionTitle = "CAMBIO DE PRECIO";
            } else if (isPaymentApproved) {
              badgeBg = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
              cardBorder = "border-emerald-500/30 hover:border-emerald-500/50";
              actionIcon = <CheckCircle2 className="w-3.5 h-3.5" />;
              actionTitle = "PAGO APROBADO";
            } else if (isPaymentRejected) {
              badgeBg = "bg-rose-500/10 text-rose-400 border-rose-500/30";
              cardBorder = "border-rose-500/30 hover:border-rose-500/50";
              actionIcon = <XCircle className="w-3.5 h-3.5" />;
              actionTitle = "PAGO RECHAZADO";
            } else if (isOrderCancelled) {
              badgeBg = "bg-rose-500/10 text-rose-400 border-rose-500/30";
              cardBorder = "border-rose-500/30 hover:border-rose-500/50";
              actionIcon = <Ban className="w-3.5 h-3.5" />;
              actionTitle = "PEDIDO ANULADO";
            } else if (isRateEvent) {
              badgeBg = "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
              cardBorder = "border-cyan-500/25 hover:border-cyan-500/50";
              actionIcon = <DollarSign className="w-3.5 h-3.5" />;
              actionTitle = "TASA CAMBIARIA";
            } else if (isTenantManagement) {
              badgeBg = "bg-blue-500/10 text-blue-400 border-blue-500/30";
              cardBorder = "border-blue-500/25 hover:border-blue-500/50";
              actionIcon = <Building2 className="w-3.5 h-3.5" />;
              actionTitle = "COMERCIO / SUSCRIPCIÓN";
            }

            return (
              <div
                key={log.id}
                className={`rounded-2xl border transition-all duration-200 bg-card overflow-hidden shadow-xs ${cardBorder}`}
              >
                {/* Event Row */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Action badge + Key Content */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${badgeBg}`}
                      >
                        {actionIcon}
                        <span>{actionTitle}</span>
                      </span>

                      {/* Tenant Tag */}
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-muted/80 text-muted-foreground text-[10px] font-bold border border-border/40">
                        <Building2 className="w-3 h-3 opacity-70" />
                        <span>{log.tenant_name || "Tienda"}</span>
                      </span>

                      {/* Entity ID / Subject */}
                      <span className="text-xs text-muted-foreground font-medium">
                        {log.entity}:{" "}
                        <span className="font-mono text-foreground font-bold">
                          {log.entity_id}
                        </span>
                      </span>

                      {/* Relative Time Pill */}
                      <span className="text-[11px] font-medium text-muted-foreground/80 bg-muted/40 px-2 py-0.5 rounded-md">
                        {formatRelativeTime(log.created_at)}
                      </span>
                    </div>

                    {/* ────────────────────────────────────────── */}
                    {/* CUSTOM RICH PREVIEWS PER ACTION TYPE       */}
                    {/* ────────────────────────────────────────── */}

                    {/* 1. USER LOGIN */}
                    {isLogin && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <LogIn className="w-3.5 h-3.5 text-indigo-400" />
                          <span>
                            Acceso exitoso:{" "}
                            <strong className="text-indigo-400 font-mono">
                              {meta.email || log.actor_email || "Usuario"}
                            </strong>
                          </span>
                        </div>
                        {meta.role && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 font-mono text-[10px] font-bold">
                            ROL: {meta.role}
                          </span>
                        )}
                        {meta.redirectTo && (
                          <div className="text-muted-foreground">
                            Destino:{" "}
                            <span className="font-mono text-foreground font-semibold">
                              {meta.redirectTo}
                            </span>
                          </div>
                        )}
                        {meta.ip && (
                          <div className="text-muted-foreground font-mono text-[11px]">
                            IP: {meta.ip}
                          </div>
                        )}
                        {meta.device && (
                          <div className="text-muted-foreground text-[11px]">
                            Dispositivo: {meta.device}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. SUPPORT IMPERSONATION ("LOGIN AS") */}
                    {isSupport && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                          <span>
                            Tienda intervenida:{" "}
                            <strong className="text-purple-400">
                              {meta.tenantName || log.tenant_name}
                            </strong>
                          </span>
                        </div>
                        {meta.impersonatedBy && (
                          <div className="text-muted-foreground">
                            Operador Maestro:{" "}
                            <span className="font-mono font-bold text-foreground">
                              {meta.impersonatedBy}
                            </span>
                          </div>
                        )}
                        {meta.purpose && (
                          <div className="w-full text-purple-300 font-medium bg-purple-500/10 px-2.5 py-1 rounded-md border border-purple-500/20 text-[11px]">
                            Motivo: {meta.purpose}
                          </div>
                        )}
                        {meta.durationMinutes && (
                          <div className="text-muted-foreground">
                            Duración sesión:{" "}
                            <strong className="text-foreground">
                              {meta.durationMinutes} minutos
                            </strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. USER MANAGEMENT */}
                    {isUserManagement && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        <div className="font-bold text-foreground">
                          Usuario:{" "}
                          <span className="font-mono text-teal-400">
                            {meta.email || meta.name || log.entity_id}
                          </span>
                        </div>
                        {meta.role && (
                          <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-400 font-mono text-[10px] font-bold">
                            ROL: {meta.role}
                          </span>
                        )}
                        {meta.tenantId && (
                          <div className="text-muted-foreground">
                            Comercio:{" "}
                            <span className="text-foreground font-semibold">
                              {meta.tenantId}
                            </span>
                          </div>
                        )}
                        {log.details && (
                          <div className="text-muted-foreground text-[11px]">
                            {log.details}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. STOCK & INVENTORY ADJUSTMENT */}
                    {isStockAdjusted && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        <div className="font-bold text-foreground">
                          {meta.name || oldMeta.name || "Producto"}:{" "}
                          <span
                            className={`font-black font-mono px-1.5 py-0.5 rounded ${
                              Number(meta.delta || 0) >= 0
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-rose-500/10 text-rose-400"
                            }`}
                          >
                            {Number(meta.delta || 0) >= 0 ? "+" : ""}
                            {meta.delta} unid.
                          </span>
                        </div>
                        {oldMeta.stock_quantity !== undefined && meta.quantity !== undefined && (
                          <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px]">
                            <span>Antes: {oldMeta.stock_quantity}</span>
                            <ArrowRight className="w-3 h-3" />
                            <span>
                              Ahora:{" "}
                              <strong className="text-foreground">{meta.quantity}</strong>
                            </span>
                          </div>
                        )}
                        {meta.reason && (
                          <span className="px-2 py-0.5 rounded-md bg-muted font-bold text-[10px] text-muted-foreground">
                            MOTIVO: {meta.reason}
                          </span>
                        )}
                        {meta.note && (
                          <div className="w-full text-muted-foreground text-[11px] italic">
                            Nota: "{meta.note}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* 5. PRICE CHANGE */}
                    {isPriceChanged && (
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <div className="text-sm font-black text-foreground">
                          {meta.name || oldMeta.name || "Producto"}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="line-through text-muted-foreground font-mono">
                            ${Number(oldMeta.price_usd || 0).toFixed(2)}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-black font-mono text-foreground text-sm">
                            ${Number(meta.price_usd || 0).toFixed(2)}
                          </span>
                          {meta.diff_usd !== undefined && (
                            <span
                              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-black ${
                                meta.diff_usd >= 0
                                  ? "bg-rose-500/10 text-rose-400"
                                  : "bg-emerald-500/10 text-emerald-400"
                              }`}
                            >
                              {meta.diff_usd >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              <span>
                                {meta.diff_usd >= 0 ? "+" : ""}
                                {meta.percentage_change}% (${meta.diff_usd})
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 6. PAYMENTS (APPROVED / REJECTED) */}
                    {(isPaymentApproved || isPaymentRejected) && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        {meta.order_number && (
                          <div className="font-bold text-foreground">
                            Pedido:{" "}
                            <span className="font-mono text-primary font-black">
                              #{meta.order_number}
                            </span>
                          </div>
                        )}
                        {meta.amount && (
                          <div className="font-black text-foreground">
                            Monto:{" "}
                            <span className="font-mono">
                              ${Number(meta.amount).toFixed(2)} USD
                            </span>
                          </div>
                        )}
                        {meta.reference_number && (
                          <div className="text-muted-foreground">
                            Ref:{" "}
                            <span className="font-mono font-bold text-foreground">
                              {meta.reference_number}
                            </span>
                          </div>
                        )}
                        {isPaymentRejected && meta.rejection_reason && (
                          <div className="w-full text-rose-400 font-semibold bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20 text-[11px]">
                            Motivo de rechazo: {meta.rejection_reason}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 7. ORDER CANCELLED */}
                    {isOrderCancelled && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        {meta.order_number && (
                          <div className="font-bold text-foreground">
                            Pedido:{" "}
                            <span className="font-mono text-rose-400 font-black">
                              #{meta.order_number}
                            </span>
                          </div>
                        )}
                        {meta.total_usd && (
                          <div className="font-bold text-foreground">
                            Total: <span className="font-mono">${meta.total_usd}</span>
                          </div>
                        )}
                        {meta.customer_phone && (
                          <div className="text-muted-foreground">
                            Cliente:{" "}
                            <span className="font-medium text-foreground">
                              {meta.customer_phone}
                            </span>
                          </div>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          Stock Reincorporado
                        </span>
                        {meta.cancellation_reason && (
                          <div className="w-full text-rose-400 font-semibold bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20 text-[11px]">
                            Motivo: {meta.cancellation_reason}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 8. BCV RATE SYNC */}
                    {isRateEvent && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        {meta.value && (
                          <div className="font-bold text-foreground">
                            Tasa USD:{" "}
                            <span className="font-mono font-black text-cyan-400">
                              Bs. {Number(meta.value).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {meta.usd && (
                          <div className="font-bold text-foreground">
                            Tasa USD Manual:{" "}
                            <span className="font-mono font-black text-cyan-400">
                              Bs. {Number(meta.usd).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {meta.eurRate && (
                          <div className="text-muted-foreground">
                            EUR: Bs. {Number(meta.eurRate).toFixed(2)}
                          </div>
                        )}
                        {meta.source && (
                          <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono">
                            {meta.source}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 9. TENANT / SUBSCRIPTION STATUS */}
                    {isTenantManagement && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        {meta.name && (
                          <div className="font-bold text-foreground">
                            Comercio:{" "}
                            <span className="text-blue-400 font-black">{meta.name}</span>
                          </div>
                        )}
                        {meta.status && (
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold uppercase text-[10px]">
                            ESTADO: {meta.status}
                          </span>
                        )}
                        {meta.plan && (
                          <span className="px-2 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">
                            PLAN: {meta.plan}
                          </span>
                        )}
                        {meta.durationDays && (
                          <div className="text-muted-foreground">
                            Duración: {meta.durationDays} días
                          </div>
                        )}
                      </div>
                    )}

                    {/* Generic Fallback */}
                    {!isLogin &&
                      !isSupport &&
                      !isUserManagement &&
                      !isPriceChanged &&
                      !isPaymentApproved &&
                      !isPaymentRejected &&
                      !isOrderCancelled &&
                      !isStockAdjusted &&
                      !isRateEvent &&
                      !isTenantManagement && (
                        <div className="text-xs text-muted-foreground">
                          {log.details ||
                            meta.name ||
                            meta.title ||
                            "Operación procesada satisfactoriamente"}
                        </div>
                      )}
                  </div>

                  {/* Right Column: Actor & Timestamp & Expand toggle */}
                  <div className="flex flex-row md:flex-col md:items-end justify-between items-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-border/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase">
                        {(log.actor_name || "A")[0]}
                      </div>
                      <div className="text-left md:text-right">
                        <div className="text-xs font-bold text-foreground leading-none">
                          {log.actor_name || "Admin Operativo"}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {log.actor_role || "OPERADOR"}
                          {log.actor_email && ` • ${log.actor_email}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                      <Clock className="w-3 h-3 text-muted-foreground/70" />
                      <span>{formatDateTime(log.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      {/* Copy JSON */}
                      <button
                        onClick={() => handleCopyLogJson(log)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
                        title="Copiar JSON del evento al portapapeles"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>

                      {/* Expand JSON Details */}
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        <span>{isExpanded ? "Ocultar Deltas" : "Ver Deltas / JSON"}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Forensic Inspector (JSON Diff Viewer) */}
                {isExpanded && (
                  <div className="px-5 py-4 bg-muted/40 border-t border-border font-mono text-[11px] space-y-3 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between text-muted-foreground font-bold gap-2">
                      <span className="flex items-center gap-1.5 text-foreground">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>Inspección Quirúrgica de Metadatos & Deltas Forenses</span>
                      </span>
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded border border-border">
                        LOG_ID: {log.id}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Old State */}
                      <div>
                        <div className="text-muted-foreground font-semibold mb-1 flex items-center justify-between">
                          <span>Estado Previo (old_data):</span>
                          {!log.old_data && (
                            <span className="text-[10px] text-muted-foreground/60 italic font-normal">
                              (Sin estado anterior)
                            </span>
                          )}
                        </div>
                        <pre className="p-3 rounded-xl bg-card border border-border overflow-x-auto text-foreground/80 max-h-56 overflow-y-auto leading-relaxed shadow-xs">
                          {log.old_data
                            ? JSON.stringify(log.old_data, null, 2)
                            : "// No hubo modificaciones sobre estado previo"}
                        </pre>
                      </div>

                      {/* New State */}
                      <div>
                        <div className="text-muted-foreground font-semibold mb-1 flex items-center justify-between">
                          <span className="text-primary font-bold">
                            Nuevo Estado Procesado (new_data):
                          </span>
                        </div>
                        <pre className="p-3 rounded-xl bg-card border border-border overflow-x-auto text-foreground max-h-56 overflow-y-auto leading-relaxed shadow-xs">
                          {log.new_data
                            ? JSON.stringify(log.new_data, null, 2)
                            : "// Registro de confirmación sin payload"}
                        </pre>
                      </div>
                    </div>

                    {/* Meta Footer */}
                    <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between text-[10px] text-muted-foreground gap-2">
                      <div>
                        <span>Actor ID: </span>
                        <span className="font-mono text-foreground font-bold">
                          {log.actor_id || "sistema"}
                        </span>
                        <span> • Tenant ID: </span>
                        <span className="font-mono text-foreground font-bold">
                          {log.tenant_id}
                        </span>
                      </div>
                      <div>
                        <span>Timestamp UTC: </span>
                        <span className="font-mono text-foreground">{log.created_at}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
