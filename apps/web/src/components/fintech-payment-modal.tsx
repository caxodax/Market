"use client";

import React, { useState } from "react";
import type {
  Order,
  FintechPaymentProvider,
  FintechPaymentLink,
} from "@marketos/types";
import {
  generateFintechPaymentLink,
  buildFintechWhatsAppShareMessage,
  formatCurrency,
} from "@marketos/utils";
import {
  X,
  CreditCard,
  QrCode,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Building2,
} from "lucide-react";

interface FintechPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  tenantId: string;
  tenantName: string;
  exchangeRateBcv?: number;
}

export function FintechPaymentModal({
  isOpen,
  onClose,
  order,
  tenantId,
  tenantName,
  exchangeRateBcv = 875.65,
}: FintechPaymentModalProps) {
  const [selectedProvider, setSelectedProvider] =
    useState<FintechPaymentProvider>("CASHEA");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentLink: FintechPaymentLink = generateFintechPaymentLink({
    tenantId,
    tenantName,
    orderId: order.id,
    provider: selectedProvider,
    amountUsd: order.total_usd,
    exchangeRateBcv,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
  });

  const whatsappUrl = buildFintechWhatsAppShareMessage(
    currentLink,
    order.customer_phone
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentLink.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const providers: {
    id: FintechPaymentProvider;
    name: string;
    tag: string;
    badge: string;
    color: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "CASHEA",
      name: "Cashea",
      tag: "BNPL 3 Cuotas sin interés",
      badge: "Más Popular",
      color: "border-yellow-500 bg-yellow-500/10 text-yellow-600",
      icon: <Sparkles className="w-5 h-5 text-yellow-500" />,
    },
    {
      id: "BIOPAGO_BDV",
      name: "Biopago BDV",
      tag: "Banco de Venezuela Huella/Tarjeta",
      badge: "Tasa BCV",
      color: "border-red-500 bg-red-500/10 text-red-600",
      icon: <Building2 className="w-5 h-5 text-red-500" />,
    },
    {
      id: "SPIDI",
      name: "Spidi Pay",
      tag: "Checkout 1-Click Digital",
      badge: "Instantáneo",
      color: "border-emerald-500 bg-emerald-500/10 text-emerald-600",
      icon: <Smartphone className="w-5 h-5 text-emerald-500" />,
    },
    {
      id: "WAYUPAY",
      name: "WayuPay",
      tag: "Pasarela Multimoneda",
      badge: "Tarjetas",
      color: "border-blue-500 bg-blue-500/10 text-blue-600",
      icon: <CreditCard className="w-5 h-5 text-blue-500" />,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                Generador de Enlaces Fintech & BNPL
              </h3>
              <p className="text-xs text-muted-foreground">
                Orden #{order.id} • {order.customer_name || "Cliente"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Provider Selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Seleccione Pasarela / Método
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {providers.map((p) => {
                const isSelected = selectedProvider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProvider(p.id)}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                        : "border-border hover:border-border/80 bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-2">
                        {p.icon}
                        <span className="font-bold text-xs text-foreground">
                          {p.name}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.color}`}>
                        {p.badge}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground line-clamp-1">
                      {p.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Summary */}
          <div className="p-3.5 bg-muted/50 rounded-xl border border-border flex items-center justify-between">
            <div>
              <div className="text-[11px] text-muted-foreground">Monto de la Orden</div>
              <div className="text-lg font-black text-foreground">
                {currentLink.currency === "USD"
                  ? `$${currentLink.amount.toFixed(2)}`
                  : `Bs. ${currentLink.amount.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`}
              </div>
            </div>
            {currentLink.currency === "VES" && (
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">Tasa Oficial</div>
                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Bs. {exchangeRateBcv.toFixed(2)} / USD
                </div>
              </div>
            )}
          </div>

          {/* Link Display & Copy */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Enlace de Pago Generado
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentLink.url}
                className="flex-1 px-3 py-2 text-xs bg-muted/60 border border-border rounded-xl font-mono text-foreground focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold rounded-xl border border-border transition-all flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* QR representation note */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
            <QrCode className="w-8 h-8 text-primary shrink-0" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Código QR preparado:</span> El cliente puede escanear este enlace directamente desde su app de {selectedProvider === "CASHEA" ? "Cashea" : selectedProvider} para autorizar en segundos.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Cerrar
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Share2 className="w-4 h-4" />
            Compartir por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
