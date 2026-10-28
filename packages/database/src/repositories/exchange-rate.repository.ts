import type {
  ExchangeRate,
  RateHistoryItem,
  AuditActor,
} from "@marketos/types";
import { fetchBcvRate } from "@marketos/utils";
import { state } from "../mock-data.ts";
import { getSupabase, isLiveDatabaseConfigured } from "./base.ts";
import { AuditRepository } from "./audit.repository.ts";

export class ExchangeRateRepository {
  /**
   * Get Exchange Rate for Tenant - Reads strictly from Database / Local Seed
   * Pure database read (0 network latency, 0 external API calls on user requests)
   */
  static async getExchangeRate(tenantId: string): Promise<ExchangeRate> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("exchange_rates")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (!error && data) {
          const rate: ExchangeRate = {
            id: data.id,
            tenant_id: data.tenant_id,
            currency: data.currency,
            value: Number(data.value),
            eur_value: data.eur_value ? Number(data.eur_value) : undefined,
            usdt_value: data.usdt_value ? Number(data.usdt_value) : undefined,
            source: data.source,
            updated_at: data.updated_at,
          };

          // If eur_value or usdt_value are missing (since exchange_rates table only stores USD value),
          // hydrate them seamlessly from the latest record in exchange_rate_history
          if (!rate.eur_value || !rate.usdt_value) {
            try {
              const { data: hist } = await supabase
                .from("exchange_rate_history")
                .select("rate_eur, usdt_promedio")
                .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
                .order("date_rate", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (hist) {
                if (hist.rate_eur && !rate.eur_value) rate.eur_value = Number(hist.rate_eur);
                if (hist.usdt_promedio && !rate.usdt_value) rate.usdt_value = Number(hist.usdt_promedio);
              }
            } catch {
              // Non-blocking fallback
            }
          }

          return rate;
        }

        // Fallback: read directly from latest database history (0 external API calls)
        const { data: latestHist } = await supabase
          .from("exchange_rate_history")
          .select("*")
          .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
          .order("date_rate", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestHist) {
          return {
            id: latestHist.id,
            tenant_id: tenantId,
            currency: "VES",
            value: Number(latestHist.rate),
            eur_value: latestHist.rate_eur ? Number(latestHist.rate_eur) : undefined,
            usdt_value: latestHist.usdt_promedio ? Number(latestHist.usdt_promedio) : undefined,
            source: latestHist.source,
            updated_at: latestHist.created_at || new Date().toISOString(),
          };
        }
      } catch (err) {
        console.warn("[MarketOS] Exchange rate fetch error, using resilient fallback:", err);
      }
    }

    const fallback = state.rates.find((r) => r.tenant_id === tenantId) || {
      id: "rate-fallback",
      tenant_id: tenantId,
      currency: "VES",
      value: 875.6505,
      eur_value: 980.6147,
      usdt_value: 1016.785,
      source: "alcambio.app",
      updated_at: new Date().toISOString(),
    };
    return fallback;
  }

  /**
   * Get Historical Exchange Rates (Daily ledger for accounting, audit and charts)
   */
  static async getExchangeRateHistory(
    tenantId?: string,
    limit: number = 30
  ): Promise<RateHistoryItem[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase
          .from("exchange_rate_history")
          .select("*")
          .order("date_rate", { ascending: false })
          .limit(limit);

        if (tenantId) {
          query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          return data.map((item: any) => ({
            id: item.id,
            tenant_id: item.tenant_id,
            date_rate: item.date_rate,
            currency: item.currency || "USD",
            rate: Number(item.rate),
            rate_eur: item.rate_eur ? Number(item.rate_eur) : undefined,
            usdt_promedio: item.usdt_promedio ? Number(item.usdt_promedio) : undefined,
            source: item.source,
            created_at: item.created_at,
          }));
        }
      } catch (err) {
        console.warn("[MarketOS] Error fetching exchange rate history from Supabase:", err);
      }
    }

    if (isLiveDatabaseConfigured()) {
      return [];
    }

    // Fallback to in-memory history state
    let history = [...state.rateHistory];
    if (tenantId) {
      history = history.filter((h) => !h.tenant_id || h.tenant_id === tenantId);
    }
    history.sort((a, b) => b.date_rate.localeCompare(a.date_rate));
    return history.slice(0, limit);
  }

  /**
   * Synchronize Official BCV Rate from API into Supabase Database
   * Executed via scheduled cron (e.g. daily at 7:00 AM) or manual Admin trigger
   */
  static async syncBcvRateFromApi(tenantId: string): Promise<ExchangeRate> {
    let bcv: {
      usdRate: number;
      eurRate?: number;
      usdtRate?: number;
      source: string;
      timestamp: string;
    };

    try {
      bcv = await fetchBcvRate();
    } catch {
      bcv = {
        usdRate: 875.6505,
        eurRate: 980.6147,
        usdtRate: 1016.785,
        source: "alcambio.app",
        timestamp: new Date().toISOString(),
      };
    }

    const todayDateStr = bcv.timestamp.split("T")[0];
    const supabase = getSupabase();

    if (supabase) {
      try {
        // 1. Update active rate in exchange_rates
        const { data: existing } = await supabase
          .from("exchange_rates")
          .select("id")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        // exchange_rates table strictly has (id, tenant_id, currency, value, source, updated_at)
        const ratePayload = {
          value: bcv.usdRate,
          source: bcv.source,
          updated_at: bcv.timestamp,
        };

        if (existing) {
          const { error: updateErr } = await supabase
            .from("exchange_rates")
            .update(ratePayload)
            .eq("id", existing.id);
          if (updateErr) {
            console.error("[MarketOS] Error updating exchange_rates:", updateErr);
          }
        } else {
          const { error: insertErr } = await supabase.from("exchange_rates").insert({
            tenant_id: tenantId,
            currency: "VES",
            ...ratePayload,
          });
          if (insertErr) {
            console.error("[MarketOS] Error inserting exchange_rates:", insertErr);
          }
        }

        // 2. Upsert into exchange_rate_history
        await supabase.from("exchange_rate_history").upsert(
          {
            tenant_id: tenantId,
            date_rate: todayDateStr,
            currency: "USD",
            rate: bcv.usdRate,
            rate_eur: bcv.eurRate,
            usdt_promedio: bcv.usdtRate,
            source: bcv.source,
            created_at: bcv.timestamp,
          },
          { onConflict: "tenant_id,date_rate,currency" }
        );

        await AuditRepository.recordAuditLog({
          tenantId,
          action: "BCV_RATE_SYNCED",
          entity: "exchange_rates",
          entityId: tenantId,
          newData: {
            value: bcv.usdRate,
            eurRate: bcv.eurRate,
            usdtRate: bcv.usdtRate,
            timestamp: bcv.timestamp,
          },
        });
      } catch (e) {
        console.warn("[MarketOS] Error updating exchange rate in Supabase:", e);
      }
    }

    const updatedRate: ExchangeRate = {
      id: `rate-${tenantId}`,
      tenant_id: tenantId,
      currency: "VES",
      value: bcv.usdRate,
      eur_value: bcv.eurRate,
      usdt_value: bcv.usdtRate,
      source: bcv.source,
      updated_at: bcv.timestamp,
    };

    // Update in-memory state
    const existingIdx = state.rates.findIndex((r) => r.tenant_id === tenantId);
    if (existingIdx >= 0) {
      state.rates[existingIdx] = updatedRate;
    } else {
      state.rates.push(updatedRate);
    }

    // Update in-memory history
    const existingHistIdx = state.rateHistory.findIndex(
      (h) => h.tenant_id === tenantId && h.date_rate === todayDateStr
    );
    const historyItem: RateHistoryItem = {
      id: `hist-${Date.now()}`,
      tenant_id: tenantId,
      date_rate: todayDateStr,
      currency: "USD",
      rate: bcv.usdRate,
      rate_eur: bcv.eurRate,
      usdt_promedio: bcv.usdtRate,
      source: bcv.source,
      created_at: bcv.timestamp,
    };
    if (existingHistIdx >= 0) {
      state.rateHistory[existingHistIdx] = historyItem;
    } else {
      state.rateHistory.unshift(historyItem);
    }

    return updatedRate;
  }

  /**
   * Save Manual Contingency Exchange Rate (Admin & Super Admin)
   */
  static async saveManualExchangeRate(
    tenantId: string,
    data: {
      date_rate: string;
      usd_rate: number;
      eur_rate?: number;
      usdt_rate?: number;
      source?: string;
    },
    actor?: AuditActor | null
  ): Promise<ExchangeRate> {
    const source = data.source || "MANUAL";
    const nowIso = new Date().toISOString();
    const supabase = getSupabase();

    if (supabase) {
      try {
        // 1. Update active rate in exchange_rates
        const { data: existing } = await supabase
          .from("exchange_rates")
          .select("id")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        // exchange_rates table strictly has (id, tenant_id, currency, value, source, updated_at)
        const ratePayload = {
          value: data.usd_rate,
          source,
          updated_at: nowIso,
        };

        if (existing) {
          const { error: updateErr } = await supabase
            .from("exchange_rates")
            .update(ratePayload)
            .eq("id", existing.id);
          if (updateErr) {
            console.error("[MarketOS] Error updating manual exchange_rates:", updateErr);
          }
        } else {
          const { error: insertErr } = await supabase.from("exchange_rates").insert({
            tenant_id: tenantId,
            currency: "VES",
            ...ratePayload,
          });
          if (insertErr) {
            console.error("[MarketOS] Error inserting manual exchange_rates:", insertErr);
          }
        }

        // 2. Upsert in exchange_rate_history
        await supabase.from("exchange_rate_history").upsert(
          {
            tenant_id: tenantId,
            date_rate: data.date_rate,
            currency: "USD",
            rate: data.usd_rate,
            rate_eur: data.eur_rate,
            usdt_promedio: data.usdt_rate,
            source,
            created_at: nowIso,
          },
          { onConflict: "tenant_id,date_rate,currency" }
        );

        await AuditRepository.recordAuditLog({
          tenantId,
          actorId: actor?.id,
          actorName: actor?.name,
          actorEmail: actor?.email,
          actorRole: actor?.role,
          action: "MANUAL_RATE_SAVED",
          entity: "exchange_rates",
          entityId: tenantId,
          newData: {
            usd: data.usd_rate,
            eur: data.eur_rate,
            usdt: data.usdt_rate,
            date: data.date_rate,
          },
        });
      } catch (e) {
        console.warn("[MarketOS] Error saving manual rate to Supabase:", e);
      }
    }

    const updatedRate: ExchangeRate = {
      id: `rate-${tenantId}`,
      tenant_id: tenantId,
      currency: "VES",
      value: data.usd_rate,
      eur_value: data.eur_rate,
      usdt_value: data.usdt_rate,
      source,
      updated_at: nowIso,
    };

    const existingIdx = state.rates.findIndex((r) => r.tenant_id === tenantId);
    if (existingIdx >= 0) {
      state.rates[existingIdx] = updatedRate;
    } else {
      state.rates.push(updatedRate);
    }

    // Add to history
    const existingHistIdx = state.rateHistory.findIndex(
      (h) => h.tenant_id === tenantId && h.date_rate === data.date_rate
    );
    const historyItem: RateHistoryItem = {
      id: `hist-${Date.now()}`,
      tenant_id: tenantId,
      date_rate: data.date_rate,
      currency: "USD",
      rate: data.usd_rate,
      rate_eur: data.eur_rate,
      usdt_promedio: data.usdt_rate,
      source,
      created_at: nowIso,
    };
    if (existingHistIdx >= 0) {
      state.rateHistory[existingHistIdx] = historyItem;
    } else {
      state.rateHistory.unshift(historyItem);
    }

    return updatedRate;
  }
}
