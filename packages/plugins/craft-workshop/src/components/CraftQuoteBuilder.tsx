"use client";

import React, { useState, useMemo } from "react";
import type {
  CraftQuote,
  CraftRecipe,
  CraftQuoteItem,
  CreateCraftQuoteInput,
} from "@marketos/types";
import {
  calculateQuoteDeposit,
  convertBimonetary,
} from "../services/craft-pricing-engine";
import {
  formatWhatsAppQuoteMessage,
  buildWhatsAppLink,
} from "../services/quote-sharing";
import {
  MessageSquare,
  Plus,
  Trash2,
  Share2,
  Copy,
  CheckCircle,
  Truck,
  ShoppingCart,
  Send,
  Clock,
  Sparkles,
  Phone,
  User,
  ShieldAlert,
} from "lucide-react";

export interface CraftQuoteBuilderProps {
  tenantId: string;
  recipes: CraftRecipe[];
  quotes: CraftQuote[];
  exchangeRate: number;
  businessName?: string;
  businessPhone?: string;
  currencySymbol?: string;
  initialRecipeForQuote?: CraftRecipe | null;
  onCreateQuote: (input: Omit<CreateCraftQuoteInput, "tenantId">) => Promise<CraftQuote | null>;
  onConvertToOrder: (quoteId: string) => Promise<boolean>;
}

