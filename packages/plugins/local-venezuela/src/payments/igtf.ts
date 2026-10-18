export interface IgtfCalculationResult {
  baseAmountUsd: number;
  igtfPercentage: number;
  igtfAmountUsd: number;
  totalWithIgtfUsd: number;
  igtfAmountVes?: number;
  totalWithIgtfVes?: number;
}

/**
 * Calculates Venezuelan 3% IGTF (Impuesto a las Grandes Transacciones Financieras)
 * Applicable to payments processed in foreign currencies (Cash USD, Zelle)
 */
export function calculateIgtf(
  amountUsd: number,
  exchangeRate?: number,
  igtfPercentage: number = 3
): IgtfCalculationResult {
  if (amountUsd <= 0) {
    return {
      baseAmountUsd: 0,
      igtfPercentage,
      igtfAmountUsd: 0,
      totalWithIgtfUsd: 0,
      ...(exchangeRate
        ? {
            igtfAmountVes: 0,
            totalWithIgtfVes: 0,
          }
        : {}),
    };
  }

  const rateMultiplier = igtfPercentage / 100;
  const igtfAmountUsd = Number((amountUsd * rateMultiplier).toFixed(2));
  const totalWithIgtfUsd = Number((amountUsd + igtfAmountUsd).toFixed(2));

  let igtfAmountVes: number | undefined;
  let totalWithIgtfVes: number | undefined;

  if (exchangeRate && exchangeRate > 0) {
    igtfAmountVes = Number((igtfAmountUsd * exchangeRate).toFixed(2));
    totalWithIgtfVes = Number((totalWithIgtfUsd * exchangeRate).toFixed(2));
  }

  return {
    baseAmountUsd: amountUsd,
    igtfPercentage,
    igtfAmountUsd,
    totalWithIgtfUsd,
    igtfAmountVes,
    totalWithIgtfVes,
  };
}
