import type {
  CurrencyCode,
  BcvApiResponse,
  StoreCurrencySettings,
  StoreRateMode,
} from "@marketos/types";

export * from "./storage.ts";
export * from "./whatsapp.ts";
export * from "./image-compressor.ts";
export * from "./dates.ts";

export interface EffectiveExchangeRateResult {
  effectiveRate: number;
  baseCurrency: "USD" | "EUR";
  rateMode: StoreRateMode;
  usdRate: number;
  eurRate: number;
  averageRate: number;
  label: string;
}

/**
 * Calculate the effective exchange rate taking into account store base currency (USD or EUR)
 * and active conversion regime (BCV_BASE, BCV_AVERAGE, BCV_CROSS, CUSTOM).
 */
export function calculateEffectiveExchangeRate(
  rate: { value: number; eur_value?: number; usdt_value?: number } | number,
  currencySettings?: StoreCurrencySettings | null
): EffectiveExchangeRateResult {
  const rawRateObj = typeof rate === "number" ? { value: rate } : rate;
  const usdRate = rawRateObj?.value && rawRateObj.value > 0 ? rawRateObj.value : 875.65;
  const eurRate =
    rawRateObj?.eur_value && rawRateObj.eur_value > 0
      ? rawRateObj.eur_value
      : Number((usdRate * 1.085).toFixed(4));
  const averageRate = Number(((usdRate + eurRate) / 2).toFixed(4));

  const baseCurrency: "USD" | "EUR" =
    currencySettings?.base_currency === "EUR" ? "EUR" : "USD";
  const rateMode: StoreRateMode = currencySettings?.rate_mode || "BCV_BASE";

  let effectiveRate = usdRate;
  let label = "Tasa Oficial BCV USD";

  if (
    rateMode === "CUSTOM" &&
    currencySettings?.custom_rate_value &&
    currencySettings.custom_rate_value > 0
  ) {
    effectiveRate = currencySettings.custom_rate_value;
    label = "Tasa Especial Personalizada";
  } else if (rateMode === "BCV_AVERAGE") {
    effectiveRate = averageRate;
    label = "Tasa Promedio (USD + EUR) / 2";
  } else if (rateMode === "BCV_CROSS") {
    if (baseCurrency === "EUR") {
      effectiveRate = usdRate;
      label = "Tasa Cruzada (Referencia USD)";
    } else {
      effectiveRate = eurRate;
      label = "Tasa Cruzada (Referencia EUR)";
    }
  } else {
    // BCV_BASE
    if (baseCurrency === "EUR") {
      effectiveRate = eurRate;
      label = "Tasa Oficial BCV EUR";
    } else {
      effectiveRate = usdRate;
      label = "Tasa Oficial BCV USD";
    }
  }

  return {
    effectiveRate: Number(effectiveRate.toFixed(4)),
    baseCurrency,
    rateMode,
    usdRate,
    eurRate,
    averageRate,
    label,
  };
}

/**
 * Convert base price to VES using the effective exchange rate
 */
export function convertPriceToVes(
  price: number,
  rate: { value: number; eur_value?: number; usdt_value?: number } | number,
  currencySettings?: StoreCurrencySettings | null
): number {
  if (price <= 0) return 0;
  const { effectiveRate } = calculateEffectiveExchangeRate(rate, currencySettings);
  return Number((price * effectiveRate).toFixed(2));
}

let memoryBcvCache: {
  data: {
    usdRate: number;
    eurRate?: number;
    usdtRate?: number;
    source: string;
    timestamp: string;
  };
  expiresAt: number;
} | null = null;

/**
 * Currency Formatting Utilities for MarketOS
 */
export function formatCurrency(
  amount: number,
  currency: CurrencyCode = "USD",
  locale: string = "es-VE"
): string {
  if (currency === "VES") {
    return `Bs. ${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)}`;
  }

  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
  }).format(amount);
}

/**
 * Convert USD to VES using specified rate
 */
export function convertUsdToVes(priceUsd: number, exchangeRate: number): number {
  if (priceUsd <= 0 || exchangeRate <= 0) return 0;
  return Number((priceUsd * exchangeRate).toFixed(2));
}

/**
 * Fetch official BCV Rate from https://bcv.today/api/ (Endpoint: /api/v1/rate.json)
 * Optimized with in-memory cache (1 hour TTL)
 */
