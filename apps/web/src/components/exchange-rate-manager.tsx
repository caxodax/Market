"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExchangeRate, RateHistoryItem } from "@marketos/types";
import {
  Landmark,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  ShieldCheck,
  Plus,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
} from "lucide-react";
import { syncBcvRateAction, saveManualRateAction } from "../app/admin/actions";

interface ExchangeRateManagerProps {
  tenantId: string;
  initialRate: ExchangeRate;
  initialHistory: RateHistoryItem[];
  isSuperAdmin?: boolean;
  onRateUpdated?: (rate: ExchangeRate) => void;
}

export function ExchangeRateManager({
  tenantId,
  initialRate,
  initialHistory = [],
  isSuperAdmin = false,
  onRateUpdated,
}: ExchangeRateManagerProps) {
  const router = useRouter();
  const [currentRate, setCurrentRate] = useState<ExchangeRate>(initialRate);
  const [history, setHistory] = useState<RateHistoryItem[]>(initialHistory);

  useEffect(() => {
    setCurrentRate(initialRate);
  }, [initialRate]);

  useEffect(() => {
    setHistory(initialHistory);
  }, [initialHistory]);

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Manual contingency form state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDate, setManualDate] = useState(
    currentRate.updated_at
      ? currentRate.updated_at.split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [manualUsd, setManualUsd] = useState(String(currentRate.value || "875.65"));
  const [manualEur, setManualEur] = useState(
    String(currentRate.eur_value || "980.61")
  );
  const [manualUsdt, setManualUsdt] = useState(
    String(currentRate.usdt_value || "1016.78")
  );
  const [savingManual, setSavingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Format date helper in Spanish
  const formatFecha = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        return new Intl.DateTimeFormat("es-VE", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(dateObj);
      }
    } catch {
      // fallback
    }
    return dateStr;
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await syncBcvRateAction(tenantId);
      if (res.success && res.rate) {
        setCurrentRate(res.rate);
        setSyncMessage({
          type: "success",
          text: `¡Tasas sincronizadas con éxito! USD: Bs. ${res.rate.value.toFixed(
            2
          )} | EUR: Bs. ${
            res.rate.eur_value ? res.rate.eur_value.toFixed(2) : "N/D"
          } | USDT: Bs. ${
            res.rate.usdt_value ? res.rate.usdt_value.toFixed(2) : "N/D"
          }`,
        });

        const todayStr = new Date().toISOString().split("T")[0];
        onRateUpdated?.(res.rate);
        router.refresh();
        setHistory((prev) => {
          const exists = prev.findIndex((h) => h.date_rate === todayStr);
          const newItem: RateHistoryItem = {
            id: `sync-${Date.now()}`,
            tenant_id: tenantId,
            date_rate: todayStr,
            currency: "USD",
            rate: res.rate!.value,
            rate_eur: res.rate!.eur_value,
            usdt_promedio: res.rate!.usdt_value,
            source: res.rate!.source,
            created_at: res.rate!.updated_at,
          };
          if (exists >= 0) {
            const updated = [...prev];
            updated[exists] = newItem;
            return updated;
          }
          return [newItem, ...prev];
        });

        setTimeout(() => setSyncMessage(null), 5000);
      } else {
        setSyncMessage({
          type: "error",
          text: res.error || "Error al sincronizar con el proveedor oficial",
        });
      }
    } catch (e: any) {
      setSyncMessage({
        type: "error",
        text: e.message || "Error al conectar con el servidor",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingManual(true);
    setManualMessage(null);

    try {
      const usdNum = parseFloat(manualUsd);
      const eurNum = manualEur ? parseFloat(manualEur) : undefined;
      const usdtNum = manualUsdt ? parseFloat(manualUsdt) : undefined;

      if (isNaN(usdNum) || usdNum <= 0) {
        throw new Error("Debe ingresar una tasa USD válida");
      }

      const res = await saveManualRateAction(tenantId, {
        date_rate: manualDate,
        usd_rate: usdNum,
        eur_rate: eurNum,
        usdt_rate: usdtNum,
      });

      if (res.success && res.rate) {
        setCurrentRate(res.rate);
        onRateUpdated?.(res.rate);
        router.refresh();
        setManualMessage({
          type: "success",
          text: "Tasa de contingencia registrada exitosamente.",
        });

        // Update history in-memory
        setHistory((prev) => {
          const exists = prev.findIndex((h) => h.date_rate === manualDate);
          const newItem: RateHistoryItem = {
            id: `manual-${Date.now()}`,
            tenant_id: tenantId,
            date_rate: manualDate,
            currency: "USD",
            rate: usdNum,
            rate_eur: eurNum,
            usdt_promedio: usdtNum,
            source: "MANUAL",
            created_at: new Date().toISOString(),
          };
          if (exists >= 0) {
            const updated = [...prev];
            updated[exists] = newItem;
            return updated;
          }
          return [newItem, ...prev];
        });

        setTimeout(() => {
          setManualMessage(null);
          setShowManualForm(false);
        }, 3000);
      } else {
        setManualMessage({
          type: "error",
          text: res.error || "No se pudo guardar la tasa manual",
        });
      }
    } catch (e: any) {
      setManualMessage({
        type: "error",
        text: e.message || "Error al procesar la solicitud",
      });
    } finally {
      setSavingManual(false);
    }
  };

  // Filter history
  const filteredHistory = history.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.date_rate.toLowerCase().includes(term) ||
      item.source.toLowerCase().includes(term) ||
      String(item.rate).includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const paginatedHistory = filteredHistory.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const todayStr = new Date().toISOString().split("T")[0];
  const rateDate = currentRate.updated_at
    ? currentRate.updated_at.split("T")[0]
    : todayStr;

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* 1. HERO CARDS: LIVE CURRENT RATES */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xs shrink-0">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                  {isSuperAdmin
                    ? "Monitor Global de Tasas de Cambio"
                    : "Tasas Oficiales y Conversión"}
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                    rateDate >= todayStr
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      rateDate >= todayStr ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span>Fecha: {rateDate}</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tasa legal de referencia para la conversión automática a Bolívares (VES) en catálogo, checkout y pagos.
              </p>
            </div>
          </div>

          {/* Sync Button */}
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs sm:text-sm font-black rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto"
            title="Sincronizar tasa oficial del BCV y Binance P2P vía AlCambio GraphQL"
          >
            <RefreshCw
              className={`w-4 h-4 shrink-0 ${syncing ? "animate-spin" : ""}`}
            />
            <span>{syncing ? "Sincronizando..." : "Sincronizar BCV Ahora"}</span>
          </button>
        </div>

        {/* Sync Feedback Message */}
        {syncMessage && (
          <div
            className={`mb-6 p-4 rounded-2xl border text-xs font-semibold flex items-center gap-3 ${
              syncMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-destructive/10 border-destructive/30 text-destructive"
            }`}
          >
            {syncMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-destructive" />
            )}
            <span>{syncMessage.text}</span>
          </div>
        )}

        {/* 3 Metric Cards: USD, EUR, USDT */}
        {/* 4 Metric Cards: USD, EUR, AVERAGE (USD+EUR)/2, USDT */}
        {(() => {
          const effectiveEur = currentRate.eur_value || Number((currentRate.value * 1.085).toFixed(4));
          const averageBcv = Number(((currentRate.value + effectiveEur) / 2).toFixed(2));

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card USD BCV */}
              <div className="bg-muted/40 rounded-2xl p-4 sm:p-5 border border-border shadow-2xs">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <span>🇺🇸</span> Dólar Oficial (BCV)
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-background px-2 py-0.5 rounded-lg border border-border text-foreground">
                    {currentRate.source.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-mono font-black text-foreground tracking-tight">
                    {currentRate.value.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground font-mono">
                    Bs. / USD
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>Fecha Valor: <strong className="text-foreground">{formatFecha(rateDate)}</strong></span>
                </p>
              </div>

              {/* Card EUR BCV */}
              <div className="bg-muted/40 rounded-2xl p-4 sm:p-5 border border-border shadow-2xs">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <span>🇪🇺</span> Euro Oficial (BCV)
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-background px-2 py-0.5 rounded-lg border border-border text-foreground">
                    BCV OFICIAL
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-mono font-black text-foreground tracking-tight">
                    {currentRate.eur_value
                      ? currentRate.eur_value.toFixed(2)
                      : effectiveEur.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground font-mono">
                    Bs. / EUR
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>Fecha Valor: <strong className="text-foreground">{formatFecha(rateDate)}</strong></span>
                </p>
              </div>

              {/* Card Promedio (USD + EUR) / 2 */}
              <div className="bg-muted/40 rounded-2xl p-4 sm:p-5 border border-border shadow-2xs">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <span>➗</span> Promedio (USD+EUR)/2
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-background px-2 py-0.5 rounded-lg border border-teal-500/30 text-teal-600 dark:text-teal-400">
                    PUNTO MEDIO
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-mono font-black text-teal-600 dark:text-teal-400 tracking-tight">
                    {averageBcv.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground font-mono">
                    Bs. / Promedio
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>Suma y división en tiempo real</span>
                </p>
              </div>

              {/* Card USDT Binance */}
              <div className="bg-muted/40 rounded-2xl p-4 sm:p-5 border border-border shadow-2xs">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <span>🟢</span> USDT Promedio (P2P)
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-background px-2 py-0.5 rounded-lg border border-border text-emerald-600 dark:text-emerald-400">
                    BINANCE P2P
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-mono font-black text-foreground tracking-tight">
                    {currentRate.usdt_value
                      ? currentRate.usdt_value.toFixed(2)
                      : "1016.78"}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground font-mono">
                    Bs. / USDT
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>Mercado Cripto Referencial</span>
                </p>
              </div>
            </div>
          );
        })()}

        {/* Automation Info & Manual Toggle */}
        <div className="mt-5 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              <strong>Cron Autónomo:</strong> Sincronización diaria 7:00 AM VET (AlCambio / Supabase / Vercel).
            </span>
          </div>

          <button
            onClick={() => setShowManualForm(!showManualForm)}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {showManualForm
                ? "Ocultar Carga Manual"
                : "Carga Manual de Contingencia"}
            </span>
          </button>
        </div>

        {/* Manual Contingency Form */}
        {showManualForm && (
          <form
            onSubmit={handleSaveManual}
            className="mt-5 p-5 bg-amber-500/5 rounded-2xl border border-amber-500/20 space-y-4"
          >
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                Carga Manual de Tasa (Uso en contingencia si cae la red o el portal del BCV)
              </span>
            </div>

            {manualMessage && (
              <div
                className={`p-3 rounded-xl border text-xs font-bold ${
                  manualMessage.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}
              >
                {manualMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-black uppercase text-muted-foreground mb-1">
                  Fecha de la Tasa *
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-background rounded-xl border border-input text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-muted-foreground mb-1">
                  Tasa USD (Bs/$) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  inputMode="decimal"
                  value={manualUsd}
                  onChange={(e) => setManualUsd(e.target.value)}
                  placeholder="Ej: 875.65"
                  required
                  className="w-full px-3 py-2 bg-background rounded-xl border border-input text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-muted-foreground mb-1">
                  Tasa EUR (Bs/€)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  inputMode="decimal"
                  value={manualEur}
                  onChange={(e) => setManualEur(e.target.value)}
                  placeholder="Ej: 980.61"
                  className="w-full px-3 py-2 bg-background rounded-xl border border-input text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-muted-foreground mb-1">
                  Tasa USDT (Bs/USDT)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  inputMode="decimal"
                  value={manualUsdt}
                  onChange={(e) => setManualUsdt(e.target.value)}
                  placeholder="Ej: 1016.78"
                  className="w-full px-3 py-2 bg-background rounded-xl border border-input text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowManualForm(false)}
                className="px-4 py-2 bg-background hover:bg-muted text-foreground text-xs font-bold rounded-xl border border-border transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingManual}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {savingManual ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Guardar Tasa Manual</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. HISTÓRICO DE TASAS DIARIAS */}
      <div className="rounded-3xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div>
            <h3 className="font-black text-foreground text-base sm:text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <span>Histórico de Tasas Diarias</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Registro inmutable de tasas según el día de la transacción para auditorías, cortes y contabilidad.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar fecha o fuente..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-8 pr-3 py-1.5 bg-background rounded-xl border border-input text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary w-44 sm:w-56"
              />
            </div>
            <span className="text-xs font-bold text-muted-foreground bg-background px-3 py-1.5 rounded-xl border border-border">
              {filteredHistory.length} fechas
            </span>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-bold text-foreground">
              No se encontraron registros de tasas
            </p>
            <p className="text-xs mt-1">
              Haz clic en &ldquo;Sincronizar BCV Ahora&rdquo; para registrar la tasa de hoy.
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-black uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-5">Fecha / Día</th>
                    <th className="py-3 px-4">Tasa USD (BCV)</th>
                    <th className="py-3 px-4">Tasa EUR (BCV)</th>
                    <th className="py-3 px-4">USDT Promedio (P2P)</th>
                    <th className="py-3 px-4">Fuente</th>
                    <th className="py-3 px-5 text-right">Variación vs Previo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedHistory.map((item, idx) => {
                    // Check previous day rate for variation
                    const fullIdx = (page - 1) * pageSize + idx;
                    const nextItem = filteredHistory[fullIdx + 1];
                    let diffPercent: number | null = null;
                    if (nextItem && nextItem.rate > 0) {
                      diffPercent =
                        ((item.rate - nextItem.rate) / nextItem.rate) * 100;
                    }

                    const isToday = item.date_rate === todayStr;

                    return (
                      <tr
                        key={item.id || item.date_rate}
                        className={`hover:bg-muted/30 transition-colors ${
                          isToday ? "bg-emerald-500/5 font-semibold" : ""
                        }`}
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground capitalize">
                              {formatFecha(item.date_rate)}
                            </span>
                            {isToday && (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                                Hoy
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {item.date_rate}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-foreground text-sm">
                          Bs. {Number(item.rate).toFixed(2)}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-muted-foreground">
                          {item.rate_eur
                            ? `Bs. ${Number(item.rate_eur).toFixed(2)}`
                            : "—"}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {item.usdt_promedio
                            ? `Bs. ${Number(item.usdt_promedio).toFixed(2)}`
                            : "—"}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                              item.source.toLowerCase().includes("manual")
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-muted text-foreground border-border"
                            }`}
                          >
                            {item.source}
                          </span>
                        </td>

                        <td className="py-3.5 px-5 text-right font-mono">
                          {diffPercent !== null ? (
                            <span
                              className={`inline-flex items-center gap-0.5 font-bold ${
                                diffPercent > 0
                                  ? "text-rose-500"
                                  : diffPercent < 0
                                  ? "text-emerald-500"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {diffPercent > 0 ? (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              ) : diffPercent < 0 ? (
                                <ArrowDownRight className="w-3.5 h-3.5" />
                              ) : null}
                              {diffPercent > 0 ? "+" : ""}
                              {diffPercent.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-border p-3 space-y-3">
              {paginatedHistory.map((item) => (
                <div
                  key={item.id || item.date_rate}
                  className="bg-card rounded-2xl p-4 border border-border shadow-2xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-foreground text-sm capitalize">
                        {formatFecha(item.date_rate)}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {item.date_rate}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border bg-muted text-foreground border-border">
                      {item.source}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block">
                        USD BCV
                      </span>
                      <span className="font-mono font-black text-foreground">
                        Bs. {Number(item.rate).toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block">
                        EUR BCV
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {item.rate_eur
                          ? `Bs. ${Number(item.rate_eur).toFixed(2)}`
                          : "—"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block">
                        USDT P2P
                      </span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {item.usdt_promedio
                          ? `Bs. ${Number(item.usdt_promedio).toFixed(2)}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
                <span>
                  Página {page} de {totalPages} ({filteredHistory.length} registros)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
