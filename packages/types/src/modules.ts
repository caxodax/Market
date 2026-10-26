/**
 * MarketOS Modular System — Tenant Modules & Plugin Definitions
 * Modeled after the Odoo / Shopify Apps modular architecture.
 */

export type TenantModuleId =
  | "food_service"          // Gastronomía: Recetas, materias primas, modificadores (Pulldog)
  | "barcode_retail"        // Retail: Escáner de código de barras, pasillos, inventario directo (Shop Market)
  | "clothing_variants"     // Moda: Tallas, colores, matriz de stock (KsaSport)
  | "local_venezuela"       // Localización: Pago Móvil, Transferencias VE, BCV, SENIAT/IGTF
  | "local_colombia"        // Localización: Nequi, Daviplata, PSE, TRM, DIAN
  | "local_global"          // Localización: Stripe, PayPal, Tarjetas internacionales
  | "promotions_coupons"    // Marketing: Cupones de descuento, 2x1, combos
  | "delivery_fleet"        // Logística: Repartidores propios, asignación de rutas
  | "mto_cpq"               // Fabricación & CPQ: Make-to-Order, dimensiones, costeo y cotizaciones
  | "storefront_pro"        // Vitrina Pro: Banners, sliders, reels, testimonios y maquetador visual
  | "pos_registers"         // POS: Multi-Caja, Turnos, Arqueo (Cierre X/Z), PIN por cajero
  | "invoicing"             // Facturación: Facturas, Notas de Crédito, Notas de Débito, Guías de Despacho
  | "local_chile"           // Localización Chile: RUT, IVA 19%, SII, DTE, Boletas Electrónicas
  | "purchasing_retentions" // Compras & Retenciones: Facturas de compra, Retención IVA/ISLR (SPE) y DTE 46
  | "analytics";            // Analítica & Audiencia: Vistas, visitantes únicos, fuentes y conversión de tienda

export type PluginCategory =
  | "location"              // Localización por país
  | "business_vertical"     // Giro de negocio / rubro comercial
  | "growth_operations";    // Marketing, logística y operaciones avanzadas

export interface TenantModule {
  id: string;
  tenant_id: string;
  module_id: TenantModuleId;
  is_active: boolean;
  settings?: Record<string, unknown>;
  installed_at: string;
  updated_at: string;
}

export interface PluginManifest {
  id: TenantModuleId;
  name: string;
  description: string;
  version: string;
  category: PluginCategory;
  author?: string;
  country_code?: "VE" | "CO" | "GLOBAL" | string;
  required_ports?: string[];
  icon_name?: string;
  dependencies?: TenantModuleId[];
  incompatible_with?: TenantModuleId[];
}

export type PluginDependencyType = "REQUIRES" | "AUTO_ACTIVATE" | "CONFLICTS";

export interface PluginDependencyRule {
  id: string;
  source_module_id: TenantModuleId;
  target_module_id: TenantModuleId;
  type: PluginDependencyType;
  description?: string;
  is_active: boolean;
}

export interface ResolveDependenciesOptions {
  moduleId: TenantModuleId;
  targetState: boolean; // true = activate, false = deactivate
  activeModuleIds: TenantModuleId[];
  rules: PluginDependencyRule[];
}

export interface ResolveDependenciesResult {
  allowed: boolean;
  toActivate: TenantModuleId[];
  toDeactivate: TenantModuleId[];
  blockedReason?: string;
  autoActivatedMessages: string[];
}

export const DEFAULT_PLUGIN_DEPENDENCY_RULES: PluginDependencyRule[] = [
  {
    id: "rule_inv_purchasing",
    source_module_id: "invoicing",
    target_module_id: "purchasing_retentions",
    type: "AUTO_ACTIVATE",
    description: "Al activar Facturación (Outbound), activar automáticamente Compras y Retenciones (Inbound)",
    is_active: true,
  },
  {
    id: "rule_conflict_ve_cl",
    source_module_id: "local_venezuela",
    target_module_id: "local_chile",
    type: "CONFLICTS",
    description: "Incompatibilidad territorial: Localización Venezuela y Localización Chile son mutuamente excluyentes en una misma tienda",
    is_active: true,
  },
];
