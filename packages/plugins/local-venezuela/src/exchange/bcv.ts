export interface BcvRateInfo {
  usdRate: number;
  eurRate?: number;
  usdtRate?: number;
  source: string;
  timestamp: string;
}

let memoryBcvCache: {
  data: BcvRateInfo;
  expiresAt: number;
} | null = null;

export const ALCAMBIO_GRAPHQL_URL = "https://api.alcambio.app/graphql";
export const BCV_API_URL = "https://bcv.today/api/v1/rate.json";

/**
 * Fetch official BCV Rate from AlCambio.app GraphQL API or bcv.today
 * Cached in memory with 1 hour TTL
 */
export async function fetchOfficialBcvRate(): Promise<BcvRateInfo> {
  // 1. Try memory cache
  if (memoryBcvCache && Date.now() < memoryBcvCache.expiresAt) {
    return memoryBcvCache.data;
  }

  // 2. Primary: AlCambio GraphQL
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

      let usdtRate: number | undefined;
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
        const result: BcvRateInfo = {
          usdRate: Number(usdRate.toFixed(4)),
          eurRate,
          usdtRate,
          source: "AlCambio (BCV Oficial)",
          timestamp: new Date().toISOString(),
        };

        memoryBcvCache = {
          data: result,
          expiresAt: Date.now() + 3600 * 1000,
        };
        return result;
      }
    }
  } catch (err) {
    console.warn("[Local-Venezuela] AlCambio fetch failed, attempting backup:", err instanceof Error ? err.message : err);
  }

  // 3. Backup: bcv.today
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(BCV_API_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    }).finally(() => clearTimeout(timeoutId));

    if (res.ok) {
      const data = await res.json();
      const usdRate = typeof data.USD === "number" ? data.USD : data.usd?.rate ?? 0;
      if (usdRate > 0) {
        const result: BcvRateInfo = {
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
    console.warn("[Local-Venezuela] Secondary backup fetch failed:", err instanceof Error ? err.message : err);
  }

  // 4. Fallback
  return {
    usdRate: 875.65,
    source: "BCV_FALLBACK_OFFLINE",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Convert USD amount to VES at the given rate
 */
export function convertUsdToVes(priceUsd: number, exchangeRate: number): number {
  if (priceUsd <= 0 || exchangeRate <= 0) return 0;
  return Number((priceUsd * exchangeRate).toFixed(2));
}

/**
 * Format currency in Venezuelan Bolivars (e.g. "Bs. 1.250,50")
 */
export function formatBs(amount: number): string {
  return `Bs. ${new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}
