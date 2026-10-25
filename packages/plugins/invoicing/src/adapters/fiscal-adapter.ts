import type {
  FiscalAdapterPort,
  FiscalCalculationInput,
  FiscalCalculationBreakdown,
  FiscalDocumentType,
} from "@marketos/types";

/**
 * Validador de RUT chileno con Algoritmo Módulo 11
 */
export function validateChileanRut(rut: string): boolean {
  const clean = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 8 || clean.length > 9) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  let expectedDv = "0";
  if (remainder === 11) expectedDv = "0";
  else if (remainder === 10) expectedDv = "K";
  else expectedDv = String(remainder);

  return dv === expectedDv;
}

/**
 * Validador de RIF venezolano
 */
export function validateVenezuelanRif(rif: string): boolean {
  const clean = rif.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return /^[JVEGP]\d{8,9}$/.test(clean);
}

// ─── 1. ADAPTADOR FISCAL VENEZUELA (SENIAT) ──────────────────────────────────
export const VenezuelaFiscalAdapter: FiscalAdapterPort = {
  countryCode: "VE",
  countryName: "Venezuela",
  taxIdLabel: "RIF",
  defaultIvaRate: 16.0,

  validateTaxId(rif: string): boolean {
    return validateVenezuelanRif(rif);
  },

  calculateTaxes(input: FiscalCalculationInput): FiscalCalculationBreakdown {
    const rate = input.exchangeRate && input.exchangeRate > 0 ? input.exchangeRate : 1;
    let subtotalExempt = 0;
    let subtotalTaxable = 0;

    for (const it of input.items) {
      const lineTotal = Number((it.quantity * it.unitPrice).toFixed(2));
      if (it.isExempt) {
        subtotalExempt += lineTotal;
      } else {
        subtotalTaxable += lineTotal;
      }
    }

    const ivaRate = this.defaultIvaRate;
    const ivaAmount = Number(((subtotalTaxable * ivaRate) / 100).toFixed(2));
    const subtotalGross = Number((subtotalExempt + subtotalTaxable).toFixed(2));

    let igtfAmount = 0;
    const igtfRate = input.applyIgtf ? 3.0 : 0;
    if (input.applyIgtf) {
      const baseForIgtf = subtotalGross + ivaAmount;
      igtfAmount = Number(((baseForIgtf * 3.0) / 100).toFixed(2));
    }

    const total = Number((subtotalGross + ivaAmount + igtfAmount).toFixed(2));
    const totalVes = Number((total * rate).toFixed(2));

    return {
      subtotalGross,
      subtotalExempt,
      subtotalTaxable,
      ivaRatePercent: ivaRate,
      ivaAmount,
      igtfRatePercent: igtfRate,
      igtfAmount,
      total,
      totalVes,
    };
  },

  formatDocumentNumber(type: string, sequence: number, prefix?: string): string {
    const pad = String(sequence).padStart(6, "0");
    if (prefix) return `${prefix}${pad}`;
    switch (type) {
      case "INVOICE":
        return `FACT-${pad}`;
      case "CREDIT_NOTE":
        return `NC-${pad}`;
      case "DEBIT_NOTE":
        return `ND-${pad}`;
      case "DISPATCH_GUIDE":
        return `GD-${pad}`;
      case "DELIVERY_NOTE":
        return `OE-${pad}`;
      default:
        return `DOC-${pad}`;
    }
  },

  getLegalLegend(type: string): string {
    switch (type) {
      case "INVOICE":
        return "Factura emitida conforme a Providencia Administrativa SNAT/2011/00071 de la República Bolivariana de Venezuela.";
      case "CREDIT_NOTE":
        return "Nota de Crédito fiscal conforme a Providencia SNAT/2011/00071. Ajuste con reposición de inventario de mercancía.";
      case "DEBIT_NOTE":
        return "Nota de Débito fiscal conforme a Providencia SNAT/2011/00071. Cargo tributario por ajuste en venta.";
      case "DISPATCH_GUIDE":
        return "Guía de Despacho que ampara el traslado de bienes muebles en tránsito conforme a la Providencia SNAT/2011/00071.";
      case "DELIVERY_NOTE":
        return "Orden y Comprobante de Entrega de mercancía con acuse de recibido conforme.";
      default:
        return "Documento emitido según normativas legales vigentes.";
    }
  },
};

