"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@marketos/ui";
import { DollarSign, ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import { addCashMovement } from "@/app/admin/pos-actions";
import type { CashMovementType } from "@marketos/types";

interface Props {
  sessionId: string;
  tenantId: string;
  userId: string;
  registerName?: string;
  open: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

export function CashMovementModal({
  sessionId,
  tenantId,
  userId,
  registerName = "Caja",
  open,
  onSuccess,
  onClose,
}: Props) {
  const [type, setType] = useState<CashMovementType>("OUT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleSubmit() {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setError("Indica un monto válido mayor a 0.");
      return;
    }
    if (!reason.trim()) {
      setError("Indica el motivo del movimiento.");
      return;
    }

    startTransition(async () => {
      const res = await addCashMovement(tenantId, {
        session_id: sessionId,
        type,
        amount_usd: num,
        reason: reason.trim(),
        created_by: userId,
      });

      if (res.success) {
        setAmount("");
        setReason("");
        setError("");
        onSuccess();
        onClose();
      } else {
        setError(res.error || "No se pudo registrar el movimiento.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
              {type === "IN" ? (
                <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
              ) : (
                <ArrowUpRight className="h-5 w-5 text-rose-600" />
              )}
              Movimiento de Caja — {registerName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Registra una entrada extra o retiro de efectivo en el turno.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 py-1">
          {/* Tipo de movimiento */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={type === "IN" ? "primary" : "outline"}
              className={type === "IN" ? "bg-emerald-600 hover:bg-emerald-700 text-white text-xs" : "text-xs"}
              onClick={() => setType("IN")}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 mr-1.5" />
              Entrada (+)
            </Button>
            <Button
              type="button"
              variant={type === "OUT" ? "primary" : "outline"}
              className={type === "OUT" ? "bg-rose-600 hover:bg-rose-700 text-white text-xs" : "text-xs"}
              onClick={() => setType("OUT")}
            >
              <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />
              Retiro (-)
            </Button>
          </div>

          {/* Monto */}
          <div className="space-y-1.5">
            <label htmlFor="mov-amount" className="text-xs font-semibold text-foreground">
              Monto en Efectivo (USD)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="mov-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                className="pl-9 font-bold text-base"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <label htmlFor="mov-reason" className="text-xs font-semibold text-foreground">
              Motivo o Justificación
            </label>
            <Input
              id="mov-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError("");
              }}
              placeholder={type === "IN" ? "Ej: Reposición de menudo" : "Ej: Pago urgente a proveedor"}
              className="text-xs"
            />
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending} className="w-1/2 text-xs">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className={`w-1/2 text-xs ${
              type === "IN"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-rose-600 hover:bg-rose-700 text-white"
            }`}
          >
            {isPending ? "Guardando..." : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
