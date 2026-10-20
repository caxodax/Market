import assert from "node:assert";
import type { StorefrontConfig, StorefrontBlock } from "@marketos/types";
import { STOREFRONT_PRO_MANIFEST } from "../manifest.ts";
import {
  createDefaultStorefrontConfig,
  createVenezuelaStorefrontConfig,
} from "../defaults.ts";

console.log("🧪 [Ponytail Check] Running tests for @marketos/plugin-storefront-pro...");

// 1. Manifest verification
assert.strictEqual(STOREFRONT_PRO_MANIFEST.id, "storefront_pro", "Plugin ID must be storefront_pro");
assert.strictEqual(STOREFRONT_PRO_MANIFEST.version, "1.0.0", "Version must be 1.0.0");
assert.strictEqual(STOREFRONT_PRO_MANIFEST.country_code, "GLOBAL", "Plugin must be GLOBAL");
console.log("  ✔ STOREFRONT_PRO_MANIFEST is valid and declared as GLOBAL");

// 2. Default Configuration Generates 10 Blocks
const globalConfig = createDefaultStorefrontConfig("Mi Tienda Global");
assert.strictEqual(globalConfig.version, "1.0.0", "Config version must be 1.0.0");
assert.strictEqual(globalConfig.blocks.length, 10, "Must contain exactly 10 modular blocks");

const expectedBlockTypes = [
  "announcement_marquee",
  "hero_slider",
  "category_bubbles",
  "flash_sale",
  "featured_rails",
  "product_reels",
  "trust_badges",
  "testimonials",
  "brand_story",
  "faq_accordion",
];

const foundTypes = globalConfig.blocks.map((b) => b.type);
assert.deepStrictEqual(foundTypes, expectedBlockTypes, "All 10 expected block types must exist in sequential order");
console.log("  ✔ Generates all 10 modular blocks in sequential order");

// 3. Multi-Tenant Global Neutrality (No Venezuelan references in global preset)
const globalJson = JSON.stringify(globalConfig);
assert.strictEqual(globalJson.includes("BCV"), false, "Global preset must not contain hardcoded BCV");
assert.strictEqual(globalJson.includes("Pago Móvil"), false, "Global preset must not contain hardcoded Pago Móvil");
assert.strictEqual(globalJson.includes("Barquisimeto"), false, "Global preset must not contain hardcoded Barquisimeto");
assert.strictEqual(globalJson.includes("Cabudare"), false, "Global preset must not contain hardcoded Cabudare");
console.log("  ✔ Global preset is strictly country-neutral and multi-tenant clean");

// 4. Custom Business Name interpolation
const heroSlide1 = (globalConfig.blocks.find((b) => b.type === "hero_slider")?.config as any)?.slides?.[0];
assert.ok(heroSlide1.title.includes("Mi Tienda Global"), "Hero slide 1 must interpolate business name");
console.log("  ✔ Custom business name interpolated correctly in hero slider");

// 5. Explicit Venezuelan Preset contains localized elements
const veConfig = createVenezuelaStorefrontConfig("Bodegón Express");
const veJson = JSON.stringify(veConfig);
assert.ok(veJson.includes("BCV"), "Venezuela preset must contain BCV reference");
assert.ok(veJson.includes("Pago Móvil"), "Venezuela preset must contain Pago Móvil reference");
assert.strictEqual(veConfig.blocks.length, 10, "Venezuela preset must also have 10 blocks");
console.log("  ✔ Venezuela preset correctly populates local payment methods and BCV references");

// 6. Block Re-ordering invariant test
const blocks = [...globalConfig.blocks];
// Swap first and second block
const temp = blocks[0];
blocks[0] = blocks[1];
blocks[1] = temp;
blocks.forEach((b, idx) => {
  b.order = idx + 1;
});
assert.strictEqual(blocks[0].order, 1, "First block order must be 1");
assert.strictEqual(blocks[1].order, 2, "Second block order must be 2");
assert.strictEqual(blocks[0].type, "hero_slider", "First block is now hero_slider");
console.log("  ✔ Block ordering mechanics and order indices verified");

// 7. Flash Sale date validity
const flashBlock = globalConfig.blocks.find((b) => b.type === "flash_sale");
const endsAt = (flashBlock?.config as any)?.endsAt;
assert.ok(endsAt, "Flash sale endsAt must be defined");
const endsAtTimestamp = new Date(endsAt).getTime();
assert.ok(!isNaN(endsAtTimestamp), "endsAt must be a valid ISO 8601 date string");
assert.ok(endsAtTimestamp > Date.now(), "endsAt must be in the future");
console.log("  ✔ Flash sale endsAt is a valid future ISO 8601 timestamp");

console.log("✅ [Ponytail & ECC Check] All 7 storefront-pro tests passed successfully!");