// ─── 2. ADAPTADOR FISCAL CHILE (SII) ─────────────────────────────────────────
export const ChileFiscalAdapter: FiscalAdapterPort = {
  countryCode: "CL",
  countryName: "Chile",
  taxIdLabel: "RUT",
  defaultIvaRate: 19.0,

  validateTaxId(rut: string): boolean {
    return validateChileanRut(rut);
  },

  calculateTaxes(input: FiscalCalculationInput): FiscalCalculationBreakdown {
    let subtotalExempt = 0;
    let subtotalTaxable = 0;

    for (const it of input.items) {
      const lineTotal = Number((it.quantity * it.unitPrice).toFixed(2));
      if (it.isExempt) {
        subtotalExempt += lineTotal;
      } else {
        subtotalTaxable += lineTotal;
      }
    }

    const ivaRate = this.defaultIvaRate;
    const ivaAmount = Number(((subtotalTaxable * ivaRate) / 100).toFixed(2));
    const subtotalGross = Number((subtotalExempt + subtotalTaxable).toFixed(2));
    const total = Number((subtotalGross + ivaAmount).toFixed(2));

    return {
      subtotalGross,
      subtotalExempt,
      subtotalTaxable,
      ivaRatePercent: ivaRate,
      ivaAmount,
      igtfRatePercent: 0,
      igtfAmount: 0,
      total,
    };
  },

  formatDocumentNumber(type: string, sequence: number, prefix?: string): string {
    const pad = String(sequence).padStart(6, "0");
    if (prefix) return `${prefix}${pad}`;
    switch (type) {
      case "INVOICE":
        return `DTE-33-${pad}`; // DTE 33 (Factura Electrónica)
      case "CREDIT_NOTE":
        return `DTE-61-${pad}`; // DTE 61 (Nota de Crédito Electrónica)
      case "DEBIT_NOTE":
        return `DTE-56-${pad}`; // DTE 56 (Nota de Débito Electrónica)
      case "DISPATCH_GUIDE":
        return `DTE-52-${pad}`; // DTE 52 (Guía de Despacho Electrónica)
      case "DELIVERY_NOTE":
        return `OE-${pad}`;
      default:
        return `DTE-${pad}`;
    }
  },

  getLegalLegend(type: string): string {
    switch (type) {
      case "INVOICE":
        return "Documento Tributario Electrónico (DTE). Timbre Electrónico SII - Res. Exenta SII N° 80.";
      case "CREDIT_NOTE":
        return "Nota de Crédito Electrónica DTE 61. Modifica documento tributario con efecto contable e inventario.";
      case "DEBIT_NOTE":
        return "Nota de Débito Electrónica DTE 56. Aplica recargo a documento tributario anterior.";
      case "DISPATCH_GUIDE":
        return "Guía de Despacho Electrónica DTE 52. Ampara el traslado de mercaderías según normativa del SII.";
      case "DELIVERY_NOTE":
        return "Comprobante de Recepción y Entrega de Mercaderías.";
      default:
        return "Documento emitido conforme a normativas del Servicio de Impuestos Internos (SII).";
    }
  },
};

// ─── 3. ADAPTADOR FISCAL GLOBAL (ESTÁNDAR COMERCIAL) ─────────────────────────
export const GlobalFiscalAdapter: FiscalAdapterPort = {
  countryCode: "GLOBAL",
  countryName: "Internacional",
  taxIdLabel: "Documento / Tax ID",
  defaultIvaRate: 0.0,

  validateTaxId(taxId: string): boolean {
    return taxId.trim().length >= 3;
  },

  calculateTaxes(input: FiscalCalculationInput): FiscalCalculationBreakdown {
    let subtotalExempt = 0;
    let subtotalTaxable = 0;

    for (const it of input.items) {
      const lineTotal = Number((it.quantity * it.unitPrice).toFixed(2));
      if (it.isExempt) {
        subtotalExempt += lineTotal;
      } else {
        subtotalTaxable += lineTotal;
      }
    }

    const ivaRate = this.defaultIvaRate;
    const ivaAmount = Number(((subtotalTaxable * ivaRate) / 100).toFixed(2));
    const subtotalGross = Number((subtotalExempt + subtotalTaxable).toFixed(2));
    const total = Number((subtotalGross + ivaAmount).toFixed(2));

    return {
      subtotalGross,
      subtotalExempt,
      subtotalTaxable,
      ivaRatePercent: ivaRate,
      ivaAmount,
      igtfRatePercent: 0,
      igtfAmount: 0,
      total,
    };
  },

  formatDocumentNumber(type: string, sequence: number, prefix?: string): string {
    const pad = String(sequence).padStart(6, "0");
    if (prefix) return `${prefix}${pad}`;
    switch (type) {
      case "INVOICE":
        return `INV-${pad}`;
      case "CREDIT_NOTE":
        return `CN-${pad}`;
      case "DEBIT_NOTE":
        return `DN-${pad}`;
      case "DISPATCH_GUIDE":
        return `GD-${pad}`;
      case "DELIVERY_NOTE":
        return `DN-${pad}`;
      default:
        return `DOC-${pad}`;
    }
  },

  getLegalLegend(type: string): string {
    return "Comprobante mercantil oficial generado por MarketOS.";
  },
};

/**
 * Resuelve el adaptador adecuado según módulos activos y país
 */
export function resolveFiscalAdapter(
  countryCode?: string,
  activeModuleIds: string[] = []
): FiscalAdapterPort {
  if (activeModuleIds.includes("local_venezuela") || countryCode === "VE") {
    return VenezuelaFiscalAdapter;
  }
  if (activeModuleIds.includes("local_chile") || countryCode === "CL") {
    return ChileFiscalAdapter;
  }
  return GlobalFiscalAdapter;
}
