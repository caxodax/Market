/**
 * SENIAT Fiscal Calculation & Utilities (Providencia Administrativa SNAT/2011/00071 & Ley del IVA / IGTF)
 * Pure TypeScript functions with zero external dependencies.
 */

export const SENIAT_LEGAL_CONSTANTS = {
  DEFAULT_IVA_RATE: 16.0,
  IGTF_RATE: 3.0,
  DEFAULT_CONTROL_PREFIX: "00-",
  DEFAULT_INVOICE_PREFIX: "FACT-",
  NON_FISCAL_WARNING_LEGEND: "DOCUMENTO NO FISCAL - EXIJA SU FACTURA FISCAL EN CAJA",
  NON_FISCAL_SUBTITLE: "Comprobante interno de preventa / despacho para verificación y caja física",
} as const;

export interface SeniatFiscalItemInput {
  name: string;
  quantity: number;
  unitPriceUsd: number;
  isTaxExempt?: boolean;
}

export interface SeniatFiscalCalculationOptions {
  items: SeniatFiscalItemInput[];
  discountUsd?: number;
  deliveryFeeUsd?: number;
  ivaRatePercentage?: number;
  applyIgtf?: boolean;
  paymentMethod?: string;
  exchangeRate?: number;
}

export interface SeniatFiscalCalculationResult {
  subtotalGrossUsd: number;
  subtotalExemptUsd: number;
  subtotalExemptVes: number;
  subtotalTaxableUsd: number;
  subtotalTaxableVes: number;
  discountUsd: number;
  deliveryFeeUsd: number;
  ivaRatePercentage: number;
  ivaAmountUsd: number;
  ivaAmountVes: number;
  igtfBaseUsd: number;
  igtfRatePercentage: number;
  igtfAmountUsd: number;
  igtfAmountVes: number;
  totalUsd: number;
  totalVes: number;
  exchangeRate: number;
}

/**
 * Calculates itemized fiscal breakdown according to Venezuelan tax law:
 * - Articles 18 & 27 Ley del IVA (Distinction between Exempt 'E' and Taxable 'G 16%')
 * - Delivery fee is classified as a taxable transport service (16%)
 * - Proportionate discount application
 * - IGTF (3%) applied to foreign currency payments (Cash USD, Zelle)
 */