export function CraftQuoteBuilder({
  tenantId,
  recipes,
  quotes,
  exchangeRate,
  businessName = "Printopink Taller Creativo",
  businessPhone = "",
  currencySymbol = "$",
  initialRecipeForQuote,
  onCreateQuote,
  onConvertToOrder,
}: CraftQuoteBuilderProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingCostBase, setShippingCostBase] = useState<number>(0);
  const [shippingNotes, setShippingNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeQuote, setActiveQuote] = useState<CraftQuote | null>(null);

  // Items de la cotización actual
  const [items, setItems] = useState<CraftQuoteItem[]>(() => {
    if (initialRecipeForQuote) {
      return [
        {
          recipe_id: initialRecipeForQuote.id,
          name: initialRecipeForQuote.name,
          quantity: 1,
          unit_price_base: initialRecipeForQuote.selling_price_base,
          subtotal_base: initialRecipeForQuote.selling_price_base,
          notes: "",
        },
      ];
    }
    return [];
  });

  const handleAddRecipeItem = (recipe: CraftRecipe) => {
    setItems([
      ...items,
      {
        recipe_id: recipe.id,
        name: recipe.name,
        quantity: 1,
        unit_price_base: recipe.selling_price_base,
        subtotal_base: recipe.selling_price_base,
        notes: "",
      },
    ]);
  };

  const handleAddCustomItem = () => {
    setItems([
      ...items,
      {
        name: "Trabajo Especial Personalizado",
        quantity: 1,
        unit_price_base: 5.0,
        subtotal_base: 5.0,
        notes: "",
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof CraftQuoteItem, value: any) => {
    setItems(
      items.map((it, idx) => {
        if (idx !== index) return it;
        const updated = { ...it, [field]: value };
        if (field === "quantity" || field === "unit_price_base") {
          const q = field === "quantity" ? parseInt(value) || 1 : it.quantity;
          const p = field === "unit_price_base" ? parseFloat(value) || 0 : it.unit_price_base;
          updated.subtotal_base = Math.round(q * p * 100) / 100;
        }
        return updated;
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Cálculos matemáticos
  const totals = useMemo(() => {
    const subtotalBase = items.reduce((acc, it) => acc + (it.subtotal_base || 0), 0);
    const totalBase = Math.round((subtotalBase + (shippingCostBase || 0)) * 100) / 100;
    const depositCalc = calculateQuoteDeposit(totalBase, 50.0);
    const totalSec = convertBimonetary(totalBase, exchangeRate);
    const depositRequiredSec = convertBimonetary(depositCalc.depositRequiredBase, exchangeRate);

    return {
      subtotalBase: Math.round(subtotalBase * 100) / 100,
      totalBase,
      totalSec,
      depositRequiredBase: depositCalc.depositRequiredBase,
      depositRequiredSec,
      pendingBalanceBase: depositCalc.pendingBalanceBase,
    };
  }, [items, shippingCostBase, exchangeRate]);

  // Mensaje en vivo de WhatsApp
  const previewMessage = useMemo(() => {
    const mockQuote: CraftQuote = {
      id: "preview",
      tenant_id: tenantId,
      quote_number: activeQuote ? activeQuote.quote_number : "COT-NUEVA",
      customer_name: customerName.trim() || undefined,
      customer_phone: customerPhone.trim() || undefined,
      subtotal_base: totals.subtotalBase,
      shipping_cost_base: shippingCostBase,
      shipping_notes: shippingNotes.trim() || undefined,
      total_base: totals.totalBase,
      exchange_rate_applied: exchangeRate,
      total_secondary: totals.totalSec,
      base_currency: "USD",
      deposit_percentage: 50.0,
      deposit_required_base: totals.depositRequiredBase,
      status: "draft",
      items: items.map((it) => ({
        recipe_id: it.recipe_id,
        name: it.name,
        quantity: it.quantity,
        unit_price_base: it.unit_price_base,
        subtotal_base: it.subtotal_base,
        is_free_item: it.is_free_item || false,
        notes: it.notes,
      })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return formatWhatsAppQuoteMessage({
      quote: mockQuote,
      businessName,
      businessPhone,
      currencySymbol,
    });
  }, [
    tenantId,
    activeQuote,
    customerName,
    customerPhone,
    totals,
    shippingCostBase,
    shippingNotes,
    exchangeRate,
    items,
    businessName,
    businessPhone,
    currencySymbol,
  ]);

  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(previewMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("No se pudo copiar al portapapeles");
    }
  };

  const handleOpenWhatsApp = () => {
    const link = buildWhatsAppLink(customerPhone, previewMessage);
    window.open(link, "_blank");
  };

  const handleSaveQuote = async () => {
    if (items.length === 0) {
      alert("Agrega al menos un producto a la cotización");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await onCreateQuote({
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        shippingCostBase,
        shippingNotes: shippingNotes.trim() || undefined,
        exchangeRateApplied: exchangeRate,
        depositPercentage: 50.0,
        items: items.map((it) => ({
          recipe_id: it.recipe_id || null,
          name: it.name,
          quantity: it.quantity,
          unit_price_base: it.unit_price_base,
          subtotal_base: it.subtotal_base,
          is_free_item: it.is_free_item || false,
          notes: it.notes || undefined,
        })),
      });

      if (created) {
        setActiveQuote(created);
        alert(`¡Cotización ${created.quote_number} registrada con éxito!`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Grid Simétrico 50% / 50%: Formulario (Izquierda) vs Previsualización WhatsApp (Derecha) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* COLUMNA IZQUIERDA (50%): Datos del Pedido */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    1. Datos de la Cotización
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Ingresa el cliente y los trabajos a presupuestar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Ítem Libre</span>
              </button>
            </div>

            {/* Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-primary" />
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej: María Gómez"
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  WhatsApp
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Ej: 04121234567"
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground font-mono text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Items a Cotizar */}
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-xs font-bold text-foreground block">
                Trabajos Incluidos ({items.length})
              </span>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <div className="p-6 border border-dashed border-border rounded-2xl bg-muted/20 text-center space-y-1">
                    <p className="text-xs font-bold text-foreground">Sin productos agregados</p>
                    <p className="text-[11px] text-muted-foreground">
                      Haz clic en las recetas de abajo o añade un ítem libre.
                    </p>
                  </div>
                ) : (
                  items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-muted/30 border border-border space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={it.name}
                          onChange={(e) => handleUpdateItem(idx, "name", e.target.value)}
                          className="text-xs sm:text-sm font-bold text-foreground bg-transparent outline-none flex-1 border-b border-transparent focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-muted-foreground hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Cant:</span>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => handleUpdateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                            className="w-full h-7 px-2 bg-background border border-border rounded font-bold text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Precio ($):</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.unit_price_base}
                            onChange={(e) => handleUpdateItem(idx, "unit_price_base", parseFloat(e.target.value) || 0)}
                            className="w-full h-7 px-2 bg-background border border-border rounded font-bold text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Subtotal:</span>
                          <div className="h-7 px-2 flex items-center bg-card border border-border rounded font-black text-xs font-mono">
                            {currencySymbol}{it.subtotal_base.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Envío */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-foreground flex items-center gap-1">
                  <Truck className="w-3 h-3 text-primary" />
                  Envío / Flete ($)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={shippingCostBase}
                  onChange={(e) => setShippingCostBase(parseFloat(e.target.value) || 0)}
                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-semibold outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-foreground">
                  Lugar de Entrega
                </label>
                <input
                  type="text"
                  value={shippingNotes}
                  onChange={(e) => setShippingNotes(e.target.value)}
                  placeholder="Ej: Retiro en taller / MRW"
                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-semibold outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
          </div>

          {/* Recetas Rápidas */}
          {recipes.length > 0 && (
            <div className="pt-2 border-t border-border space-y-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                + Agregar desde Recetario:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                {recipes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleAddRecipeItem(r)}
                    className="px-2.5 py-1 text-xs bg-muted/60 hover:bg-primary/10 hover:text-primary border border-border rounded-lg text-foreground font-semibold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-primary" />
                    <span>{r.name}</span>
                    <span className="text-muted-foreground font-mono">(${r.selling_price_base.toFixed(2)})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA (50%): Espejo Visual de WhatsApp & Cierre */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    2. Mensaje WhatsApp & Anticipo (50%)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Previsualización idéntica a la que verá tu cliente.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-muted-foreground">
                Tasa: {exchangeRate.toFixed(2)}
              </span>
            </div>

            {/* Resumen 50% Anticipo */}
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Anticipo Requerido (50%):
                </span>
                <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  {currencySymbol}{totals.depositRequiredBase.toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-amber-700/90 dark:text-amber-300/90 flex justify-between font-medium">
                <span>Total General:</span>
                <span className="font-bold font-mono">
                  {currencySymbol}{totals.totalBase.toFixed(2)} (Bs. {totals.totalSec.toFixed(2)})
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground pt-1 border-t border-amber-500/20 flex justify-between">
                <span>Saldo al retirar:</span>
                <span className="font-bold font-mono">{currencySymbol}{totals.pendingBalanceBase.toFixed(2)}</span>
              </div>
            </div>

            {/* Burbuja Espejo de WhatsApp */}
            <div className="rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 p-4 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 block">
                Vista previa del mensaje:
              </span>
              <pre className="text-xs text-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-background/60 p-3 rounded-xl border border-emerald-500/20">
                {previewMessage}
              </pre>
            </div>
          </div>

          {/* Acciones de WhatsApp */}
          <div className="space-y-2.5 pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <Send className="w-4 h-4" />
              <span>Abrir & Enviar por WhatsApp</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="h-10 bg-muted/60 hover:bg-muted text-foreground font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-border"
              >
                {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "¡Copiado!" : "Copiar Texto"}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveQuote}
                disabled={isSubmitting}
                className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Guardando..." : "Guardar Presupuesto"}</span>
              </button>
            </div>

            {activeQuote && activeQuote.status !== "converted_to_order" && (
              <button
                type="button"
                onClick={async () => {
                  if (confirm("¿Confirmar abono del 50% y generar Orden de Taller?")) {
                    await onConvertToOrder(activeQuote.id);
                  }
                }}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Convertir a Pedido Oficial</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Historial de Cotizaciones Recientes */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span>Historial de Presupuestos Recientes ({quotes.length})</span>
        </h3>

        {quotes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Aún no hay cotizaciones registradas en este comercio.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-bold uppercase text-[11px]">
                  <th className="py-2.5 px-3">N° Cotización</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Total</th>
                  <th className="py-2.5 px-3">Anticipo (50%)</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium">
                {quotes.map((q) => {
                  const isConverted = q.status === "converted_to_order";
                  return (
                    <tr key={q.id} className="hover:bg-muted/30 transition">
                      <td className="py-3 px-3 font-bold text-foreground font-mono">
                        {q.quote_number}
                      </td>
                      <td className="py-3 px-3 text-foreground">
                        {q.customer_name || "Cliente General"}
                        {q.customer_phone && (
                          <span className="block text-[11px] text-muted-foreground font-mono">{q.customer_phone}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-bold text-foreground font-mono">
                        {currencySymbol}{q.total_base.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-bold text-amber-600 font-mono">
                        {currencySymbol}{q.deposit_required_base.toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        {isConverted ? (
                          <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold rounded-full">
                            Orden Creada
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-muted text-muted-foreground text-[10px] font-bold rounded-full">
                            Pendiente Abono
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveQuote(q);
                            setCustomerName(q.customer_name || "");
                            setCustomerPhone(q.customer_phone || "");
                          }}
                          className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          Cargar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
