"use client";

import React, { useState, useTransition } from "react";
import {
  PlatformStorageTelemetry,
  TenantStorageTelemetry,
  TenantR2FileItem,
  StorageFolder,
} from "@marketos/types";
import { formatBytes } from "@marketos/utils";
import { refreshStorageTelemetryAction } from "../app/platform/actions";
import {
  Cloud,
  HardDrive,
  Image as ImageIcon,
  Receipt,
  Layers,
  FileText,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  X,
  Eye,
  Filter,
  ArrowUpDown,
  Building2,
  DollarSign,
  Sparkles,
  ChevronRight,
  Database,
  Lock,
} from "lucide-react";

interface PlatformStorageTabProps {
  initialTelemetry?: PlatformStorageTelemetry;
  onImpersonateTenant?: (tenantId: string) => void;
}

const DEFAULT_TELEMETRY: PlatformStorageTelemetry = {
  totalBucketSizeBytes: 0,
  totalBucketSizeFormatted: "0.00 MB",
  totalBucketObjects: 0,
  cloudflareFreeTierBytes: 10 * 1024 * 1024 * 1024,
  cloudflareFreeTierFormatted: "10.00 GB",
  cloudflareFreeTierPercentUsed: 0,
  estimatedMonthlyCostUsd: 0,
  folderTotals: {
    products: { sizeBytes: 0, sizeFormatted: "0.00 MB", count: 0 },
    proofs: { sizeBytes: 0, sizeFormatted: "0.00 MB", count: 0 },
    branding: { sizeBytes: 0, sizeFormatted: "0.00 MB", count: 0 },
    other: { sizeBytes: 0, sizeFormatted: "0.00 MB", count: 0 },
  },
  tenants: [],
  topConsumers: [],
  quotaAlerts: [],
  scannedAt: new Date().toISOString(),
  source: "cached_fallback",
};

