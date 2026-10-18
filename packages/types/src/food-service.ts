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
export interface ProductRecipeItem {
  raw_material_id: string;
  raw_material_name?: string;
  quantity: number;
  unit?: RawMaterialUnit;
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
  created_at: string;
  updated_at: string;
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
}
