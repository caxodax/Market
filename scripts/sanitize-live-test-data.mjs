import { createServerComponentClient } from "../packages/database/src/server.ts";

async function main() {
  console.log("🧹 [Saneamiento] Iniciando purga de datos de prueba en Supabase...\n");
  const supabase = createServerComponentClient();

  // 1. IDs de los 7 productos "Tazas Personalizadas"
  const testProductIds = [
    "a1dc6ca3-84cc-4246-b323-69d190049187",
    "9683baed-5f02-4b33-a9a3-0be29f382ab6",
    "81d5f4df-82d0-43c3-93ed-be17e201629c",
    "6b3d6296-91e8-4fae-a1af-dfe5e48d3844",
    "b98981c4-b091-4e7b-a4fd-56ee0d06a4fb",
    "be7becb7-0714-4e8f-b5cb-1292205cbe92",
    "6075f734-c5fb-4534-be31-b14e5186e3bb",
  ];

  console.log("1️⃣  Eliminando inventario y movimientos de los productos de prueba en Printopink...");
  const { error: movErr } = await supabase
    .from("inventory_movements")
    .delete()
    .in("product_id", testProductIds);
  if (movErr) console.warn("  ⚠️ Error en inventory_movements:", movErr.message);
  else console.log("  ✔ Movimientos de inventario eliminados");

  const { error: invErr } = await supabase
    .from("inventory")
    .delete()
    .in("product_id", testProductIds);
  if (invErr) console.warn("  ⚠️ Error en inventory:", invErr.message);
  else console.log("  ✔ Registros de inventario eliminados");

  const { error: prodErr } = await supabase
    .from("products")
    .delete()
    .in("id", testProductIds);
  if (prodErr) console.warn("  ⚠️ Error en products:", prodErr.message);
  else console.log(`  ✔ ${testProductIds.length} productos 'Tazas Personalizadas' eliminados de Printopink`);

  // 2. Categoría huérfana de prueba en Printopink
  const testCatId = "d355e0d5-0b78-4cf8-ae05-0d1c0b0d23b0";
  console.log("\n2️⃣  Eliminando categoría huérfana 'Tarjetas de Presentación' en Printopink...");
  const { error: catErr } = await supabase
    .from("categories")
    .delete()
    .eq("id", testCatId);
  if (catErr) console.warn("  ⚠️ Error en categories:", catErr.message);
  else console.log("  ✔ Categoría huérfana eliminada");

  // 3. Órdenes y pagos de prueba en Shop Market
  const testOrderIds = [
    "2aa7df51-a97f-427a-9023-4a66ebc1b638",
    "7ae74801-0835-4f4c-bea5-b92e750ed94d",
    "803ec26a-1774-45ff-bb06-3ae3ccdaf0b8",
  ];

  console.log("\n3️⃣  Eliminando órdenes y pagos de prueba en Shop Market...");
  const { error: payErr } = await supabase
    .from("payments")
    .delete()
    .in("order_id", testOrderIds);
  if (payErr) console.warn("  ⚠️ Error en payments:", payErr.message);
  else console.log("  ✔ Comprobantes de pago eliminados");

  const { error: itemsErr } = await supabase
    .from("order_items")
    .delete()
    .in("order_id", testOrderIds);
  if (itemsErr) console.warn("  ⚠️ Error en order_items:", itemsErr.message);
  else console.log("  ✔ Ítems de órdenes eliminados");

  const { error: ordErr } = await supabase
    .from("orders")
    .delete()
    .in("id", testOrderIds);
  if (ordErr) console.warn("  ⚠️ Error en orders:", ordErr.message);
  else console.log(`  ✔ ${testOrderIds.length} órdenes de prueba eliminadas`);

  // 4. Restaurar precio de Harina PAN a $1.25 en Shop Market
  console.log("\n4️⃣  Restaurando precio original de Harina PAN en Shop Market a $1.25...");
  const { error: priceErr } = await supabase
    .from("products")
    .update({ price_usd: 1.25, updated_at: new Date().toISOString() })
    .eq("id", "d1111111-1111-1111-1111-111111111111");
  if (priceErr) console.warn("  ⚠️ Error restaurando precio:", priceErr.message);
  else console.log("  ✔ Precio de Harina PAN restaurado a $1.25");

  console.log("\n✨ [Completado] Base de datos saneada con éxito.");
}

main().catch((err) => {
  console.error("❌ Error en script de saneamiento:", err);
  process.exit(1);
});
