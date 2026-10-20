"use client";

import React, { useState } from "react";
import { CpqOrderMilestone } from "@marketos/types";
import {
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  Lock,
  Unlock,
  Plus,
  MessageCircle,
  Percent,
} from "lucide-react";
import { buildWhatsAppBalanceReminderUrl } from "../services/quote-sharing";

export interface MilestonePaymentTrackerProps {
  milestone: CpqOrderMilestone;
  formatCurrency?: (val: number) => string;
  onRecordPayment?: (amount: number, note?: string) => void;
  onToggleAllowDispatchWithBalance?: (allow: boolean) => void;
  customerPhone?: string;
  orderNumber?: string;
  customerName?: string;
  businessName?: string;
  paymentInstructions?: string;
  readOnly?: boolean;
  className?: string;
}

const DEFAULT_CURRENCY = (val: number) => val.toFixed(2);
const PRESET_DEPOSIT_PERCENTAGES = [30, 40, 50, 70, 100];

export function MilestonePaymentTracker({
  milestone,
  formatCurrency = DEFAULT_CURRENCY,
  onRecordPayment,
  onToggleAllowDispatchWithBalance,
  customerPhone,
  orderNumber,
  customerName,
  businessName = "Taller & Fabricación",
  paymentInstructions,
  readOnly = false,
  className = "",
}: MilestonePaymentTrackerProps) {
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState<string>("");

  // Configurable deposit percentage state (defaults to milestone config or 50%)
  const defaultDepositPct =
    milestone.required_deposit_percentage !== undefined &&
    milestone.required_deposit_percentage !== null
      ? milestone.required_deposit_percentage
      : 50;
  const [activeDepositPct, setActiveDepositPct] = useState<number>(defaultDepositPct);

  const total = milestone.total_amount || 0;
  const paid = milestone.paid_amount || 0;
  const pending = Math.max(0, milestone.pending_balance || 0);
  const percentPaid = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  const isFullyPaid = pending <= 0.001;
  const isDispatchBlocked = !isFullyPaid && !milestone.allow_dispatch_with_balance;

  const calculatedDepositAmount = (total * activeDepositPct) / 100;

  const handleQuickPayment = (amount: number, note: string) => {
    if (!onRecordPayment || amount <= 0) return;
    onRecordPayment(amount, note);
  };

  const handleCustomPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(paymentAmount);
    if (!isNaN(parsed) && parsed > 0 && onRecordPayment) {
      onRecordPayment(parsed, paymentNote || "Abono a orden MTO");
      setPaymentAmount("");
      setPaymentNote("");
      setShowPaymentForm(false);
    }
  };

  const balanceReminderUrl =
    customerPhone && pending > 0
      ? buildWhatsAppBalanceReminderUrl(customerPhone, {
          orderNumber,
          customerName,
          businessName,
          totalAmount: total,
          paidAmount: paid,
          pendingBalance: pending,
          paymentInstructions,
        })
      : null;

  return (
    <div
      className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
              Control de Anticipos y Cobros MTO
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Gestión de pagos por hitos (anticipo configurable para inicio de obra y liquidación contra entrega).
          </p>
        </div>

        {/* Dispatch Security Status Badge */}
        {isDispatchBlocked ? (
          <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>Entrega Bloqueada por Saldo</span>
          </div>
        ) : isFullyPaid ? (
          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Listo para Despacho (100% Pagado)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <Unlock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Despacho con Saldo Autorizado</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-600 dark:text-zinc-400">Progreso de Cobro</span>
          <span className="font-bold text-zinc-900 dark:text-zinc-100">{percentPaid}% pagado</span>
        </div>
        <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              percentPaid >= 100
                ? "bg-emerald-500"
                : percentPaid >= (milestone.required_deposit_percentage || 50)
                ? "bg-indigo-600"
                : "bg-amber-500"
            }`}
            style={{ width: `${percentPaid}%` }}
          />
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Orden */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 block">Total Cotizado</span>
          <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 block">
            {formatCurrency(total)}
          </span>
        </div>

        {/* Anticipo Recibido */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 block">Abonado / Anticipo</span>
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
            {formatCurrency(paid)}
          </span>
        </div>

        {/* Saldo Pendiente */}
        <div
          className={`border p-3.5 rounded-xl ${
            pending > 0
              ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200"
              : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
          }`}
        >
          <span className="text-xs block text-zinc-500 dark:text-zinc-400">Saldo Pendiente</span>
          <span
            className={`text-xl font-bold mt-1 block ${
              pending > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            {formatCurrency(pending)}
          </span>
        </div>
      </div>

      {/* Deposit Rate Selector Chips */}
      {!readOnly && paid === 0 && (
        <div className="bg-zinc-50/80 dark:bg-zinc-800/30 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-indigo-500" />
              Porcentaje de Anticipo Requerido:
            </span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {activeDepositPct}% = {formatCurrency(calculatedDepositAmount)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_DEPOSIT_PERCENTAGES.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setActiveDepositPct(pct)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                  activeDepositPct === pct
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                }`}
              >
                {pct}%
              </button>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="number"
                min="1"
                max="100"
                value={activeDepositPct}
                onChange={(e) => setActiveDepositPct(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 50)))}
                className="w-14 px-2 py-0.5 text-xs text-center rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
              <span className="text-xs text-zinc-400">%</span>
            </div>
          </div>
        </div>
      )}

      {/* Warning Alert if Dispatch is Blocked */}
      {isDispatchBlocked && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">RESTRICCIÓN DE ENTREGA ACTIVA</span>
            <span>
              La política de seguridad MTO impide despachar o entregar esta orden mientras exista un saldo
              pendiente de {formatCurrency(pending)}. Registre el pago del saldo o solicite autorización de
              excepción para liberar el paquete.
            </span>
          </div>
        </div>
      )}

      {/* Actions & Payment Registration */}
      {!readOnly && (
        <div className="space-y-3 pt-2">
          {!showPaymentForm ? (
            <div className="flex flex-wrap items-center gap-2">
              {onRecordPayment && pending > 0 && (
                <>
                  {paid === 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickPayment(
                          calculatedDepositAmount,
                          `Anticipo ${activeDepositPct}% de Producción`
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-medium border border-indigo-200 dark:border-indigo-800 transition-colors"
                    >
                      Registrar Anticipo ({activeDepositPct}%: {formatCurrency(calculatedDepositAmount)})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleQuickPayment(pending, "Liquidación Total 100%")}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800 transition-colors"
                  >
                    Liquidar Saldo Completo ({formatCurrency(pending)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPaymentForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Monto Personalizado</span>
                  </button>
                </>
              )}

              {/* WhatsApp Balance Settlement Link */}
              {balanceReminderUrl && (
                <a
                  href={balanceReminderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-sm ml-auto"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Solicitar Saldo por WhatsApp</span>
                </a>
              )}
            </div>
          ) : (
            <form
              onSubmit={handleCustomPaymentSubmit}
              className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Registrar Abono o Pago Parcial
                </span>
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-zinc-500 block mb-1">Monto a abonar</span>
                  <input
                    type="number"
                    min="0.01"
                    max={pending || undefined}
                    step="0.01"
                    placeholder={`Máx: ${pending.toFixed(2)}`}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <span className="text-xs text-zinc-500 block mb-1">Nota o Referencia</span>
                  <input
                    type="text"
                    placeholder="Ej. Transferencia Banco / Efectivo"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                >
                  Confirmar Pago
                </button>
              </div>
            </form>
          )}

          {/* Exception Dispatch Toggle */}
          {pending > 0 && onToggleAllowDispatchWithBalance && (
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                Autorizar entrega excepcional con saldo pendiente (Bajo riesgo del comercio):
              </span>
              <button
                type="button"
                onClick={() =>
                  onToggleAllowDispatchWithBalance(!milestone.allow_dispatch_with_balance)
                }
                className={`text-xs px-2.5 py-1 rounded-md font-medium border transition-colors ${
                  milestone.allow_dispatch_with_balance
                    ? "bg-amber-100 dark:bg-amber-950/60 border-amber-300 text-amber-800 dark:text-amber-200"
                    : "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {milestone.allow_dispatch_with_balance ? "Autorizado" : "Bloqueado"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

