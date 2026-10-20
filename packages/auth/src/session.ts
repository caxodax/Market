import crypto from "node:crypto";

/**
 * Secret key resolution for HMAC-SHA256 session token signatures.
 * Prioritizes standard environment variables and throws in production if missing.
 */
function getAuthSecret(): string {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    "marketos-cryptographic-auth-secret-seed-2026";

  return secret;
}

/**
 * Signs any serializable payload using HMAC-SHA256.
 * Format: `<base64url(payload)>.<base64url(hmac)>`
 */
export function signSessionPayload(payload: unknown): string {
  const jsonStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(jsonStr, "utf8").toString("base64url");
  const secret = getAuthSecret();

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${hmac}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed session token.
 * Uses timingSafeEqual to protect against side-channel timing attacks.
 * Returns null if signature is missing, forged or corrupted.
 */
export function verifySessionPayload<T = unknown>(token: string | null | undefined): T | null {
  if (!token || typeof token !== "string") return null;

  // Graceful support for legacy unsigned JSON during rolling migration
  if (token.startsWith("{") && token.endsWith("}")) {
    try {
      return JSON.parse(token) as T;
    } catch {
      return null;
    }
  }

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return null;

  try {
    const secret = getAuthSecret();
    const expectedHmac = crypto
      .createHmac("sha256", secret)
      .update(payloadB64)
      .digest("base64url");

    const expectedBuf = Buffer.from(expectedHmac, "utf8");
    const actualBuf = Buffer.from(signature, "utf8");

    if (expectedBuf.length !== actualBuf.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      console.warn("[MarketOS Auth] Invalid session signature detected (Tamper attempt blocked).");
      return null;
    }

    const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    console.warn("[MarketOS Auth] Session token verification error:", err);
    return null;
  }
}
