"use client";

import React, { useState, useMemo } from "react";
import type {
  Account,
  JournalEntry,
  TenantSettings,
  TenantModuleId,
} from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import {
  initializeChartOfAccounts,
  buildTrialBalance,
  createJournalEntry,
  generateSalesInvoiceEntry,
  generatePurchaseInvoiceEntry,
} from "../services/accounting-service";
import {
  BookOpenCheck,
  Scale,
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  Printer,
  X,
} from "lucide-react";

export interface AccountingManagerAdminProps {
  tenantId: string;
  settings: TenantSettings;
  activeModuleIds?: TenantModuleId[];
  initialAccounts?: Account[];
  initialEntries?: JournalEntry[];
  initialInvoices?: any[];
  initialPurchaseInvoices?: any[];
  onSaveEntry?: (entry: JournalEntry) => Promise<void> | void;
}

export function AccountingManagerAdmin({
  tenantId,
  settings,
  activeModuleIds,
  initialAccounts,
  initialEntries = [],
  initialInvoices = [],
  initialPurchaseInvoices = [],
  onSaveEntry,
}: AccountingManagerAdminProps) {
  const [activeTab, setActiveTab] = useState<"JOURNAL" | "TRIAL_BALANCE" | "CHART">("JOURNAL");
  const [entries, setEntries] = useState<JournalEntry[]>(() => {
    if (initialEntries && initialEntries.length > 0) return initialEntries;
    const generated: JournalEntry[] = [];
    let num = 1;
    if (initialInvoices && initialInvoices.length > 0) {
      for (const inv of initialInvoices.slice(0, 20)) {
        try {
          generated.push(generateSalesInvoiceEntry(inv, num++));
        } catch {}
      }
    }
    if (initialPurchaseInvoices && initialPurchaseInvoices.length > 0) {
      for (const pur of initialPurchaseInvoices.slice(0, 20)) {
        try {
          generated.push(generatePurchaseInvoiceEntry(pur, num++));
        } catch {}
      }
    }
    return generated;
  });
  const [accounts, setAccounts] = useState<Account[]>(() =>
    initialAccounts && initialAccounts.length > 0
      ? initialAccounts
      : initializeChartOfAccounts(tenantId)
  );

  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [isNewEntryModalOpen, setIsNewEntryModalOpen] = useState(false);

  // KPIs
  const stats = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let balancedCount = 0;

    for (const e of entries) {
      totalDebit += e.total_debit;
      totalCredit += e.total_credit;
      if (e.is_balanced) balancedCount++;
    }

    return {
      entriesCount: entries.length,
      totalDebit,
      totalCredit,
      isEquilibrium: Math.abs(totalDebit - totalCredit) <= 0.05,
    };
  }, [entries]);

  // Trial Balance computed report
  const trialBalance = useMemo(() => {
    return buildTrialBalance(entries, accounts, selectedPeriod, tenantId);
  }, [entries, accounts, selectedPeriod, tenantId]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.concept.toLowerCase().includes(q) ||
        String(e.entry_number).includes(q) ||
        (e.source_document_number && e.source_document_number.toLowerCase().includes(q))
    );
  }, [entries, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header and Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              <BookOpenCheck className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Contabilidad & Asientos Automáticos
              </h1>
              <p className="text-xs text-muted-foreground">
                Plan de cuentas NIIF/PYME, partida doble automatizada desde ventas, compras y tesorería.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "TRIAL_BALANCE" && (
            <input
              type="month"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="h-9 px-3 rounded-xl border border-input bg-card text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary cursor-pointer"
            />
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-foreground text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
            title="Imprimir vista contable"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-card border border-border space-y-1 shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" />
            <span>Total Asientos</span>
          </p>
          <p className="text-xl font-black font-mono text-foreground">{stats.entriesCount}</p>
          <p className="text-[10px] text-muted-foreground">Libro Diario General</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border space-y-1 shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-blue-500" />
            <span>Total Débitos (Debe)</span>
          </p>
          <p className="text-xl font-black font-mono text-foreground">
            {formatCurrency(stats.totalDebit, "USD")}
          </p>
          <p className="text-[10px] text-muted-foreground">Cargos acumulados</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border space-y-1 shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-indigo-500" />
            <span>Total Créditos (Haber)</span>
          </p>
          <p className="text-xl font-black font-mono text-foreground">
            {formatCurrency(stats.totalCredit, "USD")}
          </p>
          <p className="text-[10px] text-muted-foreground">Abonos acumulados</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border space-y-1 shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Estado de Cuadre</span>
          </p>
          <div className="pt-0.5">
            {stats.isEquilibrium ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                <span>Cuadrado (0.00)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 text-xs font-bold border border-rose-500/20">
                <AlertCircle className="w-3 h-3" />
                <span>Descuadrado</span>
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Partida Doble NIIF</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("JOURNAL")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            activeTab === "JOURNAL"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Libro Diario</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary-foreground/20 text-inherit font-mono">
            {entries.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TRIAL_BALANCE")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            activeTab === "TRIAL_BALANCE"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Balance de Comprobación</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CHART")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            activeTab === "CHART"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Plan de Cuentas</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary-foreground/20 text-inherit font-mono">
            {accounts.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Libro Diario */}
      {activeTab === "JOURNAL" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por concepto, Nº asiento o documento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-card text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-border bg-card space-y-2">
              <BookOpenCheck className="w-10 h-10 mx-auto opacity-30 text-primary" />
              <p className="font-bold text-sm text-foreground">No hay asientos contables registrados</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Los asientos se generan automáticamente al emitir facturas en Facturación, registrar compras a proveedores o asentar cobranzas (CxC).
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-black font-mono text-sm text-foreground">
                        Asiento #{entry.entry_number}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-muted text-muted-foreground border border-border">
                        {entry.source_module}
                      </span>
                      {entry.source_document_number && (
                        <span className="text-[10px] font-mono text-primary font-semibold">
                          Doc: {entry.source_document_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground text-[11px] font-mono">
                      <span>{entry.entry_date}</span>
                      <span className="text-emerald-600 font-bold">
                        Total: {formatCurrency(entry.total_debit, "USD")}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-medium text-foreground">{entry.concept}</p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="text-muted-foreground font-semibold border-b border-border/50 text-[11px]">
                          <th className="pb-1.5 w-32">Código</th>
                          <th className="pb-1.5">Cuenta Contable / Glosa</th>
                          <th className="pb-1.5 text-right w-28">Debe ($)</th>
                          <th className="pb-1.5 text-right w-28">Haber ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                        {entry.lines.map((l) => (
                          <tr key={l.id} className="hover:bg-muted/15">
                            <td className="py-1 text-muted-foreground">{l.account_code}</td>
                            <td className="py-1 font-sans text-foreground">
                              {l.account_name}
                              {l.description && (
                                <span className="block text-[10px] text-muted-foreground font-sans">
                                  {l.description}
                                </span>
                              )}
                            </td>
                            <td className="py-1 text-right text-foreground">
                              {l.debit > 0 ? formatCurrency(l.debit, "USD") : "—"}
                            </td>
                            <td className="py-1 text-right text-foreground">
                              {l.credit > 0 ? formatCurrency(l.credit, "USD") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Balance de Comprobación */}
      {activeTab === "TRIAL_BALANCE" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-foreground">
                Balance de Comprobación de Sumas y Saldos
              </h3>
              <p className="text-[10px] text-muted-foreground">
                Período fiscal {trialBalance.period} • Generado {new Date(trialBalance.generated_at).toLocaleString("es-ES")}
              </p>
            </div>
            {trialBalance.is_balanced ? (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Sumas Iguales Verificadas
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                Descuadre en Sumas
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold text-[11px]">
                  <th className="p-3">Código</th>
                  <th className="p-3">Cuenta Contable</th>
                  <th className="p-3 text-right">Sumas Debe</th>
                  <th className="p-3 text-right">Sumas Haber</th>
                  <th className="p-3 text-right">Saldo Deudor</th>
                  <th className="p-3 text-right">Saldo Acreedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                {trialBalance.rows.map((row) => (
                  <tr key={row.account_code} className="hover:bg-muted/15">
                    <td className="p-3 text-muted-foreground">{row.account_code}</td>
                    <td className="p-3 font-sans font-medium text-foreground">{row.account_name}</td>
                    <td className="p-3 text-right">
                      {row.period_debit > 0 ? formatCurrency(row.period_debit, "USD") : "—"}
                    </td>
                    <td className="p-3 text-right">
                      {row.period_credit > 0 ? formatCurrency(row.period_credit, "USD") : "—"}
                    </td>
                    <td className="p-3 text-right font-bold text-foreground">
                      {row.final_debit > 0 ? formatCurrency(row.final_debit, "USD") : "—"}
                    </td>
                    <td className="p-3 text-right font-bold text-foreground">
                      {row.final_credit > 0 ? formatCurrency(row.final_credit, "USD") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 border-t-2 border-border font-bold text-foreground font-mono text-xs">
                  <td colSpan={2} className="p-3 font-sans">TOTALES VERIFICADOS:</td>
                  <td className="p-3 text-right">{formatCurrency(trialBalance.total_period_debit, "USD")}</td>
                  <td className="p-3 text-right">{formatCurrency(trialBalance.total_period_credit, "USD")}</td>
                  <td className="p-3 text-right text-primary">{formatCurrency(trialBalance.total_final_debit, "USD")}</td>
                  <td className="p-3 text-right text-primary">{formatCurrency(trialBalance.total_final_credit, "USD")}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Plan de Cuentas */}
      {activeTab === "CHART" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="text-xs font-bold text-foreground">
              Catálogo de Cuentas Contables NIIF / PYME
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Estructura jerárquica de 4 niveles preconfigurada para operaciones comerciales e impuestos.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold text-[11px]">
                  <th className="p-3">Código</th>
                  <th className="p-3">Nombre de la Cuenta</th>
                  <th className="p-3">Clasificación</th>
                  <th className="p-3">Naturaleza</th>
                  <th className="p-3">Nivel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                {accounts.map((acc) => (
                  <tr key={acc.code} className="hover:bg-muted/15">
                    <td className="p-3 font-bold text-muted-foreground">{acc.code}</td>
                    <td className={`p-3 font-sans ${acc.level <= 2 ? "font-bold text-foreground" : "text-foreground"}`}>
                      <span style={{ paddingLeft: `${(acc.level - 1) * 16}px` }}>
                        {acc.name}
                      </span>
                    </td>
                    <td className="p-3 font-sans">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-bold">
                        {acc.classification}
                      </span>
                    </td>
                    <td className="p-3 font-sans">
                      <span className={`text-[10px] font-bold ${acc.nature === "DEBIT" ? "text-blue-600" : "text-purple-600"}`}>
                        {acc.nature === "DEBIT" ? "Deudora (Debe)" : "Acreedora (Haber)"}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">Nivel {acc.level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
