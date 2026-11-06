"use client";

import React, { useState, useMemo } from "react";
import type {
  PrintopinkCalculation,
  PrintopinkMaterialItem,
  PrintopinkPresetCategory,
  CreatePrintopinkCalculationInput,
} from "@marketos/types";
import {
  PRINTOPINK_FACTORY_PRESETS,
  type PrintopinkPresetId,
} from "../presets/printopink-presets";
import {
  calculateMaterialsCost,
  calculateTotalProductionCost,
  calculateSellingPriceFromMargin,
  calculateNetProfit,
  convertBimonetary,
} from "../services/pricing-engine";
import {
  Calculator,
  Plus,
  Trash2,
  DollarSign,
  Percent,
  Layers,
  Wrench,
  TrendingUp,
  Tag,
  FileText,
  Scissors,
  Shirt,
  Package,
  Sparkles,
  Check,
  RotateCcw,
  Send,
  Save,
} from "lucide-react";

export interface PrintopinkCalculatorProps {
  tenantId: string;
  initialCalculation?: PrintopinkCalculation | null;
  onSaveCalculation: (payload: CreatePrintopinkCalculationInput) => Promise<boolean>;
  onSendToQuote?: (item: { title: string; unitPriceBase: number; quantity: number }) => void;
  currencySymbol?: string;
  exchangeRate?: number;
}