export function calculateSeniatFiscalBreakdown(
  options: SeniatFiscalCalculationOptions
): SeniatFiscalCalculationResult {
  const {
    items = [],
    discountUsd = 0,
    deliveryFeeUsd = 0,
    ivaRatePercentage = SENIAT_LEGAL_CONSTANTS.DEFAULT_IVA_RATE,
    applyIgtf = false,
    paymentMethod = "",
    exchangeRate = 1,
  } = options;

  let rawExemptUsd = 0;
  let rawTaxableUsd = 0;

  for (const item of items) {
    const lineTotal = item.quantity * item.unitPriceUsd;
    if (item.isTaxExempt) {
      rawExemptUsd += lineTotal;
    } else {
      rawTaxableUsd += lineTotal;
    }
  }

  const subtotalGrossUsd = Number((rawExemptUsd + rawTaxableUsd).toFixed(2));

  // Apply discount proportionally between exempt and taxable portions
  let adjustedExemptUsd = rawExemptUsd;
  let adjustedTaxableUsd = rawTaxableUsd;

  if (discountUsd > 0 && subtotalGrossUsd > 0) {
    const exemptRatio = rawExemptUsd / subtotalGrossUsd;
    const taxableRatio = rawTaxableUsd / subtotalGrossUsd;

    const exemptDiscount = discountUsd * exemptRatio;
    const taxableDiscount = discountUsd * taxableRatio;

    adjustedExemptUsd = Math.max(0, rawExemptUsd - exemptDiscount);
    adjustedTaxableUsd = Math.max(0, rawTaxableUsd - taxableDiscount);
  }

  // Delivery fee is considered a taxable transportation service under Venezuelan VAT
  if (deliveryFeeUsd > 0) {
    adjustedTaxableUsd += deliveryFeeUsd;
  }

  adjustedExemptUsd = Number(adjustedExemptUsd.toFixed(2));
  adjustedTaxableUsd = Number(adjustedTaxableUsd.toFixed(2));

  // IVA 16% calculation
  const ivaMultiplier = ivaRatePercentage / 100;
  const ivaAmountUsd = Number((adjustedTaxableUsd * ivaMultiplier).toFixed(2));

  // Subtotal with IVA before IGTF
  const subtotalWithIvaUsd = Number(
    (adjustedExemptUsd + adjustedTaxableUsd + ivaAmountUsd).toFixed(2)
  );

  // IGTF 3% calculation for foreign currency payments (Cash USD, Zelle, international)
  const isForeignCurrencyPayment =
    paymentMethod === "CASH_USD" ||
    paymentMethod === "ZELLE" ||
    paymentMethod === "BINANCE" ||
    paymentMethod === "BINANCE_PAY";

  const shouldApplyIgtf = applyIgtf && isForeignCurrencyPayment;
  const igtfBaseUsd = shouldApplyIgtf ? subtotalWithIvaUsd : 0;
  const igtfRatePercentage = shouldApplyIgtf ? SENIAT_LEGAL_CONSTANTS.IGTF_RATE : 0;
  const igtfAmountUsd = shouldApplyIgtf
    ? Number((igtfBaseUsd * (igtfRatePercentage / 100)).toFixed(2))
    : 0;

  const totalUsd = Number((subtotalWithIvaUsd + igtfAmountUsd).toFixed(2));

  // Convert to official Bolívares (VES) using the BCV exchange rate
  const rate = exchangeRate > 0 ? exchangeRate : 1;
  const subtotalExemptVes = Number((adjustedExemptUsd * rate).toFixed(2));
  const subtotalTaxableVes = Number((adjustedTaxableUsd * rate).toFixed(2));
  const ivaAmountVes = Number((ivaAmountUsd * rate).toFixed(2));
  const igtfAmountVes = Number((igtfAmountUsd * rate).toFixed(2));
  const totalVes = Number((totalUsd * rate).toFixed(2));

  return {
    subtotalGrossUsd,
    subtotalExemptUsd: adjustedExemptUsd,
    subtotalExemptVes,
    subtotalTaxableUsd: adjustedTaxableUsd,
    subtotalTaxableVes,
    discountUsd: Number(discountUsd.toFixed(2)),
    deliveryFeeUsd: Number(deliveryFeeUsd.toFixed(2)),
    ivaRatePercentage,
    ivaAmountUsd,
    ivaAmountVes,
    igtfBaseUsd,
    igtfRatePercentage,
    igtfAmountUsd,
    igtfAmountVes,
    totalUsd,
    totalVes,
    exchangeRate: rate,
  };
}

/**
 * Formats a sequential number to standard SENIAT Control Number format:
 * e.g. 125 -> "00-00000125" (8 numeric digits with prefix)
 */
export function formatSeniatControlNumber(
  sequence: number,
  prefix: string = SENIAT_LEGAL_CONSTANTS.DEFAULT_CONTROL_PREFIX
): string {
  const safeSeq = Math.max(1, Math.floor(sequence));
  const padded = safeSeq.toString().padStart(8, "0");
  return `${prefix}${padded}`;
}

/**
 * Formats a sequential number to standard SENIAT Invoice Number format:
 * e.g. 1045 -> "FACT-00001045"
 */
export function formatSeniatInvoiceNumber(
  sequence: number,
  prefix: string = SENIAT_LEGAL_CONSTANTS.DEFAULT_INVOICE_PREFIX
): string {
  const safeSeq = Math.max(1, Math.floor(sequence));
  const padded = safeSeq.toString().padStart(8, "0");
  return `${prefix}${padded}`;
}

/**
 * Validates and normalizes Venezuelan RIF (Registro de Información Fiscal):
 * Format: [J|V|G|E|P]-[0-9]{8,9}-[0-9]
 */
export function validateSeniatRif(rif: string): {
  isValid: boolean;
  normalizedRif: string;
  error?: string;
} {
  if (!rif || typeof rif !== "string") {
    return { isValid: false, normalizedRif: "", error: "El RIF no puede estar vacío." };
  }

  const clean = rif.trim().toUpperCase().replace(/[\s.]/g, "");

  // Match: J123456789 or J-12345678-9 or V12345678
  const rifRegex = /^([J|V|G|E|P])-?([0-9]{7,9})-?([0-9]{1})$/;
  const match = clean.match(rifRegex);

  if (!match) {
    return {
      isValid: false,
      normalizedRif: clean,
      error: "Formato de RIF inválido. Debe iniciar con J, V, G, E o P seguido de números (ej. J-50123456-7).",
    };
  }

  const normalizedRif = `${match[1]}-${match[2]}-${match[3]}`;
  return { isValid: true, normalizedRif };
}
