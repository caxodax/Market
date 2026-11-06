"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PrintopinkAdminPanel } from "@marketos/plugin-printopink-calculator";
import type {
  PrintopinkCalculation,
  CreatePrintopinkCalculationInput,
  PrintopinkQuote,
  CreatePrintopinkQuoteInput,
} from "@marketos/types";
import {
  getPrintopinkCalculationsAction,
  savePrintopinkCalculationAction,
  deletePrintopinkCalculationAction,
  getPrintopinkQuotesAction,
  createPrintopinkQuoteAction,
} from "@/app/admin/printopink-actions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export interface PrintopinkCalculatorAdminProps {
  tenantId: string;
  exchangeRate?: number;
  currencySymbol?: string;
  businessName?: string;
}

export function PrintopinkCalculatorAdmin({
  tenantId,
  exchangeRate = 1,
  currencySymbol = "$",
  businessName = "PrintoPink",
}: PrintopinkCalculatorAdminProps) {
  const [calculations, setCalculations] = useState<PrintopinkCalculation[]>([]);
  const [quotes, setQuotes] = useState<PrintopinkQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [calcsRes, quotesRes] = await Promise.all([
        getPrintopinkCalculationsAction(tenantId),
        getPrintopinkQuotesAction(tenantId),
      ]);

      if (calcsRes.success && calcsRes.data) {
        setCalculations(calcsRes.data);
      }
      if (quotesRes.success && quotesRes.data) {
        setQuotes(quotesRes.data);
      }
    } catch (err) {
      console.error("[PrintopinkCalculatorAdmin] Error loading data:", err);
      toast.error("Error al cargar los datos del taller");
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveCalculation = async (
    payload: CreatePrintopinkCalculationInput
  ): Promise<boolean> => {
    try {
      const res = await savePrintopinkCalculationAction(payload);
      if (res.success && res.data) {
        setCalculations((prev) => [res.data!, ...prev.filter((c) => c.id !== res.data!.id)]);
        toast.success(`Ficha "${payload.title}" guardada exitosamente`);
        return true;
      } else {
        toast.error(res.error || "No se pudo guardar la ficha de costeo");
        return false;
      }
    } catch (err) {
      toast.error("Error de comunicación al guardar la ficha");
      return false;
    }
  };

  const handleDeleteCalculation = async (id: string): Promise<boolean> => {
    try {
      const res = await deletePrintopinkCalculationAction(tenantId, id);
      if (res.success) {
        setCalculations((prev) => prev.filter((c) => c.id !== id));
        toast.success("Ficha eliminada del catálogo");
        return true;
      } else {
        toast.error(res.error || "No se pudo eliminar la ficha");
        return false;
      }
    } catch {
      toast.error("Error al eliminar la ficha");
      return false;
    }
  };

  const handleCreateQuote = async (
    payload: CreatePrintopinkQuoteInput
  ): Promise<boolean> => {
    try {
      const res = await createPrintopinkQuoteAction(payload);
      if (res.success && res.data) {
        setQuotes((prev) => [res.data!, ...prev]);
        toast.success(`Presupuesto #${res.data.quote_number} registrado`);
        return true;
      } else {
        toast.error(res.error || "Error al registrar la cotización");
        return false;
      }
    } catch {
      toast.error("Error al procesar la cotización");
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs font-semibold text-muted-foreground">
          Cargando calculadora y fórmulas de taller PrintoPink...
        </p>
      </div>
    );
  }

  return (
    <PrintopinkAdminPanel
      tenantId={tenantId}
      calculations={calculations}
      quotes={quotes}
      onSaveCalculation={handleSaveCalculation}
      onDeleteCalculation={handleDeleteCalculation}
      onCreateQuote={handleCreateQuote}
      currencySymbol={currencySymbol}
      exchangeRate={exchangeRate}
      storeName={businessName}
    />
  );
}
