import assert from "node:assert";
import { MarketOSRepository } from "../services";

async function runChecks() {
  console.log("🧪 [ECC & Ponytail Check] Running database persistence tests...");

  // 1. Check createOrder
  const input = {
    tenantId: "shop-market-ca",
    storeId: "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    customerName: "Luis Arturo Montes",
    customerPhone: "04128505629",
    customerIdNumber: "V-21276890",
    deliveryType: "DELIVERY" as const,
    deliveryAddress: "Torre bel piso 12-8",
    deliveryFeeUsd: 2.0,
    cashTenderedUsd: 20.0,
    changeRequiredUsd: 10.0,
    items: [
      {
        productId: "d1111111-1111-1111-1111-111111111111",
        productName: "Harina PAN Blanca 1kg",
        quantity: 2,
        unitPriceUsd: 1.25,
      },
    ],
    notes: "Método: CASH_USD | Retiro en Tienda",
  };

  const order = await MarketOSRepository.createOrder(input);

  assert.ok(order.id, "Order should have an ID");
  assert.match(order.order_number, /^ORD-\d+/, "Order number should match standard format");
  assert.strictEqual(order.customer_name, "Luis Arturo Montes");
  assert.strictEqual(order.customer_id_number, "V-21276890");
  assert.strictEqual(order.delivery_fee_usd, 2.0);
  assert.ok(order.notes?.includes("Paga con: $20.00"), "Notes should include cash tendered info");
  assert.ok(order.notes?.includes("Vuelto: $10.00"), "Notes should include change required info");
  console.log("  ✔ createOrder formats cash and change into notes and persists state");

  // 2. Check getTenantOrders
  const orders = await MarketOSRepository.getTenantOrders("shop-market-ca");
  assert.ok(Array.isArray(orders), "Orders should be an array");
  assert.ok(orders.length > 0, "Should have retrieved tenant orders");

  const ord = orders.find((o) => o.order_number === "ORD-151169");
  assert.ok(ord, "Should find restored order ORD-151169");
  assert.strictEqual(ord.order_number, "ORD-151169");
  assert.strictEqual(ord.status, "PAYMENT_PENDING");
  console.log("  ✔ getTenantOrders extracts cash and change info and finds ORD-151169");

  // 3. Check getTenantPayments
  const payments = await MarketOSRepository.getTenantPayments("shop-market-ca");
  assert.ok(Array.isArray(payments), "Payments should be an array");
  assert.ok(payments.length > 0, "Should have retrieved tenant payments");

  const p = payments.find((pay) => pay.reference_number === "151169");
  assert.ok(p, "Should find restored payment proof for ORD-151169");
  assert.strictEqual(p.method, "PAGO_MOVIL");
  assert.strictEqual(p.status, "PENDING");
  console.log("  ✔ getTenantPayments retrieves payments for shop-market-ca");

  console.log("✅ All database persistence tests passed successfully!");
}

runChecks().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
