import { CurrencyCode, BcvApiResponse } from "@marketos/types";
import { cacheGet, cacheSet } from "./redis";

export * from "./redis";
export * from "./storage";

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

  // 2. Fetch from bcv.today API
  try {
    const res = await fetch(BCV_API_URL, {
      headers: {
        Accept: "application/json",
      },
      ...({ next: { revalidate: 3600 } } as RequestInit),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch BCV rates: HTTP ${res.status}`);
    }

    const data = await res.json();
    const usdRate =
      typeof data.USD === "number"
        ? data.USD
        : (data as BcvApiResponse).usd?.rate ?? 0;

    if (!usdRate || usdRate <= 0) {
      throw new Error("Invalid USD rate returned from BCV API");
    }

    const result = {
      usdRate,
      source: "https://bcv.today/api/v1/rate.json",
      timestamp: data.updated_at || new Date().toISOString(),
    };

    // 3. Cache in Upstash Redis for 1 hour
    try {
      await cacheSet(CACHE_KEY, result, 3600);
    } catch (e) {
      console.warn("[Redis Cache] Error storing BCV rate:", e);
    }

    return result;
  } catch (error) {
    console.error("[BCV_SYNC_ERROR] Error fetching rate from bcv.today:", error);
    throw error;
  }
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
