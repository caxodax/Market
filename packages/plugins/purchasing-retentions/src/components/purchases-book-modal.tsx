"use client";

import React, { useState, useMemo } from "react";
import type { PurchaseInvoice, RetentionVoucher, TenantSettings } from "@marketos/types";
import { buildPurchasesBook, exportPurchasesBookCsv } from "../services/purchases-book-service";
import { formatCurrency } from "@marketos/utils";
import {
  X,
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Building2,
  CheckCircle2,
  DollarSign,
  TrendingUp,
} from "lucide-react";

export interface PurchasesBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: PurchaseInvoice[];
  vouchers?: RetentionVoucher[];
  settings: TenantSettings;
  tenantId: string;
}

export function PurchasesBookModal({
  isOpen,
  onClose,
  invoices,
  vouchers = [],
  settings,
  tenantId,
}: PurchasesBookModalProps) {
  const currentPeriod = useMemo(() => {
    return new Date().toISOString().slice(0, 7); // "YYYY-MM"
  }, []);

  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod);
  const [selectedCurrency, setSelectedCurrency] = useState<"VES" | "USD">("VES");

  const buyerData = useMemo(() => {
    const fiscal = settings.billing_settings?.emitter_fiscal_data;
    return {
      name: fiscal?.business_name || settings.business_name || "Mi Comercio",
      taxId: fiscal?.rif || "J-00000000-0",
      address: fiscal?.fiscal_address || settings.address || "",
    };
  }, [settings]);

  // Generate Purchases Book report
  const report = useMemo(() => {
    return buildPurchasesBook(invoices, {
      period: selectedPeriod,
      tenantId,
      buyer: buyerData,
      currency: selectedCurrency,
      vouchers,
    });
  }, [invoices, selectedPeriod, tenantId, buyerData, selectedCurrency, vouchers]);

  if (!isOpen) return null;

  // Handle native CSV download for Excel
  const handleDownloadCsv = () => {
    const csvContent = exportPurchasesBookCsv(report);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Libro_Compras_${selectedPeriod}_${report.currency}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-foreground">
                  Libro de Compras Fiscal Oficial
                </h3>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  Art. 56 Ley IVA & Retenciones
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {buyerData.name} • RIF: {buyerData.taxId}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TOOLBAR: PERIOD SELECTOR & EXPORT BUTTONS */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-muted/40 border-b border-border shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Period Picker */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Período Fiscal:</span>
              </label>
              <input
                type="month"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-input bg-background text-xs font-bold font-mono text-foreground focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
              />
            </div>

            {/* Currency Picker */}
            <div className="flex items-center gap-1.5 bg-background p-1 rounded-xl border border-border text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedCurrency("VES")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedCurrency === "VES"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Bolívares (Bs)
              </button>
              <button
                type="button"
                onClick={() => setSelectedCurrency("USD")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedCurrency === "USD"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Dólares ($)
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold text-foreground transition-all cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Excel (.csv)</span>
            </button>
          </div>
        </div>

        {/* SUMMARY KPI CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-4 bg-background border-b border-border shrink-0">
          <div className="p-3 rounded-2xl bg-card border border-border">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              Total Compras con IVA
            </span>
            <p className="text-sm font-black text-foreground mt-0.5">
              {formatCurrency(report.totals.total_purchases, selectedCurrency)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-card border border-border">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              Base Imponible
            </span>
            <p className="text-sm font-black text-foreground mt-0.5">
              {formatCurrency(report.totals.total_taxable_base, selectedCurrency)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-card border border-border">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              Crédito Fiscal IVA
            </span>
            <p className="text-sm font-black text-purple-600 dark:text-purple-400 mt-0.5">
              {formatCurrency(report.totals.total_vat_credit, selectedCurrency)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-card border border-border">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              Compras Exentas
            </span>
            <p className="text-sm font-black text-muted-foreground mt-0.5">
              {formatCurrency(report.totals.total_exempt, selectedCurrency)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-card border border-border">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              IVA Retenido (SPE)
            </span>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCurrency(report.totals.total_retained_vat, selectedCurrency)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-card border border-border">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              Facturas Proveedor
            </span>
            <p className="text-sm font-black text-foreground mt-0.5">
              {report.totals.invoices_count} registradas
            </p>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="flex-1 overflow-auto p-4">
          {report.entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-3">
              <FileSpreadsheet className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">
                No hay facturas de compras registradas en el período {selectedPeriod}.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-2xl overflow-hidden bg-card">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="py-2.5 px-3">Op.</th>
                    <th className="py-2.5 px-3">Fecha Fact.</th>
                    <th className="py-2.5 px-3">RIF / RUT</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Proveedor</th>
                    <th className="py-2.5 px-3">N° Factura</th>
                    <th className="py-2.5 px-3">N° Control</th>
                    <th className="py-2.5 px-3 text-right">Total Compra</th>
                    <th className="py-2.5 px-3 text-right">Exento</th>
                    <th className="py-2.5 px-3 text-right">Base Imponible</th>
                    <th className="py-2.5 px-3 text-right">IVA Crédito</th>
                    <th className="py-2.5 px-3 text-right">IVA Retenido</th>
                    <th className="py-2.5 px-3">Comprobante Retención</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {report.entries.map((entry) => (
                    <tr key={entry.operation_number} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2 px-3 font-sans font-bold text-muted-foreground">
                        {entry.operation_number}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">{entry.invoice_date}</td>
                      <td className="py-2 px-3 font-sans font-semibold">
                        {entry.supplier_tax_id}
                      </td>
                      <td className="py-2 px-3 font-sans font-medium truncate max-w-[180px]">
                        {entry.supplier_name}
                      </td>
                      <td className="py-2 px-3 font-bold">{entry.invoice_number}</td>
                      <td className="py-2 px-3 text-muted-foreground">{entry.control_number}</td>
                      <td className="py-2 px-3 text-right font-black">
                        {entry.total_with_tax.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right text-muted-foreground">
                        {entry.exempt_amount.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold">
                        {entry.taxable_base.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-purple-600 dark:text-purple-400">
                        {entry.tax_amount.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {entry.retained_vat_amount > 0 ? entry.retained_vat_amount.toFixed(2) : "-"}
                      </td>
                      <td className="py-2 px-3 text-[11px] font-sans">
                        {entry.retention_voucher_number ? (
                          <span className="font-mono text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">
                            {entry.retention_voucher_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">No emitido</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/70 font-black text-xs border-t-2 border-border font-mono">
                    <td colSpan={6} className="py-3 px-3 font-sans uppercase">
                      Totales del Período ({report.period})
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      {report.totals.total_purchases.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {report.totals.total_exempt.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {report.totals.total_taxable_base.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-purple-600 dark:text-purple-400">
                      {report.totals.total_vat_credit.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400">
                      {report.totals.total_retained_vat.toFixed(2)}
                    </td>
                    <td className="py-3 px-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
