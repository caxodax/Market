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
import { PurchasesBookModal } from "./purchases-book-modal";
import { resolveRetentionAdapter } from "../adapters/retention-adapter";
import {
  buildSeniatIslrXmlFromInvoices,
  recordSupplierPayment,
} from "../services/purchasing-service";
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
  Percent,
  CreditCard,
  Clock,
  CheckCircle2,
  X,
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
  ) => Promise<{
    success: boolean;
    error?: string;
    invoice?: PurchaseInvoice;
    voucher?: RetentionVoucher;
    islrVoucher?: RetentionVoucher;
  }>;
  onDownloadSeniatTxt?: (
    taxPeriod: string
  ) => Promise<{ success: boolean; error?: string; content?: string; filename?: string }>;
  onDownloadSeniatIslrXml?: (
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
  onDownloadSeniatIslrXml,
}: PurchasingManagerAdminProps) {
  const isVenezuela = activeModuleIds.includes("local_venezuela");
  const isChile = activeModuleIds.includes("local_chile");
  const adapter = resolveRetentionAdapter(undefined, activeModuleIds);

  const [invoices, setInvoices] = useState<PurchaseInvoice[]>(initialInvoices);
  const [vouchers, setVouchers] = useState<RetentionVoucher[]>(initialVouchers);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);

  const [activeTab, setActiveTab] = useState<"INVOICES" | "VOUCHERS" | "SUPPLIERS" | "CXP">("INVOICES");
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<"ALL" | "VAT" | "INCOME_TAX">("ALL");
  const [cxpStatusFilter, setCxpStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    new Date().toISOString().slice(0, 7).replace("-", "")
  );

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [viewingVoucher, setViewingVoucher] = useState<RetentionVoucher | null>(null);
  const [isDownloadingTxt, setIsDownloadingTxt] = useState(false);
  const [isDownloadingXml, setIsDownloadingXml] = useState(false);
  const [isPurchasesBookModalOpen, setIsPurchasesBookModalOpen] = useState(false);

  // CxP Payment Modal state
  const [paymentInvoice, setPaymentInvoice] = useState<PurchaseInvoice | null>(null);
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState<string>("");
  const [supplierPaymentDate, setSupplierPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [supplierPaymentMethod, setSupplierPaymentMethod] = useState<string>("TRANSFERENCIA");
  const [supplierPaymentReference, setSupplierPaymentReference] = useState<string>("");
  const [supplierPaymentNotes, setSupplierPaymentNotes] = useState<string>("");
  const [supplierPaymentError, setSupplierPaymentError] = useState<string | null>(null);

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
    const totalVatRetained = vouchers
      .filter((v) => v.voucher_type === "VAT" || v.voucher_type === "CHILE_DTE_46")
      .reduce((acc, v) => acc + v.retained_amount, 0);
    const totalIslrRetained = vouchers
      .filter((v) => v.voucher_type === "INCOME_TAX")
      .reduce((acc, v) => acc + v.retained_amount, 0);
    const totalRetainedVes = vouchers.reduce(
      (acc, v) => acc + (v.retained_amount_ves || 0),
      0
    );

    return {
      totalPurchases,
      totalVatRetained,
      totalIslrRetained,
      totalRetainedVes,
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
    let list = vouchers;
    if (voucherTypeFilter !== "ALL") {
      list = list.filter((v) => v.voucher_type === voucherTypeFilter);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (v) =>
        v.voucher_number.toLowerCase().includes(q) ||
        v.supplier_name.toLowerCase().includes(q) ||
        v.supplier_tax_id.toLowerCase().includes(q) ||
        v.invoice_number.toLowerCase().includes(q)
    );
  }, [vouchers, searchQuery, voucherTypeFilter]);

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

  // CxP Metrics
  const cxpStats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const creditInvoices = invoices.filter(
      (inv) => inv.payment_condition === "CREDIT"
    );

    const totalNetPayable = creditInvoices.reduce((sum, inv) => {
      const net =
        inv.net_payable_amount ??
        Math.max(
          0,
          inv.total_amount -
            (inv.retained_vat_amount || 0) -
            (inv.retained_islr_amount || 0)
        );
      const due = inv.amount_due ?? (inv.status === "PAID" ? 0 : net);
      return sum + due;
    }, 0);

    const totalPaid = creditInvoices.reduce(
      (sum, inv) => sum + (inv.amount_paid ?? 0),
      0
    );

    const totalOverdue = creditInvoices
      .filter((inv) => {
        const net =
          inv.net_payable_amount ??
          Math.max(
            0,
            inv.total_amount -
              (inv.retained_vat_amount || 0) -
              (inv.retained_islr_amount || 0)
          );
        const due = inv.amount_due ?? (inv.status === "PAID" ? 0 : net);
        const isPast = inv.due_date && inv.due_date < today;
        return (inv.payment_status === "OVERDUE" || isPast) && due > 0.005;
      })
      .reduce((sum, inv) => {
        const net =
          inv.net_payable_amount ??
          Math.max(
            0,
            inv.total_amount -
              (inv.retained_vat_amount || 0) -
              (inv.retained_islr_amount || 0)
          );
        return sum + (inv.amount_due ?? net);
      }, 0);

    return {
      creditInvoicesCount: creditInvoices.length,
      totalNetPayable,
      totalPaid,
      totalOverdue,
    };
  }, [invoices]);

  const filteredCxPInvoices = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return invoices.filter((inv) => {
      if (inv.payment_condition !== "CREDIT") return false;
      const net =
        inv.net_payable_amount ??
        Math.max(
          0,
          inv.total_amount -
            (inv.retained_vat_amount || 0) -
            (inv.retained_islr_amount || 0)
        );
      const isPast = inv.due_date && inv.due_date < today;
      const computedStatus = (inv.amount_due ?? net) <= 0.005
        ? "PAID"
        : isPast || inv.payment_status === "OVERDUE"
        ? "OVERDUE"
        : (inv.amount_paid && inv.amount_paid > 0)
        ? "PARTIALLY_PAID"
        : "PENDING";

      if (cxpStatusFilter !== "ALL" && computedStatus !== cxpStatusFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        inv.supplier_name.toLowerCase().includes(q) ||
        inv.supplier_tax_id.toLowerCase().includes(q) ||
        inv.invoice_number.toLowerCase().includes(q)
      );
    });
  }, [invoices, cxpStatusFilter, searchQuery]);

  const handleOpenSupplierPaymentModal = (inv: PurchaseInvoice) => {
    setPaymentInvoice(inv);
    const net =
      inv.net_payable_amount ??
      Math.max(
        0,
        inv.total_amount -
          (inv.retained_vat_amount || 0) -
          (inv.retained_islr_amount || 0)
      );
    setSupplierPaymentAmount(String(inv.amount_due ?? net));
    setSupplierPaymentDate(new Date().toISOString().split("T")[0]);
    setSupplierPaymentMethod("TRANSFERENCIA");
    setSupplierPaymentReference("");
    setSupplierPaymentNotes("");
    setSupplierPaymentError(null);
  };

  const handleRegisterSupplierPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;
    setSupplierPaymentError(null);
    const amt = parseFloat(supplierPaymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setSupplierPaymentError("Por favor ingresa un monto válido mayor a 0.");
      return;
    }

    try {
      const updated = recordSupplierPayment(paymentInvoice, {
        amount: amt,
        payment_date: supplierPaymentDate,
        payment_method: supplierPaymentMethod,
        reference: supplierPaymentReference.trim() || null,
        notes: supplierPaymentNotes.trim() || null,
      });

      setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setPaymentInvoice(null);
    } catch (err: any) {
      setSupplierPaymentError(err?.message || "Error al registrar el pago al proveedor.");
    }
  };

  // Handle register purchase wrapper
  const handleRegisterPurchaseWrapper = async (input: CreatePurchaseInvoiceInput) => {
    const res = await onRegisterPurchase(input);
    if (res.success && res.invoice) {
      setInvoices((prev) => [res.invoice!, ...prev]);
      const newVouchers: RetentionVoucher[] = [];
      if (res.voucher) newVouchers.push(res.voucher);
      if (res.islrVoucher) newVouchers.push(res.islrVoucher);
      if (newVouchers.length > 0) {
        setVouchers((prev) => [...newVouchers, ...prev]);
      }
      // Add or update supplier if not exists
      setSuppliers((prev) => {
        const exists = prev.some((s) => s.tax_id === input.supplier_tax_id);
        if (exists) return prev;
        const newSup: Supplier = {
          id: `sup_${input.supplier_tax_id.replace(/[^A-Za-z0-9]/g, "")}`,
          tenantId: tenantId,
          name: input.supplier_name,
          taxId: input.supplier_tax_id,
          phone: input.supplier_phone || null,
          address: input.supplier_address || null,
          default_retention_rate: input.retention_rate_percent,
          is_active: true,
          created_at: new Date().toISOString(),
        } as any;
        return [newSup, ...prev];
      });
    }
    return res;
  };

  // Handle TXT Download (IVA Providencia 0049)
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
        alert(res.error || "No se encontraron retenciones de IVA para el período fiscal seleccionado.");
      }
    } catch (err: any) {
      alert(err?.message || "Error al generar el archivo TXT para el SENIAT.");
    } finally {
      setIsDownloadingTxt(false);
    }
  };

  // Handle XML Download (ISLR Decreto 1.808)
  const handleDownloadXml = async () => {
    try {
      setIsDownloadingXml(true);
      if (onDownloadSeniatIslrXml) {
        const res = await onDownloadSeniatIslrXml(selectedPeriod);
        if (res.success && res.content) {
          const blob = new Blob([res.content], { type: "application/xml;charset=iso-8859-1" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = res.filename || `SENIAT_ISLR_${selectedPeriod}.xml`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          return;
        } else {
          alert(res.error || "No se encontraron retenciones de ISLR para el período seleccionado.");
          return;
        }
      }

      // Default generator from registered invoices
      const agentRif =
        settings.billing_settings?.emitter_fiscal_data?.rif || "J-00000000-0";
      const xmlContent = buildSeniatIslrXmlFromInvoices({
        agentRif,
        taxPeriod: selectedPeriod,
        invoices,
      });

      const blob = new Blob([xmlContent], { type: "application/xml;charset=iso-8859-1" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `SENIAT_ISLR_${selectedPeriod}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || "Error al generar el archivo XML de ISLR para el SENIAT.");
    } finally {
      setIsDownloadingXml(false);
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
          {isVenezuela && (
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
              {onDownloadSeniatTxt && (
                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  disabled={isDownloadingTxt || selectedPeriod.length !== 6}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
                  title="Exportar archivo TXT para declaración de Retenciones de IVA (Providencia 0049)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isDownloadingTxt ? "Generando..." : "TXT IVA"}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadXml}
                disabled={isDownloadingXml || selectedPeriod.length !== 6}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
                title="Exportar archivo XML para declaración de Retenciones de ISLR (Decreto 1.808)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isDownloadingXml ? "Generando..." : "XML ISLR"}</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsPurchasesBookModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-purple-500/30 bg-purple-500/5 text-purple-600 dark:text-purple-400 text-xs font-bold hover:bg-purple-500/10 transition-colors cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Libro de Compras</span>
          </button>

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
            Providencia SNAT/2015/0049
          </div>
        </div>

        {/* Total ISLR Retenido */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-indigo-600">
            <span className="text-xs font-bold">ISLR Retenido (Decreto 1.808)</span>
            <Percent className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-indigo-600 font-mono">
            {formatCurrency(stats.totalIslrRetained, settings.default_currency || "USD")}
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">
            Declaración XML SENIAT
          </div>
        </div>

        {/* Comprobantes Emitidos */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Comprobantes Emitidos</span>
            <FileSpreadsheet className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-black text-foreground font-mono">
            {stats.vouchersCount}
          </div>
          <div className="text-[11px] text-muted-foreground">
            IVA e ISLR generados
          </div>
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
          <button
            type="button"
            onClick={() => setActiveTab("CXP")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "CXP"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Cuentas por Pagar ({cxpStats.creditInvoicesCount})
          </button>
        </div>

        {/* Search Bar & Type filter if in VOUCHERS */}
        <div className="flex items-center gap-2">
          {activeTab === "VOUCHERS" && (
            <div className="flex items-center gap-1 bg-muted/60 border border-border rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setVoucherTypeFilter("ALL")}
                className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  voucherTypeFilter === "ALL" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setVoucherTypeFilter("VAT")}
                className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  voucherTypeFilter === "VAT" ? "bg-purple-500/20 text-purple-700 dark:text-purple-300" : "text-muted-foreground"
                }`}
              >
                IVA
              </button>
              <button
                type="button"
                onClick={() => setVoucherTypeFilter("INCOME_TAX")}
                className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  voucherTypeFilter === "INCOME_TAX" ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" : "text-muted-foreground"
                }`}
              >
                ISLR
              </button>
            </div>
          )}

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
                  <th className="p-3 text-right">Retenciones</th>
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
                    const vatVoucher = vouchers.find(
                      (v) =>
                        v.purchase_invoice_id === inv.id &&
                        (v.voucher_type === "VAT" || v.voucher_type === "CHILE_DTE_46")
                    );
                    const islrVoucher = vouchers.find(
                      (v) => v.purchase_invoice_id === inv.id && v.voucher_type === "INCOME_TAX"
                    );

                    const totalRetained =
                      (inv.retained_vat_amount || 0) + (inv.retained_islr_amount || 0);
                    const netPayable = inv.total_amount - totalRetained;

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
                        <td className="p-3 text-right font-mono">
                          {inv.retained_vat_amount ? (
                            <span className="block font-bold text-purple-600">
                              IVA: -{formatCurrency(inv.retained_vat_amount, inv.currency)}
                            </span>
                          ) : null}
                          {inv.retained_islr_amount ? (
                            <span className="block font-bold text-indigo-600 text-[10px]">
                              ISLR: -{formatCurrency(inv.retained_islr_amount, inv.currency)}
                            </span>
                          ) : null}
                          {!inv.retained_vat_amount && !inv.retained_islr_amount && (
                            <span className="text-muted-foreground">0.00</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-emerald-600">
                          {formatCurrency(netPayable, inv.currency)}
                        </td>
                        <td className="p-3 pr-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {vatVoucher && (
                              <button
                                type="button"
                                onClick={() => setViewingVoucher(vatVoucher)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 text-[10px] font-bold transition-colors cursor-pointer"
                                title="Ver Comprobante de Retención IVA"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>IVA</span>
                              </button>
                            )}
                            {islrVoucher && (
                              <button
                                type="button"
                                onClick={() => setViewingVoucher(islrVoucher)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 text-[10px] font-bold transition-colors cursor-pointer"
                                title="Ver Comprobante de Retención ISLR (Decreto 1.808)"
                              >
                                <Percent className="w-3 h-3" />
                                <span>ISLR</span>
                              </button>
                            )}
                            {!vatVoucher && !islrVoucher && (
                              <span className="text-[11px] text-muted-foreground italic">
                                Sin retención
                              </span>
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
      )}

      {/* Tab 2: Comprobantes de Retención */}
      {activeTab === "VOUCHERS" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <th className="p-3 pl-4">Tipo / Comprobante</th>
                  <th className="p-3">Período / Emisión</th>
                  <th className="p-3">Proveedor Retenido</th>
                  <th className="p-3">Factura Afectada</th>
                  <th className="p-3 text-right">% Ret.</th>
                  <th className="p-3 text-right">Impuesto Retenido</th>
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
                      <td className="p-3 pl-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {v.voucher_type === "INCOME_TAX" ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                              ISLR
                            </span>
                          ) : v.voucher_type === "CHILE_DTE_46" ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
                              DTE-46
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300">
                              IVA
                            </span>
                          )}
                          <span className="font-mono font-bold text-foreground">
                            {v.voucher_number}
                          </span>
                        </div>
                        {v.islr_concept_code && (
                          <span className="block text-[10px] text-muted-foreground pl-0.5">
                            [{v.islr_concept_code}] {v.islr_concept_name || "Decreto 1.808"}
                          </span>
                        )}
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
                      <td className={`p-3 text-right font-bold ${v.voucher_type === "INCOME_TAX" ? "text-indigo-700" : "text-purple-700"}`}>
                        {v.retention_rate_percent}%
                      </td>
                      <td className={`p-3 text-right font-mono font-black ${v.voucher_type === "INCOME_TAX" ? "text-indigo-900 dark:text-indigo-300" : "text-purple-900 dark:text-purple-300"}`}>
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

      {/* CXP Tab Panel */}
      {activeTab === "CXP" && (
        <div className="space-y-4">
          {/* CXP Metrics Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Deuda Neta por Pagar</span>
              </p>
              <p className="text-xl font-black font-mono text-amber-500">
                {formatCurrency(cxpStats.totalNetPayable, settings.default_currency || "USD")}
              </p>
              <p className="text-[10px] text-muted-foreground">Saldo neto deducidas retenciones</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Total Pagado</span>
              </p>
              <p className="text-xl font-black font-mono text-emerald-500">
                {formatCurrency(cxpStats.totalPaid, settings.default_currency || "USD")}
              </p>
              <p className="text-[10px] text-muted-foreground">Abonos realizados a proveedores</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>Deuda Vencida</span>
              </p>
              <p className="text-xl font-black font-mono text-rose-500">
                {formatCurrency(cxpStats.totalOverdue, settings.default_currency || "USD")}
              </p>
              <p className="text-[10px] text-muted-foreground">Facturas con plazo expirado</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                <span>Compras a Crédito</span>
              </p>
              <p className="text-xl font-black font-mono text-foreground">
                {cxpStats.creditInvoicesCount}
              </p>
              <p className="text-[10px] text-muted-foreground">Total facturas recibidas a plazo</p>
            </div>
          </div>

          {/* CXP Status Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "ALL", label: "Todas" },
              { id: "PENDING", label: "Pendientes" },
              { id: "PARTIALLY_PAID", label: "Abonadas" },
              { id: "OVERDUE", label: "Vencidas" },
              { id: "PAID", label: "Pagadas" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCxpStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  cxpStatusFilter === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* CXP Invoices Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <th className="p-3 pl-4">Factura Nº</th>
                    <th className="p-3">Proveedor / RIF</th>
                    <th className="p-3">Emisión</th>
                    <th className="p-3">Vencimiento</th>
                    <th className="p-3 text-right">Total Factura</th>
                    <th className="p-3 text-right">Retenciones</th>
                    <th className="p-3 text-right">Deuda Neta</th>
                    <th className="p-3 text-right">Pagado</th>
                    <th className="p-3 text-right">Saldo Pendiente</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 pr-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredCxPInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-muted-foreground space-y-2">
                        <CreditCard className="w-8 h-8 mx-auto opacity-30" />
                        <p className="font-semibold text-xs">No hay facturas a crédito registradas con proveedores</p>
                        <p className="text-[11px] text-muted-foreground/80">
                          Al registrar una compra, marca la condición de pago como "Crédito (CxP)".
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCxPInvoices.map((inv) => {
                      const today = new Date().toISOString().split("T")[0];
                      const retVat = inv.retained_vat_amount || 0;
                      const retIslr = inv.retained_islr_amount || 0;
                      const totalRet = retVat + retIslr;
                      const netPayable = inv.net_payable_amount ?? Math.max(0, inv.total_amount - totalRet);
                      const balance = inv.amount_due ?? (inv.status === "PAID" ? 0 : netPayable);
                      const isPaid = balance <= 0.005;
                      const isPast = inv.due_date && inv.due_date < today;
                      const isOverdue = !isPaid && (inv.payment_status === "OVERDUE" || isPast);

                      return (
                        <tr key={inv.id} className="hover:bg-muted/15 transition-colors">
                          <td className="p-3 pl-4">
                            <p className="font-mono font-bold text-foreground">{inv.invoice_number}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">{inv.control_number || "—"}</p>
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-foreground">{inv.supplier_name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">{inv.supplier_tax_id}</p>
                          </td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {inv.invoice_date}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <p className={`font-mono font-semibold ${isOverdue ? "text-rose-500" : "text-foreground"}`}>
                              {inv.due_date || "—"}
                            </p>
                            <span className="text-[10px] text-muted-foreground">
                              {inv.credit_term_days ? `${inv.credit_term_days} días` : "Plazo"}
                              {isOverdue && " • Vencida"}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-muted-foreground whitespace-nowrap">
                            {formatCurrency(inv.total_amount, inv.currency)}
                          </td>
                          <td className="p-3 text-right font-mono text-purple-600 whitespace-nowrap font-semibold">
                            {totalRet > 0 ? `-${formatCurrency(totalRet, inv.currency)}` : "—"}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                            {formatCurrency(netPayable, inv.currency)}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-600 font-semibold whitespace-nowrap">
                            {formatCurrency(inv.amount_paid ?? 0, inv.currency)}
                          </td>
                          <td className="p-3 text-right font-mono font-black whitespace-nowrap">
                            <span className={balance > 0 ? (isOverdue ? "text-rose-600" : "text-amber-600") : "text-emerald-600"}>
                              {formatCurrency(balance, inv.currency)}
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            {isPaid ? (
                              <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                Pagada
                              </span>
                            ) : isOverdue ? (
                              <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full border bg-rose-500/10 text-rose-600 border-rose-500/20">
                                Vencida
                              </span>
                            ) : (inv.amount_paid && inv.amount_paid > 0) ? (
                              <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 border-amber-500/20">
                                Abono Parcial
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-600 border-blue-500/20">
                                Pendiente
                              </span>
                            )}
                          </td>
                          <td className="p-3 pr-4 text-center whitespace-nowrap">
                            {balance > 0.005 ? (
                              <button
                                type="button"
                                onClick={() => handleOpenSupplierPaymentModal(inv)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
                                title="Registrar Pago o Abono a Proveedor"
                              >
                                <DollarSign className="w-3 h-3" />
                                <span>Abonar</span>
                              </button>
                            ) : (
                              <span className="text-muted-foreground text-[11px] font-semibold">Saldada</span>
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
        </div>
      )}

      {/* Supplier Payment / Abono Modal */}
      {paymentInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-primary/10 text-primary">
                  <DollarSign className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Registrar Pago a Proveedor</h3>
                  <p className="text-[11px] text-muted-foreground">Factura {paymentInvoice.invoice_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentInvoice(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {supplierPaymentError && (
              <div className="mx-4 mt-3 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{supplierPaymentError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSupplierPaymentSubmit} className="p-4 space-y-3.5">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proveedor:</span>
                  <span className="font-bold text-foreground truncate max-w-[200px]">{paymentInvoice.supplier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Factura:</span>
                  <span className="font-mono">{formatCurrency(paymentInvoice.total_amount, paymentInvoice.currency)}</span>
                </div>
                {(paymentInvoice.retained_vat_amount || paymentInvoice.retained_islr_amount) && (
                  <div className="flex justify-between text-purple-600 font-semibold">
                    <span>Retenciones Fiscales:</span>
                    <span className="font-mono">
                      -{formatCurrency((paymentInvoice.retained_vat_amount || 0) + (paymentInvoice.retained_islr_amount || 0), paymentInvoice.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deuda Neta:</span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(paymentInvoice.net_payable_amount ?? paymentInvoice.total_amount, paymentInvoice.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pagado Previo:</span>
                  <span className="font-mono text-emerald-600 font-semibold">{formatCurrency(paymentInvoice.amount_paid ?? 0, paymentInvoice.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-1 font-bold">
                  <span className="text-foreground">Saldo Pendiente por Pagar:</span>
                  <span className="font-mono text-amber-600">
                    {formatCurrency(paymentInvoice.amount_due ?? paymentInvoice.total_amount, paymentInvoice.currency)}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground">Monto a Pagar ($) *</label>
                  <button
                    type="button"
                    onClick={() => setSupplierPaymentAmount(String(paymentInvoice.amount_due ?? paymentInvoice.net_payable_amount ?? paymentInvoice.total_amount))}
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Saldo Total
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={paymentInvoice.amount_due ?? paymentInvoice.net_payable_amount ?? paymentInvoice.total_amount}
                  value={supplierPaymentAmount}
                  onChange={(e) => setSupplierPaymentAmount(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background font-mono text-xs font-bold text-foreground focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Fecha</label>
                  <input
                    type="date"
                    value={supplierPaymentDate}
                    onChange={(e) => setSupplierPaymentDate(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Método</label>
                  <select
                    value={supplierPaymentMethod}
                    onChange={(e) => setSupplierPaymentMethod(e.target.value)}
                    className="w-full h-9 px-2 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                  >
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="PAGO_MOVIL">Pago Móvil</option>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="ZELLE">Zelle</option>
                    <option value="DEBITO">Punto / Débito</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Referencia / Comprobante</label>
                <input
                  type="text"
                  placeholder="Ej: 98765432"
                  value={supplierPaymentReference}
                  onChange={(e) => setSupplierPaymentReference(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-mono text-foreground focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Notas / Observación</label>
                <input
                  type="text"
                  placeholder="Ej: Abono a factura de insumos"
                  value={supplierPaymentNotes}
                  onChange={(e) => setSupplierPaymentNotes(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setPaymentInvoice(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
                >
                  Confirmar Pago
                </button>
              </div>
            </form>
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

      {/* Official Purchases Book Modal */}
      <PurchasesBookModal
        isOpen={isPurchasesBookModalOpen}
        onClose={() => setIsPurchasesBookModalOpen(false)}
        invoices={invoices}
        vouchers={vouchers}
        settings={settings}
        tenantId={tenantId}
      />
    </div>
  );
}