export function PlatformStorageTab({
  initialTelemetry,
  onImpersonateTenant,
}: PlatformStorageTabProps) {
  const [telemetry, setTelemetry] = useState<PlatformStorageTelemetry>(
    initialTelemetry || DEFAULT_TELEMETRY
  );
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"size" | "percent" | "name" | "files">("size");

  // State for inspecting a tenant's files in modal
  const [selectedTenant, setSelectedTenant] = useState<TenantStorageTelemetry | null>(null);
  const [fileFolderFilter, setFileFolderFilter] = useState<StorageFolder | "ALL">("ALL");
  const [fileSearchTerm, setFileSearchTerm] = useState("");

  const handleRefresh = () => {
    startTransition(async () => {
      const res = await refreshStorageTelemetryAction();
      if (res.success && res.telemetry) {
        setTelemetry(res.telemetry);
      }
    });
  };

  // Filter and sort tenants
  const filteredTenants = telemetry.tenants
    .filter((t) => {
      const matchSearch =
        t.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.tenantSlug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.tenantId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchPlan = planFilter === "ALL" || t.planId === planFilter;
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "WARNING" && (t.status === "warning" || t.status === "critical" || t.status === "exceeded")) ||
        (statusFilter === "NORMAL" && t.status === "normal");

      return matchSearch && matchPlan && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === "size") return b.totalSizeBytes - a.totalSizeBytes;
      if (sortBy === "percent") return b.percentUsed - a.percentUsed;
      if (sortBy === "files") return b.totalFiles - a.totalFiles;
      if (sortBy === "name") return a.tenantName.localeCompare(b.tenantName);
      return 0;
    });

  // Filtered files in modal
  const modalFiles: TenantR2FileItem[] = selectedTenant
    ? selectedTenant.recentFiles.filter((f) => {
        const matchFolder = fileFolderFilter === "ALL" || f.folder === fileFolderFilter;
        const matchName =
          f.fileName.toLowerCase().includes(fileSearchTerm.toLowerCase()) ||
          f.key.toLowerCase().includes(fileSearchTerm.toLowerCase());
        return matchFolder && matchName;
      })
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header with Cloudflare R2 Connection & Live Sync */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center shrink-0">
            <Cloud className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black tracking-tight text-foreground">
                Telemetría Cloudflare R2 por Tienda
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                R2 Activo
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-muted text-muted-foreground border border-border">
                Bucket: marketos-media
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Medición milimétrica del consumo de espacio en almacenamiento de objetos (Fotos de productos, comprobantes y marcas) por cada comercio.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Fuente de Datos
            </p>
            <p className="text-xs font-medium text-foreground">
              {telemetry.source === "r2_live" ? "📡 R2 S3 Scan (En Vivo)" : "⚡ Caché Resiliente"}
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-95 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
            <span>{isPending ? "Sincronizando..." : "Sincronizar R2"}</span>
          </button>
        </div>
      </div>

      {/* 2. Global Cloudflare R2 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total R2 Usage Card */}
        <div className="bg-card border border-border p-4 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Consumo Total Red</span>
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {telemetry.totalBucketSizeFormatted}
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
              <span>de 10 GB Free Tier</span>
              <span className="font-semibold text-foreground">{telemetry.cloudflareFreeTierPercentUsed}%</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(2, telemetry.cloudflareFreeTierPercentUsed))}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 font-medium">
            {telemetry.totalBucketObjects} archivos en R2
          </p>
        </div>

        {/* Product Images Card */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Fotos de Productos</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {telemetry.folderTotals.products.sizeFormatted}
          </div>
          <p className="text-xs font-semibold text-blue-500 mt-1">
            {telemetry.folderTotals.products.count} fotos activas
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Catálogo y variantes
          </p>
        </div>

        {/* Payment Proofs Card */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Comprobantes</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {telemetry.folderTotals.proofs.sizeFormatted}
          </div>
          <p className="text-xs font-semibold text-emerald-500 mt-1">
            {telemetry.folderTotals.proofs.count} recibos de pago
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Pago Móvil, Zelle y transferencias
          </p>
        </div>

        {/* Branding & Logos Card */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Identidad & Marca</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {telemetry.folderTotals.branding.sizeFormatted}
          </div>
          <p className="text-xs font-semibold text-purple-500 mt-1">
            {telemetry.folderTotals.branding.count} logos y banners
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Favicons y headers de tienda
          </p>
        </div>

        {/* Estimated Cost Card */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Costo R2 Estimado</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-500">
            ${telemetry.estimatedMonthlyCostUsd.toFixed(2)}
          </div>
          <p className="text-xs font-semibold text-muted-foreground mt-1">
            100% Free Tier (10 GB)
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            $0 Costo de Egress en Cloudflare
          </p>
        </div>
      </div>

      {/* 3. Quota Alerts Banner if any store exceeds limit */}
      {telemetry.quotaAlerts.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <h4 className="font-bold text-amber-500">
              Atención: {telemetry.quotaAlerts.length} comercio(s) superando el 80% de su cuota de almacenamiento
            </h4>
            <div className="mt-1 flex flex-wrap gap-2">
              {telemetry.quotaAlerts.map((qa) => (
                <span
                  key={qa.tenantId}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <strong>{qa.tenantName}</strong> ({qa.totalSizeFormatted} / {qa.quotaFormatted} - {qa.percentUsed}%)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Controls: Search, Filters & Sorting */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por comercio o slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* Plan Filter */}
          <div className="flex items-center gap-1 border border-border p-1 rounded-xl bg-muted/40 text-xs shrink-0">
            <span className="text-muted-foreground px-1.5 text-[10px] font-bold uppercase">Plan:</span>
            {["ALL", "STARTER", "GROWTH", "ENTERPRISE"].map((tier) => (
              <button
                key={tier}
                onClick={() => setPlanFilter(tier)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  planFilter === tier
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tier === "ALL" ? "Todos" : tier}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 border border-border p-1 rounded-xl bg-muted/40 text-xs shrink-0">
            <span className="text-muted-foreground px-1.5 text-[10px] font-bold uppercase">Estado:</span>
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                statusFilter === "ALL" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter("NORMAL")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                statusFilter === "NORMAL" ? "bg-emerald-500 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Normal
            </button>
            <button
              onClick={() => setStatusFilter("WARNING")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                statusFilter === "WARNING" ? "bg-amber-500 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Alerta (&gt;80%)
            </button>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 border border-border p-1 rounded-xl bg-muted/40 text-xs shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-[11px] font-bold text-foreground focus:outline-none cursor-pointer pr-1"
            >
              <option value="size">Mayor Consumo</option>
              <option value="percent">% Cuota Usado</option>
              <option value="files">Cant. Archivos</option>
              <option value="name">Nombre</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Stores Telemetry Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-black text-foreground">
              Consumo de Almacenamiento por Comercio ({filteredTenants.length})
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Medidor en MB/GB relativo a la cuota del Plan SaaS
          </span>
        </div>

        {filteredTenants.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Cloud className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium">No se encontraron comercios con los filtros aplicados</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredTenants.map((tenant) => {
              const statusColor =
                tenant.status === "exceeded"
                  ? "text-red-500 bg-red-500/10 border-red-500/20"
                  : tenant.status === "critical"
                  ? "text-rose-500 bg-rose-500/10 border-rose-500/20"
                  : tenant.status === "warning"
                  ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
                  : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";

              const progressBarColor =
                tenant.status === "exceeded" || tenant.status === "critical"
                  ? "bg-red-500"
                  : tenant.status === "warning"
                  ? "bg-amber-500"
                  : "bg-emerald-500";

              return (
                <div
                  key={tenant.tenantId}
                  className="p-4 sm:p-5 hover:bg-muted/30 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left: Tenant Identity */}
                  <div className="flex items-center gap-3.5 min-w-[260px]">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-base shrink-0">
                      {tenant.tenantName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-foreground">
                          {tenant.tenantName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                          {tenant.planId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="font-mono">{tenant.tenantSlug}</span>
                        <span>•</span>
                        <span>{tenant.totalFiles} archivos en R2</span>
                      </div>
                    </div>
                  </div>

                  {/* Center: Storage Consumption Meter */}
                  <div className="flex-1 max-w-xl">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="text-foreground">{tenant.totalSizeFormatted}</span>
                        <span className="text-muted-foreground font-normal">de</span>
                        <span className="text-muted-foreground">{tenant.quotaFormatted}</span>
                      </div>
                      <span className={`text-xs font-black ${statusColor.split(" ")[0]}`}>
                        {tenant.percentUsed}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden p-0.5 border border-border">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`}
                        style={{ width: `${Math.min(100, Math.max(1, tenant.percentUsed))}%` }}
                      />
                    </div>

                    {/* Folder Breakdown Mini-Chips */}
                    <div className="flex items-center gap-2 flex-wrap mt-2.5 text-[11px]">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                        <ImageIcon className="w-3 h-3" />
                        Productos: {tenant.byFolder.products.sizeFormatted} ({tenant.byFolder.products.count})
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Receipt className="w-3 h-3" />
                        Comprobantes: {tenant.byFolder.proofs.sizeFormatted} ({tenant.byFolder.proofs.count})
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">
                        <Layers className="w-3 h-3" />
                        Logos: {tenant.byFolder.branding.sizeFormatted} ({tenant.byFolder.branding.count})
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    <button
                      onClick={() => {
                        setSelectedTenant(tenant);
                        setFileFolderFilter("ALL");
                        setFileSearchTerm("");
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-border bg-card hover:bg-muted/80 text-foreground transition-all cursor-pointer shadow-xs"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-primary" />
                      <span>Ver Archivos R2</span>
                    </button>

                    {onImpersonateTenant && (
                      <button
                        onClick={() => onImpersonateTenant(tenant.tenantId)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
                        title="Ingresar como Dueño para administrar o limpiar archivos"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Login As</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Modal: Detailed Files Explorer for Selected Tenant */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">
                    Archivos en Cloudflare R2 — {selectedTenant.tenantName}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Consumo: {selectedTenant.totalSizeFormatted} de {selectedTenant.quotaFormatted} ({selectedTenant.percentUsed}%) • {selectedTenant.totalFiles} objetos
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTenant(null)}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Controls: Folder tabs & file search */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/10">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setFileFolderFilter("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    fileFolderFilter === "ALL"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Todos ({selectedTenant.recentFiles.length})
                </button>
                <button
                  onClick={() => setFileFolderFilter("products")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    fileFolderFilter === "products"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Productos ({selectedTenant.byFolder.products.count})
                </button>
                <button
                  onClick={() => setFileFolderFilter("proofs")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    fileFolderFilter === "proofs"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Comprobantes ({selectedTenant.byFolder.proofs.count})
                </button>
                <button
                  onClick={() => setFileFolderFilter("branding")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    fileFolderFilter === "branding"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Branding ({selectedTenant.byFolder.branding.count})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar archivo..."
                  value={fileSearchTerm}
                  onChange={(e) => setFileSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Modal Body: Files Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {modalFiles.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium">No se encontraron archivos en esta carpeta</p>
                </div>
              ) : (
                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                  {modalFiles.map((file, idx) => (
                    <div
                      key={file.key || idx}
                      className="p-3 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border">
                          {file.folder === "products" ? (
                            <ImageIcon className="w-4 h-4 text-blue-500" />
                          ) : file.folder === "proofs" ? (
                            <Receipt className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Layers className="w-4 h-4 text-purple-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-foreground truncate">{file.fileName}</p>
                          <p className="text-[11px] font-mono text-muted-foreground truncate">{file.key}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-muted text-muted-foreground">
                          {file.sizeFormatted}
                        </span>

                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
              <span>Cloudflare R2 Bucket: marketos-media</span>
              <button
                onClick={() => setSelectedTenant(null)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
