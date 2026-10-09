import { CurrencyCode, BcvApiResponse } from "@marketos/types";
import { cacheGet, cacheSet } from "./redis";

export * from "./redis";
export * from "./storage";
export * from "./whatsapp";
export * from "./image-compressor";

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
 * Optimized with Upstash Redis cache (1 hour TTL)
 */
export const ALCAMBIO_GRAPHQL_URL = "https://api.alcambio.app/graphql";
export const BCV_API_URL = "https://bcv.today/api/v1/rate.json";

export async function fetchBcvRate(): Promise<{
  usdRate: number;
  source: string;
  timestamp: string;
}> {
  const CACHE_KEY = "marketos:bcv:rate";

  // 1. Try Upstash Redis cache first (sub-millisecond latency)
  try {
    const cached = await cacheGet<{
      usdRate: number;
      source: string;
      timestamp: string;
    }>(CACHE_KEY);

    if (cached && typeof cached.usdRate === "number" && cached.usdRate > 0) {
      return cached;
    }
  } catch (e) {
    console.warn("[Redis Cache] Error checking BCV rate cache:", e);
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

        // Cache in Upstash Redis asynchronously
        cacheSet(CACHE_KEY, result, 3600).catch(() => {});
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
        cacheSet(CACHE_KEY, result, 3600).catch(() => {});
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
