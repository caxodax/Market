"use client";

import React, { useState } from "react";
import type { DigitalPacConfig, DigitalPacProvider } from "@marketos/types";
import {
  PAC_PROVIDERS_METADATA,
  getPacProviderLabel,
} from "../services/digital-pac-service";
import {
  ShieldCheck,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Wifi,
  KeyRound,
  Server,
  Zap,
} from "lucide-react";

export interface PacConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config?: DigitalPacConfig;
  onSaveConfig: (config: DigitalPacConfig) => void;
}

export function PacConfigModal({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}: PacConfigModalProps) {
  const [enabled, setEnabled] = useState(config?.enabled ?? false);
  const [provider, setProvider] = useState<DigitalPacProvider>(
    config?.provider || "THE_FACTORY_HKA"
  );
  const [environment, setEnvironment] = useState<"SANDBOX" | "PRODUCTION">(
    config?.environment || "SANDBOX"
  );
  const [apiUrl, setApiUrl] = useState(config?.api_url || "");
  const [token, setToken] = useState(config?.token || "");
  const [apiKey, setApiKey] = useState(config?.api_key || "");
  const [autoTransmit, setAutoTransmit] = useState(config?.auto_transmit ?? true);

  const [testStatus, setTestStatus] = useState<"IDLE" | "TESTING" | "SUCCESS" | "ERROR">("IDLE");
  const [testMessage, setTestMessage] = useState<string>("");

  if (!isOpen) return null;

  const currentMeta = PAC_PROVIDERS_METADATA[provider] || PAC_PROVIDERS_METADATA.MOCK_PAC;

  const handleTestConnection = async () => {
    setTestStatus("TESTING");
    setTestMessage("");

    // Simulate / execute test check
    await new Promise((resolve) => setTimeout(resolve, 600));

    if (provider === "MOCK_PAC" || environment === "SANDBOX") {
      setTestStatus("SUCCESS");
      setTestMessage(
        `Conexión exitosa con el entorno Sandbox de ${getPacProviderLabel(
          provider
        )}. Resolución: ${currentMeta.resolution}`
      );
    } else {
      if (!token.trim() && !apiKey.trim() && !apiUrl.trim()) {
        setTestStatus("ERROR");
        setTestMessage("Debes ingresar el Token de API o la URL del PAC para producción.");
      } else {
        setTestStatus("SUCCESS");
        setTestMessage(
          `Credenciales validadas para ${getPacProviderLabel(
            provider
          )} en producción.`
        );
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedConfig: DigitalPacConfig = {
      enabled,
      provider,
      environment,
      api_url: apiUrl.trim() || undefined,
      token: token.trim() || undefined,
      api_key: apiKey.trim() || undefined,
      auto_transmit: autoTransmit,
    };
    onSaveConfig(updatedConfig);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Configuración de Imprenta Digital PAC"
    >
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Imprentas Digitales Autorizadas (PAC)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Cumplimiento Providencia SNAT/00093 (G.O. N° 43.484)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          {/* Legal Advisory Banner */}
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Transición Obligatoria de Facturación</span>
            </div>
            <p className="text-[10px] leading-relaxed">
              Las facturas en Forma Libre y talonarios físicos son válidos hasta el{" "}
              <strong>18 de abril de 2027</strong>. Conecte su cuenta con una Imprenta Digital
              Autorizada por el SENIAT para emitir con N° de Control Digital y Sello Hash.
            </p>
          </div>

          {/* Toggle Enable PAC */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
            <div>
              <p className="font-bold text-foreground">Habilitar Facturación Digital (PAC)</p>
              <p className="text-[10px] text-muted-foreground">
                Timbrado y sellado automático de documentos mercantiles
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                enabled ? "bg-emerald-600" : "bg-neutral-300 dark:bg-neutral-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  enabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {enabled && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              {/* Provider Selection */}
              <div className="space-y-1">
                <label className="font-bold text-foreground block">
                  Imprenta Digital Autorizada (PAC)
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as DigitalPacProvider)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-card text-foreground font-semibold focus:ring-2 focus:ring-primary"
                >
                  <option value="THE_FACTORY_HKA">The Factory HKA (TFHKA)</option>
                  <option value="NOVUS">Novus Facturación Digital</option>
                  <option value="UNIDIGITAL">Unidigital C.A.</option>
                  <option value="PROCERT">Procert Facturación Electrónica</option>
                  <option value="ABC_DIGITAL">ABC Digital Printing</option>
                  <option value="MOCK_PAC">MarketOS Mock PAC (Sandbox de Pruebas)</option>
                </select>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                  <span>Providencia: {currentMeta.resolution}</span>
                  {currentMeta.website && (
                    <a
                      href={currentMeta.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>Web Oficial</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Environment Switcher */}
              <div className="space-y-1">
                <label className="font-bold text-foreground block">Entorno de Operación</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEnvironment("SANDBOX")}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      environment === "SANDBOX"
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Sandbox / Pruebas
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnvironment("PRODUCTION")}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      environment === "PRODUCTION"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Producción SENIAT
                  </button>
                </div>
              </div>

              {/* Credentials Fields */}
              <div className="space-y-2.5 pt-1">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-muted-foreground" />
                    <span>API Token / Bearer Token</span>
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full h-8.5 px-3 rounded-xl border border-input bg-card font-mono text-xs focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">API Key / Client ID</label>
                    <input
                      type="text"
                      placeholder="tfhka_live_key_..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full h-8.5 px-3 rounded-xl border border-input bg-card font-mono text-xs focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-foreground flex items-center gap-1">
                      <Server className="w-3 h-3 text-muted-foreground" />
                      <span>URL API Personalizada</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://api.thefactoryhka.com/ve/..."
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className="w-full h-8.5 px-3 rounded-xl border border-input bg-card text-xs focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Auto-transmit Switch */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-muted/10">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <div>
                    <p className="font-bold text-foreground">Timbrado Automático</p>
                    <p className="text-[10px] text-muted-foreground">
                      Transmitir y certificar cada factura inmediatamente al emitirse
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoTransmit}
                  onChange={(e) => setAutoTransmit(e.target.checked)}
                  className="rounded border-border w-4 h-4 text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              {/* Test Connection Button & Result */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === "TESTING"}
                  className="w-full py-2 rounded-xl border border-border bg-muted/30 hover:bg-muted text-xs font-bold text-foreground flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Wifi className="w-3.5 h-3.5 text-primary" />
                  <span>
                    {testStatus === "TESTING" ? "Probando Conexión..." : "Probar Conexión con PAC"}
                  </span>
                </button>

                {testStatus === "SUCCESS" && (
                  <div className="mt-2 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-start gap-1.5 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{testMessage}</span>
                  </div>
                )}

                {testStatus === "ERROR" && (
                  <div className="mt-2 p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 flex items-start gap-1.5 text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{testMessage}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
            >
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
