"use client";

import React from "react";
import { Receipt, ShieldCheck, CheckCircle, Building2, Scale, FileText } from "lucide-react";
import { FiscalTaxPayerType, FiscalBillingMode, FiscalProvider } from "@marketos/types";

export interface SeniatFiscalSettingsProps {
  fiscalBillingEnabled: boolean;
  setFiscalBillingEnabled: (val: boolean) => void;
  emitterRif: string;
  setEmitterRif: (val: string) => void;
  emitterBusinessName: string;
  setEmitterBusinessName: (val: string) => void;
  emitterFiscalAddress: string;
  setEmitterFiscalAddress: (val: string) => void;
  emitterPhone: string;
  setEmitterPhone: (val: string) => void;
  taxPayerType: FiscalTaxPayerType;
  setTaxPayerType: (val: FiscalTaxPayerType) => void;
  defaultIvaRate: number;
  setDefaultIvaRate: (val: number) => void;
  applyIgtf: boolean;
  setApplyIgtf: (val: boolean) => void;
  billingMode: FiscalBillingMode;
  setBillingMode: (val: FiscalBillingMode) => void;
  fiscalProvider: FiscalProvider;
  setFiscalProvider: (val: FiscalProvider) => void;
  providerApiKey: string;
  setProviderApiKey: (val: string) => void;
  providerEnv: "SANDBOX" | "PRODUCTION";
  setProviderEnv: (val: "SANDBOX" | "PRODUCTION") => void;
}

