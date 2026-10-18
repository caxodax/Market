"use client";

import React, { useState } from "react";
import { Copy, Check, QrCode } from "lucide-react";

export interface PagoMovilAccountData {
  bank: string;
  phone: string;
  id_doc: string;
  name?: string;
}

export interface PagoMovilCardProps {
  data: PagoMovilAccountData;
  amountBs?: number;
  exchangeRate?: number;
  className?: string;
}

export function PagoMovilCard({
  data,
  amountBs,
  exchangeRate,
  className = "",
}: PagoMovilCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className={`p-4 rounded-2xl bg-muted/40 border border-border text-xs space-y-3 ${className}`}>
      <div className="font-bold text-foreground flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <QrCode className="w-4 h-4 text-primary" />
          <span>Datos para Pago Móvil</span>
        </div>
        <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
          {data.bank}
        </span>
      </div>

      <div className="space-y-2 pt-1">
        {/* Banco */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">
              Banco Receptor
            </span>
            <span className="font-bold text-xs text-foreground">
              {data.bank}
            </span>
          </div>
        </div>

        {/* Teléfono */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">
              Teléfono
            </span>
            <span className="font-mono font-bold text-xs text-foreground">
              {data.phone}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(data.phone.replace(/\D/g, ""), "phone")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              copiedField === "phone"
                ? "bg-emerald-600 text-white"
                : "bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border"
            }`}
          >
            {copiedField === "phone" ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>

        {/* Cédula o RIF */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">
              Cédula / RIF
            </span>
            <span className="font-mono font-bold text-xs text-foreground">
              {data.id_doc}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(data.id_doc.replace(/[^A-Za-z0-9]/g, ""), "id_doc")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              copiedField === "id_doc"
                ? "bg-emerald-600 text-white"
                : "bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border"
            }`}
          >
            {copiedField === "id_doc" ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>

        {/* Titular */}
        {data.name && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                Titular
              </span>
              <span className="font-medium text-xs text-foreground">
                {data.name}
              </span>
            </div>
          </div>
        )}

        {/* Monto exacto a transferir */}
        {amountBs !== undefined && amountBs > 0 && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-100">
            <div>
              <span className="text-[10px] uppercase font-bold block opacity-80">
                Monto Exacto a Transferir
              </span>
              <span className="font-bold text-sm">
                Bs. {new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountBs)}
              </span>
              {exchangeRate && (
                <span className="text-[10px] block opacity-70">
                  (Tasa BCV: {exchangeRate.toFixed(2)} Bs/$)
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleCopy(amountBs.toFixed(2), "amount")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                copiedField === "amount"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-600/20 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {copiedField === "amount" ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Bs.</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
