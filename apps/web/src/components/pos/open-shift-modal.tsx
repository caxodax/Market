"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@marketos/ui";
import { DollarSign, Play, X } from "lucide-react";
import { openShift } from "@/app/admin/pos-actions";
import type { CashRegister, CashRegisterSession } from "@marketos/types";

interface Props {
  register: CashRegister;
  tenantId: string;
  cashierUserId: string;
  cashierName: string;
  open: boolean;
  onSuccess: (session: CashRegisterSession) => void;
  onClose: () => void;
}

export function OpenShiftModal({
  register,
  tenantId,
  cashierUserId,
  cashierName,
  open,
  onSuccess,
  onClose,
}: Props) {
  const [openingBalance, setOpeningBalance] = useState("0.00");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleOpen() {
    const amount = parseFloat(openingBalance);
    if (isNaN(amount) || amount < 0) {
      setError("El fondo inicial debe ser un valor válido.");
      return;
    }
    startTransition(async () => {
      const result = await openShift(tenantId, {
        register_id: register.id,
        opening_balance: amount,
        cashier_user_id: cashierUserId,
        cashier_name: cashierName,
      });
      if (result.success && result.data) {
        setOpeningBalance("0.00");
        setError("");
        onSuccess(result.data);
      } else if (!result.success) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Play className="h-5 w-5 text-emerald-600" />
              Abrir Turno — {register.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cajero: <strong className="text-foreground">{cashierName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <label htmlFor="opening-balance" className="text-xs font-semibold text-foreground">
              Fondo Inicial (USD)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="opening-balance"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={openingBalance}
                onChange={(e) => {
                  setOpeningBalance(e.target.value);
                  setError("");
                }}
                className="pl-9 font-semibold text-base"
                placeholder="0.00"
              />
            </div>
            {/* Quick Presets for Cashiers */}
            <div className="flex gap-1.5 pt-1">
              {["0.00", "20.00", "50.00", "100.00"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setOpeningBalance(preset);
                    setError("");
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                    openingBalance === preset
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-muted/60 hover:bg-muted text-muted-foreground border-border"
                  }`}
                >
                  ${Number(preset).toFixed(0)}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Efectivo disponible en caja para comenzar a dar vuelto.
            </p>
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending} className="w-1/2 text-xs">
            Cancelar
          </Button>
          <Button
            className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            onClick={handleOpen}
            disabled={isPending}
          >
            {isPending ? "Abriendo..." : "Abrir Turno"}
          </Button>
        </div>
      </div>
    </div>
  );
}
