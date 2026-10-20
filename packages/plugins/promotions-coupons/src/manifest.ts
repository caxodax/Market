import type { PluginManifest } from "@marketos/types";

export const PROMOTIONS_COUPONS_MANIFEST: PluginManifest = {
  id: "promotions_coupons",
  name: "Marketing, Cupones & Descuentos",
  description:
    "Motor avanzado de fidelización y promociones. Permite crear y validar cupones de descuento porcentuales o montos fijos en USD, controlar topes de descuento (max_discount_usd), mínimos de compra, límites de canje globales y por cliente, y vigencia temporal estricta protegiendo las tarifas de delivery de erosión financiera.",
  version: "1.0.0",
  category: "growth_operations",
  author: "MarketOS Team",
  country_code: "GLOBAL",
  icon_name: "TicketPercent",
  required_ports: [],
};
