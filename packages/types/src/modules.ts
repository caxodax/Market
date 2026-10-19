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
  | "mto_cpq";              // Fabricación & CPQ: Make-to-Order, dimensiones, costeo y cotizaciones

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
}