export function PrintopinkCalculator({
  tenantId,
  initialCalculation,
  onSaveCalculation,
  onSendToQuote,
  currencySymbol = "$",
  exchangeRate = 1,
}: PrintopinkCalculatorProps) {
  // Estado general de la ficha
  const [title, setTitle] = useState(
    initialCalculation?.title || "Etiquetas Adhesivas Fotográficas"
  );
  const [presetCategory, setPresetCategory] = useState<PrintopinkPresetCategory>(
    initialCalculation?.preset_category || "stickers"
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    initialCalculation ? "custom" : "stickers_photo"
  );

  // Tríada de costos reales
  const [materials, setMaterials] = useState<PrintopinkMaterialItem[]>(() => {
    if (initialCalculation?.materials_breakdown?.length) {
      return initialCalculation.materials_breakdown;
    }
    const def = PRINTOPINK_FACTORY_PRESETS[0].defaultMaterials;
    return def.map((m) => ({ ...m }));
  });

  const [machineryCost, setMachineryCost] = useState<number>(
    initialCalculation?.machinery_cost_base ?? 0.05
  );
  const [laborCost, setLaborCost] = useState<number>(
    initialCalculation?.labor_cost_base ?? 0.6
  );
  const [wastePercentage, setWastePercentage] = useState<number>(
    initialCalculation?.waste_percentage ?? 0
  );

  // Fijación de Precio y Rentabilidad
  const [sellingPrice, setSellingPrice] = useState<number>(
    initialCalculation?.selling_price_base ?? 1.8
  );
  const [wholesalePrice, setWholesalePrice] = useState<string>(
    initialCalculation?.wholesale_price_base ? String(initialCalculation.wholesale_price_base) : "1.60"
  );
  const [notes, setNotes] = useState(initialCalculation?.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Cálculos matemáticos en vivo
  const calculations = useMemo(() => {
    const materialsSum = calculateMaterialsCost(materials);
    const totalCost = calculateTotalProductionCost(
      materialsSum,
      machineryCost,
      laborCost,
      wastePercentage
    );
    const profit = calculateNetProfit(sellingPrice, totalCost);
    const costVes = convertBimonetary(totalCost, exchangeRate);
    const priceVes = convertBimonetary(sellingPrice, exchangeRate);
    const profitVes = convertBimonetary(profit.netProfit, exchangeRate);

    return {
      materialsSum,
      totalCost,
      costVes,
      sellingPrice,
      priceVes,
      netProfit: profit.netProfit,
      profitVes,
      marginPercentage: profit.marginPercentage,
    };
  }, [materials, machineryCost, laborCost, wastePercentage, sellingPrice, exchangeRate]);

  // Manejador para aplicar una plantilla del PDF con 1 clic
  const handleApplyPreset = (presetId: PrintopinkPresetId) => {
    const preset = PRINTOPINK_FACTORY_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setSelectedPresetId(preset.id);
    setPresetCategory(preset.category);
    setTitle(preset.title);
    setMaterials(preset.defaultMaterials.map((m) => ({ ...m })));
    setMachineryCost(preset.defaultMachineryCost);
    setLaborCost(preset.defaultLaborCost);
    setWastePercentage(preset.defaultWastePercentage);
    setSellingPrice(preset.suggestedPrice);
    const wp =
      "wholesalePrice" in preset && typeof (preset as any).wholesalePrice === "number"
        ? (preset as any).wholesalePrice.toFixed(2)
        : "";
    setWholesalePrice(wp);
    setNotes(preset.tips || "");
  };

  // Manejo de materiales
  const handleAddMaterial = () => {
    setMaterials([
      ...materials,
      {
        name: "Nuevo Insumo Directo",
        cost: 0.5,
        qty: 1,
        subtotal: 0.5,
      },
    ]);
  };

  const handleUpdateMaterial = (
    index: number,
    field: keyof PrintopinkMaterialItem,
    value: any
  ) => {
    setMaterials((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        const updated = { ...it, [field]: value };
        if (field === "cost" || field === "qty") {
          const cost = field === "cost" ? Number(value) || 0 : it.cost;
          const qty = field === "qty" ? Number(value) || 1 : it.qty || 1;
          updated.subtotal = Math.round(cost * qty * 10000) / 10000;
        }
        return updated;
      })
    );
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterials((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Ajuste rápido de margen con slider o botones de %
  const handleSetMargin = (marginPct: number) => {
    const newPrice = calculateSellingPriceFromMargin(calculations.totalCost, marginPct);
    setSellingPrice(newPrice);
  };

  // Guardar cálculo
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const payload: CreatePrintopinkCalculationInput = {
        tenantId,
        title: title.trim(),
        presetCategory,
        materialsCostBase: calculations.materialsSum,
        machineryCostBase: machineryCost,
        laborCostBase: laborCost,
        wastePercentage,
        sellingPriceBase: sellingPrice,
        wholesalePriceBase: wholesalePrice ? parseFloat(wholesalePrice) : null,
        materialsBreakdown: materials,
        notes: notes.trim() || undefined,
      };

      const ok = await onSaveCalculation(payload);
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* 1. BARRA SUPERIOR DE PLANTILLAS RÁPIDAS (1-CLIC PRESETS DEL PDF) */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                Calculadora de Taller PrintoPink
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Costeo directo por pieza: Insumos + Desgaste de Máquinas + Mano de Obra.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-xl border border-border">
              BCV Oficial: Bs. {exchangeRate.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Título de la Ficha Editable */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">
            Nombre del Producto o Trabajo <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Etiquetas Adhesivas Fotográficas"
            className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-foreground text-sm font-semibold focus:ring-2 focus:ring-primary outline-none transition"
          />
        </div>

        {/* Botones de Presets de 1 Toque */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Plantillas Rápidas del Taller (Guía PrintoPink):</span>
            </span>
            <span className="text-[11px] text-muted-foreground">Carga con 1 toque</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {PRINTOPINK_FACTORY_PRESETS.map((p) => {
              const isSelected = selectedPresetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPreset(p.id)}
                  className={`py-2 px-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer active:scale-95 min-h-[58px] ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 font-bold"
                      : "border-border bg-background hover:bg-muted text-foreground"
                  }`}
                >
                  <span className="text-[11px] font-bold line-clamp-2 leading-tight">
                    {p.title}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      isSelected ? "text-primary-foreground/90" : "text-primary"
                    }`}
                  >
                    PVP ${p.suggestedPrice.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. LAYOUT SIMÉTRICO 50% / 50% (Desktop) | LINEAR WIZARD (Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* COLUMNA IZQUIERDA (50%): TRÍADA DE COSTOS */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            {/* Cabecera Columna */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Tríada de Costos de Producción
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-foreground bg-muted/60 px-2.5 py-1 rounded-lg">
                Subtotal: {currencySymbol}{calculations.totalCost.toFixed(2)}
              </span>
            </div>

            {/* CONCEPTO 1: MATERIALES DIRECTOS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  <span>1. Insumos & Materiales Directos:</span>
                </span>
                <button
                  type="button"
                  onClick={handleAddMaterial}
                  className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Insumo</span>
                </button>
              </div>

              <div className="space-y-2">
                {materials.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-border bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <input
                      type="text"
                      value={it.name}
                      onChange={(e) => handleUpdateMaterial(idx, "name", e.target.value)}
                      placeholder="Nombre del material..."
                      className="font-bold text-foreground bg-transparent outline-none flex-1 min-w-0 px-1"
                    />

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">$</span>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={it.cost}
                          onChange={(e) =>
                            handleUpdateMaterial(idx, "cost", parseFloat(e.target.value) || 0)
                          }
                          className="w-16 h-7 px-1.5 rounded-lg border border-border bg-muted/30 text-center font-bold text-foreground font-mono"
                          title="Costo por unidad"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">x</span>
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          value={it.qty ?? 1}
                          onChange={(e) =>
                            handleUpdateMaterial(idx, "qty", parseFloat(e.target.value) || 1)
                          }
                          className="w-12 h-7 px-1 rounded-lg border border-border bg-muted/30 text-center font-bold text-foreground font-mono"
                          title="Cantidad usada"
                        />
                      </div>

                      <span className="font-mono font-bold text-foreground min-w-[55px] text-right">
                        ${it.subtotal.toFixed(3)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveMaterial(idx)}
                        className="p-1 text-muted-foreground hover:text-rose-500 rounded-md transition"
                        title="Eliminar insumo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CONCEPTO 2: DESGASTE DE MAQUINARIA & LUZ */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-500" />
                  <span>2. Desgaste de Maquinaria + Luz:</span>
                </span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                  ${machineryCost.toFixed(2)} USD
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={machineryCost}
                    onChange={(e) => setMachineryCost(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-bold outline-none font-mono"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-muted-foreground font-bold">
                    USD/pieza
                  </span>
                </div>
              </div>

              {/* Botones de ajuste rápido para máquinas */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground font-bold self-center mr-1">
                  Presets:
                </span>
                {[
                  { label: "Laminadora ($0.03)", val: 0.03 },
                  { label: "Impresora ($0.05)", val: 0.05 },
                  { label: "Prensa ($0.25)", val: 0.25 },
                  { label: "Cameo+Prensa ($0.40)", val: 0.4 },
                  { label: "Doble Cara ($0.80)", val: 0.8 },
                ].map((b) => (
                  <button
                    key={b.val}
                    type="button"
                    onClick={() => setMachineryCost(b.val)}
                    className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                      machineryCost === b.val
                        ? "border-amber-500 bg-amber-500/15 text-amber-600"
                        : "border-border bg-background hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* CONCEPTO 3: MANO DE OBRA (TU TIEMPO / SUELDO) */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                  <span>3. Mano de Obra (Tu Sueldo Cobrado):</span>
                </span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                  ${laborCost.toFixed(2)} USD
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={laborCost}
                    onChange={(e) => setLaborCost(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-bold outline-none font-mono"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-muted-foreground font-bold">
                    USD/pieza
                  </span>
                </div>
              </div>

              {/* Botones de ajuste rápido para mano de obra */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground font-bold self-center mr-1">
                  Presets:
                </span>
                {[
                  { label: "Carnet ($0.12)", val: 0.12 },
                  { label: "Rápido ($0.30)", val: 0.3 },
                  { label: "Estándar ($0.60)", val: 0.6 },
                  { label: "Depilado 1L ($2.00)", val: 2.0 },
                  { label: "Depilado 2L ($3.50)", val: 3.5 },
                ].map((b) => (
                  <button
                    key={b.val}
                    type="button"
                    onClick={() => setLaborCost(b.val)}
                    className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                      laborCost === b.val
                        ? "border-indigo-500 bg-indigo-500/15 text-indigo-600"
                        : "border-border bg-background hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Merma Técnica Opcional */}
          <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Percent className="w-3 h-3 text-muted-foreground" />
              <span>Merma Técnica (fallos de calor/corte):</span>
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="1"
                min="0"
                max="25"
                value={wastePercentage}
                onChange={(e) => setWastePercentage(parseFloat(e.target.value) || 0)}
                className="w-14 h-7 rounded-lg border border-border bg-background text-center font-bold text-xs"
              />
              <span className="text-muted-foreground font-bold">%</span>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA (50%): TICKET FINANCIERO & RENTABILIDAD */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            {/* Cabecera Columna */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-foreground">
                  Fijación de Precio & Rentabilidad
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Margen Libre: {calculations.marginPercentage}%
              </span>
            </div>

            {/* Resumen de Costo de Producción */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase font-bold text-muted-foreground block">
                  Costo Total de Producción
                </span>
                <span className="text-xl sm:text-2xl font-black text-foreground font-mono">
                  ${calculations.totalCost.toFixed(2)} USD
                </span>
                <span className="text-xs text-muted-foreground font-mono block">
                  (Bs. {calculations.costVes.toFixed(2)})
                </span>
              </div>

              <div className="text-right text-xs space-y-0.5 text-muted-foreground">
                <p>Mat: ${calculations.materialsSum.toFixed(2)}</p>
                <p>Máq: ${machineryCost.toFixed(2)}</p>
                <p className="font-bold text-indigo-600 dark:text-indigo-400">
                  Sueldo: ${laborCost.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Fijar Precio de Venta (PVP) */}
            <div className="p-4 rounded-2xl bg-background border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  Precio de Venta al Público (PVP):
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-xs">$</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-24 h-9 px-2.5 rounded-xl border-2 border-primary bg-background text-foreground text-sm font-black text-right font-mono"
                  />
                  <span className="text-xs font-bold text-foreground">USD</span>
                </div>
              </div>

              {/* Botones de porcentaje de margen */}
              <div className="flex items-center justify-between gap-1 pt-1">
                <span className="text-[10px] text-muted-foreground font-bold">Margen sugerido:</span>
                <div className="flex gap-1.5">
                  {[25, 35, 50, 65].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleSetMargin(pct)}
                      className="px-2 py-0.5 rounded-lg border border-border bg-muted/40 hover:bg-primary/10 hover:text-primary text-xs font-bold transition cursor-pointer"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Precio al Mayor */}
              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                <span className="text-muted-foreground font-medium">
                  Precio al Mayor (+12 uds):
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">$</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value)}
                    placeholder="Opcional"
                    className="w-20 h-7 px-2 rounded-lg border border-border bg-muted/30 text-right font-bold text-xs"
                  />
                </div>
              </div>
            </div>

            {/* EL GRAN TICKET DE GANANCIA NETA LIBRE */}
            <div className="p-5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">
                    Ganancia Neta Libre (Empresa)
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                      +${calculations.netProfit.toFixed(2)} USD
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                      (Bs. {calculations.profitVes.toFixed(2)})
                    </span>
                  </div>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black text-sm">
                  {calculations.marginPercentage}% libre
                </div>
              </div>

              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 pt-1 border-t border-emerald-500/20">
                ✨ ¡Además de tus{" "}
                <span className="font-bold underline">${laborCost.toFixed(2)} USD</span> cobrados
                en tu sueldo de mano de obra!
              </p>
            </div>

            {/* Notas opcionales */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">
                Notas y Recomendaciones de Producción:
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Cobertura estándar. En lotes grandes ofrecer $1.60."
                className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-xs outline-none"
              />
            </div>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="pt-4 border-t border-border flex flex-col sm:flex-row gap-2.5">
            {onSendToQuote && (
              <button
                type="button"
                onClick={() =>
                  onSendToQuote({
                    title: title.trim(),
                    unitPriceBase: sellingPrice,
                    quantity: 1,
                  })
                }
                className="flex-1 h-11 px-4 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Agregar a Cotización WhatsApp</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-primary/20 disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>¡Ficha Guardada con Éxito!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? "Guardando..." : "Guardar Ficha Técnica"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
