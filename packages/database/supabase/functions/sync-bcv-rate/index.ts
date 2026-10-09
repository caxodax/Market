import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const ALCAMBIO_GRAPHQL_URL = "https://api.alcambio.app/graphql";

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch official BCV rate from AlCambio GraphQL API (Same engine as KsaSport)
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
    });

    let usdRate = 875.65;
    let source = "AlCambio (BCV Oficial)";

    if (res.ok) {
      const json = await res.json();
      const rates = json.data?.getCountryConversions?.conversionRates || [];
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

      if (officialUsd && Number(officialUsd.baseValue) > 0) {
        usdRate = Number(Number(officialUsd.baseValue).toFixed(4));
      }
    }

    // 2. Update exchange_rates in Supabase directly
    const { data: tenants } = await supabase.from("tenants").select("id");
    const tenantIds = tenants && tenants.length > 0
      ? tenants.map((t: any) => t.id)
      : ["shop-market-ca"];

    for (const tenantId of tenantIds) {
      const { data: existing } = await supabase
        .from("exchange_rates")
        .select("id")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("exchange_rates")
          .update({
            value: usdRate,
            source,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("exchange_rates").insert({
          tenant_id: tenantId,
          currency: "VES",
          value: usdRate,
          source,
          updated_at: new Date().toISOString(),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        usdRate,
        source,
        tenantsUpdated: tenantIds.length,
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
