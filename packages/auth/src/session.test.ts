import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { signSessionPayload, verifySessionPayload } from "./session.ts";

describe("Cryptographic Session Auth (HMAC-SHA256)", () => {
  const samplePayload = {
    id: "usr-admin-01",
    email: "owner@shopmarket.com",
    fullName: "Luis Montes",
    role: "TENANT_OWNER",
    tenantId: "shop-market-ca",
    loggedInAt: "2026-10-20T10:00:00.000Z",
  };

  it("successfully signs and verifies a valid session payload", () => {
    const token = signSessionPayload(samplePayload);
    assert.equal(typeof token, "string");
    assert.ok(token.includes("."));

    const verified = verifySessionPayload<typeof samplePayload>(token);
    assert.ok(verified !== null);
    assert.equal(verified?.id, "usr-admin-01");
    assert.equal(verified?.role, "TENANT_OWNER");
    assert.equal(verified?.tenantId, "shop-market-ca");
  });

  it("blocks privilege escalation and rejects tampered token payloads", () => {
    const token = signSessionPayload(samplePayload);
    const [b64Payload, signature] = token.split(".");

    // Attacker modifies the payload to elevate role to PLATFORM_SUPER_ADMIN
    const forgedPayload = {
      ...samplePayload,
      role: "PLATFORM_SUPER_ADMIN",
    };
    const forgedB64 = Buffer.from(JSON.stringify(forgedPayload), "utf8").toString("base64url");
    const tamperedToken = `${forgedB64}.${signature}`;

    const result = verifySessionPayload(tamperedToken);
    assert.equal(result, null);
  });

  it("blocks tenant hopping and rejects tampered tenantId", () => {
    const token = signSessionPayload(samplePayload);
    const [b64Payload, signature] = token.split(".");

    // Attacker attempts to hop to competitor tenant
    const forgedPayload = {
      ...samplePayload,
      tenantId: "competitor-tenant-xyz",
    };
    const forgedB64 = Buffer.from(JSON.stringify(forgedPayload), "utf8").toString("base64url");
    const tamperedToken = `${forgedB64}.${signature}`;

    const result = verifySessionPayload(tamperedToken);
    assert.equal(result, null);
  });

  it("rejects malformed or empty tokens gracefully", () => {
    assert.equal(verifySessionPayload(""), null);
    assert.equal(verifySessionPayload("not-a-token"), null);
    assert.equal(verifySessionPayload("invalid.three.parts"), null);
    assert.equal(verifySessionPayload(null as any), null);
  });

  it("supports legacy JSON tokens during rolling migration", () => {
    const legacyJson = JSON.stringify(samplePayload);
    const result = verifySessionPayload<typeof samplePayload>(legacyJson);
    assert.ok(result !== null);
    assert.equal(result?.id, samplePayload.id);
  });
});
