import type {
  RetentionVoucherType,
  SeniatRetentionTxtRow,
} from "@marketos/types";

export interface RetentionCalculationResult {
  vatRetainedAmount: number;
  netPayableVat: number;
  retentionRatePercent: number;
}

export interface RetentionAdapterPort {
  countryCode: string;
  countryName: string;
  defaultVatRetentionRate: number; // 75% en VE, 100% en DTE 46 CL
  calculateVatRetention(ivaAmount: number, ratePercent?: number): RetentionCalculationResult;
  calculateIncomeTaxRetention(taxableBase: number, ratePercent: number): number;
  formatVoucherNumber(sequence: number, taxPeriod: string): string;
  getLegalLegend(type: RetentionVoucherType): string;
  formatSeniatTxtLine?(row: SeniatRetentionTxtRow): string;
}

// ─── 1. ADAPTADOR VENEZUELA (SENIAT SUJETOS PASIVOS ESPECIALES) ─────────────
export const VenezuelaRetentionAdapter: RetentionAdapterPort = {
  countryCode: "VE",
  countryName: "Venezuela (SENIAT SPE)",
  defaultVatRetentionRate: 75.0,

  calculateVatRetention(ivaAmount: number, ratePercent = 75.0): RetentionCalculationResult {
    const rate = [75, 100].includes(ratePercent) ? ratePercent : 75.0;
    const vatRetainedAmount = Number(((ivaAmount * rate) / 100).toFixed(2));
    const netPayableVat = Number((ivaAmount - vatRetainedAmount).toFixed(2));
    return {
      vatRetainedAmount,
      netPayableVat,
      retentionRatePercent: rate,
    };
  },

  calculateIncomeTaxRetention(taxableBase: number, ratePercent: number): number {
    if (taxableBase <= 0 || ratePercent <= 0) return 0;
    return Number(((taxableBase * ratePercent) / 100).toFixed(2));
  },

  /**
   * Formato oficial SENIAT: 14 dígitos (YYYYMM + 8 dígitos correlativos)
   * Ej: 20261000000001
   */
  formatVoucherNumber(sequence: number, taxPeriod: string): string {
    const cleanPeriod = taxPeriod.replace(/[^0-9]/g, "").slice(0, 6);
    const period = cleanPeriod.length === 6 ? cleanPeriod : new Date().toISOString().slice(0, 7).replace("-", "");
    const pad = String(sequence).padStart(8, "0");
    return `${period}${pad}`;
  },

  getLegalLegend(type: RetentionVoucherType): string {
    if (type === "VAT") {
      return "Comprobante de Retención del Impuesto al Valor Agregado (IVA) emitido de conformidad con la Providencia Administrativa SNAT/2015/0049 publicada en Gaceta Oficial N° 40.720. El impuesto retenido será enterado al Tesoro Nacional por cuenta del proveedor.";
    }
    if (type === "INCOME_TAX") {
      return "Comprobante de Retención de Impuesto Sobre la Renta (ISLR) emitido según el Decreto N° 1.808 (Reglamento Parcial de la Ley de ISLR en materia de Retenciones).";
    }
    return "Comprobante Fiscal de Retención en la Fuente.";
  },

  /**
   * Genera la línea oficial para el archivo TXT de retenciones de IVA del SENIAT
   * Formato: 16 campos separados por tabulador (\t)
   */
  formatSeniatTxtLine(row: SeniatRetentionTxtRow): string {
    const cleanAgentRif = row.agentRif.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const cleanSupplierRif = row.supplierRif.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const cleanPeriod = row.taxPeriod.replace(/[^0-9]/g, "").slice(0, 6);
    const affectedDoc = row.affectedInvoiceNumber ? row.affectedInvoiceNumber.trim() : "0";
    const fileNo = row.fileNumber || "0";

    const fields = [
      cleanAgentRif,
      cleanPeriod,
      row.invoiceDate,
      row.operationType || "C",
      row.documentType || "01",
      cleanSupplierRif,
      row.invoiceNumber,
      row.controlNumber || "00-000000",
      row.totalAmountVes.toFixed(2),
      row.taxableBaseVes.toFixed(2),
      row.retainedAmountVes.toFixed(2),
      affectedDoc,
      row.voucherNumber,
      row.exemptAmountVes.toFixed(2),
      row.ivaRatePercent.toFixed(2),
      fileNo,
    ];

    return fields.join("\t");
  },
};

