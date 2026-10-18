import { PluginManifest } from "@marketos/types";

export const FOOD_SERVICE_MANIFEST: PluginManifest = {
  id: "food_service",
  name: "Gastronomía, Comida Rápida & Recetas",
  description:
    "Módulo especializado para restaurantes, pizzerías y carritos de comida rápida (Pulldog). Permite gestionar recetas de cocina (escandallo), inventario de materias primas por sede y selector interactivo de salsas y extras para los clientes.",
  version: "1.0.0",
  category: "business_vertical",
  author: "MarketOS Team",
  country_code: "GLOBAL",
  icon_name: "Utensils",
  required_ports: ["InventoryPort"],
};
