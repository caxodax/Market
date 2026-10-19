/**
 * Make-to-Order & CPQ (Configure, Price, Quote) Domain Types
 * Core-isolated: Pure decimals, zero country or currency references.
 */

export type CalculationType =
  | "AREA"             // e.g., m², sq ft (letreros, cristalería, telas)
  | "LINEAR"           // e.g., metros lineales (cortinas, perfiles, molduras)
  | "UNITARY_CUSTOM"   // e.g., por unidad con accesorios (tazas, gorras, poleras)
  | "VOLUME"           // e.g., m³ (carpintería en bloque, tanques, espumas)
  | "TIERED_VOLUME";   // e.g., escalas de volumen directo por tramos

export interface CpqCostSettings {
  id: string;
  tenant_id: string;
  default_margin_percentage: number; // e.g. 45.00 (%)
  hourly_labor_rate: number;         // Labor cost per hour (e.g. 15.00)
  machine_cost_per_hour: number;     // Depreciation / energy per machine hour (e.g. 5.00)
  created_at?: string;
  updated_at?: string;
}

export interface CpqPricingMatrix {
  id: string;
  tenant_id: string;
  name: string;
  calculation_type: CalculationType;
  min_billable_unit: number;         // Minimum chargeable area/length/unit (e.g. 1.0)
  setup_fee: number;                 // Fixed startup cost (e.g. 10.00)
  waste_factor: number;              // Waste multiplier (e.g. 0.05 for 5%)
  base_material_cost_per_unit?: number;
  base_labor_minutes?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CpqAttributeOption {
  id: string;
  matrix_id: string;
  attribute_name: string;            // e.g. 'tecnica', 'grosor', 'material'
  label: string;                     // e.g. 'Sublimación A3', 'Vinil Reflectivo'
  material_cost: number;             // Material cost incurred
  labor_minutes: number;             // Extra labor minutes needed
  price_modifier?: number;           // Optional override modifier
  is_default?: boolean;
  created_at?: string;
}

export interface CpqVolumeTier {
  id: string;
  matrix_id: string;
  min_quantity: number;
  max_quantity: number | null;       // null = unlimited
  discount_percentage: number;       // Discount % (e.g. 15.0)
  created_at?: string;
}

export interface CpqDimensions {
  width?: number;
  height?: number;
  depth?: number;
  length?: number;
  area?: number;
  unit?: "cm" | "m" | "mm" | "in";
}

export interface CpqBomItem {
  name: string;
  category: "MATERIAL" | "LABOR" | "MACHINE" | "SETUP";
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
}

export interface CpqCostBreakdown {
  materials: number;
  labor: number;
  machine: number;
  setup: number;
  waste: number;
  total_cost: number;
  bom_items: CpqBomItem[];
}

export interface CpqCalculationResult {
  unitCost: number;                  // Internal cost per unit
  baseUnitPrice: number;             // Base price before volume tier discount
  unitPrice: number;                 // Final selling price per unit
  quantity: number;
  totalCost: number;                 // unitCost * quantity
  totalPrice: number;                // unitPrice * quantity
  profitMargin: number;              // Effective gross margin %
  netMarginAmount: number;           // totalPrice - totalCost (net profit)
  discountPercentage: number;        // Applied volume discount %
  costBreakdown: CpqCostBreakdown;
  productionNotes?: string[];
}

export type CpqQuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "CONVERTED";

export interface CpqQuote {
  id: string;
  tenant_id: string;
  quote_number: string;              // e.g. "COT-2026-001"
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  status: CpqQuoteStatus;
  total_cost: number;                // Internal total cost (Owner only)
  total_price: number;               // Public client price
  net_margin_amount: number;         // Projected net profit (Owner only)
  valid_until?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CpqQuoteItem {
  id: string;
  quote_id: string;
  product_id: string;
  product_name?: string;
  dimensions: CpqDimensions;
  selected_attributes: Record<string, string>;
  cost_breakdown: CpqCostBreakdown;
  unit_cost: number;
  unit_price: number;
  quantity: number;
  total_price: number;
  created_at?: string;
}

export type CpqWorkOrderStatus = "QUEUED" | "IN_PROCESS" | "READY" | "DELIVERED";

export interface CpqProductionSheet {
  work_order_number: string;
  product_name: string;
  quantity: number;
  dimensions: CpqDimensions;
  selected_attributes: Record<string, string>;
  technical_specs: string[];
  materials_to_consume: {
    name: string;
    quantity: number;
    unit: string;
  }[];
  operator_notes?: string;
  files_to_print?: { name: string; url: string }[];
}

export interface CpqWorkOrder {
  id: string;
  tenant_id: string;
  order_id?: string | null;
  quote_id?: string | null;
  status: CpqWorkOrderStatus;
  production_sheet: CpqProductionSheet;
  created_at?: string;
  updated_at?: string;
}

export interface CpqOrderMilestone {
  id: string;
  order_id: string;
  total_amount: number;
  paid_amount: number;
  pending_balance: number;
  allow_dispatch_with_balance: boolean;
  created_at?: string;
  updated_at?: string;
}