// ─── 2. ADAPTADOR CHILE (SII FACTURA DE COMPRA DTE 46 / RCV) ────────────────
export const ChileRetentionAdapter: RetentionAdapterPort = {
  countryCode: "CL",
  countryName: "Chile (SII DTE 46 / RCV)",
  defaultVatRetentionRate: 100.0, // Retención total de IVA por cambio de sujeto

  calculateVatRetention(ivaAmount: number, ratePercent = 100.0): RetentionCalculationResult {
    const rate = ratePercent > 0 ? ratePercent : 100.0;
    const vatRetainedAmount = Math.round((ivaAmount * rate) / 100);
    const netPayableVat = Math.max(0, ivaAmount - vatRetainedAmount);
    return {
      vatRetainedAmount,
      netPayableVat,
      retentionRatePercent: rate,
    };
  },

  calculateIncomeTaxRetention(taxableBase: number, ratePercent: number): number {
    if (taxableBase <= 0 || ratePercent <= 0) return 0;
    return Math.round((taxableBase * ratePercent) / 100);
  },

  formatVoucherNumber(sequence: number): string {
    return `DTE-46-${String(sequence).padStart(6, "0")}`;
  },

  getLegalLegend(): string {
    return "Factura de Compra (DTE 46) con retención de IVA y cambio de sujeto pasivo de acuerdo al Artículo 3° de la Ley sobre Impuesto a las Ventas y Servicios (D.L. 825) y Resoluciones Exentas del SII.";
  },
};

// ─── 3. ADAPTADOR GLOBAL / INTERNACIONAL ─────────────────────────────────────
export const GlobalRetentionAdapter: RetentionAdapterPort = {
  countryCode: "GLOBAL",
  countryName: "Internacional (Withholding Tax)",
  defaultVatRetentionRate: 0.0,

  calculateVatRetention(ivaAmount: number, ratePercent = 0.0): RetentionCalculationResult {
    const vatRetainedAmount = Number(((ivaAmount * ratePercent) / 100).toFixed(2));
    const netPayableVat = Number((ivaAmount - vatRetainedAmount).toFixed(2));
    return {
      vatRetainedAmount,
      netPayableVat,
      retentionRatePercent: ratePercent,
    };
  },

  calculateIncomeTaxRetention(taxableBase: number, ratePercent: number): number {
    if (taxableBase <= 0 || ratePercent <= 0) return 0;
    return Number(((taxableBase * ratePercent) / 100).toFixed(2));
  },

  formatVoucherNumber(sequence: number, taxPeriod: string): string {
    return `RET-${taxPeriod}-${String(sequence).padStart(6, "0")}`;
  },

  getLegalLegend(): string {
    return "Withholding Tax Voucher issued for commercial vendor procurement.";
  },
};

// ─── SELECTOR DE ADAPTADOR DESACOPLADO ───────────────────────────────────────
export function resolveRetentionAdapter(
  countryCode?: string,
  activeModuleIds: string[] = []
): RetentionAdapterPort {
  if (activeModuleIds.includes("local_venezuela") || countryCode?.toUpperCase() === "VE") {
    return VenezuelaRetentionAdapter;
  }
  if (activeModuleIds.includes("local_chile") || countryCode?.toUpperCase() === "CL") {
    return ChileRetentionAdapter;
  }
  return GlobalRetentionAdapter;
}
