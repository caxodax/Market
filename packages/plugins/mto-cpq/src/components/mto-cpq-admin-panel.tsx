"use client";

import React, { useState } from "react";
import {
  CpqCostSettings,
  CpqPricingMatrix,
  CpqCalculationResult,
  CpqDimensions,
  Order,
  CpqOrderMilestone,
  CpqWorkOrder,
} from "@marketos/types";
import { CustomProductConfigurator } from "./custom-product-configurator";
import { AdminCostMarginInspector } from "./admin-cost-margin-inspector";
import { ProductionWorkOrderView } from "./production-work-order-view";
import { MilestonePaymentTracker } from "./milestone-payment-tracker";
import {
  Layers,
  Sliders,
  DollarSign,
  Printer,
  CreditCard,
  Save,
  CheckCircle2,
  Percent,
} from "lucide-react";

export interface MtoCpqAdminPanelProps {
  tenantId: string;
  businessName?: string;
  businessPhone?: string;
  initialCostSettings?: CpqCostSettings;
  initialMatrices?: CpqPricingMatrix[];
  orders?: Order[];
  onSaveCostSettings?: (settings: Partial<CpqCostSettings>) => Promise<boolean | void>;
  formatCurrency?: (val: number) => string;
}

const DEFAULT_CURRENCY = (val: number) => `$${val.toFixed(2)}`;

const DEFAULT_SETTINGS: CpqCostSettings = {
  id: "default-cost-settings",
  tenant_id: "default",
  hourly_labor_rate: 15.0,
  machine_cost_per_hour: 10.0,
  default_margin_percentage: 35.0,
  default_deposit_percentage: 50.0,
};

const DEFAULT_MATRIX: CpqPricingMatrix = {
  id: "matrix-acrylic-sign",
  tenant_id: "default",
  name: "Letreros y Avisos Acrílicos con Iluminación LED",
  calculation_type: "AREA",
  setup_fee: 10.0,
  waste_factor: 0.05,
  min_billable_unit: 0.25,
  deposit_percentage: 50.0,
  base_material_cost_per_unit: 25.0,
  base_labor_minutes: 30,
  is_active: true,
};

