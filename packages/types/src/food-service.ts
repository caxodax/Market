/**
 * MarketOS Plugin Food Service — Domain Models (Gastronomía & Comida Rápida)
 * Used by restaurants, fast food, pizzerias and hot dog establishments (e.g. Pulldog).
 */

export type RawMaterialUnit =
  | "UNIT"        // Unidades (ej. 1 pan, 1 salchicha, 1 vaso)
  | "KG"          // Kilogramos
  | "G"           // Gramos (ej. 20g papitas ralladas)
  | "L"           // Litros
  | "ML"          // Mililitros
  | "PORTION";    // Porciones (ej. 1 porción de salsa especial)

/**
 * Insumo o Materia Prima (Trastienda / Inventario de Cocina)
 * No se vende directamente al cliente; se descuenta al vender platillos.
 */
export interface RawMaterial {
  id: string;
  tenant_id: string;
  store_id: string;
  name: string;
  sku?: string | null;
  unit: RawMaterialUnit;
  current_stock: number;
  min_alert_stock: number;
  cost_per_unit_usd: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * Relación de Insumo dentro de una Receta
 */
/**
 * Relación de Insumo dentro de una Receta (Escandallo)
 */
export interface ProductRecipeItem {
  raw_material_id: string;
  raw_material_name?: string;
  quantity: number;
  unit?: RawMaterialUnit;
  waste_percentage?: number; // Merma gastronómica o encogimiento en cocción (ej. 10 para 10%)
  cost_per_portion_usd?: number; // Costo unitario calculado en la receta
}

/**
 * Receta / Escandallo de un Producto (BOM - Bill of Materials)
 * Define qué materia prima gasta la preparación de 1 platillo.
 */
export interface ProductRecipe {
  id: string;
  tenant_id: string;
  product_id: string;
  items: ProductRecipeItem[];
  target_food_cost_percentage?: number; // Meta de costo de comida (default: 30.0%)
  total_cost_usd?: number;
  food_cost_percentage?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Clasificación de Salud Financiera del Plato (Semáforo Food Cost)
 */
export type FoodCostHealth = "OPTIMAL" | "ACCEPTABLE" | "CRITICAL";

/**
 * Cálculo detallado del Escandallo & Rentabilidad
 */
export interface RecipeCostItemBreakdown {
  raw_material_id: string;
  raw_material_name: string;
  recipeQuantity: number;
  recipeUnit: RawMaterialUnit;
  storageUnit: RawMaterialUnit;
  effectiveQuantity: number; // Cantidad consumida tras aplicar factor de merma
  unitCostUsd: number;
  totalCostUsd: number;
  wastePercentage: number;
}

export interface RecipeCostCalculation {
  recipeId?: string;
  productId: string;
  productPriceUsd: number;
  totalIngredientCostUsd: number;
  foodCostPercentage: number;
  health: FoodCostHealth;
  grossMarginUsd: number;
  grossMarginPercentage: number;
  suggestedRetailPriceUsd: number;
  items: RecipeCostItemBreakdown[];
}

/**
 * Opción individual dentro de un grupo de modificadores (ej. "Salsa de Ajo", "Tocineta")
 */
export interface ProductModifierOption {
  id: string;
  name: string;
  price_adjustment_usd: number; // 0.00 para gratis, > 0 para extra con costo
  raw_material_id?: string | null; // Insumo asociado para descontar de inventario
  raw_material_quantity?: number | null;
  raw_material_unit?: RawMaterialUnit;
  is_default?: boolean;
  is_available?: boolean;
}

/**
 * Grupo de Modificadores (ej. "Elige tus Salsas", "Toppings Adicionales")
 */
export interface ProductModifierGroup {
  id: string;
  tenant_id: string;
  product_id?: string | null;   // Si aplica a un plato específico
  category_id?: string | null;  // Si aplica a todos los platos de una categoría (ej. todos los perros)
  name: string;
  description?: string | null;
  required: boolean;
  min_selectable: number;
  max_selectable: number;
  options: ProductModifierOption[];
  sort_order: number;
  is_active: boolean;
}

/**
 * Modificador seleccionado por el cliente al poner el platillo en el carrito
 */
export interface SelectedModifier {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price_usd: number;
  raw_material_id?: string | null;
  raw_material_quantity?: number | null;
  raw_material_unit?: RawMaterialUnit;
}

/**
 * Kitchen Display System (KDS / Comanda de Cocina)
 */
export type KitchenTicketStatus = "PENDING" | "PREPARING" | "READY" | "SERVED";

export interface KitchenTicketItem {
  id: string;
  product_name: string;
  quantity: number;
  notes?: string;
  selected_modifiers?: SelectedModifier[];
  exclusions?: string[]; // Ej. ["SIN CEBOLLA", "SIN MAYONESA"]
}

export interface KitchenTicket {
  id: string;
  order_id: string;
  order_number: string;
  table_number?: string;
  delivery_type: "delivery" | "pickup" | "dine_in";
  status: KitchenTicketStatus;
  customer_name?: string;
  created_at: string;
  elapsed_minutes?: number;
  items: KitchenTicketItem[];
}

/**
 * Normalizes raw material units into standard mass, volume or discrete count.
 * Returns the multiplier to convert from `sourceUnit` into `targetUnit`.
 * e.g. convertUnitQuantity("G", "KG", 150) -> 0.150
 *      convertUnitQuantity("KG", "G", 2.5) -> 2500
 *      convertUnitQuantity("ML", "L", 50) -> 0.050
 */
export function convertUnitQuantity(
  sourceUnit: RawMaterialUnit,
  targetUnit: RawMaterialUnit,
  quantity: number
): number {
  if (sourceUnit === targetUnit) return quantity;

  // Mass Family: KG <-> G
  if (sourceUnit === "G" && targetUnit === "KG") return quantity / 1000;
  if (sourceUnit === "KG" && targetUnit === "G") return quantity * 1000;

  // Volume Family: ML <-> L
  if (sourceUnit === "ML" && targetUnit === "L") return quantity / 1000;
  if (sourceUnit === "L" && targetUnit === "ML") return quantity * 1000;

  // Discrete / fallback
  return quantity;
}


