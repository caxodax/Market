import type { IslrConcept } from "@marketos/types";

/**
 * Tabla oficial de Conceptos de Retención de ISLR
 * Decreto N° 1.808 (Reglamento Parcial en materia de Retenciones de ISLR).
 * Gaceta Oficial N° 36.203.
 */
export const OFFICIAL_ISLR_CONCEPTS: IslrConcept[] = [
  {
    code: "001",
    name: "Honorarios Profesionales (Personas Naturales Residentes)",
    entity_type: "PN",
    default_rate_percent: 3,
    description: "Servicios y honorarios de profesionales independientes PN (Decreto 1.808 Art. 9 Num. 1)",
  },
  {
    code: "002",
    name: "Honorarios Profesionales (Personas Jurídicas Domiciliadas)",
    entity_type: "PJ",
    default_rate_percent: 5,
    description: "Servicios profesionales y asesorías de empresas PJ (Decreto 1.808 Art. 9 Num. 1)",
  },
  {
    code: "003",
    name: "Comisiones Mercantiles y Mediaciones (Personas Naturales)",
    entity_type: "PN",
    default_rate_percent: 3,
    description: "Comisiones y corretajes pagados a personas naturales (Decreto 1.808 Art. 9 Num. 2)",
  },
  {
    code: "004",
    name: "Comisiones Mercantiles y Mediaciones (Personas Jurídicas)",
    entity_type: "PJ",
    default_rate_percent: 5,
    description: "Comisiones y corretajes pagados a empresas PJ (Decreto 1.808 Art. 9 Num. 2)",
  },
  {
    code: "055",
    name: "Ejecución de Obras y Prestación de Servicios (Personas Jurídicas)",
    entity_type: "PJ",
    default_rate_percent: 2,
    description: "Contratos de servicio general, contratistas y mantenimiento PJ (Decreto 1.808 Art. 9 Num. 11)",
  },
  {
    code: "056",
    name: "Ejecución de Obras y Prestación de Servicios (Personas Naturales)",
    entity_type: "PN",
    default_rate_percent: 1,
    description: "Contratistas de obras y oficios varios PN (Decreto 1.808 Art. 9 Num. 11)",
  },
  {
    code: "053",
    name: "Fletes y Transporte Terrestre de Carga Nacional",
    entity_type: "ALL",
    default_rate_percent: 3,
    description: "Servicio de flete y transporte de mercancías nacional (Decreto 1.808 Art. 9 Num. 8)",
  },
  {
    code: "027",
    name: "Arrendamiento de Bienes Inmuebles (Personas Jurídicas)",
    entity_type: "PJ",
    default_rate_percent: 5,
    description: "Cánones de arrendamiento de locales y oficinas PJ (Decreto 1.808 Art. 9 Num. 5)",
  },
  {
    code: "028",
    name: "Publicidad y Propaganda Comercial (Personas Jurídicas)",
    entity_type: "PJ",
    default_rate_percent: 5,
    description: "Servicios de publicidad, medios y mercadeo PJ (Decreto 1.808 Art. 9 Num. 13)",
  },
];
