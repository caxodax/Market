/**
 * @marketos/types - printopink.ts
 * Dominio de Costeo Rápido y Cotizaciones PrintoPink (Tríada de Costos & Presets de Guía)
 */

export type PrintopinkPresetCategory =
  | "stickers"
  | "paper_print"
  | "lamination"
  | "textile"
  | "packaging"
  | "custom";

export interface PrintopinkMaterialItem {
  id?: string;
  name: string;
  cost: number;
  qty?: number;
  subtotal: number;
}

export interface PrintopinkCalculation {
  id: string;
  tenant_id: string;
  title: string;
  preset_category: PrintopinkPresetCategory;
  materials_cost_base: number;
  machinery_cost_base: number;
  labor_cost_base: number;
  waste_percentage: number;
  total_cost_base: number;
  selling_price_base: number;
  wholesale_price_base?: number | null;
  net_profit_base: number;
  margin_percentage: number;
  materials_breakdown: PrintopinkMaterialItem[];
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePrintopinkCalculationInput {
  tenantId: string;
  title: string;
  presetCategory: PrintopinkPresetCategory;
  materialsCostBase: number;
  machineryCostBase: number;
  laborCostBase: number;
  wastePercentage?: number;
  sellingPriceBase: number;
  wholesalePriceBase?: number | null;
  materialsBreakdown: PrintopinkMaterialItem[];
  notes?: string | null;
}

export interface UpdatePrintopinkCalculationInput {
  id: string;
  tenantId: string;
  title?: string;
  presetCategory?: PrintopinkPresetCategory;
  materialsCostBase?: number;
  machineryCostBase?: number;
  laborCostBase?: number;
  wastePercentage?: number;
  sellingPriceBase?: number;
  wholesalePriceBase?: number | null;
  materialsBreakdown?: PrintopinkMaterialItem[];
  notes?: string | null;
  isActive?: boolean;
}

export interface PrintopinkQuoteItem {
  id: string;
  calculationId?: string | null;
  title: string;
  unitPriceBase: number;
  quantity: number;
  subtotalBase: number;
  notes?: string;
}

export type PrintopinkQuoteStatus = "draft" | "sent" | "approved" | "converted";

export interface PrintopinkQuote {
  id: string;
  tenant_id: string;
  quote_number: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  total_base: number;
  deposit_required_base: number;
  pending_balance_base: number;
  items: PrintopinkQuoteItem[];
  notes?: string | null;
  status: PrintopinkQuoteStatus;
  created_at: string;
  updated_at: string;
}

export interface CreatePrintopinkQuoteInput {
  tenantId: string;
  customerName?: string;
  customerPhone?: string;
  depositPercentage?: number;
  items: {
    calculationId?: string | null;
    title: string;
    unitPriceBase: number;
    quantity: number;
    notes?: string;
  }[];
  notes?: string;
}

export interface PrintopinkPreset {
  readonly id: string;
  readonly category: PrintopinkPresetCategory;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly defaultMaterials: readonly PrintopinkMaterialItem[];
  readonly defaultMachineryCost: number;
  readonly defaultLaborCost: number;
  readonly defaultWastePercentage: number;
  readonly suggestedPrice: number;
  readonly wholesalePrice?: number;
  readonly wholesaleMinQty?: number;
  readonly tips?: string;
}
