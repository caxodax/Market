import { CurrencyCode, BcvApiResponse } from "@marketos/types";

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
 * Fetch official BCV Rate from https://bcv.today/api/
 */
export const BCV_API_URL = "https://bcv.today/api/";

export async function fetchBcvRate(): Promise<{
  usdRate: number;
  source: string;
  timestamp: string;
}> {
  try {
    const res = await fetch(BCV_API_URL, {
      ...({ next: { revalidate: 3600 } } as RequestInit),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch BCV rates: HTTP ${res.status}`);
    }

    const data: BcvApiResponse = await res.json();
    const usdRate = data.usd?.rate ?? 0;

    if (!usdRate || usdRate <= 0) {
      throw new Error("Invalid USD rate returned from BCV API");
    }

    return {
      usdRate,
      source: "bcv.today",
      timestamp: data.usd?.updated_at || new Date().toISOString(),
    };
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