export function MtoCpqAdminPanel({
  tenantId,
  businessName = "Taller de Fabricación",
  businessPhone = "",
  initialCostSettings,
  initialMatrices = [],
  orders = [],
  onSaveCostSettings,
  formatCurrency = DEFAULT_CURRENCY,
}: MtoCpqAdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    "CONFIGURATOR" | "COST_SETTINGS" | "PAYMENT_MILESTONES" | "WORK_ORDER"
  >("CONFIGURATOR");

  // Cost Settings State
  const [costSettings, setCostSettings] = useState<CpqCostSettings>(
    initialCostSettings || DEFAULT_SETTINGS
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettingsSuccess, setSavedSettingsSuccess] = useState(false);

  // Active matrix selection
  const matrices = initialMatrices.length > 0 ? initialMatrices : [DEFAULT_MATRIX];
  const [selectedMatrixId, setSelectedMatrixId] = useState<string>(matrices[0].id);
  const activeMatrix = matrices.find((m) => m.id === selectedMatrixId) || matrices[0];

  // Active calculation from the configurator
  const [currentConfig, setCurrentConfig] = useState<{
    dimensions: CpqDimensions;
    quantity: number;
    calculation: CpqCalculationResult;
  } | null>(null);

  // Milestone Mock / Active State
  const [activeMilestone, setActiveMilestone] = useState<CpqOrderMilestone>({
    id: "mto-sample-milestone",
    order_id: orders[0]?.id || "ord-sample-mto",
    total_amount: 150.0,
    paid_amount: 75.0,
    pending_balance: 75.0,
    required_deposit_percentage: costSettings.default_deposit_percentage || 50,
    required_deposit_amount: (150.0 * (costSettings.default_deposit_percentage || 50)) / 100,
    allow_dispatch_with_balance: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSavedSettingsSuccess(false);
    try {
      if (onSaveCostSettings) {
        await onSaveCostSettings(costSettings);
      }
      setSavedSettingsSuccess(true);
      setTimeout(() => setSavedSettingsSuccess(false), 3000);
    } finally {
      setSavingSettings(false);
    }
  };

  const sampleWorkOrder: CpqWorkOrder = {
    id: "wo-sample-01",
    tenant_id: tenantId,
    order_id: orders[0]?.id || "ord-sample-mto",
    status: "IN_PROCESS",
    production_sheet: {
      work_order_number: "OT-2026-0042",
      product_name: activeMatrix.name,
      quantity: currentConfig?.quantity || 1,
      dimensions: currentConfig?.dimensions || { width: 120, height: 60, unit: "cm" },
      selected_attributes: { Material: "Acrílico 5mm", Iluminación: "LED Neón Blanco" },
      technical_specs: [
        "Cantos pulidos al diamante",
        "Tira LED Neón 12V con transformador 5A",
        "Perforaciones esquineras para embellecedores",
      ],
      materials_to_consume: [
        { name: "Plancha Acrílico 5mm", quantity: 0.72, unit: "m²" },
        { name: "LED Neón Flex", quantity: 3.6, unit: "m" },
      ],
      operator_notes: "Verificar acabado de cantos antes de embalar.",
    },
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-foreground">
              Make-to-Order & CPQ (Taller y Fabricación a Medida)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Calcula presupuestos precisos basados en Cost-Plus (materiales, m², mano de obra y merma),
            emite fichas de taller sin precios y controla el cobro de anticipos configurables para inicio de obra.
          </p>
        </div>

        {/* Subtab Navigation Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-muted/50 p-1 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setActiveSubTab("CONFIGURATOR")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === "CONFIGURATOR"
                ? "bg-card text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Cotizador en Vivo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("COST_SETTINGS")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === "COST_SETTINGS"
                ? "bg-card text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Parámetros & Costos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("PAYMENT_MILESTONES")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === "PAYMENT_MILESTONES"
                ? "bg-card text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Anticipos & Despacho</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("WORK_ORDER")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === "WORK_ORDER"
                ? "bg-card text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Ficha de Taller</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: LIVE CONFIGURATOR & ADMIN INSPECTOR */}
      {activeSubTab === "CONFIGURATOR" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Product & Dimension Configurator */}
            <div className="lg:col-span-7">
              <CustomProductConfigurator
                matrix={activeMatrix}
                costSettings={costSettings}
                isAdmin={true}
                productName={activeMatrix.name}
                businessName={businessName}
                businessPhone={businessPhone}
                formatCurrency={formatCurrency}
                onConfigurationChange={(cfg) => {
                  setCurrentConfig(cfg);
                  // Sync milestone sample with current price
                  setActiveMilestone((prev) => ({
                    ...prev,
                    total_amount: cfg.calculation.totalPrice,
                    pending_balance: Math.max(0, cfg.calculation.totalPrice - prev.paid_amount),
                    required_deposit_percentage: cfg.calculation.depositPercentage,
                    required_deposit_amount: cfg.calculation.depositAmount,
                  }));
                }}
              />
            </div>

            {/* Right: Real-time Admin Cost-Plus & Margin Auditor */}
            <div className="lg:col-span-5 space-y-4">
              {currentConfig ? (
                <AdminCostMarginInspector
                  calculation={currentConfig.calculation}
                  costSettings={costSettings}
                  currentMarginPercentage={currentConfig.calculation.profitMargin}
                  onMarginChange={(newMargin) => {
                    setCostSettings((prev) => ({
                      ...prev,
                      default_margin_percentage: newMargin,
                    }));
                  }}
                  formatCurrency={formatCurrency}
                />
              ) : (
                <div className="bg-card border border-border rounded-xl p-8 text-center text-xs text-muted-foreground">
                  Ajuste las medidas en el cotizador para ver la auditoría de costos en tiempo real.
                </div>
              )}

              {/* Informative Security Tip */}
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300">
                🛡️ <strong>Aislamiento Confidencial:</strong> Las horas hombre, depreciación de máquinas
                y porcentajes de margen neto solo son visibles para administradores. La vista pública del cliente
                únicamente muestra el precio cotizado y el anticipo requerido.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: COST & PRODUCTION SETTINGS */}
      {activeSubTab === "COST_SETTINGS" && (
        <form
          onSubmit={handleSaveSettingsSubmit}
          className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6 max-w-3xl"
        >
          <div>
            <h3 className="text-base font-bold text-foreground">
              Configuración de Costos y Política de Anticipos
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Estos parámetros rigen el motor de cotización algorítmico y la validación de despacho.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Costo Mano de Obra ($ / hora)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={costSettings.hourly_labor_rate}
                onChange={(e) =>
                  setCostSettings({
                    ...costSettings,
                    hourly_labor_rate: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Costo Horario de Máquinas ($ / hora)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={costSettings.machine_cost_per_hour}
                onChange={(e) =>
                  setCostSettings({
                    ...costSettings,
                    machine_cost_per_hour: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Margen de Rentabilidad Objetivo (%)
              </label>
              <input
                type="number"
                step="1"
                min="5"
                max="200"
                value={costSettings.default_margin_percentage}
                onChange={(e) =>
                  setCostSettings({
                    ...costSettings,
                    default_margin_percentage: parseFloat(e.target.value) || 35,
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Configurable Advance Deposit Percentage */}
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50">
              <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 mb-1">
                <Percent className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Porcentaje de Anticipo por Defecto (%)
              </label>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">
                Anticipo obligatorio inicial (ej. 30%, 40%, 50%, 70% o 100%).
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="5"
                  min="10"
                  max="100"
                  value={costSettings.default_deposit_percentage ?? 50}
                  onChange={(e) =>
                    setCostSettings({
                      ...costSettings,
                      default_deposit_percentage: Math.min(
                        100,
                        Math.max(1, parseFloat(e.target.value) || 50)
                      ),
                    })
                  }
                  className="w-24 px-3 py-1.5 text-sm font-bold text-center rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-zinc-800 text-indigo-900 dark:text-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            {savedSettingsSuccess && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Parámetros guardados correctamente
              </span>
            )}
            <button
              type="submit"
              disabled={savingSettings}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? "Guardando..." : "Guardar Parámetros"}</span>
            </button>
          </div>
        </form>
      )}

      {/* SUBTAB 3: PAYMENT MILESTONES & DISPATCH RESTRICTIONS */}
      {activeSubTab === "PAYMENT_MILESTONES" && (
        <div className="space-y-4 max-w-3xl">
          <MilestonePaymentTracker
            milestone={activeMilestone}
            customerPhone={businessPhone}
            orderNumber="MTO-2026-0042"
            customerName="Carlos Mendoza"
            businessName={businessName}
            formatCurrency={formatCurrency}
            onRecordPayment={(amt) => {
              const newPaid = activeMilestone.paid_amount + amt;
              setActiveMilestone((prev) => ({
                ...prev,
                paid_amount: newPaid,
                pending_balance: Math.max(0, prev.total_amount - newPaid),
              }));
            }}
            onToggleAllowDispatchWithBalance={(allow) => {
              setActiveMilestone((prev) => ({
                ...prev,
                allow_dispatch_with_balance: allow,
              }));
            }}
          />
        </div>
      )}

      {/* SUBTAB 4: PRODUCTION WORK ORDER / CUT SHEET */}
      {activeSubTab === "WORK_ORDER" && (
        <div className="space-y-4">
          <ProductionWorkOrderView
            workOrder={sampleWorkOrder}
            customerName="Carlos Mendoza"
            orderNumber="MTO-2026-0042"
          />
        </div>
      )}
    </div>
  );
}
