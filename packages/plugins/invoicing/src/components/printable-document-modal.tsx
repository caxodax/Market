"use client";

import React, { useState } from "react";
import type { FiscalDocument } from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import {
  Printer,
  X,
  FileText,
  Truck,
  RotateCcw,
  CheckCircle2,
  QrCode,
  Building2,
  User,
  ShieldCheck,
  Receipt,
  LayoutTemplate,
} from "lucide-react";

export interface PrintableDocumentModalProps {
  document: FiscalDocument | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PrintableDocumentModal({
  document: doc,
  isOpen,
  onClose,
}: PrintableDocumentModalProps) {
  const [formatMode, setFormatMode] = useState<"LETTER" | "THERMAL">("LETTER");

  if (!isOpen || !doc) return null;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const isDispatchOrDelivery =
    doc.document_type === "DISPATCH_GUIDE" || doc.document_type === "DELIVERY_NOTE";
  const isCreditNote = doc.document_type === "CREDIT_NOTE";
  const isDebitNote = doc.document_type === "DEBIT_NOTE";

  const getDocTypeBadge = () => {
    switch (doc.document_type) {
      case "INVOICE":
        return { label: "FACTURA DE VENTA", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
      case "CREDIT_NOTE":
        return { label: "NOTA DE CRÉDITO", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" };
      case "DEBIT_NOTE":
        return { label: "NOTA DE DÉBITO", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
      case "DISPATCH_GUIDE":
        return { label: "GUÍA DE DESPACHO EN TRÁNSITO", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
      case "DELIVERY_NOTE":
        return { label: "ORDEN / COMPROBANTE DE ENTREGA", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" };
      default:
        return { label: "DOCUMENTO FISCAL", color: "bg-muted text-muted-foreground border-border" };
    }
  };

  const badge = getDocTypeBadge();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador e Impresión de Documento Fiscal"
    >
      <div className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header & Controls Toolbar (Hidden in Print) */}
        <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">{doc.document_number}</h3>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                Control: {doc.control_number || "S/N"} • {new Date(doc.created_at).toLocaleString("es-ES")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format Switcher */}
            <div className="inline-flex items-center bg-background border border-border p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFormatMode("LETTER")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  formatMode === "LETTER" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Carta / A4
              </button>
              <button
                type="button"
                onClick={() => setFormatMode("THERMAL")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  formatMode === "THERMAL" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Ticket 80mm
              </button>
            </div>

            {/* Print button */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-transform active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Paper Container */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-muted/20 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          {formatMode === "LETTER" ? (
            /* ══════════════════════════════════════════════════════════════════
               1. FORMATO HOJA COMPLETA (CARTA / A4)
               ══════════════════════════════════════════════════════════════════ */
            <div className="w-full max-w-[780px] bg-background border border-border/80 shadow-md rounded-2xl p-6 sm:p-8 space-y-6 text-foreground print:shadow-none print:border-none print:p-0 print:max-w-none">
              {/* Header Box: Emitter and Document ID */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-border">
                <div className="space-y-1">
                  <h1 className="text-xl font-black tracking-tight text-foreground">{doc.emitter_business_name}</h1>
                  <p className="text-xs font-mono font-bold text-primary">ID Fiscal: {doc.emitter_id_doc}</p>
                  <p className="text-xs text-muted-foreground max-w-sm">{doc.emitter_address}</p>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-muted/30 text-right space-y-1 shrink-0 min-w-[220px]">
                  <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.color}`}>
                    {badge.label}
                  </span>
                  <p className="text-base font-mono font-black text-foreground">{doc.document_number}</p>
                  {doc.control_number && (
                    <p className="text-xs font-mono text-muted-foreground">
                      Nº Control: <strong className="text-foreground">{doc.control_number}</strong>
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Fecha: {new Date(doc.created_at).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
              </div>

              {/* Reference Document Note (for Credit and Debit Notes) */}
              {(isCreditNote || isDebitNote) && doc.affected_document_number && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="font-bold">
                        Modifica a la Factura Nº: <span className="font-mono">{doc.affected_document_number}</span>
                      </p>
                      {doc.reason && <p className="text-[11px] opacity-90">Motivo: {doc.reason}</p>}
                    </div>
                  </div>
                  {doc.return_items_to_inventory && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
                      ✓ Mercancía Repuesta en Inventario
                    </span>
                  )}
                </div>
              )}

              {/* Customer Box & Transport Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Data */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-1.5 text-xs">
                  <p className="font-bold text-foreground flex items-center gap-1.5 border-b border-border pb-1">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>Datos del Cliente / Receptor</span>
                  </p>
                  <p className="text-xs font-bold text-foreground pt-0.5">{doc.customer_name}</p>
                  <p className="font-mono text-muted-foreground">Doc. / RIF / RUT: <strong className="text-foreground">{doc.customer_id_doc}</strong></p>
                  {doc.customer_phone && <p className="text-muted-foreground">Teléfono: {doc.customer_phone}</p>}
                  {doc.customer_address && <p className="text-muted-foreground">Dirección: {doc.customer_address}</p>}
                </div>

                {/* Transport & Dispatch Data (For Guía de Despacho / Delivery) */}
                {isDispatchOrDelivery && (
                  <div className="p-4 rounded-xl border border-border bg-card space-y-1.5 text-xs">
                    <p className="font-bold text-foreground flex items-center gap-1.5 border-b border-border pb-1">
                      <Truck className="w-3.5 h-3.5 text-primary" />
                      <span>Datos del Traslado & Conductor</span>
                    </p>
                    <p className="text-xs font-bold text-foreground pt-0.5">
                      Conductor: {doc.transport_info?.driver_name || "Transportista Asignado"}
                    </p>
                    <p className="font-mono text-muted-foreground">
                      Cédula / RUT: {doc.transport_info?.driver_id_doc || "N/A"} • Tel: {doc.transport_info?.driver_phone || "N/A"}
                    </p>
                    <p className="font-mono text-muted-foreground">
                      Vehículo: {doc.transport_info?.vehicle_model || "Vehículo de Carga"} • Placa: <strong className="text-foreground">{doc.transport_info?.vehicle_plate || "N/A"}</strong>
                    </p>
                    {doc.transport_info?.packages_count && (
                      <p className="text-muted-foreground">Bultos / Paquetes: {doc.transport_info.packages_count}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border text-muted-foreground font-bold">
                      <th className="p-3 w-12 text-center">Cant.</th>
                      <th className="p-3">Descripción de la Mercancía</th>
                      <th className="p-3 text-right">Precio Unitario</th>
                      <th className="p-3 text-center">Alicuota</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {doc.items.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-muted/20">
                        <td className="p-3 text-center font-mono font-bold text-foreground">{it.quantity}</td>
                        <td className="p-3 font-medium text-foreground">{it.name}</td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          {formatCurrency(it.unit_price, doc.currency === "VES" ? "USD" : doc.currency)}
                        </td>
                        <td className="p-3 text-center font-mono text-[11px] text-muted-foreground">
                          {it.is_exempt ? "Exento (0%)" : `${it.tax_rate_percent || doc.iva_rate_percent}%`}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-foreground">
                          {formatCurrency(it.total_price, doc.currency === "VES" ? "USD" : doc.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Breakdown & Totals */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
                <div className="space-y-2 text-xs text-muted-foreground max-w-sm">
                  {doc.legal_legend && (
                    <p className="italic leading-relaxed border-l-2 border-primary/40 pl-2.5">
                      {doc.legal_legend}
                    </p>
                  )}
                  {doc.qr_data && (
                    <div className="flex items-center gap-2 pt-2">
                      <div className="w-14 h-14 rounded-lg border border-border bg-white p-1 flex items-center justify-center shrink-0">
                        <QrCode className="w-12 h-12 text-black" />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {doc.pac_certification
                          ? "Certificación Fiscal SENIAT / Imprenta Digital Autorizada"
                          : "Validación y Timbrado Digital CUV MarketOS"}
                      </span>
                    </div>
                  )}

                  {doc.pac_certification && (
                    <div className="mt-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>EMISIÓN DIGITAL CERTIFICADA (Providencia SNAT/00093)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-mono">
                        <div>
                          <span className="text-foreground font-semibold">Imprenta Digital:</span> {doc.pac_certification.provider}
                        </div>
                        <div>
                          <span className="text-foreground font-semibold">Autorización:</span> {doc.pac_certification.authorization_number || "SNAT/00093"}
                        </div>
                        <div>
                          <span className="text-foreground font-semibold">Nº Control:</span> {doc.pac_certification.control_number}
                        </div>
                        <div>
                          <span className="text-foreground font-semibold">Fecha Timbrado:</span> {new Date(doc.pac_certification.certified_at).toLocaleString("es-ES")}
                        </div>
                      </div>
                      <div className="pt-1 border-t border-emerald-500/20 text-[9px] font-mono text-muted-foreground break-all">
                        <span className="text-foreground font-semibold">Sello Digital:</span> {doc.pac_certification.digital_seal}
                      </div>
                      {doc.pac_certification.qr_url && (
                        <div className="pt-0.5 text-[9px] text-emerald-600 truncate">
                          <span>Verificación SENIAT: </span>
                          <a
                            href={doc.pac_certification.qr_url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline font-mono"
                          >
                            {doc.pac_certification.qr_url}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="w-full sm:w-72 p-4 rounded-xl border border-border bg-muted/20 space-y-1.5 text-xs shrink-0">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Base Exenta:</span>
                    <span className="font-mono text-foreground font-semibold">
                      {formatCurrency(doc.subtotal_exempt, doc.currency === "VES" ? "USD" : doc.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Base Imponible:</span>
                    <span className="font-mono text-foreground font-semibold">
                      {formatCurrency(doc.subtotal_taxable, doc.currency === "VES" ? "USD" : doc.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>IVA ({doc.iva_rate_percent}%):</span>
                    <span className="font-mono text-foreground font-semibold">
                      {formatCurrency(doc.iva_amount, doc.currency === "VES" ? "USD" : doc.currency)}
                    </span>
                  </div>
                  {doc.igtf_amount && doc.igtf_amount > 0 ? (
                    <div className="flex justify-between text-amber-600 font-semibold">
                      <span>IGTF (3%):</span>
                      <span className="font-mono">
                        {formatCurrency(doc.igtf_amount, doc.currency === "VES" ? "USD" : doc.currency)}
                      </span>
                    </div>
                  ) : null}

                  <div className="border-t border-border pt-2 mt-2 flex justify-between items-baseline font-black">
                    <span className="text-sm text-foreground">TOTAL:</span>
                    <span className="text-base text-primary font-mono">
                      {formatCurrency(doc.total_amount, doc.currency === "VES" ? "USD" : doc.currency)}
                    </span>
                  </div>

                  {doc.total_ves && doc.total_ves > 0 && (
                    <div className="flex justify-between items-baseline text-xs font-mono text-muted-foreground pt-0.5">
                      <span>Total en Bolívares:</span>
                      <span className="font-bold text-foreground">
                        Bs. {doc.total_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Signature Footers for Dispatch and Reception */}
              {isDispatchOrDelivery && (
                <div className="grid grid-cols-2 gap-8 pt-10 text-center text-xs text-muted-foreground">
                  <div className="border-t border-border pt-2 space-y-1">
                    <p className="font-bold text-foreground">Despachado por (Firma / Sello)</p>
                    <p className="text-[10px]">Almacén / Centro de Distribución</p>
                  </div>
                  <div className="border-t border-border pt-2 space-y-1">
                    <p className="font-bold text-foreground">Recibido Conforme (Firma y C.I. / RUT)</p>
                    <p className="text-[10px]">Cliente / Receptor Final</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════════════
               2. FORMATO TICKET TÉRMICO (80MM)
               ══════════════════════════════════════════════════════════════════ */
            <div className="w-[340px] bg-white text-black p-5 font-mono text-xs shadow-md border border-neutral-300 rounded-lg space-y-3 print:shadow-none print:border-none print:p-0">
              {/* Thermal Header */}
              <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-black">
                <h2 className="text-sm font-black uppercase tracking-tight">{doc.emitter_business_name}</h2>
                <p className="text-[11px] font-bold">ID: {doc.emitter_id_doc}</p>
                <p className="text-[10px] leading-tight text-neutral-700">{doc.emitter_address}</p>
                <div className="pt-1.5">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-black border border-black uppercase">
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs font-black pt-1">{doc.document_number}</p>
                {doc.control_number && <p className="text-[10px]">Nº Control: {doc.control_number}</p>}
                <p className="text-[10px] text-neutral-600">
                  {new Date(doc.created_at).toLocaleString("es-ES")}
                </p>
              </div>

              {/* Reference */}
              {(isCreditNote || isDebitNote) && doc.affected_document_number && (
                <div className="text-[10px] pb-2 border-b border-dashed border-black">
                  <p className="font-bold">Afecta Factura: {doc.affected_document_number}</p>
                  {doc.reason && <p>Motivo: {doc.reason}</p>}
                </div>
              )}

              {/* Client */}
              <div className="text-[10px] space-y-0.5 pb-2 border-b border-dashed border-black">
                <p><strong>Cliente:</strong> {doc.customer_name}</p>
                <p><strong>Doc:</strong> {doc.customer_id_doc}</p>
                {doc.customer_phone && <p><strong>Tel:</strong> {doc.customer_phone}</p>}
                {doc.customer_address && <p><strong>Dir:</strong> {doc.customer_address}</p>}
              </div>

              {/* Transport info for thermal */}
              {isDispatchOrDelivery && doc.transport_info && (
                <div className="text-[10px] space-y-0.5 pb-2 border-b border-dashed border-black">
                  <p><strong>Chofer:</strong> {doc.transport_info.driver_name || "N/A"}</p>
                  <p><strong>Placa:</strong> {doc.transport_info.vehicle_plate || "N/A"}</p>
                </div>
              )}

              {/* Items Lines */}
              <div className="space-y-1.5 pb-2 border-b border-dashed border-black">
                {doc.items.map((it, idx) => (
                  <div key={it.id || idx} className="flex justify-between text-[11px]">
                    <div className="min-w-0 pr-1">
                      <p className="font-bold truncate">{it.quantity}x {it.name}</p>
                      <p className="text-[9px] text-neutral-600">
                        @{formatCurrency(it.unit_price, doc.currency === "VES" ? "USD" : doc.currency)}
                      </p>
                    </div>
                    <span className="font-bold shrink-0">
                      {formatCurrency(it.total_price, doc.currency === "VES" ? "USD" : doc.currency)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 text-right text-[11px] pb-2 border-b border-dashed border-black">
                <div className="flex justify-between">
                  <span>Subtotal Exento:</span>
                  <span>{formatCurrency(doc.subtotal_exempt, doc.currency === "VES" ? "USD" : doc.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Base Imponible:</span>
                  <span>{formatCurrency(doc.subtotal_taxable, doc.currency === "VES" ? "USD" : doc.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA ({doc.iva_rate_percent}%):</span>
                  <span>{formatCurrency(doc.iva_amount, doc.currency === "VES" ? "USD" : doc.currency)}</span>
                </div>
                {doc.igtf_amount && doc.igtf_amount > 0 ? (
                  <div className="flex justify-between">
                    <span>IGTF (3%):</span>
                    <span>{formatCurrency(doc.igtf_amount, doc.currency === "VES" ? "USD" : doc.currency)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-xs font-black pt-1 border-t border-black">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(doc.total_amount, doc.currency === "VES" ? "USD" : doc.currency)}</span>
                </div>
                {doc.total_ves && doc.total_ves > 0 && (
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>Bs:</span>
                    <span>Bs. {doc.total_ves.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* PAC Digital Thermal Stamp */}
              {doc.pac_certification && (
                <div className="text-[9px] text-center pt-2 pb-1 border-t border-dashed border-black space-y-0.5">
                  <p className="font-bold">*** EMISIÓN DIGITAL CERTIFICADA ***</p>
                  <p>PAC: {doc.pac_certification.provider}</p>
                  <p>CTRL: {doc.pac_certification.control_number}</p>
                  <p className="break-all font-mono">SELLO: {doc.pac_certification.digital_seal.substring(0, 24)}...</p>
                  <p>AUT: {doc.pac_certification.authorization_number || "SNAT/00093"}</p>
                </div>
              )}

              {/* Thermal Footer */}
              <div className="text-center text-[9px] text-neutral-600 pt-1 space-y-1">
                <p className="leading-tight">{doc.legal_legend}</p>
                <p className="font-bold">¡Gracias por su preferencia!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
