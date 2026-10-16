"use client";

import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { AuditLog, AuditActionType, Tenant } from "@marketos/types";
import { getAuditLogsAction } from "@/app/admin/actions";
import { getGlobalAuditLogsAction } from "@/app/platform/actions";

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
  const [selectedTenant, setSelectedTenant] = useState<string>(
    tenantId && !isSuperAdmin ? tenantId : "ALL"
  );
  const [activeCategory, setActiveCategory] = useState<
    "ALL" | "PRICES" | "PAYMENTS" | "CANCELLATIONS" | "STOCK" | "RATES" | "OTHER"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Quick refresh from server
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (isSuperAdmin) {
        const res = await getGlobalAuditLogsAction({
          tenantId: selectedTenant !== "ALL" ? selectedTenant : undefined,
          limit: 150,
        });
        if (res.success && res.logs) {
          setLogs(res.logs);
        }
      } else if (tenantId) {
        const res = await getAuditLogsAction(tenantId, 150);
        if (res.success && res.logs) {
          setLogs(res.logs);
        }
      }
    } catch (err) {
      console.error("Error refreshing audit logs:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter logs by Category, Tenant and Search Query
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Tenant filter
      if (isSuperAdmin && selectedTenant !== "ALL") {
        if (log.tenant_id !== selectedTenant) return false;
      }

      // 2. Category filter
      if (activeCategory === "PRICES") {
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
      } else if (activeCategory === "STOCK") {
        if (!log.action.includes("STOCK") && !log.action.includes("INVENTORY"))
          return false;
      } else if (activeCategory === "RATES") {
        if (!log.action.includes("RATE") && !log.action.includes("BCV")) return false;
      } else if (activeCategory === "OTHER") {
        const isStandard =
          log.action === "PRICE_CHANGED" ||
          log.action.includes("PAYMENT") ||
          log.action === "ORDER_CANCELLED" ||
          log.action.includes("STOCK") ||
          log.action.includes("RATE") ||
          log.action.includes("BCV");
        if (isStandard) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchActor =
          log.actor_name?.toLowerCase().includes(q) ||
          log.actor_email?.toLowerCase().includes(q);
        const matchAction = log.action?.toLowerCase().includes(q);
        const matchEntity =
          log.entity?.toLowerCase().includes(q) || log.entity_id?.toLowerCase().includes(q);
        const matchTenant = log.tenant_name?.toLowerCase().includes(q);
        const matchData = JSON.stringify(log.new_data || {}).toLowerCase().includes(q);
        if (!matchActor && !matchAction && !matchEntity && !matchTenant && !matchData) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedTenant, activeCategory, searchQuery, isSuperAdmin]);

  // Statistics KPIs
  const stats = useMemo(() => {
    const total = logs.length;
    const priceChanges = logs.filter(
      (l) => l.action === "PRICE_CHANGED" || l.action.includes("PRICE")
    ).length;
    const paymentAudits = logs.filter(
      (l) => l.action === "PAYMENT_APPROVED" || l.action === "PAYMENT_REJECTED"
    ).length;
    const orderCancellations = logs.filter(
      (l) => l.action === "ORDER_CANCELLED" || l.action.includes("CANCEL")
    ).length;
    return { total, priceChanges, paymentAudits, orderCancellations };
  }, [logs]);

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

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                  🛡️ Registro de Auditoría Global (Audit Trail)
                </h2>
                {isSuperAdmin && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20 text-[10px] font-black uppercase tracking-wider">
                    Red Multi-Tienda
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Bitácora cronológica inmutable de quién cambió precios, aprobó o rechazó pagos,
                o anuló pedidos en toda la red con estricto registro de autoría y deltas.
              </p>
            </div>
          </div>

          {/* Refresh Action */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-border bg-card hover:bg-muted text-foreground transition-colors shadow-xs disabled:opacity-50"
              title="Refrescar eventos de auditoría"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-muted-foreground ${
                  isRefreshing ? "animate-spin text-primary" : ""
                }`}
              />
              <span>{isRefreshing ? "Actualizando..." : "Refrescar"}</span>
            </button>
          </div>
        </div>

        {/* KPI Metrics Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
          <div className="bg-muted/40 rounded-xl p-3 border border-border/60">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Eventos</span>
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-foreground">{stats.total}</div>
          </div>

          <div className="bg-amber-500/5 rounded-xl p-3 border border-amber-500/20">
            <div className="flex items-center justify-between text-amber-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cambios de Precio</span>
              <Tag className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-amber-600">{stats.priceChanges}</div>
          </div>

          <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/20">
            <div className="flex items-center justify-between text-emerald-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Pagos Auditados</span>
              <CreditCard className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-emerald-600">{stats.paymentAudits}</div>
          </div>

          <div className="bg-rose-500/5 rounded-xl p-3 border border-rose-500/20">
            <div className="flex items-center justify-between text-rose-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Pedidos Anulados</span>
              <Ban className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-rose-600">{stats.orderCancellations}</div>
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Quick Category Buttons */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {[
            { id: "ALL", label: "Todos", icon: Filter },
            { id: "PRICES", label: "🏷️ Precios", icon: Tag },
            { id: "PAYMENTS", label: "💳 Pagos", icon: CreditCard },
            { id: "CANCELLATIONS", label: "🚫 Anulaciones", icon: Ban },
            { id: "STOCK", label: "📦 Inventario", icon: Package },
            { id: "RATES", label: "💵 Tasa BCV", icon: DollarSign },
            { id: "OTHER", label: "⚙️ Otros", icon: Layers },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Tenant Dropdown (if Super Admin) & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {isSuperAdmin && allTenants.length > 0 && (
            <div className="relative w-full sm:w-56 shrink-0">
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="w-full appearance-none px-3 py-2 pr-8 rounded-xl border border-border bg-card text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs cursor-pointer"
              >
                <option value="ALL">🌐 Todos los Comercios</option>
                {allTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    🏪 {t.name}
                  </option>
                ))}
              </select>
              <Building2 className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por producto, orden, actor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Audit Logs List */}
      {filteredLogs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card">
          <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-bold text-foreground">No se encontraron eventos</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {searchQuery || activeCategory !== "ALL" || selectedTenant !== "ALL"
              ? "Prueba a cambiar los filtros o el término de búsqueda para ver más transacciones."
              : "Aún no se han registrado transacciones auditables en la bitácora."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const isPriceChanged =
              log.action === "PRICE_CHANGED" || log.action.includes("PRICE");
            const isPaymentApproved = log.action === "PAYMENT_APPROVED";
            const isPaymentRejected = log.action === "PAYMENT_REJECTED";
            const isOrderCancelled = log.action === "ORDER_CANCELLED";
            const isStockAdjusted =
              log.action === "STOCK_ADJUSTED" || log.action.includes("STOCK");
            const isRateEvent =
              log.action === "BCV_RATE_SYNCED" || log.action === "MANUAL_RATE_SAVED";

            const isExpanded = expandedLogId === log.id;

            // Extract structured metadata
            const meta = (log.new_data || {}) as Record<string, any>;
            const oldMeta = (log.old_data || {}) as Record<string, any>;

            // Badge styling
            let badgeBg = "bg-blue-500/10 text-blue-600 border-blue-500/20";
            let actionIcon = <Layers className="w-3.5 h-3.5" />;
            let actionTitle = log.action;

            if (isPriceChanged) {
              badgeBg = "bg-amber-500/10 text-amber-600 border-amber-500/20";
              actionIcon = <Tag className="w-3.5 h-3.5" />;
              actionTitle = "CAMBIO DE PRECIO";
            } else if (isPaymentApproved) {
              badgeBg = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
              actionIcon = <CheckCircle2 className="w-3.5 h-3.5" />;
              actionTitle = "PAGO APROBADO";
            } else if (isPaymentRejected) {
              badgeBg = "bg-rose-500/10 text-rose-600 border-rose-500/20";
              actionIcon = <XCircle className="w-3.5 h-3.5" />;
              actionTitle = "PAGO RECHAZADO";
            } else if (isOrderCancelled) {
              badgeBg = "bg-rose-500/10 text-rose-600 border-rose-500/20";
              actionIcon = <Ban className="w-3.5 h-3.5" />;
              actionTitle = "PEDIDO ANULADO";
            } else if (isStockAdjusted) {
              badgeBg = "bg-purple-500/10 text-purple-600 border-purple-500/20";
              actionIcon = <Package className="w-3.5 h-3.5" />;
              actionTitle = "AJUSTE INVENTARIO";
            } else if (isRateEvent) {
              badgeBg = "bg-cyan-500/10 text-cyan-600 border-cyan-500/20";
              actionIcon = <DollarSign className="w-3.5 h-3.5" />;
              actionTitle = "TASA CAMBIARIA";
            } else if (log.action === "SUPPORT_IMPERSONATION_STARTED") {
              badgeBg = "bg-purple-500/10 text-purple-400 border-purple-500/30";
              actionIcon = <span className="text-xs">🎭</span>;
              actionTitle = "LOGIN AS (INICIADO)";
            } else if (log.action === "SUPPORT_IMPERSONATION_ENDED") {
              badgeBg = "bg-slate-500/10 text-slate-400 border-slate-500/30";
              actionIcon = <span className="text-xs">🚪</span>;
              actionTitle = "LOGIN AS (FINALIZADO)";
            }

            return (
              <div
                key={log.id}
                className={`rounded-2xl border transition-all duration-200 bg-card overflow-hidden ${
                  isPriceChanged
                    ? "border-amber-500/30 hover:border-amber-500/50"
                    : isPaymentApproved
                    ? "border-emerald-500/30 hover:border-emerald-500/50"
                    : isPaymentRejected || isOrderCancelled
                    ? "border-rose-500/30 hover:border-rose-500/50"
                    : "border-border hover:border-border/80"
                }`}
              >
                {/* Event Main Row */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Action badge + Key Content */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${badgeBg}`}
                      >
                        {actionIcon}
                        <span>{actionTitle}</span>
                      </span>

                      {/* Tenant Tag */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-bold">
                        <Building2 className="w-3 h-3 opacity-60" />
                        <span>{log.tenant_name || "Tienda"}</span>
                      </span>

                      {/* Entity ID / Subject */}
                      <span className="text-xs text-muted-foreground font-medium">
                        {log.entity}:{" "}
                        <span className="font-mono text-foreground font-bold">
                          {log.entity_id}
                        </span>
                      </span>
                    </div>

                    {/* Surgical Content Breakdown */}
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
                                  ? "bg-rose-500/10 text-rose-600"
                                  : "bg-emerald-500/10 text-emerald-600"
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

                    {(isPaymentApproved || isPaymentRejected) && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        {meta.order_number && (
                          <div className="font-bold text-foreground">
                            Pedido:{" "}
                            <span className="font-mono text-primary">{meta.order_number}</span>
                          </div>
                        )}
                        {meta.amount && (
                          <div className="font-black text-foreground">
                            Monto:{" "}
                            <span className="font-mono">
                              {meta.currency || "VES"} {Number(meta.amount).toLocaleString("es-VE")}
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
                          <div className="w-full text-rose-600 font-semibold bg-rose-500/5 px-2.5 py-1 rounded-md border border-rose-500/20">
                            Motivo de rechazo: {meta.rejection_reason}
                          </div>
                        )}
                      </div>
                    )}

                    {isOrderCancelled && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        {meta.order_number && (
                          <div className="font-bold text-foreground">
                            Pedido:{" "}
                            <span className="font-mono text-rose-600 font-black">
                              {meta.order_number}
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
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          Stock Reincorporado
                        </span>
                        {meta.cancellation_reason && (
                          <div className="w-full text-rose-600 font-semibold bg-rose-500/5 px-2.5 py-1 rounded-md border border-rose-500/20">
                            Motivo: {meta.cancellation_reason}
                          </div>
                        )}
                      </div>
                    )}

                    {isStockAdjusted && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        <div className="font-bold text-foreground">
                          Variación:{" "}
                          <span
                            className={`font-black font-mono ${
                              Number(meta.delta || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {Number(meta.delta || 0) >= 0 ? "+" : ""}
                            {meta.delta} unid.
                          </span>
                        </div>
                        {meta.quantity !== undefined && (
                          <div className="text-muted-foreground font-mono">
                            Stock Resultante:{" "}
                            <strong className="text-foreground">{meta.quantity}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {isRateEvent && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        {meta.value && (
                          <div className="font-bold text-foreground">
                            Tasa USD:{" "}
                            <span className="font-mono font-black text-cyan-600">
                              Bs. {Number(meta.value).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {meta.usd && (
                          <div className="font-bold text-foreground">
                            Tasa USD Manual:{" "}
                            <span className="font-mono font-black text-cyan-600">
                              Bs. {Number(meta.usd).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {meta.eurRate && (
                          <div className="text-muted-foreground">
                            EUR: Bs. {Number(meta.eurRate).toFixed(2)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Generic summary if not matching specific category */}
                    {!isPriceChanged &&
                      !isPaymentApproved &&
                      !isPaymentRejected &&
                      !isOrderCancelled &&
                      !isStockAdjusted &&
                      !isRateEvent && (
                        <div className="text-xs text-muted-foreground">
                          {meta.name || meta.title || "Operación procesada satisfactoriamente"}
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

                    <button
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline mt-1"
                    >
                      <span>{isExpanded ? "Ocultar JSON" : "Ver JSON"}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Collapsible Forensic Inspector (JSON diff) */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-muted/50 border-t border-border font-mono text-[11px] space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground font-bold">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Inspección Quirúrgica de Metadatos
                      </span>
                      <span>ID: {log.id}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {log.old_data && (
                        <div>
                          <div className="text-muted-foreground font-semibold mb-1">
                            Estado Anterior (old_data):
                          </div>
                          <pre className="p-2.5 rounded-lg bg-card border border-border overflow-x-auto text-foreground/80 max-h-48 overflow-y-auto">
                            {JSON.stringify(log.old_data, null, 2)}
                          </pre>
                        </div>
                      )}
                      <div>
                        <div className="text-muted-foreground font-semibold mb-1">
                          Nuevo Estado (new_data):
                        </div>
                        <pre className="p-2.5 rounded-lg bg-card border border-border overflow-x-auto text-foreground/80 max-h-48 overflow-y-auto">
                          {JSON.stringify(log.new_data, null, 2)}
                        </pre>
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
