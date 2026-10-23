"use client";

import { useState, useTransition } from "react";
import { Button, Badge, cn } from "@marketos/ui";
import { Monitor, Wifi, WifiOff, Delete, CheckCircle2, X } from "lucide-react";
import { verifyRegisterPin } from "@/app/admin/pos-actions";
import type { CashRegister, CashRegisterSession } from "@marketos/types";

interface Props {
  registers: CashRegister[];
  open: boolean;
  onSuccess: (register: CashRegister, session: CashRegisterSession | null) => void;
  onClose: () => void;
}

type Step = "select" | "pin";

export function RegisterSelectModal({ registers, open, onSuccess, onClose }: Props) {
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<CashRegister | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function reset() {
    setStep("select");
    setSelected(null);
    setPin("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSelectRegister(reg: CashRegister) {
    setSelected(reg);
    setPin("");
    setError("");
    setStep("pin");
  }

  function handleDigit(d: string) {
    if (pin.length >= 6) return;
    setPin((p) => p + d);
    setError("");
  }

  function handleDelete() {
    setPin((p) => p.slice(0, -1));
    setError("");
  }

  function handleConfirmPin() {
    if (!selected) return;
    startTransition(async () => {
      const result = await verifyRegisterPin({ register_id: selected.id, pin });
      if (result.success) {
        reset();
        onSuccess(selected, selected.active_session ?? null);
      } else {
        setError(result.error ?? "PIN incorrecto");
        setPin("");
      }
    });
  }

  const PIN_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Monitor className="h-5 w-5 text-emerald-600" />
              {step === "select" ? "Seleccionar Caja" : `Acceso — ${selected?.name}`}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === "select"
                ? "Selecciona la caja en la que vas a trabajar."
                : "Ingresa tu PIN de cajero para continuar."}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "select" ? (
          <div className="grid gap-2.5 max-h-[60vh] overflow-y-auto">
            {registers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No hay cajas configuradas en esta sucursal.
              </p>
            ) : (
              registers.map((reg) => {
                const isOpen = !!reg.active_session;
                return (
                  <button
                    key={reg.id}
                    onClick={() => handleSelectRegister(reg)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border p-3.5 text-left transition-colors hover:bg-muted/60",
                      isOpen ? "border-emerald-500/40 bg-emerald-50/20" : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Monitor className={cn("h-5 w-5", isOpen ? "text-emerald-600" : "text-muted-foreground")} />
                      <div>
                        <p className="font-semibold text-sm text-foreground">{reg.name}</p>
                        {reg.description && (
                          <p className="text-xs text-muted-foreground">{reg.description}</p>
                        )}
                        {isOpen && reg.active_session && (
                          <p className="text-xs text-emerald-600 font-medium">
                            Cajero: {reg.active_session.cashier_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={isOpen ? "default" : "secondary"}
                      className={isOpen ? "bg-emerald-600 text-white" : ""}
                    >
                      {isOpen ? (
                        <span className="flex items-center gap-1">
                          <Wifi className="h-3 w-3" /> Abierta
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <WifiOff className="h-3 w-3" /> Cerrada
                        </span>
                      )}
                    </Badge>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Indicador de dígitos */}
            <div className="flex justify-center gap-3 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-3.5 w-3.5 rounded-full border-2 transition-all",
                    i < pin.length
                      ? "bg-emerald-600 border-emerald-600 scale-110"
                      : "border-muted-foreground/40"
                  )}
                />
              ))}
            </div>

            {error && (
              <p className="text-center text-xs font-medium text-destructive">{error}</p>
            )}

            {/* PIN Pad */}
            <div className="grid grid-cols-3 gap-2">
              {PIN_DIGITS.map((d, i) => {
                if (d === "") return <div key={i} />;
                if (d === "⌫") {
                  return (
                    <Button
                      key={i}
                      variant="outline"
                      onClick={handleDelete}
                      className="h-12 text-base"
                    >
                      <Delete className="h-4 w-4" />
                    </Button>
                  );
                }
                return (
                  <Button
                    key={i}
                    variant="outline"
                    onClick={() => handleDigit(d)}
                    className="h-12 text-lg font-bold"
                  >
                    {d}
                  </Button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="ghost"
                className="w-1/2 text-xs"
                onClick={() => {
                  setStep("select");
                  setPin("");
                  setError("");
                }}
              >
                Volver
              </Button>
              <Button
                className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                onClick={handleConfirmPin}
                disabled={pin.length < 4 || isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                {isPending ? "Validando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
