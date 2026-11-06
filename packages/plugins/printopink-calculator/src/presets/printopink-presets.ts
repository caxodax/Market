import type { PrintopinkPreset } from "@marketos/types";

/**
 * Presets Oficiales Inmutables de Fábrica para PrintoPink
 * Extraídos directamente de la "Guía Completa de Costos y Estructura de Precios".
 * Protegidos con 'as const' para garantizar inmutabilidad.
 */
export const PRINTOPINK_FACTORY_PRESETS = [
  // 1. ETIQUETAS ADHESIVAS
  {
    id: "stickers_photo",
    category: "stickers",
    title: "Etiquetas Adhesivas (Papel Fotográfico)",
    subtitle: "Paquete 20 hojas ($6.00) + Kit tinta ($50 rinde 200)",
    description: "Cálculo por hoja A4 / Carta para stickers full color troquelados o cortados.",
    defaultMaterials: [
      { name: "Papel Fotográfico Adhesivo (1 hoja)", cost: 0.3, qty: 1, subtotal: 0.3 },
      { name: "Tinta Fotográfica Full Color (cobertura estándar)", cost: 0.25, qty: 1, subtotal: 0.25 },
    ],
    defaultMachineryCost: 0.05,
    defaultLaborCost: 0.6,
    defaultWastePercentage: 0,
    suggestedPrice: 1.8,
    wholesalePrice: 1.6,
    wholesaleMinQty: 20,
    tips: "PVP sugerido entre $1.60 (en pedidos de +20 hojas) y $1.80 por hoja al detal.",
  },

  // 2. IMPRESIONES PAPEL NORMAL
  {
    id: "paper_print_black",
    category: "paper_print",
    title: "Impresión Negro (Texto / Líneas)",
    subtitle: "Papel bond 75g ($6/500) + Tinta negra (rinde 2,500)",
    description: "Impresión monocromática rápida para documentos de texto.",
    defaultMaterials: [
      { name: "Papel Bond Normal (1 hoja)", cost: 0.012, qty: 1, subtotal: 0.012 },
      { name: "Gasto Tinta Negra (rinde ~2,500 hojas)", cost: 0.02, qty: 1, subtotal: 0.02 },
    ],
    defaultMachineryCost: 0.05,
    defaultLaborCost: 0.3,
    defaultWastePercentage: 0,
    suggestedPrice: 0.6,
    wholesalePrice: 0.5,
    wholesaleMinQty: 50,
    tips: "PVP sugerido: $0.50 - $0.60 por hoja.",
  },
  {
    id: "paper_print_color",
    category: "paper_print",
    title: "Impresión Color (Documentos / Gráficos)",
    subtitle: "Papel bond 75g + Tinta color (rinde 500)",
    description: "Impresión a color para gráficos, láminas y documentos.",
    defaultMaterials: [
      { name: "Papel Bond Normal (1 hoja)", cost: 0.012, qty: 1, subtotal: 0.012 },
      { name: "Gasto Tinta Color (rinde ~500 hojas)", cost: 0.1, qty: 1, subtotal: 0.1 },
    ],
    defaultMachineryCost: 0.05,
    defaultLaborCost: 0.6,
    defaultWastePercentage: 0,
    suggestedPrice: 1.2,
    wholesalePrice: 1.0,
    wholesaleMinQty: 25,
    tips: "PVP sugerido: $1.00 - $1.20 por hoja. Subir a $1.50 si es cobertura fotográfica 100%.",
  },

  // 3. PLASTIFICADO CARNET
  {
    id: "lamination_badge",
    category: "lamination",
    title: "Plastificado Tipo Carnet",
    subtitle: "Lámina carnet ($8/100) + Laminadora (2,000 ciclos)",
    description: "Termolaminado de carnet o credencial (1-2 minutos de mano de obra).",
    defaultMaterials: [
      { name: "Lámina de plastificado tamaño carnet", cost: 0.08, qty: 1, subtotal: 0.08 },
    ],
    defaultMachineryCost: 0.03,
    defaultLaborCost: 0.12,
    defaultWastePercentage: 0,
    suggestedPrice: 0.75,
    wholesalePrice: 0.5,
    wholesaleMinQty: 10,
    tips: "PVP sugerido: $0.75 pieza individual | $0.50 en lote (+10 carnets).",
  },

  // 4. ESTAMPADO TEXTIL: VINIL SUBLIMABLE
  {
    id: "textile_vinyl_1side",
    category: "textile",
    title: "Estampado Vinil Sublimable (1 Lado)",
    subtitle: "Vinil 1/4m ($1.87) + Tinta ($0.35) + Cameo 5 y Prensa",
    description: "Servicio de corte, depilado de vinil y planchado térmico frontal.",
    defaultMaterials: [
      { name: "Vinil Textil Sublimable (1/4 metro)", cost: 1.87, qty: 1, subtotal: 1.87 },
      { name: "Tinta de Sublimación", cost: 0.35, qty: 1, subtotal: 0.35 },
    ],
    defaultMachineryCost: 0.4,
    defaultLaborCost: 2.0,
    defaultWastePercentage: 0,
    suggestedPrice: 9.0,
    wholesalePrice: 8.0,
    wholesaleMinQty: 12,
    tips: "Solo servicio de estampado (sin incluir la franela). PVP sugerido: $8.00 - $10.00.",
  },
  {
    id: "textile_vinyl_2sides",
    category: "textile",
    title: "Estampado Vinil Sublimable (Ambos Lados)",
    subtitle: "Vinil 1/2m ($3.75) + Tinta ($0.70) + Depilado doble",
    description: "Servicio de estampado textil en pecho y espalda con vinil sublimable.",
    defaultMaterials: [
      { name: "Vinil Textil Sublimable (1/2 metro)", cost: 3.75, qty: 1, subtotal: 3.75 },
      { name: "Tinta de Sublimación (2 lados)", cost: 0.7, qty: 1, subtotal: 0.7 },
    ],
    defaultMachineryCost: 0.8,
    defaultLaborCost: 3.5,
    defaultWastePercentage: 0,
    suggestedPrice: 16.0,
    wholesalePrice: 15.0,
    wholesaleMinQty: 12,
    tips: "PVP sugerido: $15.00 - $18.00 (servicio de estampado en dos caras).",
  },

  // 4. ESTAMPADO TEXTIL: SUBLIMACIÓN DIRECTA
  {
    id: "textile_direct_1side",
    category: "textile",
    title: "Sublimación Directa Franela (1 Lado)",
    subtitle: "1 Hoja A4 ($0.15) + Tinta ($0.25) sin vinil ni plotter",
    description: "Sublimación directa al tejido sobre poliéster blanco o claro.",
    defaultMaterials: [
      { name: "Hoja de Sublimación A4", cost: 0.15, qty: 1, subtotal: 0.15 },
      { name: "Tinta de Sublimación", cost: 0.25, qty: 1, subtotal: 0.25 },
    ],
    defaultMachineryCost: 0.25,
    defaultLaborCost: 0.5,
    defaultWastePercentage: 0,
    suggestedPrice: 4.0,
    wholesalePrice: 3.5,
    wholesaleMinQty: 12,
    tips: "Tu servicio de mayor margen porcentual (71%). PVP sugerido: $3.50 - $5.00.",
  },
  {
    id: "textile_direct_2sides",
    category: "textile",
    title: "Sublimación Directa Franela (Ambos Lados)",
    subtitle: "2 Hojas A4 ($0.30) + Tinta ($0.50)",
    description: "Sublimación directa en frente y espalda sin vinil.",
    defaultMaterials: [
      { name: "2 Hojas de Sublimación A4", cost: 0.3, qty: 1, subtotal: 0.3 },
      { name: "Tinta de Sublimación (2 caras)", cost: 0.5, qty: 1, subtotal: 0.5 },
    ],
    defaultMachineryCost: 0.45,
    defaultLaborCost: 0.9,
    defaultWastePercentage: 0,
    suggestedPrice: 7.0,
    wholesalePrice: 6.0,
    wholesaleMinQty: 12,
    tips: "PVP sugerido: $6.00 - $8.00.",
  },

  // 5. CAJAS ARMADAS / PACKAGING (Cameo 5)
  {
    id: "packaging_glasse_2parts",
    category: "packaging",
    title: "Caja Armada Glasse (2 Partes: Tapa y Base)",
    subtitle: "2 Hojas Papel Glasse ($0.13 c/u) con diseño y corte Cameo 5",
    description: "Caja de regalo o empaque troquelada con Silhouette Cameo 5.",
    defaultMaterials: [
      { name: "2 Hojas Papel Glasse ($0.13 c/u)", cost: 0.26, qty: 1, subtotal: 0.26 },
      { name: "Tinta Full Color (2 hojas)", cost: 0.5, qty: 1, subtotal: 0.5 },
    ],
    defaultMachineryCost: 0.2,
    defaultLaborCost: 0.3,
    defaultWastePercentage: 0,
    suggestedPrice: 2.5,
    wholesalePrice: 2.2,
    wholesaleMinQty: 25,
    tips: "Si el cliente pide la caja sin impresión (cartulina limpia), resta $0.25 por hoja.",
  },
  {
    id: "packaging_opalina_2parts",
    category: "packaging",
    title: "Caja Armada Opalina (2 Partes: Tapa y Base)",
    subtitle: "2 Hojas Cartulina Opalina ($0.17 c/u) con diseño y corte Cameo 5",
    description: "Caja rígida en cartulina opalina con tapa y base.",
    defaultMaterials: [
      { name: "2 Hojas Cartulina Opalina ($0.17 c/u)", cost: 0.34, qty: 1, subtotal: 0.34 },
      { name: "Tinta Full Color (2 hojas)", cost: 0.5, qty: 1, subtotal: 0.5 },
    ],
    defaultMachineryCost: 0.2,
    defaultLaborCost: 0.3,
    defaultWastePercentage: 0,
    suggestedPrice: 2.75,
    wholesalePrice: 2.4,
    wholesaleMinQty: 25,
    tips: "Si el cliente pide sin impresión (opalina limpia), resta $0.25 por hoja.",
  },

  // 6. A MEDIDA
  {
    id: "custom_blank",
    category: "custom",
    title: "Trabajo a Medida (En Blanco)",
    subtitle: "Cotiza cualquier proyecto personalizado desde cero",
    description: "Configura materiales, máquinas y mano de obra a tu gusto.",
    defaultMaterials: [
      { name: "Insumo Principal", cost: 1.0, qty: 1, subtotal: 1.0 },
    ],
    defaultMachineryCost: 0.25,
    defaultLaborCost: 1.0,
    defaultWastePercentage: 5,
    suggestedPrice: 3.5,
    tips: "Usa este lienzo en blanco para trabajos especiales fuera de catálogo.",
  },
] as const satisfies readonly PrintopinkPreset[];

export type PrintopinkPresetId = (typeof PRINTOPINK_FACTORY_PRESETS)[number]["id"];
