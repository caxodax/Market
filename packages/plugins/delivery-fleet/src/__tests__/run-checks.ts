import assert from "node:assert";
import type { Order, Driver } from "@marketos/types";
import { DELIVERY_FLEET_MANIFEST } from "../manifest.ts";
import {
  buildGoogleMapsUrl,
  sanitizeWhatsAppPhone,
  formatDriverWhatsAppDispatchMessage,
  buildDriverWhatsAppDispatchUrl,
} from "../services/dispatch-formatter.ts";

console.log("🧪 [Ponytail Check] Running tests for @marketos/plugin-delivery-fleet...");

// 1. Manifest verification
assert.strictEqual(DELIVERY_FLEET_MANIFEST.id, "delivery_fleet", "Plugin ID must be delivery_fleet");
assert.strictEqual(DELIVERY_FLEET_MANIFEST.version, "1.0.0", "Version must be 1.0.0");
assert.strictEqual(DELIVERY_FLEET_MANIFEST.country_code, "GLOBAL", "Delivery fleet must be GLOBAL");
assert.strictEqual(DELIVERY_FLEET_MANIFEST.category, "growth_operations");
console.log("  ✔ DELIVERY_FLEET_MANIFEST is valid and declared as GLOBAL growth operation");

// 2. Phone sanitizer verification
assert.strictEqual(sanitizeWhatsAppPhone("+58 412-1234567"), "584121234567");
assert.strictEqual(sanitizeWhatsAppPhone("04141234567"), "584141234567");
assert.strictEqual(sanitizeWhatsAppPhone("+1 (555) 019-2834"), "15550192834");
console.log("  ✔ Phone sanitizer standardizes international and local numbers for WhatsApp");

// 3. Google Maps URL generation
const mapsUrl = buildGoogleMapsUrl("Av. Lara con Calle 8, Barquisimeto");
assert.ok(mapsUrl.startsWith("https://www.google.com/maps/search/?api=1&query="));
assert.ok(mapsUrl.includes("Av.%20Lara%20con%20Calle%208"));
assert.strictEqual(buildGoogleMapsUrl("   "), "");
console.log("  ✔ Google Maps URLs encode correctly and handle empty addresses gracefully");

// 4. Dispatch Comanda formatting with Cash & Change
const mockDriver: Driver = {
  id: "drv-1",
  tenant_id: "tenant-demo",
  name: "Carlos Mendoza",
  phone: "04128505629",
  vehicle_type: "MOTO",
  plate_number: "AB12CD",
  is_active: true,
};

const mockCashOrder: Order = {
  id: "ord-1",
  tenant_id: "tenant-demo",
  store_id: "store-1",
  customer_id: "cust-1",
  order_number: "ORD-998877",
  status: "READY",
  delivery_type: "DELIVERY",
  delivery_address: "Urbanización Los Cardones, Casa 45",
  total_usd: 25.5,
  total_ves: 1020,
  exchange_rate_applied: 40,
  customer_name: "María Gómez",
  customer_phone: "+58 424 9998877",
  payment_method: "CASH_USD",
  cash_tendered_usd: 50,
  change_required_usd: 24.5,
  notes: "Tocar el timbre blanco y cuidado con el perro.",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  items: [
    {
      id: "it-1",
      order_id: "ord-1",
      tenant_id: "tenant-demo",
      product_id: "prod-1",
      product_name: "Hamburguesa Doble",
      quantity: 2,
      unit_price_usd: 10,
      total_price_usd: 20,
      selected_modifiers: [
        {
          group_id: "g1",
          group_name: "Salsas",
          option_id: "o1",
          option_name: "Salsa de Ajo",
          price_usd: 0,
        },
      ],
    },
    {
      id: "it-2",
      order_id: "ord-1",
      tenant_id: "tenant-demo",
      product_id: "prod-2",
      product_name: "Papas Fritas",
      quantity: 1,
      unit_price_usd: 5.5,
      total_price_usd: 5.5,
    },
  ],
};

const dispatchMsg = formatDriverWhatsAppDispatchMessage({
  order: mockCashOrder,
  driver: mockDriver,
  storeName: "Burgers Gourmet",
});

