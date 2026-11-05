/**
 * @marketos/types - craft.ts
 * Dominio de manufactura liviana, escandallos, costeo y cotizaciones de taller
 * (Sublimación, DTF, Vinil, Papelería, Esferas Navideñas y Manualidades)
 */

export type CraftMaterialCategory =
  | "sublimacion"
  | "dtf"
  | "vinil"
  | "papeleria"
  | "esferas"
  | "empaque"
  | "envio"
  | "general";

export type CraftMaterialUnit =
  | "UNIDAD"
  | "HOJA"
  | "METRO"
  | "CM2"
  | "ML"
  | "GRAMO"
  | "USO"
  | string;

export interface CraftMaterial {
  id: string;
  tenant_id: string;
  name: string;
  category: CraftMaterialCategory;
  sku?: string | null;
  pack_quantity: number;
  pack_price_base: number;
  unit_cost_base: number;
  unit_measure: CraftMaterialUnit;
  stock_packs: number;
  min_stock_packs: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCraftMaterialInput {
  tenantId: string;
  name: string;
  category: CraftMaterialCategory;
  sku?: string | null;
  packQuantity: number;
  packPriceBase: number;
  unitMeasure?: CraftMaterialUnit;
  stockPacks?: number;
  minStockPacks?: number;
}

export interface UpdateCraftMaterialInput {
  materialId: string;
  tenantId: string;
  name?: string;
  category?: CraftMaterialCategory;
  sku?: string | null;
  packQuantity?: number;
  packPriceBase?: number;
  unitMeasure?: CraftMaterialUnit;
  stockPacks?: number;
  minStockPacks?: number;
  isActive?: boolean;
}

export type CraftPricingFormula = "MARGIN" | "MARKUP";

export type WorkshopTechnique =
  | "sublimacion"
  | "dtf"
  | "vinil"
  | "papeleria"
  | "esferas"
  | "combo"
  | "general";

export interface CraftRecipeItem {
  id: string;
  tenant_id: string;
  recipe_id: string;
  material_id?: string | null;
  custom_name: string;
  pack_qty_snapshot: number;
  pack_price_snapshot: number;
  unit_cost_snapshot: number;
  qty_to_use: number;
  cost_used_base: number;
  is_checked: boolean;
  sort_order: number;
}

export interface CraftRecipe {
  id: string;
  tenant_id: string;
  name: string;
  sku?: string | null;
  technique: WorkshopTechnique;
  category_name?: string | null;
  materials_cost_base: number;
  waste_percentage: number;
  labor_cost_base: number;
  direct_cost_base: number;
  pricing_formula: CraftPricingFormula;
  margin_percentage: number;
  selling_price_base: number;
  wholesale_price_base?: number | null;
  profit_base: number;
  has_pending_recalc: boolean;
  is_published: boolean;
  product_id?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: CraftRecipeItem[];
}

export interface CreateCraftRecipeItemInput {
  materialId?: string | null;
  customName: string;
  packQtySnapshot: number;
  packPriceSnapshot: number;
  unitCostSnapshot?: number;
  qtyToUse: number;
  isChecked: boolean;
  sortOrder?: number;
}

export interface CreateCraftRecipeInput {
  tenantId: string;
  name: string;
  sku?: string | null;
  technique: WorkshopTechnique;
  categoryName?: string | null;
  wastePercentage?: number;
  laborCostBase?: number;
  pricingFormula?: CraftPricingFormula;
  marginPercentage?: number;
  sellingPriceBase?: number;
  wholesalePriceBase?: number | null;
  notes?: string | null;
  isPublished?: boolean;
  productId?: string | null;
  items: CreateCraftRecipeItemInput[];
}

export interface UpdateCraftRecipeInput {
  recipeId: string;
  tenantId: string;
  name?: string;
  sku?: string | null;
  technique?: WorkshopTechnique;
  categoryName?: string | null;
  wastePercentage?: number;
  laborCostBase?: number;
  pricingFormula?: CraftPricingFormula;
  marginPercentage?: number;
  sellingPriceBase?: number;
  wholesalePriceBase?: number | null;
  notes?: string | null;
  isPublished?: boolean;
  productId?: string | null;
  isActive?: boolean;
  items?: Array<CreateCraftRecipeItemInput & { id?: string }>;
}

export type CraftQuoteStatus = "draft" | "sent_whatsapp" | "converted_to_order";

export interface CraftQuoteItem {
  recipe_id?: string | null;
  name: string;
  quantity: number;
  unit_price_base: number;
  subtotal_base: number;
  is_free_item?: boolean;
  notes?: string | null;
}

export interface CraftQuote {
  id: string;
  tenant_id: string;
  quote_number: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  items: CraftQuoteItem[];
  shipping_notes?: string | null;
  shipping_cost_base: number;
  subtotal_base: number;
  total_base: number;
  base_currency: string;
  exchange_rate_applied: number;
  total_secondary: number;
  deposit_percentage: number;
  deposit_required_base: number;
  status: CraftQuoteStatus;
  converted_order_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCraftQuoteInput {
  tenantId: string;
  quoteNumber?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  items: CraftQuoteItem[];
  shippingNotes?: string | null;
  shippingCostBase?: number;
  baseCurrency?: string;
  exchangeRateApplied?: number;
  depositPercentage?: number;
}

export interface RecalculateCraftRecipesResult {
  updated_recipes: number;
  synced_products: number;
}
