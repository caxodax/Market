"use client";

import React, { useRef } from "react";
import type { RetentionVoucher, TenantSettings } from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import { Printer, X, ShieldCheck, Download, Building, UserCheck } from "lucide-react";

export interface PrintableRetentionVoucherModalProps {
  voucher: RetentionVoucher | null;
  isOpen: boolean;
  onClose: () => void;
  settings: TenantSettings;
}

export function PrintableRetentionVoucherModal({
  voucher,
  isOpen,
  onClose,
  settings,
}: PrintableRetentionVoucherModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !voucher) return null;

  const handlePrint = () => {
    window.print();
  };

  const isVenezuela = voucher.currency === "VES" || Boolean(voucher.retained_amount_ves);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      {/* Container Dialog */}
      <div className="bg-card border border-border w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">
                Comprobante de Retención #{voucher.voucher_number}
              </h2>
              <p className="text-xs text-muted-foreground">
                Período Fiscal: {voucher.tax_period} • Proveedor: {voucher.supplier_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Comprobante</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet (Letter / A4 Standard Format) */}
        <div className="flex-1 overflow-y-auto p-6 bg-neutral-100 flex justify-center">
          <div
            ref={printRef}
            className="w-full max-w-[760px] bg-white text-black p-8 shadow-md rounded-lg font-sans text-xs border border-neutral-300 print:shadow-none print:border-none print:m-0 print:p-0 print:w-full"
          >
            {/* Header: Title and Legal reference */}
            <div className="text-center pb-4 border-b border-neutral-400">
              <h1 className="text-base font-black uppercase tracking-wider text-neutral-900">
                COMPROBANTE DE RETENCIÓN DEL IMPUESTO AL VALOR AGREGADO (IVA)
              </h1>
              <p className="text-[11px] text-neutral-600 mt-1">
                Ley del IVA - Artículo 11 / Providencia Administrativa SNAT/2015/0049
              </p>
              <div className="inline-block mt-2 px-3 py-1 bg-neutral-100 border border-neutral-400 rounded-md font-mono font-bold text-xs">
                N° DE COMPROBANTE: {voucher.voucher_number}
              </div>
            </div>

            {/* Date and Tax Period Box */}
            <div className="grid grid-cols-2 gap-4 my-4 text-xs">
              <div className="p-3 bg-neutral-50 border border-neutral-300 rounded">
                <span className="font-bold text-neutral-700 block">FECHA DE EMISIÓN:</span>
                <span className="font-semibold text-neutral-900">{voucher.issue_date}</span>
              </div>
              <div className="p-3 bg-neutral-50 border border-neutral-300 rounded">
                <span className="font-bold text-neutral-700 block">PERÍODO FISCAL (AÑO - MES):</span>
                <span className="font-mono font-semibold text-neutral-900">
                  {voucher.tax_period.slice(0, 4)} - {voucher.tax_period.slice(4, 6)}
                </span>
              </div>
            </div>

            {/* Dual Entity Box: Withholding Agent & Supplier */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Agente de Retención (El Comercio) */}
              <div className="border border-neutral-300 p-3 rounded space-y-1 bg-neutral-50/50">
                <div className="font-bold text-[11px] text-neutral-800 uppercase tracking-wide border-b border-neutral-200 pb-1 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-neutral-600" />
                  <span>AGENTE DE RETENCIÓN (COMPRADOR)</span>
                </div>
                <p className="font-bold text-neutral-900 text-xs pt-1">{voucher.agent_business_name}</p>
                <p className="text-neutral-700"><strong>RIF / ID Fiscal:</strong> {voucher.agent_tax_id}</p>
                <p className="text-neutral-600 text-[10px] leading-tight">{voucher.agent_fiscal_address}</p>
              </div>

              {/* Sujeto Retenido (Proveedor) */}
              <div className="border border-neutral-300 p-3 rounded space-y-1 bg-neutral-50/50">
                <div className="font-bold text-[11px] text-neutral-800 uppercase tracking-wide border-b border-neutral-200 pb-1 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-neutral-600" />
                  <span>SUJETO RETENIDO (PROVEEDOR)</span>
                </div>
                <p className="font-bold text-neutral-900 text-xs pt-1">{voucher.supplier_name}</p>
                <p className="text-neutral-700"><strong>RIF / RUT:</strong> {voucher.supplier_tax_id}</p>
                <p className="text-neutral-600 text-[10px] leading-tight">
                  {voucher.supplier_fiscal_address || "Domicilio fiscal del proveedor"}
                </p>
              </div>
            </div>

            {/* Invoices and Withholding Detailed Table */}
            <div className="border border-neutral-400 rounded overflow-hidden mb-4">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-neutral-200 text-neutral-800 font-bold border-b border-neutral-400">
                    <th className="p-2 border-r border-neutral-300">Fecha Fact.</th>
                    <th className="p-2 border-r border-neutral-300">N° Factura</th>
                    <th className="p-2 border-r border-neutral-300">N° Control</th>
                    <th className="p-2 border-r border-neutral-300 text-right">Total Factura</th>
                    <th className="p-2 border-r border-neutral-300 text-right">Base Imponible</th>
                    <th className="p-2 border-r border-neutral-300 text-right">% Alíc.</th>
                    <th className="p-2 border-r border-neutral-300 text-right">Impuesto IVA</th>
                    <th className="p-2 border-r border-neutral-300 text-right">% Ret.</th>
                    <th className="p-2 text-right bg-purple-50 text-purple-900 font-black">IVA Retenido</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-300">
                    <td className="p-2 border-r border-neutral-200">{voucher.invoice_date}</td>
                    <td className="p-2 border-r border-neutral-200 font-mono font-bold">{voucher.invoice_number}</td>
                    <td className="p-2 border-r border-neutral-200 font-mono">{voucher.control_number || "N/A"}</td>
                    <td className="p-2 border-r border-neutral-200 text-right font-mono">
                      {formatCurrency(voucher.invoice_total_amount, voucher.currency === "VES" ? "USD" : voucher.currency)}
                    </td>
                    <td className="p-2 border-r border-neutral-200 text-right font-mono">
                      {formatCurrency(voucher.taxable_base_amount, voucher.currency === "VES" ? "USD" : voucher.currency)}
                    </td>
                    <td className="p-2 border-r border-neutral-200 text-right">{voucher.iva_rate_percent}%</td>
                    <td className="p-2 border-r border-neutral-200 text-right font-mono">
                      {formatCurrency(voucher.iva_total_amount, voucher.currency === "VES" ? "USD" : voucher.currency)}
                    </td>
                    <td className="p-2 border-r border-neutral-200 text-right font-bold">{voucher.retention_rate_percent}%</td>
                    <td className="p-2 text-right font-mono font-black text-purple-900 bg-purple-50">
                      {formatCurrency(voucher.retained_amount, voucher.currency === "VES" ? "USD" : voucher.currency)}
                    </td>
                  </tr>

                  {/* Equivalent in Bolívares if exchange rate applies */}
                  {voucher.retained_amount_ves && voucher.exchange_rate_applied && (
                    <tr className="bg-neutral-50 text-[10px] text-neutral-600 font-mono">
                      <td colSpan={3} className="p-2 border-r border-neutral-200 font-sans italic">
                        Equivalente en Bs. (Tasa oficial: Bs. {voucher.exchange_rate_applied.toFixed(2)})
                      </td>
                      <td className="p-2 border-r border-neutral-200 text-right">
                        Bs. {(voucher.invoice_total_amount * voucher.exchange_rate_applied).toFixed(2)}
                      </td>
                      <td className="p-2 border-r border-neutral-200 text-right">
                        Bs. {(voucher.taxable_base_amount * voucher.exchange_rate_applied).toFixed(2)}
                      </td>
                      <td className="p-2 border-r border-neutral-200 text-right">-</td>
                      <td className="p-2 border-r border-neutral-200 text-right">
                        Bs. {(voucher.iva_total_amount * voucher.exchange_rate_applied).toFixed(2)}
                      </td>
                      <td className="p-2 border-r border-neutral-200 text-right">-</td>
                      <td className="p-2 text-right font-bold text-neutral-900">
                        Bs. {voucher.retained_amount_ves.toFixed(2)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Highlight */}
            <div className="flex justify-end mb-6">
              <div className="w-64 border border-neutral-400 bg-neutral-100 p-3 rounded text-right space-y-1">
                <div className="text-[11px] text-neutral-700 font-bold uppercase">
                  TOTAL IMPUESTO RETENIDO:
                </div>
                <div className="text-base font-black text-purple-950 font-mono">
                  {formatCurrency(voucher.retained_amount, voucher.currency === "VES" ? "USD" : voucher.currency)}
                </div>
                {voucher.retained_amount_ves && (
                  <div className="text-xs font-bold text-neutral-800 font-mono">
                    Bs. {voucher.retained_amount_ves.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* Legal Legend */}
            <div className="text-[9px] text-neutral-600 border border-neutral-300 p-2.5 rounded bg-neutral-50 leading-relaxed mb-12">
              <p><strong>DECLARACIÓN LEGAL:</strong> {voucher.legal_legend}</p>
            </div>

            {/* Signatures Row */}
            <div className="grid grid-cols-2 gap-12 pt-8 border-t border-neutral-300 text-center text-xs">
              <div>
                <div className="border-t border-neutral-500 w-48 mx-auto mb-1"></div>
                <p className="font-bold text-neutral-900">{voucher.agent_business_name}</p>
                <p className="text-[10px] text-neutral-600">Firma y Sello del Agente de Retención</p>
              </div>
              <div>
                <div className="border-t border-neutral-500 w-48 mx-auto mb-1"></div>
                <p className="font-bold text-neutral-900">{voucher.supplier_name}</p>
                <p className="text-[10px] text-neutral-600">Firma del Proveedor / Fecha de Recepción</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