assert.ok(dispatchMsg.includes("Carlos Mendoza"), "Must include driver name");
assert.ok(dispatchMsg.includes("MOTO - AB12CD"), "Must include vehicle type and plate");
assert.ok(dispatchMsg.includes("#ORD-998877"), "Must include order number");
assert.ok(dispatchMsg.includes("María Gómez"), "Must include customer name");
assert.ok(dispatchMsg.includes("Hamburguesa Doble"), "Must include product name");
assert.ok(dispatchMsg.includes("Salsas: Salsa de Ajo"), "Must include selected modifier");
assert.ok(dispatchMsg.includes("El cliente paga con:* $50.00"), "Must state cash tendered");
assert.ok(dispatchMsg.includes("Llevar cambio / vuelto:* $24.50"), "Must calculate exact change");
assert.ok(dispatchMsg.includes("cuidado con el perro"), "Must include customer notes");
console.log("  ✔ WhatsApp dispatch comanda includes full delivery, modifier, cash and change context");

// 5. WhatsApp dispatch URL creation
const waUrl = buildDriverWhatsAppDispatchUrl({
  order: mockCashOrder,
  driver: mockDriver,
  storeName: "Burgers Gourmet",
});
assert.ok(waUrl.startsWith("https://wa.me/584128505629?text="), "Must target sanitized driver phone");
assert.ok(waUrl.includes(encodeURIComponent("#ORD-998877")), "Must URL encode message content");
console.log("  ✔ Dispatch WhatsApp wa.me link is valid and properly URL-encoded");

// 6. Pre-paid / Digital order handling
const mockPaidOrder: Order = {
  ...mockCashOrder,
  payment_method: "PAGO_MOVIL",
  payment_status: "APPROVED",
  cash_tendered_usd: undefined,
  change_required_usd: undefined,
};

const paidDispatchMsg = formatDriverWhatsAppDispatchMessage({
  order: mockPaidOrder,
  driver: mockDriver,
});
assert.ok(paidDispatchMsg.includes("PAGADO / NO COBRAR"), "Paid orders must instruct driver not to collect cash");
assert.strictEqual(paidDispatchMsg.includes("El cliente paga con:"), false, "Must not mention cash tendered on paid order");
console.log("  ✔ Pre-paid orders explicitly safeguard against accidental double-charging");

// 7. Geolocation Engine, Distance & Sector tests
import {
  calculateDistanceKm,
  calculateStoreProximities,
  matchNearestMetropolitanSector,
  BARQUISIMETO_METROPOLITAN_SECTORS,
} from "../services/delivery-geo-engine.ts";

// Distance between Nueva Segovia (10.054, -69.298) and Zona Norte (10.140, -69.312)
const distNorth = calculateDistanceKm(10.054, -69.298, 10.140, -69.312);
assert.ok(distNorth >= 9.5 && distNorth <= 10.0, `Zona Norte distance must be ~9.7 km, got ${distNorth}`);
console.log(`  ✔ Zona Norte distance accurately calculates to ~${distNorth} km`);

// Distance to Valencia IP Gateway (10.18, -67.99)
const distValencia = calculateDistanceKm(10.054, -69.298, 10.18, -67.99);
assert.ok(distValencia > 140, "Valencia distance must exceed 140 km");
console.log(`  ✔ Out-of-bounds Valencia IP accurately calculates to ~${distValencia} km`);

// Proximity calculations and sanity check (35km boundary)
const testStores = [
  { id: "store-ns", code: "NS-01", name: "Sucursal Nueva Segovia" },
];

const proxNorth = calculateStoreProximities(testStores, 10.140, -69.312);
assert.strictEqual(proxNorth.nearestStore?.id, "store-ns");
assert.strictEqual(proxNorth.isWithinMetroPerimeter, true);
assert.strictEqual(proxNorth.proximityBadge, "📍 a 9.7 km");
console.log("  ✔ calculateStoreProximities correctly marks Zona Norte as within metro perimeter");

const proxValencia = calculateStoreProximities(testStores, 10.18, -67.99);
assert.strictEqual(proxValencia.isWithinMetroPerimeter, false);
assert.strictEqual(proxValencia.proximityBadge, "📍 Despacho en Barquisimeto");
console.log("  ✔ calculateStoreProximities correctly sanitizes out-of-bounds locations (>35km)");

// Sector matching
const matchedSector = matchNearestMetropolitanSector(10.140, -69.312);
assert.strictEqual(matchedSector?.id, "norte");
assert.strictEqual(matchedSector?.name, "Zona Norte");
console.log("  ✔ matchNearestMetropolitanSector correctly identifies Zona Norte from coordinates");

console.log("🎉 All @marketos/plugin-delivery-fleet tests passed successfully!\n");
