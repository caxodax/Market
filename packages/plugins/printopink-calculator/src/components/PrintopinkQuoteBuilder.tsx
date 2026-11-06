"use client";

import React, { useState } from "react";
import type {
  PrintopinkQuote,
  CreatePrintopinkQuoteInput,
  PrintopinkQuoteStatus,
} from "@marketos/types";
import {
  calculateQuoteDeposit,
  convertBimonetary,
  formatPrintopinkWhatsAppQuote,
} from "../services/pricing-engine";
import {
  Share2,
  Copy,
  Check,
  Plus,
  Trash2,
  Phone,
  User,
  Clock,
  Sparkles,
  DollarSign,
  FileText,
} from "lucide-react";

export interface PrintopinkQuoteBuilderProps {
  tenantId: string;
  quotes: PrintopinkQuote[];
  onCreateQuote: (payload: CreatePrintopinkQuoteInput) => Promise<boolean>;
  onUpdateQuoteStatus?: (quoteId: string, status: PrintopinkQuoteStatus) => Promise<boolean>;
  pendingQuoteItem?: { title: string; unitPriceBase: number; quantity: number } | null;
  currencySymbol?: string;
  exchangeRate?: number;
  storeName?: string;
}

export function PrintopinkQuoteBuilder({
  tenantId,
  quotes,
  onCreateQuote,
  onUpdateQuoteStatus,
  pendingQuoteItem,
  currencySymbol = "$",
  exchangeRate = 1,
  storeName = "PrintoPink Taller Creativo",
}: PrintopinkQuoteBuilderProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [depositPct, setDepositPct] = useState(50);
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<
    { title: string; unitPriceBase: number; quantity: number }[]
  >(() => {
    if (pendingQuoteItem) {
      return [{ ...pendingQuoteItem }];
    }
    return [
      {
        title: "Etiquetas Adhesivas Fotográficas A4",
        unitPriceBase: 1.8,
        quantity: 10,
      },
    ];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Cálculos reactivos de la cotización
  const totalBase = items.reduce((acc, it) => acc + it.unitPriceBase * it.quantity, 0);
  const { depositRequiredBase, pendingBalanceBase } = calculateQuoteDeposit(totalBase, depositPct);

  const totalVes = convertBimonetary(totalBase, exchangeRate);
  const depositVes = convertBimonetary(depositRequiredBase, exchangeRate);
  const pendingVes = convertBimonetary(pendingBalanceBase, exchangeRate);

  const formattedItemsForQuote = items.map((it) => ({
    title: it.title,
    unitPriceBase: it.unitPriceBase,
    quantity: it.quantity,
    subtotalBase: Math.round(it.unitPriceBase * it.quantity * 100) / 100,
  }));

  const whatsAppMessage = formatPrintopinkWhatsAppQuote({
    storeName,
    quoteNumber: "PP-BORRADOR",
    customerName,
    items: formattedItemsForQuote,
    totalBase,
    depositRequiredBase,
    pendingBalanceBase,
    exchangeRate,
  });

  // Manejadores de ítems
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        title: "Nuevo Trabajo de Taller",
        unitPriceBase: 5.0,
        quantity: 1,
      },
    ]);
  };

  const handleUpdateItem = (
    index: number,
    field: "title" | "unitPriceBase" | "quantity",
    value: any
  ) => {
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, [field]: value } : it))
    );
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Copiar al portapapeles
  const handleCopy = () => {
    navigator.clipboard.writeText(whatsAppMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Abrir WhatsApp Web / App
  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(whatsAppMessage);
    const cleanPhone = customerPhone.replace(/\D/g, "");
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  // Guardar Cotización Oficial
  const handleSaveQuote = async () => {
    if (items.length === 0) return;
    setIsSubmitting(true);

    try {
      const payload: CreatePrintopinkQuoteInput = {
        tenantId,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        depositPercentage: depositPct,
        items: items.map((it) => ({
          title: it.title.trim(),
          unitPriceBase: it.unitPriceBase,
          quantity: it.quantity,
        })),
        notes: notes.trim() || undefined,
      };

      await onCreateQuote(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. LAYOUT SIMÉTRICO 50% / 50%: FORMULARIO VS ESPEJO WHATSAPP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* COLUMNA IZQUIERDA (50%): ARMADOR DE COTIZACIÓN */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">
                Cotizador Rápido de Taller
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg">
              {items.length} {items.length === 1 ? "producto" : "productos"}
            </span>
          </div>

          {/* Datos del Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Cliente:</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ej: María Gómez"
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-semibold outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <span>WhatsApp (opcional):</span>
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Ej: 584121234567"
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-semibold outline-none font-mono"
              />
            </div>
          </div>

          {/* Lista de Trabajos / Productos en Cotización */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                Productos / Trabajos a Incluir:
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Agregar Trabajo</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl border border-border bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <input
                    type="text"
                    value={it.title}
                    onChange={(e) => handleUpdateItem(idx, "title", e.target.value)}
                    placeholder="Descripción del trabajo..."
                    className="font-bold text-foreground bg-transparent outline-none flex-1 min-w-0 px-1"
                  />

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">$</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={it.unitPriceBase}
                        onChange={(e) =>
                          handleUpdateItem(idx, "unitPriceBase", parseFloat(e.target.value) || 0)
                        }
                        className="w-16 h-7 px-1.5 rounded-lg border border-border bg-muted/30 text-center font-bold text-foreground font-mono"
                        title="Precio unitario"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">x</span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={it.quantity}
                        onChange={(e) =>
                          handleUpdateItem(idx, "quantity", parseInt(e.target.value) || 1)
                        }
                        className="w-12 h-7 px-1 rounded-lg border border-border bg-muted/30 text-center font-bold text-foreground font-mono"
                        title="Cantidad"
                      />
                    </div>

                    <span className="font-mono font-bold text-foreground min-w-[55px] text-right">
                      ${(it.unitPriceBase * it.quantity).toFixed(2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 text-muted-foreground hover:text-rose-500 rounded-md transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resumen del Anticipo del 50% */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase font-bold text-amber-700 dark:text-amber-300 block">
                  Anticipo Requerido ({depositPct}%)
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  ${depositRequiredBase.toFixed(2)} USD
                </span>
                <span className="text-xs text-amber-700 dark:text-amber-300 font-mono block">
                  (Bs. {depositVes.toFixed(2)})
                </span>
              </div>

              <div className="text-right">
                <span className="text-[11px] uppercase font-bold text-muted-foreground block">
                  Total de la Orden
                </span>
                <span className="text-lg font-black text-foreground font-mono">
                  ${totalBase.toFixed(2)} USD
                </span>
                <span className="text-xs text-muted-foreground font-mono block">
                  Saldo: ${pendingBalanceBase.toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-[11px] font-medium text-amber-800 dark:text-amber-200">
              🔒 Regla de taller: No se compran insumos ni se aparta cupo en maquinaria sin la
              confirmación del abono del 50%.
            </p>
          </div>

          {/* Botón de Guardar Registro */}
          <button
            type="button"
            onClick={handleSaveQuote}
            disabled={isSubmitting || items.length === 0}
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>{isSubmitting ? "Guardando..." : "Guardar Presupuesto en Historial"}</span>
          </button>
        </div>

        {/* COLUMNA DERECHA (50%): ESPEJO EN VIVO DE WHATSAPP */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-emerald-500" />
              <h3 className="text-base font-bold text-foreground">
                Espejo de WhatsApp (Mensaje Listo)
              </h3>
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
              Formato WhatsApp
            </span>
          </div>

          {/* Caja con estilo de chat de WhatsApp */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border font-mono text-xs whitespace-pre-wrap leading-relaxed text-foreground max-h-[460px] overflow-y-auto">
            {whatsAppMessage}
          </div>

          {/* Botones de Envío / Copia Rápida */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 h-11 px-4 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>¡Mensaje Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Mensaje</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="flex-1 h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <Share2 className="w-4 h-4" />
              <span>Enviar por WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. HISTORIAL DE PRESUPUESTOS RECIENTES */}
      {quotes.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>Historial de Cotizaciones Recientes ({quotes.length})</span>
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">N° Cotización</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Total</th>
                  <th className="py-2.5 px-3">Anticipo (50%)</th>
                  <th className="py-2.5 px-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-muted/30 transition">
                    <td className="py-3 px-3 font-mono font-bold text-foreground">
                      {q.quote_number}
                    </td>
                    <td className="py-3 px-3 text-foreground">
                      {q.customer_name || "Cliente General"}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-foreground">
                      ${q.total_base.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-amber-600">
                      ${q.deposit_required_base.toFixed(2)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold">
                        {q.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
