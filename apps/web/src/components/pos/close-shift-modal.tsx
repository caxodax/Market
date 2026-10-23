"use client";

import { useState, useEffect, useTransition } from "react";
import { Button, Input } from "@marketos/ui";
import { AlertCircle, Lock, Printer, DollarSign, ArrowUpRight, ArrowDownLeft, ShoppingBag, X } from "lucide-react";
import { closeShift, getShiftSummary, markTicketPrinted } from "@/app/admin/pos-actions";
import { ShiftTicket } from "./shift-ticket";
import type { ShiftSummary, CloseType } from "@marketos/types";

interface Props {
  sessionId: string;
  tenantName?: string;
  open: boolean;
  onSuccess: (closeType: CloseType) => void;
  onClose: () => void;
}

export function CloseShiftModal({
  sessionId,
  tenantName = "MarketOS",
  open,
  onSuccess,
  onClose,
}: Props) {
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [closingBalance, setClosingBalance] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPrintTicket, setShowPrintTicket] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !sessionId) return;
    setLoading(true);
    setError("");
    getShiftSummary(sessionId)
      .then((data) => {
        if (data) {
          setSummary(data);
          setClosingBalance(data.expected_balance.toFixed(2));
        } else {
          setError("No se pudo cargar la información del turno.");
        }
      })
      .catch(() => setError("Error al consultar el turno."))
      .finally(() => setLoading(false));
  }, [open, sessionId]);

  if (!open) return null;

  const counted = parseFloat(closingBalance) || 0;
  const expected = summary?.expected_balance ?? 0;
  const difference = counted - expected;

  function handleCloseZ() {
    if (isNaN(counted) || counted < 0) {
      setError("Indica el monto de efectivo en caja.");
      return;
    }
    startTransition(async () => {
      const res = await closeShift({
        session_id: sessionId,
        closing_balance: counted,
        close_type: "Z",
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        if (summary) {
          setSummary({
            ...summary,
            closing_balance: counted,
            difference,
            close_type: "Z",
          });
        }
        setShowPrintTicket(true);
      } else {
        setError(res.error || "Error al cerrar el turno.");
      }
    });
  }

  function handlePrintOnly() {
    setShowPrintTicket(true);
  }

  return (
    <>
      {!showPrintTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Lock className="h-5 w-5 text-amber-500" />
                  Arqueo & Cierre de Caja
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {summary ? (
                    <span>Caja: <strong className="text-foreground">{summary.register_name}</strong> · Cajero: <strong className="text-foreground">{summary.cashier_name}</strong></span>
                  ) : "Calculando totales de la sesión..."}
                </p>
              </div>
              <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Cargando balance y movimientos...
              </div>
            ) : error && !summary ? (
              <div className="py-6 text-center text-xs text-destructive">{error}</div>
            ) : summary ? (
              <div className="space-y-4 py-1">
                {/* Balance Cards */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-muted/40 rounded-xl border border-border">
                    <div className="text-muted-foreground text-[11px]">Fondo Inicial</div>
                    <div className="font-bold text-base mt-0.5">${summary.opening_balance.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-xl border border-border">
                    <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" /> Ventas ({summary.transaction_count})
                    </div>
                    <div className="font-bold text-base text-emerald-600 mt-0.5">${summary.total_sales_usd.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-xl border border-border">
                    <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                      <ArrowDownLeft className="w-3.5 h-3.5 text-blue-500" /> Entradas manuales
                    </div>
                    <div className="font-bold text-base mt-0.5">${summary.total_cash_in.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-xl border border-border">
                    <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" /> Salidas manuales
                    </div>
                    <div className="font-bold text-base mt-0.5">-${summary.total_cash_out.toFixed(2)}</div>
                  </div>
                </div>

                {/* Total Esperado */}
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Efectivo Teórico Esperado</div>
                    <div className="text-[11px] text-muted-foreground">Fondo + Ventas + Entradas - Salidas</div>
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    ${expected.toFixed(2)}
                  </div>
                </div>

                {/* Conteo Real en Efectivo */}
                <div className="space-y-1.5">
                  <label htmlFor="counted-cash" className="text-xs font-semibold text-foreground">
                    Efectivo Real en Caja (Arqueo Físico en USD)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="counted-cash"
                      type="number"
                      step="0.01"
                      min="0"
                      value={closingBalance}
                      onChange={(e) => {
                        setClosingBalance(e.target.value);
                        setError("");
                      }}
                      className="pl-9 text-base font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Cuadre / Diferencia */}
                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  Math.abs(difference) < 0.01
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                    : difference < 0
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                }`}>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">
                      {Math.abs(difference) < 0.01
                        ? "Caja Cuadrada Exacta"
                        : difference < 0
                        ? `Faltante de Efectivo`
                        : `Sobrante de Efectivo`}
                    </span>
                  </div>
                  <div className="font-bold text-base">
                    {difference >= 0 ? `+$${difference.toFixed(2)}` : `-$${Math.abs(difference).toFixed(2)}`}
                  </div>
                </div>

                {/* Observaciones */}
                <div className="space-y-1.5">
                  <label htmlFor="close-notes" className="text-[11px] font-medium text-muted-foreground">
                    Notas u Observaciones del Cierre
                  </label>
                  <textarea
                    id="close-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Se dejó fondo para el turno de la tarde..."
                    className="w-full text-xs rounded-xl border border-border bg-background p-2.5 outline-hidden focus:border-primary"
                  />
                </div>

                {error && <p className="text-xs font-medium text-destructive">{error}</p>}
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrintOnly}
                disabled={loading || !summary}
                className="w-full sm:w-1/2 text-xs"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Cierre X (Parcial)
              </Button>
              <Button
                type="button"
                onClick={handleCloseZ}
                disabled={loading || !summary || isPending}
                className="w-full sm:w-1/2 bg-amber-600 hover:bg-amber-700 text-white text-xs"
              >
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                {isPending ? "Procesando Cierre Z..." : "Ejecutar Cierre Z"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket imprimible */}
      {showPrintTicket && summary && (
        <ShiftTicket
          summary={{
            ...summary,
            closing_balance: counted,
            difference,
            close_type: summary.close_type || "Z",
          }}
          tenantName={tenantName}
          open={showPrintTicket}
          onClose={() => {
            setShowPrintTicket(false);
            if (summary.close_type === "Z") {
              markTicketPrinted(sessionId).catch(console.error);
              onSuccess("Z");
              onClose();
            }
          }}
        />
      )}
    </>
  );
}
