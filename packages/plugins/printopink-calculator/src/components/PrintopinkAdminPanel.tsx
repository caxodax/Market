"use client";

import React, { useState } from "react";
import type {
  PrintopinkCalculation,
  CreatePrintopinkCalculationInput,
  PrintopinkQuote,
  CreatePrintopinkQuoteInput,
} from "@marketos/types";
import { PrintopinkCalculator } from "./PrintopinkCalculator";
import { PrintopinkQuoteBuilder } from "./PrintopinkQuoteBuilder";
import { PrintopinkCatalogView } from "./PrintopinkCatalogView";
import { Calculator, FileText, Share2, Sparkles } from "lucide-react";

export interface PrintopinkAdminPanelProps {
  tenantId: string;
  calculations: PrintopinkCalculation[];
  quotes: PrintopinkQuote[];
  onSaveCalculation: (payload: CreatePrintopinkCalculationInput) => Promise<boolean>;
  onDeleteCalculation: (id: string) => Promise<boolean>;
  onCreateQuote: (payload: CreatePrintopinkQuoteInput) => Promise<boolean>;
  currencySymbol?: string;
  exchangeRate?: number;
  storeName?: string;
}

type TabType = "calculator" | "catalog" | "quotes";

export function PrintopinkAdminPanel({
  tenantId,
  calculations,
  quotes,
  onSaveCalculation,
  onDeleteCalculation,
  onCreateQuote,
  currencySymbol = "$",
  exchangeRate = 1,
  storeName = "PrintoPink",
}: PrintopinkAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("calculator");
  const [selectedCalc, setSelectedCalc] = useState<PrintopinkCalculation | null>(null);
  const [pendingQuoteItem, setPendingQuoteItem] = useState<{
    title: string;
    unitPriceBase: number;
    quantity: number;
  } | null>(null);

  const handleSelectCalculation = (calc: PrintopinkCalculation) => {
    setSelectedCalc(calc);
    setActiveTab("calculator");
  };

  const handleSendToQuote = (item: {
    title: string;
    unitPriceBase: number;
    quantity: number;
  }) => {
    setPendingQuoteItem(item);
    setActiveTab("quotes");
  };

  const handleSendCalcToQuote = (calc: PrintopinkCalculation) => {
    setPendingQuoteItem({
      title: calc.title,
      unitPriceBase: calc.selling_price_base,
      quantity: 1,
    });
    setActiveTab("quotes");
  };

  return (
    <div className="space-y-6">
      {/* Pestañas de Navegación del Módulo */}
      <div className="flex border-b border-border gap-2 pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            setSelectedCalc(null);
            setActiveTab("calculator");
          }}
          className={`h-11 px-4 sm:px-5 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "calculator"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Calculadora de Costos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("catalog")}
          className={`h-11 px-4 sm:px-5 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "catalog"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Fichas Guardadas ({calculations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("quotes")}
          className={`h-11 px-4 sm:px-5 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "quotes"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Cotizador WhatsApp (50% Abono)</span>
          {quotes.length > 0 && (
            <span className="px-1.5 py-0.2 bg-muted text-muted-foreground rounded-full text-[10px]">
              {quotes.length}
            </span>
          )}
        </button>
      </div>

      {/* Renderizado de Vistas según Pestaña Activa */}
      {activeTab === "calculator" && (
        <PrintopinkCalculator
          tenantId={tenantId}
          initialCalculation={selectedCalc}
          onSaveCalculation={onSaveCalculation}
          onSendToQuote={handleSendToQuote}
          currencySymbol={currencySymbol}
          exchangeRate={exchangeRate}
        />
      )}

      {activeTab === "catalog" && (
        <PrintopinkCatalogView
          tenantId={tenantId}
          calculations={calculations}
          onSelectCalculation={handleSelectCalculation}
          onDeleteCalculation={onDeleteCalculation}
          onSendToQuote={handleSendCalcToQuote}
          currencySymbol={currencySymbol}
          exchangeRate={exchangeRate}
        />
      )}

      {activeTab === "quotes" && (
        <PrintopinkQuoteBuilder
          tenantId={tenantId}
          quotes={quotes}
          onCreateQuote={onCreateQuote}
          pendingQuoteItem={pendingQuoteItem}
          currencySymbol={currencySymbol}
          exchangeRate={exchangeRate}
          storeName={storeName}
        />
      )}
    </div>
  );
}
