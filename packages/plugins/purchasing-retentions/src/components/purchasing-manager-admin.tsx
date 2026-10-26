"use client";

import React, { useState, useMemo } from "react";
import type {
  PurchaseInvoice,
  RetentionVoucher,
  Supplier,
  TenantSettings,
  CreatePurchaseInvoiceInput,
} from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import { RegisterPurchaseModal } from "./register-purchase-modal";
import { PrintableRetentionVoucherModal } from "./printable-retention-voucher-modal";
import { resolveRetentionAdapter } from "../adapters/retention-adapter";
import {
  ShoppingBag,
  ShieldCheck,
  Building,
  Plus,
  Search,
  Printer,
  Calendar,
  Download,
  Filter,
  DollarSign,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

export interface PurchasingManagerAdminProps {
  tenantId: string;
  settings: TenantSettings;
  activeModuleIds?: string[];
  initialInvoices?: PurchaseInvoice[];
  initialVouchers?: RetentionVoucher[];
  initialSuppliers?: Supplier[];
  defaultExchangeRate?: number;
  onRegisterPurchase: (
    input: CreatePurchaseInvoiceInput
  ) => Promise<{ success: boolean; error?: string; invoice?: PurchaseInvoice; voucher?: RetentionVoucher }>;
  onDownloadSeniatTxt?: (
    taxPeriod: string
  ) => Promise<{ success: boolean; error?: string; content?: string; filename?: string }>;
}

export function PurchasingManagerAdmin({
  tenantId,
  settings,
  activeModuleIds = [],
  initialInvoices = [],
  initialVouchers = [],
  initialSuppliers = [],
  defaultExchangeRate = 1,
  onRegisterPurchase,
  onDownloadSeniatTxt,
}: PurchasingManagerAdminProps) {
  const isVenezuela = activeModuleIds.includes("local_venezuela");
  const isChile = activeModuleIds.includes("local_chile");
  const adapter = resolveRetentionAdapter(undefined, activeModuleIds);

  const [invoices, setInvoices] = useState<PurchaseInvoice[]>(initialInvoices);
  const [vouchers, setVouchers] = useState<RetentionVoucher[]>(initialVouchers);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);

  const [activeTab, setActiveTab] = useState<"INVOICES" | "VOUCHERS" | "SUPPLIERS">("INVOICES");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    new Date().toISOString().slice(0, 7).replace("-", "")
  );

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [viewingVoucher, setViewingVoucher] = useState<RetentionVoucher | null>(null);
  const [isDownloadingTxt, setIsDownloadingTxt] = useState(false);

  // Sync state if initial props change
  React.useEffect(() => {
    if (initialInvoices.length > 0) setInvoices(initialInvoices);
  }, [initialInvoices]);

  React.useEffect(() => {
    if (initialVouchers.length > 0) setVouchers(initialVouchers);
  }, [initialVouchers]);

  React.useEffect(() => {
    if (initialSuppliers.length > 0) setSuppliers(initialSuppliers);
  }, [initialSuppliers]);

  // Derived KPIs
  const stats = useMemo(() => {
    const totalPurchases = invoices.reduce((acc, inv) => acc + inv.total_amount, 0);
    const totalVatRetained = vouchers.reduce((acc, v) => acc + v.retained_amount, 0);
    const totalVatRetainedVes = vouchers.reduce(
      (acc, v) => acc + (v.retained_amount_ves || 0),
      0
    );

    return {
      totalPurchases,
      totalVatRetained,
      totalVatRetainedVes,
      vouchersCount: vouchers.length,
      suppliersCount: suppliers.length,
    };
  }, [invoices, vouchers, suppliers]);

  // Filtered lists
  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return invoices;
    const q = searchQuery.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.supplier_name.toLowerCase().includes(q) ||
        inv.supplier_tax_id.toLowerCase().includes(q) ||
        inv.invoice_number.toLowerCase().includes(q)
    );
  }, [invoices, searchQuery]);

  const filteredVouchers = useMemo(() => {
    if (!searchQuery.trim()) return vouchers;
    const q = searchQuery.toLowerCase();
    return vouchers.filter(
      (v) =>
        v.voucher_number.toLowerCase().includes(q) ||
        v.supplier_name.toLowerCase().includes(q) ||
        v.supplier_tax_id.toLowerCase().includes(q) ||
        v.invoice_number.toLowerCase().includes(q)
    );
  }, [vouchers, searchQuery]);

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) return suppliers;
    const q = searchQuery.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.tax_id.toLowerCase().includes(q) ||
        (s.phone && s.phone.toLowerCase().includes(q))
    );
  }, [suppliers, searchQuery]);

  // Handle register purchase wrapper
  const handleRegisterPurchaseWrapper = async (input: CreatePurchaseInvoiceInput) => {
    const res = await onRegisterPurchase(input);
    if (res.success && res.invoice) {
      setInvoices((prev) => [res.invoice!, ...prev]);
      if (res.voucher) {
        setVouchers((prev) => [res.voucher!, ...prev]);
      }
      // Add or update supplier if not exists
      setSuppliers((prev) => {
        const exists = prev.some((s) => s.tax_id === input.supplier_tax_id);
        if (exists) return prev;
        const newSup: Supplier = {
          id: `sup_${input.supplier_tax_id.replace(/[^A-Za-z0-9]/g, "")}`,
          tenant_id: tenantId,
          name: input.supplier_name,
          tax_id: input.supplier_tax_id,
          phone: input.supplier_phone || null,
          address: input.supplier_address || null,
          default_retention_rate: input.retention_rate_percent,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        return [newSup, ...prev];
      });
    }
    return res;
  };

  // Handle TXT Download
  const handleDownloadTxt = async () => {
    if (!onDownloadSeniatTxt) return;
    try {
      setIsDownloadingTxt(true);
      const res = await onDownloadSeniatTxt(selectedPeriod);
      if (res.success && res.content) {
        const blob = new Blob([res.content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = res.filename || `SENIAT_RET_${selectedPeriod}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        alert(res.error || "No se encontraron retenciones para el período fiscal seleccionado.");
      }
    } catch (err: any) {
      alert(err?.message || "Error al generar el archivo TXT para el SENIAT.");
    } finally {
      setIsDownloadingTxt(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground">
                Compras y Retenciones Fiscales
              </h2>
              <p className="text-xs text-muted-foreground">
                {isVenezuela
                  ? "Sujetos Pasivos Especiales (SPE) • Providencia SNAT/2015/0049 • Declaración TXT"
                  : isChile
                  ? "Gestión de Proveedores y Factura de Compra DTE 46 / RCV (SII)"
                  : "Registro de adquisiciones, facturas de compras y retenciones en la fuente"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isVenezuela && onDownloadSeniatTxt && (
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl p-1 shadow-xs">
              <input
                type="text"
                aria-label="Período Fiscal YYYYMM"
                placeholder="YYYYMM"
                maxLength={6}
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-20 px-2 py-1 text-xs font-mono font-bold bg-muted/60 border-none rounded-lg text-foreground focus:outline-hidden text-center"
              />
              <button
                type="button"
                onClick={handleDownloadTxt}
                disabled={isDownloadingTxt || selectedPeriod.length !== 6}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isDownloadingTxt ? "Generando..." : "Descargar TXT SENIAT"}</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsRegisterModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Compra</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Compras */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Compras</span>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-black text-foreground font-mono">
            {formatCurrency(stats.totalPurchases, settings.default_currency || "USD")}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {invoices.length} facturas registradas
          </div>
        </div>

        {/* Total IVA Retenido */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-xs font-bold">IVA Retenido (A enterar)</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-purple-600 font-mono">
            {formatCurrency(stats.totalVatRetained, settings.default_currency || "USD")}
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">
            {stats.totalVatRetainedVes > 0 ? `Bs. ${stats.totalVatRetainedVes.toFixed(2)}` : "En divisa base"}
          </div>
        </div>

        {/* Comprobantes Emitidos */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Comprobantes de Retención</span>
            <FileSpreadsheet className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-black text-foreground font-mono">
            {stats.vouchersCount}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isVenezuela ? "Providencia SNAT/2015/0049" : "Vouchers de retención"}
          </div>
        </div>

        {/* Proveedores */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Proveedores Registrados</span>
            <Building className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-foreground font-mono">
            {stats.suppliersCount}
          </div>
          <div className="text-[11px] text-muted-foreground">Directorio comercial</div>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("INVOICES")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "INVOICES"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Facturas de Compra ({invoices.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("VOUCHERS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "VOUCHERS"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Comprobantes de Retención ({vouchers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("SUPPLIERS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "SUPPLIERS"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Proveedores ({suppliers.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por número, RIF o nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-card border border-border rounded-xl text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Tab 1: Facturas de Compra */}
      {activeTab === "INVOICES" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <th className="p-3 pl-4">Fecha</th>
                  <th className="p-3">Factura / Control</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3 text-right">Subtotal Base</th>
                  <th className="p-3 text-right">IVA</th>
                  <th className="p-3 text-right">IVA Retenido</th>
                  <th className="p-3 text-right">Neto a Pagar</th>
                  <th className="p-3 pr-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No se encontraron facturas de compras registradas.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const voucher = vouchers.find((v) => v.purchase_invoice_id === inv.id);
                    const netPayable = inv.total_amount - (inv.retained_vat_amount || 0);

                    return (
                      <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 pl-4 whitespace-nowrap text-muted-foreground">
                          {inv.invoice_date}
                        </td>
                        <td className="p-3 whitespace-nowrap font-mono">
                          <span className="font-bold text-foreground">{inv.invoice_number}</span>
                          {inv.control_number && (
                            <span className="block text-[10px] text-muted-foreground">
                              Ctrl: {inv.control_number}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-foreground">{inv.supplier_name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {inv.supplier_tax_id}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono">
                          {formatCurrency(inv.subtotal_taxable, inv.currency)}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {formatCurrency(inv.iva_amount, inv.currency)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-purple-600">
                          {inv.retained_vat_amount
                            ? `-${formatCurrency(inv.retained_vat_amount, inv.currency)}`
                            : "0.00"}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-emerald-600">
                          {formatCurrency(netPayable, inv.currency)}
                        </td>
                        <td className="p-3 pr-4 text-center whitespace-nowrap">
                          {voucher ? (
                            <button
                              type="button"
                              onClick={() => setViewingVoucher(voucher)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 text-[11px] font-bold transition-colors cursor-pointer"
                              title="Ver Comprobante de Retención"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Ver Retención</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              Sin retención
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Comprobantes de Retención */}
      {activeTab === "VOUCHERS" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <th className="p-3 pl-4">N° Comprobante</th>
                  <th className="p-3">Período / Emisión</th>
                  <th className="p-3">Proveedor Retenido</th>
                  <th className="p-3">Factura Afectada</th>
                  <th className="p-3 text-right">% Ret.</th>
                  <th className="p-3 text-right">IVA Retenido</th>
                  <th className="p-3 text-right">Equivalente Bs.</th>
                  <th className="p-3 pr-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No se han emitido comprobantes de retención.
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 pl-4 whitespace-nowrap font-mono font-bold text-foreground">
                        {v.voucher_number}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-semibold text-foreground">
                          {v.tax_period.slice(0, 4)}-{v.tax_period.slice(4, 6)}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {v.issue_date}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{v.supplier_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {v.supplier_tax_id}
                        </div>
                      </td>
                      <td className="p-3 font-mono">
                        <span className="font-bold">{v.invoice_number}</span>
                        {v.control_number && (
                          <span className="block text-[10px] text-muted-foreground">
                            Ctrl: {v.control_number}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-purple-700">
                        {v.retention_rate_percent}%
                      </td>
                      <td className="p-3 text-right font-mono font-black text-purple-900">
                        {formatCurrency(v.retained_amount, v.currency === "VES" ? "USD" : v.currency)}
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground">
                        {v.retained_amount_ves ? `Bs. ${v.retained_amount_ves.toFixed(2)}` : "-"}
                      </td>
                      <td className="p-3 pr-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewingVoucher(v)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Imprimir</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Directorio de Proveedores */}
      {activeTab === "SUPPLIERS" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <th className="p-3 pl-4">Razón Social / Nombre</th>
                  <th className="p-3">RIF / RUT</th>
                  <th className="p-3">Teléfono</th>
                  <th className="p-3">Dirección Fiscal</th>
                  <th className="p-3 text-center">% Retención Defecto</th>
                  <th className="p-3 pr-4 text-right">Facturas Registradas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No hay proveedores registrados en el directorio.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s) => {
                    const supInvoicesCount = invoices.filter(
                      (inv) => inv.supplier_tax_id === s.tax_id
                    ).length;

                    return (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 pl-4 font-bold text-foreground">{s.name}</td>
                        <td className="p-3 font-mono font-semibold text-foreground">{s.tax_id}</td>
                        <td className="p-3 text-muted-foreground">{s.phone || "-"}</td>
                        <td className="p-3 text-muted-foreground max-w-xs truncate">
                          {s.address || "-"}
                        </td>
                        <td className="p-3 text-center font-bold text-purple-700">
                          {s.default_retention_rate ? `${s.default_retention_rate}%` : "75% (General)"}
                        </td>
                        <td className="p-3 pr-4 text-right font-mono font-bold text-foreground">
                          {supInvoicesCount}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register Purchase Modal */}
      <RegisterPurchaseModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onPurchaseRegistered={handleRegisterPurchaseWrapper}
        settings={settings}
        activeModuleIds={activeModuleIds}
        existingSuppliers={suppliers}
        defaultExchangeRate={defaultExchangeRate || settings.currency_settings?.custom_rate_value || 1}
      />

      {/* Printable Retention Voucher Modal */}
      <PrintableRetentionVoucherModal
        voucher={viewingVoucher}
        isOpen={Boolean(viewingVoucher)}
        onClose={() => setViewingVoucher(null)}
        settings={settings}
      />
    </div>
  );
}
