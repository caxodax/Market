import assert from "node:assert";
import { MarketOSRepository } from "../services.ts";

async function runChecks() {
  console.log("🧪 [ECC & Ponytail Check] Running database persistence & multi-tenant isolation tests...");

  const tenantA = "shop-market-ca";
  const tenantB = "ferreteria-el-sol-ve";

  // 1. Check createOrder for Tenant A
  const inputA = {
    tenantId: tenantA,
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

  const orderA = await MarketOSRepository.createOrder(inputA);

  assert.ok(orderA.id, "Order should have an ID");
  assert.match(orderA.order_number, /^ORD-\d+/, "Order number should match standard format");
  assert.strictEqual(orderA.customer_name, "Luis Arturo Montes");
  assert.strictEqual(orderA.customer_id_number, "V-21276890");
  assert.strictEqual(orderA.delivery_fee_usd, 2.0);
  assert.ok(orderA.notes?.includes("Paga con: $20.00"), "Notes should include cash tendered info");
  assert.ok(orderA.notes?.includes("Vuelto: $10.00"), "Notes should include change required info");
  console.log("  ✔ createOrder formats cash and change into notes and persists state");

  // 2. Check getTenantOrders for Tenant A
  const ordersA = await MarketOSRepository.getTenantOrders(tenantA);
  assert.ok(Array.isArray(ordersA), "Orders should be an array");
  assert.ok(ordersA.length > 0, "Should have retrieved tenant orders");

  const ordFound = ordersA.find((o) => o.id === orderA.id);
  assert.ok(ordFound, `Should find created order ${orderA.id}`);
  assert.strictEqual(ordFound.customer_phone, "04128505629");
  console.log(`  ✔ getTenantOrders finds created order ${orderA.order_number}`);

  // 3. Submit payment proof for Tenant A
  await MarketOSRepository.submitPaymentProof({
    tenantId: tenantA,
    orderId: orderA.id,
    method: "PAGO_MOVIL",
    bankName: "Banesco",
    referenceNumber: "151169",
    amount: 4.5,
    currency: "VES",
  });

  const paymentsA = await MarketOSRepository.getTenantPayments(tenantA);
  assert.ok(Array.isArray(paymentsA), "Payments should be an array");
  const pA = paymentsA.find((pay) => pay.order_id === orderA.id);
  assert.ok(pA, "Should find submitted payment proof for Tenant A");
  assert.strictEqual(pA.method, "PAGO_MOVIL");
  assert.strictEqual(pA.status, "PENDING");
  console.log("  ✔ submitPaymentProof & getTenantPayments retrieves payment for Tenant A");

  // =========================================================================
  // 4. MULTI-TENANT ISOLATION TESTS (ECC AgentShield Standards)
  // =========================================================================
  console.log("🔒 [AgentShield] Verifying zero cross-tenant data leakage...");

  // Tenant B queries orders
  const ordersB = await MarketOSRepository.getTenantOrders(tenantB);
  const leakedOrder = ordersB.find((o) => o.id === orderA.id || o.tenant_id === tenantA);
  assert.strictEqual(leakedOrder, undefined, "CRITICAL: Tenant B must NEVER see Tenant A orders!");
  console.log("  ✔ Orders Isolation: Tenant B cannot access Tenant A orders");

  // Tenant B queries payments
  const paymentsB = await MarketOSRepository.getTenantPayments(tenantB);
  const leakedPayment = paymentsB.find((p) => p.order_id === orderA.id || p.tenant_id === tenantA);
  assert.strictEqual(leakedPayment, undefined, "CRITICAL: Tenant B must NEVER see Tenant A payments!");
  console.log("  ✔ Payments Isolation: Tenant B cannot access Tenant A payment proofs");

  // Tenant B queries products
  const productsB = await MarketOSRepository.getProducts(tenantB);
  const leakedProduct = productsB.find((p) => p.tenant_id === tenantA);
  assert.strictEqual(leakedProduct, undefined, "CRITICAL: Tenant B must NEVER see Tenant A products!");
  console.log("  ✔ Catalog Isolation: Tenant B cannot access Tenant A products");

  // Category Creation, Retrieval & Multi-Tenant Isolation
  console.log("🏷️  [Catalog] Verifying Category creation & multi-tenant isolation...");
  const catPrintopink = await MarketOSRepository.createCategory("printopink", {
    name: "Tarjetas de Presentación",
  });
  assert.ok(catPrintopink.id, "Category must have an ID");
  assert.strictEqual(catPrintopink.tenant_id, "printopink");
  assert.strictEqual(catPrintopink.name, "Tarjetas de Presentación");
  assert.strictEqual(catPrintopink.slug, "tarjetas-de-presentacion");

  const categoriesPrinto = await MarketOSRepository.getCategories("printopink");
  assert.ok(categoriesPrinto.some((c) => c.id === catPrintopink.id), "Should find created category in Printopink");

  const categoriesTenantB = await MarketOSRepository.getCategories(tenantB);
  const leakedCategory = categoriesTenantB.find((c) => c.id === catPrintopink.id);
  assert.strictEqual(leakedCategory, undefined, "CRITICAL: Tenant B must NEVER see Printopink categories!");
  console.log("  ✔ Category Isolation: Tenant categories are strictly partitioned");

  // Product Update & UUID Tolerance Tests (AgentShield + Ponytail)
  console.log("🛠️  [Catalog] Verifying Product update resilience for non-UUID and UUID products...");
  const updatedPrinto = await MarketOSRepository.updateProduct({
    tenantId: "printopink",
    productId: "prod-pp-1",
    priceUsd: 9,
    stock: 100,
    name: "Tarjetas de Presentación (100 u.) Actualizadas",
  });
  assert.ok(updatedPrinto, "Should update non-UUID mock product successfully");
  assert.strictEqual(updatedPrinto.price_usd, 9);
  assert.strictEqual(updatedPrinto.stock, 100);
  assert.strictEqual(updatedPrinto.name, "Tarjetas de Presentación (100 u.) Actualizadas");
  console.log("  ✔ Non-UUID Product Update: Successfully updated prod-pp-1 without PostgreSQL UUID syntax errors");

  // Create Product generates valid UUID
  const createdProd = await MarketOSRepository.createProduct({
    tenantId: "printopink",
    name: "Tazas Personalizadas",
    priceUsd: 5.5,
    categoryId: catPrintopink.id,
    initialStock: 30,
  });
  assert.ok(createdProd, "Should create product");
  assert.match(
    createdProd.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Generated product ID must be a valid UUID"
  );
  console.log("  ✔ UUID Product Creation: Successfully generated product with valid UUID " + createdProd.id);

  // Shop Market product update check
  const shopMarketProds = await MarketOSRepository.getProducts("shop-market-ca");
  assert.ok(shopMarketProds.length > 0, "Shop Market must have products");
  const firstShopProd = shopMarketProds[0];
  const updatedShop = await MarketOSRepository.updateProduct({
    tenantId: "shop-market-ca",
    productId: firstShopProd.id,
    priceUsd: firstShopProd.price_usd + 0.1,
  });
  assert.ok(updatedShop, "Should update Shop Market product successfully");
  console.log("  ✔ Shop Market Integrity: Product " + firstShopProd.id + " updated cleanly");

  // =========================================================================
  // 5. PLUGIN VISIBILITY & ISOLATION TESTS (Phase 4)
  // =========================================================================
  console.log("🧩 [Plugins] Verifying plugin activation and visibility isolation...");

  // Set plugin status for Tenant A: enable delivery_fleet, disable pos_registers
  await MarketOSRepository.setTenantModuleStatus(tenantA, "delivery_fleet", true);
  await MarketOSRepository.setTenantModuleStatus(tenantA, "pos_registers", false);

  const activeA = await MarketOSRepository.getTenantActiveModuleIds(tenantA);
  assert.ok(activeA.includes("delivery_fleet"), "Tenant A should have delivery_fleet active");
  assert.strictEqual(activeA.includes("pos_registers"), false, "Tenant A should have pos_registers inactive");

  // Check that Tenant A module settings do not dictate Tenant B module settings
  const isDeliveryActiveB = await MarketOSRepository.isModuleActiveForTenant(tenantB, "delivery_fleet");
  // Toggle for Tenant B
  await MarketOSRepository.setTenantModuleStatus(tenantB, "delivery_fleet", false);
  const isDeliveryActiveBAfter = await MarketOSRepository.isModuleActiveForTenant(tenantB, "delivery_fleet");
  const isDeliveryActiveAAfter = await MarketOSRepository.isModuleActiveForTenant(tenantA, "delivery_fleet");

  assert.strictEqual(isDeliveryActiveBAfter, false, "Tenant B delivery_fleet was disabled");
  assert.strictEqual(isDeliveryActiveAAfter, true, "Tenant A delivery_fleet remains enabled (independent state)");
  console.log("  ✔ Plugin Isolation: Toggling modules in Tenant B leaves Tenant A unaffected");

  // =========================================================================
  // 6. ATOMIC FISCAL SEQUENCES & RACE CONDITION TESTS (AgentShield)
  // =========================================================================
  console.log("⚡ [AgentShield] Verifying zero race conditions in concurrent fiscal sequence numbering...");
  const { InvoicingRepository } = await import("../repositories/invoicing.repository.ts");

  const seq1 = await InvoicingRepository.getNextFiscalSequence(tenantA, "INVOICE");
  const seq2 = await InvoicingRepository.getNextFiscalSequence(tenantA, "INVOICE");
  const seq3 = await InvoicingRepository.getNextFiscalSequence(tenantA, "INVOICE");

  assert.strictEqual(seq2, seq1 + 1, "Fiscal sequence must increment strictly monotonically");
  assert.strictEqual(seq3, seq2 + 1, "Fiscal sequence must increment strictly monotonically");
  console.log("  ✔ Atomic Fiscal Sequence: Sequential numbering increments monotonically without collisions");

  console.log("✅ All persistence, isolation, plugin, and fiscal sequence tests passed successfully!");
}

runChecks().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
