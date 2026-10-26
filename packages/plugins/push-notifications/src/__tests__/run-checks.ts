import assert from "node:assert";
import type { PushSubscriptionRecord } from "@marketos/types";
import { PUSH_NOTIFICATIONS_MANIFEST } from "../manifest.ts";
import {
  buildOrderStatusPushPayload,
  filterPushSubscriptions,
  PUSH_MARKETING_PRESETS,
} from "../services/push-templates.ts";

console.log("🧪 [Ponytail Check] Running tests for @marketos/plugin-push-notifications...");

// 1. Manifest verification
assert.strictEqual(PUSH_NOTIFICATIONS_MANIFEST.id, "push_notifications");
assert.strictEqual(PUSH_NOTIFICATIONS_MANIFEST.version, "1.0.0");
assert.strictEqual(PUSH_NOTIFICATIONS_MANIFEST.country_code, "GLOBAL");
assert.strictEqual(PUSH_NOTIFICATIONS_MANIFEST.category, "growth_operations");
console.log("  ✔ PUSH_NOTIFICATIONS_MANIFEST is valid and declared as GLOBAL growth operation");

// 2. Order status payload generation
const approvedPayload = buildOrderStatusPushPayload({
  orderNumber: "ORD-101",
  status: "PAYMENT_APPROVED",
  storeName: "Bodegón Caracas",
});
assert.ok(approvedPayload.title.includes("¡Pago Aprobado!"));
assert.ok(approvedPayload.title.includes("ORD-101"));
assert.ok(approvedPayload.body.includes("Bodegón Caracas"));
assert.strictEqual(approvedPayload.url, "/?order=ORD-101");
assert.strictEqual(approvedPayload.tag, "order-ORD-101");

const deliveringPayload = buildOrderStatusPushPayload({
  orderNumber: "ORD-202",
  status: "DELIVERING",
  driverName: "Carlos Gómez",
});
assert.ok(deliveringPayload.title.includes("¡Tu pedido va en camino!"));
assert.ok(deliveringPayload.body.includes("Carlos Gómez"));

const rejectedPayload = buildOrderStatusPushPayload({
  orderNumber: "ORD-303",
  status: "REJECTED",
  rejectionReason: "Referencia bancaria duplicada",
});
assert.ok(rejectedPayload.title.includes("Aviso sobre tu pago"));
assert.ok(rejectedPayload.body.includes("Referencia bancaria duplicada"));
console.log("  ✔ Order status payloads generated accurately across lifecycle events");

// 3. Subscriber segmentation filtering
const mockSubscriptions: PushSubscriptionRecord[] = [
  {
    id: "sub-1",
    tenant_id: "tenant-a",
    endpoint: "https://fcm.googleapis.com/fcm/send/sub1",
    p256dh: "key1",
    auth: "auth1",
    customer_id: "cust-1",
    created_at: new Date().toISOString(),
  },
  {
    id: "sub-2",
    tenant_id: "tenant-a",
    endpoint: "https://fcm.googleapis.com/fcm/send/sub2",
    p256dh: "key2",
    auth: "auth2",
    customer_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "sub-3",
    tenant_id: "tenant-a",
    endpoint: "https://fcm.googleapis.com/fcm/send/sub3",
    p256dh: "key3",
    auth: "auth3",
    customer_id: "cust-3",
    created_at: new Date().toISOString(),
  },
];

const allSubs = filterPushSubscriptions(mockSubscriptions, "all");
assert.strictEqual(allSubs.length, 3);

const withOrdersSubs = filterPushSubscriptions(mockSubscriptions, "with_orders");
assert.strictEqual(withOrdersSubs.length, 2);
assert.ok(withOrdersSubs.every((s) => Boolean(s.customer_id)));

const withoutOrdersSubs = filterPushSubscriptions(mockSubscriptions, "without_orders");
assert.strictEqual(withoutOrdersSubs.length, 1);
assert.strictEqual(withoutOrdersSubs[0].id, "sub-2");
console.log("  ✔ Push subscription segmentation (all, with_orders, without_orders) validated");

// 4. Marketing presets
assert.ok(PUSH_MARKETING_PRESETS.length >= 3);
assert.ok(PUSH_MARKETING_PRESETS.some((p) => p.id === "FLASH_SALE"));
console.log("  ✔ Marketing push presets configured and accessible");

console.log("🎉 All @marketos/plugin-push-notifications tests passed successfully!\n");
