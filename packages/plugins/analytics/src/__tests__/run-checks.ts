import assert from "node:assert";
import {
  humanizePagePath,
  normalizeAcquisitionSource,
  buildAnalyticsSummary,
} from "../services/analytics-engine.ts";
import type { TenantPageView } from "@marketos/types";

console.log("🧪 Running @marketos/plugin-analytics unit checks...");

// 1. Path humanization
const home = humanizePagePath("/");
assert.strictEqual(home.category, "Portada");
assert.strictEqual(home.label, "Inicio (Vitrina Principal)");

const product = humanizePagePath("/product/torta-chocolate");
assert.strictEqual(product.category, "Producto");
assert.strictEqual(product.label, "Producto: Torta chocolate");

const checkout = humanizePagePath("/checkout");
assert.strictEqual(checkout.category, "Checkout");

// 2. Acquisition Source Normalization
const wa = normalizeAcquisitionSource("https://l.instagram.com/", "whatsapp");
assert.strictEqual(wa.type, "whatsapp");

const ig = normalizeAcquisitionSource("https://l.instagram.com/", null);
assert.strictEqual(ig.type, "instagram");

const google = normalizeAcquisitionSource("https://www.google.com/search?q=shop", null);
assert.strictEqual(google.type, "google");

const direct = normalizeAcquisitionSource(null, null);
assert.strictEqual(direct.type, "direct");

// 3. Analytics Aggregation
const mockViews: TenantPageView[] = [
  {
    id: "v1",
    tenant_id: "shop_market",
    path: "/",
    referrer: "https://l.instagram.com/",
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    session_id: "sess_1",
    created_at: new Date().toISOString(),
  },
  {
    id: "v2",
    tenant_id: "shop_market",
    path: "/checkout",
    referrer: "https://l.instagram.com/",
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    session_id: "sess_1", // Same visitor
    created_at: new Date().toISOString(),
  },
  {
    id: "v3",
    tenant_id: "shop_market",
    path: "/product/hamburguesa",
    referrer: "https://wa.me/catalog",
    utm_source: "whatsapp",
    utm_medium: null,
    utm_campaign: null,
    session_id: "sess_2", // Different visitor
    created_at: new Date().toISOString(),
  },
];

const summary = buildAnalyticsSummary(mockViews, 1, 30);

assert.strictEqual(summary.totalViews, 3, "Total views must be 3");
assert.strictEqual(summary.uniqueVisitors, 2, "Unique visitors must be 2");
assert.strictEqual(summary.completedOrdersCount, 1, "Completed orders must be 1");
assert.strictEqual(summary.conversionRatePercent, 50, "50% conversion rate (1 order / 2 visitors)");
assert.strictEqual(summary.sources.length, 2, "Must aggregate 2 sources");
assert.strictEqual(summary.trendData.length, 30, "Trend data must have 30 days");

// 4. Safe Empty State
const emptySummary = buildAnalyticsSummary([], 0, 7);
assert.strictEqual(emptySummary.totalViews, 0);
assert.strictEqual(emptySummary.uniqueVisitors, 0);
assert.strictEqual(emptySummary.conversionRatePercent, 0);
assert.strictEqual(emptySummary.trendData.length, 7);

console.log("✅ All @marketos/plugin-analytics unit checks passed successfully!");
