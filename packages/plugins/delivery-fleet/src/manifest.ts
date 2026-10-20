import type { PluginManifest } from "@marketos/types";

export const DELIVERY_FLEET_MANIFEST: PluginManifest = {
  id: "delivery_fleet",
  name: "Delivery Propio & Motorizados",
  description:
    "Gestión integral de flota propia de repartidores y motorizados. Permite configurar zonas de cobertura con tarifas planas, asignar pedidos interactivamente a choferes activos, calcular vuelto exacto en efectivo y despachar comandas completas con geolocalización directa por WhatsApp en 1 clic.",
  version: "1.0.0",
  category: "growth_operations",
  author: "MarketOS Team",
  country_code: "GLOBAL",
  icon_name: "Bike",
  required_ports: [],
};
