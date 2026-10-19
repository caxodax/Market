import { PluginManifest } from "@marketos/types";

export const MTO_CPQ_MANIFEST: PluginManifest = {
  id: "mto_cpq",
  name: "Make-to-Order & CPQ (Costeo y Configuración)",
  description:
    "Motor universal de cotización bajo pedido (Configure, Price, Quote) con cálculo de costo real (materia prima, merma y mano de obra) y aplicación de margen comercial. Diseñado para imprentas, sublimación, cristalería, cortinas, letreros y carpintería.",
  version: "1.0.0",
  category: "business_vertical",
  author: "MarketOS Team",
  country_code: "GLOBAL",
  icon_name: "Ruler",
  required_ports: ["PricingPort"],
};
