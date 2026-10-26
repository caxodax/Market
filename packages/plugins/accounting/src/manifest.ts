import type { PluginManifest } from "@marketos/types";

export const ACCOUNTING_MANIFEST: PluginManifest = {
  id: "accounting",
  name: "Contabilidad & Asientos Automáticos",
  description:
    "Plan de Cuentas estándar, asientos contables por partida doble generados automáticamente desde ventas, compras, CxC y CxP, y Balance de Comprobación.",
  version: "1.0.0",
  category: "growth_operations",
  author: "MarketOS Team",
  country_code: "GLOBAL",
  icon_name: "BookOpenCheck",
  dependencies: ["invoicing"],
};
