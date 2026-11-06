"use client";

import React, { useState } from "react";
import type { PrintopinkCalculation } from "@marketos/types";
import { convertBimonetary } from "../services/pricing-engine";
import {
  Search,
  Calculator,
  Trash2,
  DollarSign,
  TrendingUp,
  Tag,
  Wrench,
  Layers,
  Send,
} from "lucide-react";

export interface PrintopinkCatalogViewProps {
  tenantId: string;
  calculations: PrintopinkCalculation[];
  onSelectCalculation: (calc: PrintopinkCalculation) => void;
  onDeleteCalculation: (id: string) => Promise<boolean>;
  onSendToQuote?: (calc: PrintopinkCalculation) => void;
  currencySymbol?: string;
  exchangeRate?: number;
}

export function PrintopinkCatalogView({
  tenantId,
  calculations,
  onSelectCalculation,
  onDeleteCalculation,
  onSendToQuote,
  currencySymbol = "$",
  exchangeRate = 1,
}: PrintopinkCatalogViewProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = calculations.filter((c) =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Barra de Búsqueda & Métricas */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar ficha técnica de taller..."
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-border bg-background text-foreground text-xs font-semibold outline-none"
          />
        </div>

        <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-xl border border-border self-start sm:self-auto">
          {filtered.length} {filtered.length === 1 ? "ficha guardada" : "fichas guardadas"}
        </span>
      </div>

      {/* Grid de Fichas Técnicas */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-border bg-card space-y-2">
          <p className="text-sm font-bold text-foreground">No hay fichas guardadas aún</p>
          <p className="text-xs text-muted-foreground">
            Usa la calculadora arriba para diseñar y guardar tus escandallos con la tríada de costos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const priceVes = convertBimonetary(c.selling_price_base, exchangeRate);
            const profitVes = convertBimonetary(c.net_profit_base, exchangeRate);

            return (
              <div
                key={c.id}
                className="rounded-3xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-primary/40 transition group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">
                        {c.preset_category}
                      </span>
                      <h4 className="text-sm font-bold text-foreground line-clamp-2">
                        {c.title}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Eliminar la ficha "${c.title}"?`)) {
                          onDeleteCalculation(c.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                      title="Eliminar ficha"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Tríada de Costos en Ficha */}
                  <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 text-xs space-y-1 font-mono">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Materiales:</span>
                      <span className="font-bold">${c.materials_cost_base.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Máquinas + Luz:</span>
                      <span className="font-bold">${c.machinery_cost_base.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-indigo-600 dark:text-indigo-400">
                      <span>Mano de Obra (Sueldo):</span>
                      <span className="font-bold">${c.labor_cost_base.toFixed(2)}</span>
                    </div>
                    <div className="pt-1 border-t border-border/60 flex justify-between font-bold text-foreground">
                      <span>Costo Total:</span>
                      <span>${c.total_cost_base.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Precios y Ganancia */}
                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        PVP Sugerido
                      </span>
                      <span className="text-xl font-black text-foreground font-mono">
                        ${c.selling_price_base.toFixed(2)}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono block">
                        (Bs. {priceVes.toFixed(2)})
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                        Ganancia Neta
                      </span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono block">
                        +${c.net_profit_base.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">
                        {c.margin_percentage}% margen libre
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="pt-3 border-t border-border flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectCalculation(c)}
                    className="flex-1 h-9 px-3 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Cargar</span>
                  </button>

                  {onSendToQuote && (
                    <button
                      type="button"
                      onClick={() => onSendToQuote(c)}
                      className="h-9 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Agregar a Cotizador WhatsApp"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Cotizar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
