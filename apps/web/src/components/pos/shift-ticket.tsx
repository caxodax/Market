"use client";

import { useRef } from "react";
import { Button } from "@marketos/ui";
import { Printer, Check, Receipt, X } from "lucide-react";
import type { ShiftSummary } from "@marketos/types";

interface Props {
  summary: ShiftSummary;
  tenantName?: string;
  open: boolean;
  onClose: () => void;
}

export function ShiftTicket({
  summary,
  tenantName = "MarketOS",
  open,
  onClose,
}: Props) {
  const ticketRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  function handlePrint() {
    window.print();
  }

  const isZ = summary.close_type === "Z";
  const title = isZ ? "CIERRE Z (DEFINITIVO)" : "CIERRE X (CORTE PARCIAL)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 print:p-0 print:bg-transparent">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto print:max-w-none print:w-full print:border-none print:shadow-none print:p-0">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-foreground">Reporte de Arqueo de Caja</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable 80mm / 58mm Thermal Ticket */}
        <div
          ref={ticketRef}
          className="bg-white text-black p-4 rounded-xl border font-mono text-[11px] leading-relaxed max-w-[320px] mx-auto print:border-none print:max-w-none print:w-full print:m-0 print:p-2"
        >
          {/* Header */}
          <div className="text-center pb-2 border-b border-dashed border-gray-400 space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-tight">{tenantName}</h2>
            <div className="font-bold text-xs tracking-wider my-1 bg-gray-100 py-0.5 border border-gray-300">
              *** {title} ***
            </div>
            <p className="text-[10px] text-gray-600">PUNTO DE VENTA & ARQUEO</p>
          </div>

          {/* Shift Metadata */}
          <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">CAJA:</span>
              <span className="font-bold">{summary.register_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">CAJERO:</span>
              <span className="font-semibold">{summary.cashier_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">APERTURA:</span>
              <span>{new Date(summary.opened_at).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{isZ ? "CIERRE:" : "CORTE:"}</span>
              <span>{new Date(summary.closed_at).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">OPERACIONES:</span>
              <span className="font-bold">{summary.transaction_count} tickets</span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>(+) FONDO INICIAL:</span>
              <span className="font-semibold">${summary.opening_balance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>(+) VENTAS COBRADAS:</span>
              <span className="font-semibold">${summary.total_sales_usd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>(+) ENTRADAS EFECTIVO:</span>
              <span>${summary.total_cash_in.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>(-) RETIROS MANUALES:</span>
              <span>-${summary.total_cash_out.toFixed(2)}</span>
            </div>
          </div>

          {/* Final Balances */}
          <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span>ESPERADO EN CAJA:</span>
              <span>${summary.expected_balance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span>EFECTIVO CONTADO:</span>
              <span>${summary.closing_balance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold pt-1 border-t border-dotted border-gray-300">
              <span>DIFERENCIA:</span>
              <span className={summary.difference < -0.01 ? "text-red-700" : summary.difference > 0.01 ? "text-blue-700" : "text-green-700"}>
                {summary.difference >= 0 ? `+$${summary.difference.toFixed(2)}` : `-$${Math.abs(summary.difference).toFixed(2)}`}
              </span>
            </div>
          </div>

          {/* Cash Movements */}
          {summary.movements && summary.movements.length > 0 && (
            <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
              <div className="text-[10px] font-bold text-gray-500 uppercase">MOVIMIENTOS DE CAJA:</div>
              {summary.movements.map((m, idx) => (
                <div key={idx} className="flex justify-between text-[10px]">
                  <span className="truncate pr-2">
                    {m.type === "IN" ? "[+]" : "[-]"} {m.reason}
                  </span>
                  <span className="shrink-0 font-medium">${m.amount_usd.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Signatures */}
          <div className="pt-6 pb-2 text-center space-y-4">
            <div className="border-t border-gray-400 w-3/4 mx-auto pt-1 text-[9px] text-gray-600">
              FIRMA CAJERO / RESPONSABLE
            </div>
            <p className="text-[8px] text-gray-400 tracking-wider">
              MARKETOS POS · REGISTRO AUDITABLE
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="print:hidden flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="w-1/2 text-xs">
            <Check className="w-3.5 h-3.5 mr-1.5" />
            Finalizar
          </Button>
          <Button onClick={handlePrint} className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Imprimir Ticket
          </Button>
        </div>
      </div>
    </div>
  );
}
