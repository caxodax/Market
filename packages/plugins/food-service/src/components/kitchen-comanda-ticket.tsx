"use client";

import React, { useState, useEffect } from "react";
import {
  KitchenTicket,
  KitchenTicketStatus,
  KitchenTicketItem,
  SelectedModifier,
} from "@marketos/types";
import {
  Clock,
  Printer,
  CheckCircle2,
  ChefHat,
  Flame,
  AlertTriangle,
  ShoppingBag,
  Bike,
  UtensilsCrossed,
  Filter,
} from "lucide-react";

export interface KitchenComandaTicketProps {
  tickets: KitchenTicket[];
  onUpdateStatus: (ticketId: string, nextStatus: KitchenTicketStatus) => Promise<void> | void;
  title?: string;
}

export function KitchenComandaTicket({
  tickets,
  onUpdateStatus,
  title = "Monitor de Cocina (KDS)",
}: KitchenComandaTicketProps) {
  const [filter, setFilter] = useState<"ALL" | KitchenTicketStatus>("ALL");
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Real-time tick every 10 seconds for kitchen timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const filteredTickets = tickets.filter((t) => {
    if (filter === "ALL") return t.status !== "SERVED";
    return t.status === filter;
  });

  const getElapsedMinutes = (createdAt: string) => {
    const start = new Date(createdAt).getTime();
    if (isNaN(start)) return 0;
    return Math.max(0, Math.floor((currentTime - start) / 60000));
  };

  const getUrgencyClasses = (elapsedMinutes: number) => {
    if (elapsedMinutes >= 20) {
      return "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse";
    }
    if (elapsedMinutes >= 12) {
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    }
    return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  };

  const handlePrint = (ticket: KitchenTicket) => {
    const printWindow = window.open("", "_blank", "width=380,height=600");
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comanda #${ticket.order_number}</title>
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          body {
            font-family: monospace, -apple-system, sans-serif;
            font-size: 13px;
            line-height: 1.3;
            color: #000;
            margin: 0;
            padding: 8px;
            max-width: 80mm;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .header { border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
          .title { font-size: 18px; margin: 0; }
          .meta { font-size: 11px; margin-top: 4px; }
          .item-row { margin-bottom: 8px; border-bottom: 1px dotted #ccc; padding-bottom: 6px; }
          .item-name { font-size: 14px; font-weight: bold; }
          .mod-extra { color: #000; margin-left: 8px; font-size: 12px; }
          .mod-sin { font-weight: bold; margin-left: 8px; font-size: 12px; text-decoration: underline; }
          .notes { background: #eee; padding: 4px; font-size: 11px; margin-top: 4px; }
          .footer { text-align: center; margin-top: 12px; font-size: 10px; border-top: 1px dashed #000; padding-top: 6px; }
        </style>
      </head>
      <body>
        <div class="header center">
          <div class="title bold">COMANDA COCINA</div>
          <div style="font-size: 20px; font-weight: 900; margin: 4px 0;">#${ticket.order_number}</div>
          <div class="meta">
            ${ticket.table_number ? `<b>MESA: ${ticket.table_number}</b> | ` : ""}
            <b>${ticket.delivery_type.toUpperCase()}</b>
            <br/>${new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            ${ticket.customer_name ? `<br/>Cliente: ${ticket.customer_name}` : ""}
          </div>
        </div>

        <div class="items">
          ${ticket.items
            .map((item) => {
              const extras = (item.selected_modifiers || []).filter(
                (m) => !m.option_name.toLowerCase().startsWith("sin ")
              );
              const sins = (item.selected_modifiers || [])
                .filter((m) => m.option_name.toLowerCase().startsWith("sin "))
                .map((m) => m.option_name.toUpperCase())
                .concat(item.exclusions || []);

              return `
                <div class="item-row">
                  <div class="item-name">${item.quantity}x ${item.product_name}</div>
                  ${sins.map((s) => `<div class="mod-sin">⚠️ ${s}</div>`).join("")}
                  ${extras.map((e) => `<div class="mod-extra">+ ${e.option_name}</div>`).join("")}
                  ${item.notes ? `<div class="notes">NOTA: ${item.notes}</div>` : ""}
                </div>
              `;
            })
            .join("")}
        </div>

        <div class="footer">
          MarketOS Gastro KDS Engine
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const getNextStatus = (current: KitchenTicketStatus): KitchenTicketStatus | null => {
    if (current === "PENDING") return "PREPARING";
    if (current === "PREPARING") return "READY";
    if (current === "READY") return "SERVED";
    return null;
  };

  const getNextStatusLabel = (current: KitchenTicketStatus): string => {
    if (current === "PENDING") return "Iniciar Preparación";
    if (current === "PREPARING") return "Marcar como Listo";
    if (current === "READY") return "Despachado";
    return "Completado";
  };

  const pendingCount = tickets.filter((t) => t.status === "PENDING").length;
  const preparingCount = tickets.filter((t) => t.status === "PREPARING").length;
  const readyCount = tickets.filter((t) => t.status === "READY").length;

  return (
    <div className="space-y-6">
      {/* KDS Header & Filter Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              {title}
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                {filteredTickets.length} activas
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Control de comanda en tiempo real con alertas de modificación e ingredientes críticos
            </p>
          </div>
        </div>

        {/* Status Pill Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              filter === "ALL"
                ? "bg-zinc-100 text-zinc-900 border-white shadow-sm"
                : "bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-white"
            }`}
          >
            Activas ({tickets.filter((t) => t.status !== "SERVED").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("PENDING")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all ${
              filter === "PENDING"
                ? "bg-rose-500 text-white border-rose-400 shadow-sm"
                : "bg-zinc-800/80 text-rose-400 border-zinc-700 hover:border-rose-500/40"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            En Espera ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("PREPARING")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all ${
              filter === "PREPARING"
                ? "bg-amber-500 text-zinc-950 border-amber-400 font-bold shadow-sm"
                : "bg-zinc-800/80 text-amber-400 border-zinc-700 hover:border-amber-500/40"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            En Plancha ({preparingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("READY")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all ${
              filter === "READY"
                ? "bg-emerald-500 text-white border-emerald-400 shadow-sm"
                : "bg-zinc-800/80 text-emerald-400 border-zinc-700 hover:border-emerald-500/40"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Listos ({readyCount})
          </button>
        </div>
      </div>

      {/* Tickets Grid */}
      {filteredTickets.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto text-zinc-500 mb-3">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-zinc-300">Cocina al día</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            No hay comandas pendientes bajo el filtro seleccionado. Las nuevas órdenes aparecerán automáticamente aquí.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTickets.map((ticket) => {
            const elapsed = getElapsedMinutes(ticket.created_at);
            const urgencyClass = getUrgencyClasses(elapsed);
            const nextStatus = getNextStatus(ticket.status);

            return (
              <div
                key={ticket.id}
                className={`flex flex-col bg-zinc-900 border rounded-2xl overflow-hidden shadow-lg transition-all ${
                  ticket.status === "PENDING"
                    ? "border-rose-500/30 ring-1 ring-rose-500/20"
                    : ticket.status === "PREPARING"
                    ? "border-amber-500/40 ring-1 ring-amber-500/20"
                    : "border-emerald-500/30"
                }`}
              >
                {/* Ticket Top Bar */}
                <div className="p-3.5 bg-zinc-950/60 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-white font-mono">
                      #{ticket.order_number}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        ticket.delivery_type === "dine_in"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : ticket.delivery_type === "pickup"
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {ticket.table_number
                        ? `MESA ${ticket.table_number}`
                        : ticket.delivery_type === "dine_in"
                        ? "EN SALA"
                        : ticket.delivery_type === "pickup"
                        ? "RETIRAR"
                        : "DELIVERY"}
                    </span>
                  </div>

                  {/* Timer Badge */}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold ${urgencyClass}`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{elapsed}m</span>
                  </div>
                </div>

                {/* Customer / Service Meta */}
                {ticket.customer_name && (
                  <div className="px-3.5 py-1.5 bg-zinc-900/80 border-b border-zinc-800/60 text-[11px] text-zinc-400 truncate">
                    Cliente: <span className="text-zinc-200 font-medium">{ticket.customer_name}</span>
                  </div>
                )}

                {/* Items List */}
                <div className="p-3.5 space-y-3 flex-1 overflow-y-auto max-h-[380px]">
                  {ticket.items.map((item, idx) => {
                    const extras = (item.selected_modifiers || []).filter(
                      (m) => !m.option_name.toLowerCase().startsWith("sin ")
                    );
                    const exclusions = (item.selected_modifiers || [])
                      .filter((m) => m.option_name.toLowerCase().startsWith("sin "))
                      .map((m) => m.option_name.toUpperCase())
                      .concat(item.exclusions || []);

                    return (
                      <div
                        key={item.id || idx}
                        className="p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-800/80 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-bold text-white leading-tight">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono text-xs mr-1.5">
                              {item.quantity}x
                            </span>
                            {item.product_name}
                          </span>
                        </div>

                        {/* Critical Exclusions (Red High-Alert) */}
                        {exclusions.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {exclusions.map((sin, sIdx) => (
                              <span
                                key={sIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-600 text-white shadow-sm tracking-wide"
                              >
                                <AlertTriangle className="w-3 h-3 text-yellow-300 stroke-[2.5]" />
                                {sin.startsWith("⚠️") ? sin : `⚠️ ${sin}`}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Extras & Toppings (Green Accents) */}
                        {extras.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {extras.map((extra, eIdx) => (
                              <span
                                key={eIdx}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/40"
                              >
                                + {extra.option_name}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Notes */}
                        {item.notes && (
                          <p className="text-[11px] italic text-amber-300 bg-amber-950/30 border border-amber-800/30 rounded px-2 py-1">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action Footer */}
                <div className="p-3 bg-zinc-950/80 border-t border-zinc-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrint(ticket)}
                    title="Imprimir comanda térmica (80mm)"
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {nextStatus ? (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(ticket.id, nextStatus)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        ticket.status === "PENDING"
                          ? "bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/20"
                          : ticket.status === "PREPARING"
                          ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/20"
                          : "bg-zinc-700 hover:bg-zinc-600 text-white"
                      }`}
                    >
                      {ticket.status === "PENDING" && <Flame className="w-3.5 h-3.5" />}
                      {ticket.status === "PREPARING" && <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{getNextStatusLabel(ticket.status)}</span>
                    </button>
                  ) : (
                    <div className="flex-1 py-2 text-center text-xs font-semibold text-zinc-500">
                      Completada
                    </div>
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
