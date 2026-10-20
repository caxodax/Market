import { PluginManifest } from "@marketos/types";

export const BARCODE_RETAIL_MANIFEST: PluginManifest = {
  id: "barcode_retail",
  name: "Retail, Supermercados & Bodegones (Código de Barras)",
  description:
    "Motor de alto rendimiento para comercio minorista: lectura rápida por teclado HID/láser, jerarquía de empaques (unidad, six-pack, bulto de 24), parser de balanzas GS1 (prefijo 20), feedback acústico con Web Audio y rutas de picking por pasillo.",
  version: "1.0.0",
  category: "business_vertical",
  author: "MarketOS Team",
  country_code: "GLOBAL",
  icon_name: "ScanBarcode",
  required_ports: [],
};
