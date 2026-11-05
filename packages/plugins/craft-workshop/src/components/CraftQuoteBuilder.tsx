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
  DollarSign,
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
      quote_number: activeQuote ? activeQuote.quote_number : "COT-PENDIENTE",
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
        alert(`¡Cotización ${created.quote_number} guardada exitosamente!`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Grid Principal: Formulario (Izquierda) + Resumen y WhatsApp (Derecha) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Datos del Cliente & Productos */}
        <div className="lg:col-span-7 rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
                <MessageSquare className="w-6 h-6 text-emerald-500" />
                Generador de Cotizaciones WhatsApp
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                Presupuestos rápidos con 50% de anticipo automático y conversión directa a orden de taller.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddCustomItem}
              className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Ítem Libre</span>
            </button>
          </div>

          {/* Datos del Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                <User className="w-4 h-4 text-primary" />
                Nombre del Cliente
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ej: María Gómez"
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm font-semibold outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-emerald-500" />
                Teléfono / WhatsApp
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Ej: +58 412 1234567"
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground font-mono text-sm font-semibold outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          {/* Renglones Cotizados */}
          <div className="space-y-3 pt-2">
            <label className="text-xs sm:text-sm font-bold text-foreground block">
              Productos y Trabajos Incluidos ({items.length})
            </label>

            {items.length === 0 ? (
              <div className="p-8 border border-dashed border-border rounded-2xl bg-muted/20 text-center space-y-2">
                <ShoppingCart className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-bold text-foreground">
                  No hay productos en la cotización
                </p>
                <p className="text-xs text-muted-foreground">
                  Selecciona una receta del taller abajo o agrega un ítem libre.
                </p>
              </div>
            ) : (
              items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="text"
                      value={it.name}
                      onChange={(e) => handleUpdateItem(idx, "name", e.target.value)}
                      className="text-sm sm:text-base font-bold text-foreground bg-transparent outline-none flex-1 border-b border-transparent focus:border-primary px-1 py-0.5"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer transition"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs sm:text-sm">
                    <div>
                      <span className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Cantidad</span>
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => handleUpdateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                        className="w-full h-10 px-3 bg-background border border-border rounded-lg font-bold text-foreground"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Precio Unitario ($)</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.unit_price_base}
                        onChange={(e) => handleUpdateItem(idx, "unit_price_base", parseFloat(e.target.value) || 0)}
                        className="w-full h-10 px-3 bg-background border border-border rounded-lg font-bold text-foreground"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Subtotal</span>
                      <div className="h-10 px-3 flex items-center bg-card border border-border rounded-lg font-black text-foreground font-mono">
                        {currencySymbol}{it.subtotal_base.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={it.notes || ""}
                      onChange={(e) => handleUpdateItem(idx, "notes", e.target.value)}
                      placeholder="Nota de personalización (ej: Foto de graduación enviada, color dorado)..."
                      className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Opciones de Envío y Flete */}
          <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-primary" />
                Costo de Envío / Flete ($)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={shippingCostBase}
                onChange={(e) => setShippingCostBase(parseFloat(e.target.value) || 0)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm font-semibold outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-foreground">
                Destino / Indicaciones de Entrega
              </label>
              <input
                type="text"
                value={shippingNotes}
                onChange={(e) => setShippingNotes(e.target.value)}
                placeholder="Ej: Retiro en taller / Envío MRW Chacao"
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm font-semibold outline-none placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          {/* Recetario de Taller para Agregar con 1 Clic */}
          {recipes.length > 0 && (
            <div className="pt-3 border-t border-border space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Agregar desde Recetario de Taller:
              </span>
              <div className="flex flex-wrap gap-2">
                {recipes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleAddRecipeItem(r)}
                    className="px-3 py-1.5 text-xs bg-muted/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border rounded-xl text-foreground font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{r.name}</span>
                    <span className="text-muted-foreground font-normal">({currencySymbol}{r.selling_price_base.toFixed(2)})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Columna Derecha: Resumen Financiero con 50% de Anticipo & Previsualización */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card Resumen Financiero (Sin pegote negro) */}
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Resumen de Cotización
              </span>
              <span className="text-xs text-muted-foreground font-mono font-semibold">
                Tasa BCV: {exchangeRate.toFixed(2)} Bs/$
              </span>
            </div>

            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-muted-foreground font-medium">
                <span>Subtotal Trabajos:</span>
                <span className="font-bold text-foreground font-mono">{currencySymbol}{totals.subtotalBase.toFixed(2)}</span>
              </div>
              {shippingCostBase > 0 && (
                <div className="flex justify-between text-muted-foreground font-medium">
                  <span>Envío / Flete:</span>
                  <span className="font-bold text-foreground font-mono">+{currencySymbol}{shippingCostBase.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-border">
                <span className="text-sm font-bold text-foreground">TOTAL GENERAL:</span>
                <div className="text-right">
                  <span className="text-2xl font-black text-foreground tracking-tight font-mono">
                    {currencySymbol}{totals.totalBase.toFixed(2)}
                  </span>
                  <span className="text-xs font-mono font-bold text-muted-foreground block">
                    Bs. {totals.totalSec.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* 🔒 BLOQUE DESTACADO: 50% ANTICIPO OBLIGATORIO */}
            <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Anticipo Requerido (50%):
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  {currencySymbol}{totals.depositRequiredBase.toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-amber-700/90 dark:text-amber-300/90 flex justify-between font-medium">
                <span>Equivalente en Bolívares:</span>
                <span className="font-bold font-mono">Bs. {totals.depositRequiredSec.toFixed(2)}</span>
              </div>
              <div className="text-xs text-muted-foreground pt-1.5 border-t border-amber-500/20 flex justify-between">
                <span>Saldo pendiente contra entrega:</span>
                <span className="font-bold font-mono text-foreground">{currencySymbol}{totals.pendingBalanceBase.toFixed(2)}</span>
              </div>
            </div>

            {/* Acciones de WhatsApp */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <Send className="w-4 h-4" />
                <span>Enviar Cotización por WhatsApp</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="h-11 bg-muted/60 hover:bg-muted text-foreground font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer border border-border"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? "¡Copiado!" : "Copiar Texto"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveQuote}
                  disabled={isSubmitting}
                  className="h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-primary/20"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{isSubmitting ? "Guardando..." : "Guardar Registro"}</span>
                </button>
              </div>

              {/* Botón Convertir a Pedido */}
              {activeQuote && activeQuote.status !== "converted_to_order" && (
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("¿Confirmar recepción del 50% de anticipo y convertir en Orden de Taller?")) {
                      await onConvertToOrder(activeQuote.id);
                    }
                  }}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Convertir a Pedido Oficial de Taller</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Historial de Cotizaciones Recientes */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span>Historial de Presupuestos & Cotizaciones Recientes</span>
        </h3>

        {quotes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Aún no se han generado cotizaciones en este comercio.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-bold uppercase text-[11px]">
                  <th className="py-3 px-3">N° Cotización</th>
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3">Total General</th>
                  <th className="py-3 px-3">Anticipo (50%)</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium">
                {quotes.map((q) => {
                  const isConverted = q.status === "converted_to_order";
                  return (
                    <tr key={q.id} className="hover:bg-muted/40 transition">
                      <td className="py-3.5 px-3 font-bold text-foreground font-mono">
                        {q.quote_number}
                      </td>
                      <td className="py-3.5 px-3 text-foreground">
                        {q.customer_name || "Cliente General"}
                        {q.customer_phone && (
                          <span className="block text-[11px] text-muted-foreground font-mono">{q.customer_phone}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-foreground font-mono">
                        {currencySymbol}{q.total_base.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-amber-600 font-mono">
                        {currencySymbol}{q.deposit_required_base.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3">
                        {isConverted ? (
                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold rounded-full">
                            Convertido a Orden
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-muted text-muted-foreground text-[10px] font-bold rounded-full">
                            Pendiente Anticipo
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveQuote(q);
                            setCustomerName(q.customer_name || "");
                            setCustomerPhone(q.customer_phone || "");
                          }}
                          className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg transition cursor-pointer"
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