export const ALCAMBIO_GRAPHQL_URL = "https://api.alcambio.app/graphql";
export const BCV_API_URL = "https://bcv.today/api/v1/rate.json";

export async function fetchBcvRate(): Promise<{
  usdRate: number;
  source: string;
  timestamp: string;
}> {
  // 1. Try in-memory cache first (sub-millisecond, zero external dependencies)
  if (memoryBcvCache && Date.now() < memoryBcvCache.expiresAt) {
    return memoryBcvCache.data;
  }

  // 2. Primary Source: AlCambio.app GraphQL API (Reliable & fast, same as KsaSport)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const query = `
      query getRates {
        getCountryConversions(payload: { countryCode: "VE" }) {
          dateBcv
          conversionRates {
            type
            official
            baseValue
            rateCurrency {
              code
            }
          }
        }
        getBinanceP2PAverages {
          sellAverage
          buyAverage
        }
      }
    `;

    const res = await fetch(ALCAMBIO_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (res.ok) {
      const json = await res.json();
      const rates = json.data?.getCountryConversions?.conversionRates || [];
      const binance = json.data?.getBinanceP2PAverages;

      const officialUsd =
        rates.find(
          (r: any) =>
            r.official === true &&
            r.rateCurrency?.code === "USD" &&
            (r.type === "SECONDARY" || r.type === "OTHER")
        ) ||
        rates.find(
          (r: any) => r.official === true && r.rateCurrency?.code === "USD"
        );

      const officialEur =
        rates.find(
          (r: any) =>
            r.official === true &&
            r.rateCurrency?.code === "EUR" &&
            (r.type === "SECONDARY" || r.type === "OTHER")
        ) ||
        rates.find(
          (r: any) => r.rateCurrency?.code === "EUR"
        );

      let usdtRate: number | undefined = undefined;
      if (binance?.buyAverage && binance?.sellAverage) {
        const buy = Number(binance.buyAverage);
        const sell = Number(binance.sellAverage);
        if (!isNaN(buy) && !isNaN(sell) && buy > 0 && sell > 0) {
          usdtRate = Number(((buy + sell) / 2).toFixed(4));
        }
      }

      const usdRate = officialUsd ? Number(officialUsd.baseValue) : 0;
      const eurRate = officialEur ? Number(Number(officialEur.baseValue).toFixed(4)) : undefined;

      if (usdRate > 0) {
        const result = {
          usdRate: Number(usdRate.toFixed(4)),
          eurRate,
          usdtRate,
          source: "AlCambio (BCV Oficial)",
          timestamp: new Date().toISOString(),
        };

        // Cache in-memory for 1 hour
        memoryBcvCache = {
          data: result,
          expiresAt: Date.now() + 3600 * 1000,
        };
        return result;
      }
    }
  } catch (err) {
    console.warn(
      "[AlCambio] Could not fetch rate, falling back to secondary source:",
      err instanceof Error ? err.message : err
    );
  }

  // 3. Secondary Backup: bcv.today API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(BCV_API_URL, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
      ...({ next: { revalidate: 3600 } } as RequestInit),
    }).finally(() => clearTimeout(timeoutId));

    if (res.ok) {
      const data = await res.json();
      const usdRate =
        typeof data.USD === "number"
          ? data.USD
          : (data as BcvApiResponse).usd?.rate ?? 0;

      if (usdRate > 0) {
        const result = {
          usdRate,
          source: "bcv.today",
          timestamp: data.updated_at || new Date().toISOString(),
        };
        memoryBcvCache = {
          data: result,
          expiresAt: Date.now() + 3600 * 1000,
        };
        return result;
      }
    }
  } catch (err) {
    // Silent fallback
  }

  // 4. Safe Offline Fallback
  return {
    usdRate: 875.65,
    source: "BCV_FALLBACK_OFFLINE",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Safe Slugifier for Tenants & Products
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Sanitize URL to prevent XSS payloads (e.g. javascript:, data:, vbscript:)
 * Allows only http://, https://, /relative, mailto:, and tel:
 */
export function sanitizeSafeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:")
  ) {
    return null;
  }
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("/") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  ) {
    return trimmed;
  }
  return null;
}
