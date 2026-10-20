"use client";

import React from "react";
import {
  Receipt,
  ShieldCheck,
  CheckCircle,
  Building2,
  Scale,
  FileText,
  Printer,
  AlertTriangle,
  Hash,
  Sparkles,
  Info,
} from "lucide-react";
import { FiscalTaxPayerType, FiscalBillingMode, FiscalProvider } from "@marketos/types";
import { SENIAT_LEGAL_CONSTANTS, validateSeniatRif } from "../fiscal/seniat";

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
  // Campos extendidos para cumplimiento estricto con o sin máquina fiscal
  fiscalMachineSerial?: string;
  setFiscalMachineSerial?: (val: string) => void;
  nextInvoiceNumber?: number;
  setNextInvoiceNumber?: (val: number) => void;
  nextControlNumber?: number;
  setNextControlNumber?: (val: number) => void;
  controlPrefix?: string;
  setControlPrefix?: (val: string) => void;
  nonFiscalWarningLegend?: string;
  setNonFiscalWarningLegend?: (val: string) => void;
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
  fiscalMachineSerial = "",
  setFiscalMachineSerial,
  nextInvoiceNumber = 1,
  setNextInvoiceNumber,
  nextControlNumber = 1,
  setNextControlNumber,
  controlPrefix = "00-",
  setControlPrefix,
  nonFiscalWarningLegend = SENIAT_LEGAL_CONSTANTS.NON_FISCAL_WARNING_LEGEND,
  setNonFiscalWarningLegend,
}: SeniatFiscalSettingsProps) {
  const rifValidation = validateSeniatRif(emitterRif);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Legal Context Banner */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
              <span>Cumplimiento Fiscal SENIAT (Providencias 00071 & 00032)</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/20 uppercase">
                Venezuela
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Controla la emisión fiscal de tus pedidos según el modelo operativo de tu comercio (con o sin máquina fiscal).
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-2 leading-relaxed">
          <p>
            <strong className="text-foreground">📌 Marco Jurídico Vigente:</strong> La Providencia Administrativa <strong className="text-foreground">SNAT/2011/00071</strong> exige que toda transacción esté amparada por Factura Fiscal o por un documento no fiscal debidamente identificado.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-card/80 border border-border space-y-1">
              <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-primary" />
                <span>¿Tienes Máquina Fiscal en Tienda?</span>
              </span>
              <p className="text-[11px]">
                Deja la facturación digital desactivada. MarketOS emitirá notas de preventa con la leyenda obligatoria de ley y tu cajera asociará el número de factura física emitida por la registradora.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-card/80 border border-border space-y-1">
              <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>¿No Tienes Máquina Fiscal?</span>
              </span>
              <p className="text-[11px]">
                Activa la facturación digital para emitir facturas legales autorizadas con Código Único de Validación (CUV), código QR y correlativos SENIAT en ventas por internet y delivery.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Selector Principal de Modalidad Operativa */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        <div>
          <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Modalidad de Operación del Comercio</span>
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecciona el modelo que describe cómo factura legalmente tu empresa ante el SENIAT.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Opción 1: Mostrador / Máquina Fiscal */}
          <div
            onClick={() => {
              setFiscalBillingEnabled(false);
              setBillingMode("TICKET_ONLY");
            }}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              !fiscalBillingEnabled || billingMode === "TICKET_ONLY"
                ? "bg-primary/5 border-primary ring-1 ring-primary"
                : "bg-card border-border hover:border-border/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Printer className="w-4 h-4" />
              </span>
              {(!fiscalBillingEnabled || billingMode === "TICKET_ONLY") && (
                <CheckCircle className="w-4 h-4 text-primary" />
              )}
            </div>
            <h5 className="font-bold text-xs text-foreground mt-3">Máquina Fiscal / ERP</h5>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              Facturación en caja física (Bixolon, The Factory, Saint, A2). MarketOS emite preventas y notas de despacho.
            </p>
          </div>

          {/* Opción 2: Factura Digital Automatizada */}
          <div
            onClick={() => {
              setFiscalBillingEnabled(true);
              setBillingMode("DIGITAL_INVOICE");
            }}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              fiscalBillingEnabled && billingMode === "DIGITAL_INVOICE"
                ? "bg-emerald-500/5 border-emerald-500 ring-1 ring-emerald-500"
                : "bg-card border-border hover:border-border/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </span>
              {fiscalBillingEnabled && billingMode === "DIGITAL_INVOICE" && (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              )}
            </div>
            <h5 className="font-bold text-xs text-foreground mt-3">Factura Digital (API)</h5>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              Emisión digital directa mediante imprenta autorizada (The Factory HKA, Lixie, GuruSoft). Ideal sin máquina.
            </p>
          </div>

          {/* Opción 3: Talonario Manual de Contingencia */}
          <div
            onClick={() => {
              setFiscalBillingEnabled(true);
              setBillingMode("MANUAL_INVOICE");
            }}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              fiscalBillingEnabled && billingMode === "MANUAL_INVOICE"
                ? "bg-amber-500/5 border-amber-500 ring-1 ring-amber-500"
                : "bg-card border-border hover:border-border/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Hash className="w-4 h-4" />
              </span>
              {fiscalBillingEnabled && billingMode === "MANUAL_INVOICE" && (
                <CheckCircle className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <h5 className="font-bold text-xs text-foreground mt-3">Talonario Preimpreso</h5>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              Llenado manual con correlativo y rangos de control autorizados por imprenta autorizada tradicional.
            </p>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* SECCIÓN 1: CONFIGURACIÓN PARA COMERCIO CON MÁQUINA FISCAL        */}
      {/* ================================================================ */}
      {(!fiscalBillingEnabled || billingMode === "TICKET_ONLY") && (
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm">
            <Printer className="w-4 h-4 text-primary" />
            <span>Configuración de Máquina Fiscal Física en Mostrador</span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Protección Legal Automática Activada (Providencia 00071)</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Todos los tickets y comprobantes impresos incluirán en el encabezado la advertencia legal obligatoria:
              <br />
              <strong className="font-mono">"{nonFiscalWarningLegend}"</strong>.
              Esto certifica ante cualquier inspector del SENIAT que el sistema opera en preventa y que la factura oficial se emite en caja física.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-muted-foreground block mb-1.5">
                Serial de la Máquina Fiscal Registrada en Tienda
              </label>
              <input
                type="text"
                value={fiscalMachineSerial}
                onChange={(e) => setFiscalMachineSerial?.(e.target.value.toUpperCase())}
                placeholder="ej. Z4A1234567 o BIX-908123"
                className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none uppercase"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Serial troquelado por el fabricante homologado (The Factory, Bixolon, Dascom) que aparece en los reportes Z.
              </p>
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1.5">
                Leyenda de Advertencia Preventiva en Comprobantes
              </label>
              <input
                type="text"
                value={nonFiscalWarningLegend}
                onChange={(e) => setNonFiscalWarningLegend?.(e.target.value)}
                placeholder={SENIAT_LEGAL_CONSTANTS.NON_FISCAL_WARNING_LEGEND}
                className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Texto normativo exigido por el Artículo 11 de la Providencia SNAT/2011/00071.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* SECCIÓN 2: DATOS DEL COMERCIO EMISOR (Común a digital y talonario)*/}
      {/* ================================================================ */}
      {fiscalBillingEnabled && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Building2 className="w-4 h-4 text-primary" />
              <span>Datos Fiscales del Comercio Emisor (Providencia 00071)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  RIF del Comercio / Emisor *
                </label>
                <input
                  type="text"
                  value={emitterRif}
                  onChange={(e) => setEmitterRif(e.target.value.toUpperCase())}
                  placeholder="ej. J-50123456-7"
                  className={`w-full h-10 px-3.5 rounded-xl border text-xs font-mono font-bold focus:ring-2 focus:outline-none uppercase ${
                    emitterRif && !rifValidation.isValid
                      ? "border-destructive text-destructive bg-destructive/5 focus:ring-destructive"
                      : "border-input bg-background text-foreground focus:ring-primary"
                  }`}
                />
                {emitterRif && !rifValidation.isValid ? (
                  <p className="text-[10px] text-destructive mt-1">{rifValidation.error}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Debe coincidir con la planilla del RIF emitida por el SENIAT.
                  </p>
                )}
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Razón Social Fiscal Registrada *
                </label>
                <input
                  type="text"
                  value={emitterBusinessName}
                  onChange={(e) => setEmitterBusinessName(e.target.value)}
                  placeholder="ej. Inversiones & Comercializadora Market C.A."
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
                  placeholder="ej. Av. Las Industrias c/c Calle 12, Local N° 4, Zona Industrial, Barquisimeto, Edo. Lara"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Dirección exacta según constancia de inscripción en el Registro de Información Fiscal.
                </p>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Teléfono Fiscal de Contacto
                </label>
                <input
                  type="text"
                  value={emitterPhone}
                  onChange={(e) => setEmitterPhone(e.target.value)}
                  placeholder="ej. +58 424 5919577"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Condición Tributaria ante el SENIAT
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
            </div>
          </div>

          {/* ================================================================ */}
          {/* SECCIÓN 3: ALÍCUOTAS DE IMPUESTOS (IVA 16% & IGTF 3%)            */}
          {/* ================================================================ */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Scale className="w-4 h-4 text-primary" />
              <span>Régimen Tributario & Alícuotas de Impuesto</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
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
                  Tasa general estipulada por la Ley del IVA (actualmente 16.00%).
                </p>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Tratamiento de Productos Exentos (Art. 18 Ley del IVA)
                </label>
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-[11px] text-muted-foreground leading-snug">
                  Los productos marcados como <strong className="text-foreground">Exentos</strong> en tu catálogo (arroz, harina, leche, huevos, medicamentos) tributarán al <strong className="text-foreground">0%</strong> y se discriminarán en la columna de exentos.
                </div>
              </div>
            </div>

            {/* IGTF 3% Card */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-4">
              <div>
                <h5 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <span>Impuesto a las Grandes Transacciones Financieras (IGTF 3%)</span>
                  {taxPayerType === "SPECIAL" && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      Obligatorio si cobras en divisas
                    </span>
                  )}
                </h5>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Aplica el 3% a cobros recibidos en moneda extranjera (efectivo USD, Zelle, transferencias en divisas) si tu empresa actúa como agente de percepción designado por el SENIAT.
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

          {/* ================================================================ */}
          {/* SECCIÓN 4: CORRELATIVOS Y RANGOS DE CONTROL SENIAT              */}
          {/* ================================================================ */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Hash className="w-4 h-4 text-primary" />
              <span>Correlativos y Números de Control Autorizados por el SENIAT</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Próximo N° de Factura
                </label>
                <input
                  type="number"
                  min="1"
                  value={nextInvoiceNumber}
                  onChange={(e) => setNextInvoiceNumber?.(Math.max(1, Number(e.target.value)))}
                  placeholder="1001"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Se incrementa automáticamente en cada factura emitida.
                </p>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Serie / Prefijo de Control
                </label>
                <input
                  type="text"
                  value={controlPrefix}
                  onChange={(e) => setControlPrefix?.(e.target.value)}
                  placeholder="00-"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Formato de dos dígitos asignado por imprenta (ej. "00-").
                </p>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">
                  Próximo N° de Control SENIAT
                </label>
                <input
                  type="number"
                  min="1"
                  value={nextControlNumber}
                  onChange={(e) => setNextControlNumber?.(Math.max(1, Number(e.target.value)))}
                  placeholder="1"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Ejemplo formateado: <strong className="font-mono text-primary">{controlPrefix}{nextControlNumber.toString().padStart(8, "0")}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* SECCIÓN 5: PROVEEDOR TECNOLÓGICO / IMPRENTA DIGITAL (API)       */}
          {/* ================================================================ */}
          {billingMode === "DIGITAL_INVOICE" && (
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                <FileText className="w-4 h-4 text-primary" />
                <span>Imprenta Digital Autorizada (Proveedor Tecnológico Homologado)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    Proveedor de Facturación Digital
                  </label>
                  <select
                    value={fiscalProvider}
                    onChange={(e) => setFiscalProvider(e.target.value as FiscalProvider)}
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    <option value="THE_FACTORY_HKA">The Factory HKA (Líder en Venezuela)</option>
                    <option value="LIXIE">Lixie Digital</option>
                    <option value="GURUSOFT">GuruSoft e-Docs</option>
                    <option value="FACTURATECH">FacturaTech</option>
                    <option value="MANUAL_SIMULATION">Simulador Local / Emisión Directa</option>
                  </select>
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
                    <option value="SANDBOX">Sandbox / Modo Pruebas</option>
                    <option value="PRODUCTION">Producción (Transmisión Real al SENIAT)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-muted-foreground block mb-1.5">
                    API Token / Clave de Integración con la Imprenta Digital
                  </label>
                  <input
                    type="password"
                    value={providerApiKey}
                    onChange={(e) => setProviderApiKey(e.target.value)}
                    placeholder="••••••••••••••••••••••••••••••••"
                    className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Credencial provista por tu imprenta digital para firmar los comprobantes con CUV y QR fiscal.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