export function SeniatFiscalSettings({
  fiscalBillingEnabled,
  setFiscalBillingEnabled,
  emitterRif,
  setEmitterRif,
  emitterBusinessName,
  setEmitterBusinessName,
  emitterFiscalAddress,
  setEmitterFiscalAddress,
  emitterPhone,
  setEmitterPhone,
  taxPayerType,
  setTaxPayerType,
  defaultIvaRate,
  setDefaultIvaRate,
  applyIgtf,
  setApplyIgtf,
  billingMode,
  setBillingMode,
  fiscalProvider,
  setFiscalProvider,
  providerApiKey,
  setProviderApiKey,
  providerEnv,
  setProviderEnv,
}: SeniatFiscalSettingsProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Explanation Banner */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-foreground">
              Cumplimiento Fiscal SENIAT (Providencia 00071 & Factura Digital)
            </h3>
            <p className="text-xs text-muted-foreground">
              Controla la emisión fiscal de tus pedidos según el modelo operativo de tu empresa.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-2 leading-relaxed">
          <p>
            <strong className="text-foreground">📌 Contexto Legal Actual en Venezuela:</strong> El SENIAT eliminó la homologación previa del programa informático, pero <span className="text-foreground font-semibold">mantiene vigentes todas las normativas de facturación (Providencia 00071)</span> y la obligatoriedad de imprentas digitales autorizadas para ventas digitales y e-commerce.
          </p>
          <p>
            Si tu negocio <strong className="text-foreground">ya cuenta con máquina fiscal en mostrador o un ERP contable</strong> (Saint, Profit, A2, Valery), mantén este módulo en <strong className="text-emerald-600 dark:text-emerald-400">OFF (Modo Preventa)</strong>. MarketOS generará las notas de entrega limpias para empaque y despacho, y la cajera emitirá la factura fiscal en la máquina física.
          </p>
        </div>
      </div>

      {/* Master Switch: Toggle ON / OFF (Default OFF) */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Emisión Automatizada de Factura Fiscal Digital</span>
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Activa la estructuración legal completa (RIF emisor, discriminación IVA 16%, IGTF 3% y rangos autorizados).
            </p>
          </div>

          <button
            type="button"
            onClick={() => setFiscalBillingEnabled(!fiscalBillingEnabled)}
            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              fiscalBillingEnabled ? "bg-emerald-600" : "bg-muted-foreground/30"
            }`}
            title={fiscalBillingEnabled ? "Desactivar facturación fiscal" : "Activar facturación fiscal"}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                fiscalBillingEnabled ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Status explanation alert */}
        <div
          className={`p-4 rounded-xl border text-xs leading-relaxed ${
            fiscalBillingEnabled
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-muted/40 border-border text-muted-foreground"
          }`}
        >
          {fiscalBillingEnabled ? (
            <div className="space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                <span>🟢 MÓDULO FISCAL ACTIVO (Emisión Digital SENIAT)</span>
              </div>
              <p>
                Al conciliar pagos aprobados, el sistema estructurará el documento como <strong>FACTURA DIGITAL</strong> con Número de Factura, Número de Control, desglose de IVA (16%), IGTF (3% si aplica) y código QR fiscal de validación.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-foreground">
                <span>⚪ MODO ACTUAL: TICKET DE PEDIDO / PREVENTA (POR DEFECTO)</span>
              </div>
              <p>
                Los pedidos se generan como <strong>comprobantes de compra / notas de entrega internas</strong>. No se generan correlativos fiscales automáticos. Este modo es el 100% recomendado para comercios que facturan físicamente en su caja registradora o ERP.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Configuration (Rendered when fiscalBillingEnabled is true) */}
      {fiscalBillingEnabled && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Emitter Fiscal Data Card */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Building2 className="w-4 h-4 text-primary" />
              <span>Datos Fiscales del Comercio Emisor (Providencia 00071)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  RIF del Negocio / Emisor *
                </label>
                <input
                  type="text"
                  value={emitterRif}
                  onChange={(e) => setEmitterRif(e.target.value.toUpperCase())}
                  placeholder="ej. J-50123456-7"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none uppercase"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Debe comenzar con J, V, G o E según el registro SENIAT.
                </p>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Razón Social Fiscal *
                </label>
                <input
                  type="text"
                  value={emitterBusinessName}
                  onChange={(e) => setEmitterBusinessName(e.target.value)}
                  placeholder="ej. Shop Market C.A."
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Domicilio Fiscal Completo *
                </label>
                <input
                  type="text"
                  value={emitterFiscalAddress}
                  onChange={(e) => setEmitterFiscalAddress(e.target.value)}
                  placeholder="ej. Av. Lara c/c Calle 3, Edif. Centro, Piso 1, Barquisimeto, Edo. Lara"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Dirección legal inscrita en el RIF del SENIAT que debe aparecer en toda factura.
                </p>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Teléfono Fiscal
                </label>
                <input
                  type="text"
                  value={emitterPhone}
                  onChange={(e) => setEmitterPhone(e.target.value)}
                  placeholder="ej. +58 424 5919577"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Tax Regime & Aliquots Card */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Scale className="w-4 h-4 text-primary" />
              <span>Régimen Tributario & Alícuotas de Impuesto</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Condición ante el SENIAT
                </label>
                <select
                  value={taxPayerType}
                  onChange={(e) => setTaxPayerType(e.target.value as FiscalTaxPayerType)}
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value="ORDINARY">Contribuyente Ordinario</option>
                  <option value="SPECIAL">Contribuyente Especial (Sujeto Pasivo Especial)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Alícuota General de IVA (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={defaultIvaRate}
                  onChange={(e) => setDefaultIvaRate(Number(e.target.value))}
                  placeholder="16.00"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Tasa general estipulada por ley (actualmente 16.00%).
                </p>
              </div>
            </div>

            {/* IGTF 3% Toggle Card */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-4">
              <div>
                <h5 className="font-bold text-xs text-foreground">
                  Impuesto a las Grandes Transacciones Financieras (IGTF 3%)
                </h5>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Aplica el 3% a cobros recibidos en divisas (efectivo USD, Zelle) si tu negocio está designado como Sujeto Pasivo Especial.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setApplyIgtf(!applyIgtf)}
                className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  applyIgtf ? "bg-emerald-600" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    applyIgtf ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Digital Printer / Provider Card */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <FileText className="w-4 h-4 text-primary" />
              <span>Imprenta Digital Autorizada (Proveedor Tecnológico SENIAT)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Modalidad de Emisión Fiscal
                </label>
                <select
                  value={billingMode}
                  onChange={(e) => setBillingMode(e.target.value as FiscalBillingMode)}
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value="DIGITAL_INVOICE">Facturación Digital por API (Imprenta Autorizada)</option>
                  <option value="MANUAL_INVOICE">Talonario Fiscal Preimpreso (Asignación Manual)</option>
                  <option value="TICKET_ONLY">Comprobante Interno (Preventa)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Proveedor de Facturación Digital
                </label>
                <select
                  value={fiscalProvider}
                  onChange={(e) => setFiscalProvider(e.target.value as FiscalProvider)}
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value="THE_FACTORY_HKA">The Factory HKA (Recomendado Venezuela)</option>
                  <option value="LIXIE">Lixie Digital</option>
                  <option value="GURUSOFT">GuruSoft e-Docs</option>
                  <option value="FACTURATECH">FacturaTech</option>
                  <option value="MANUAL_SIMULATION">Simulador / Integración Propia</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  API Token / Clave de Integración
                </label>
                <input
                  type="password"
                  value={providerApiKey}
                  onChange={(e) => setProviderApiKey(e.target.value)}
                  placeholder="••••••••••••••••••••••••"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Entorno de Ejecución
                </label>
                <select
                  value={providerEnv}
                  onChange={(e) => setProviderEnv(e.target.value as "SANDBOX" | "PRODUCTION")}
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value="SANDBOX">Sandbox (Pruebas de Emisión)</option>
                  <option value="PRODUCTION">Producción (SENIAT Oficial en Vivo)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
