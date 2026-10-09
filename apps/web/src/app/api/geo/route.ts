import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Resilient GeoIP Lookup Endpoint
 * Fallback for devices without hardware GPS (e.g. desktop PCs, laptops on ethernet, or denied permissions)
 */
export async function GET(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const cfIp = request.headers.get("cf-connecting-ip");

    const clientIp =
      cfIp || (forwarded ? forwarded.split(",")[0].trim() : null) || realIp;

    // Check if the IP is localhost / private LAN
    const isPrivate =
      !clientIp ||
      clientIp === "127.0.0.1" ||
      clientIp === "::1" ||
      clientIp.startsWith("192.168.") ||
      clientIp.startsWith("10.") ||
      clientIp.startsWith("172.16.") ||
      clientIp.startsWith("172.17.") ||
      clientIp.startsWith("172.18.") ||
      clientIp.startsWith("172.19.") ||
      clientIp.startsWith("172.20.") ||
      clientIp.startsWith("172.21.") ||
      clientIp.startsWith("172.22.") ||
      clientIp.startsWith("172.23.") ||
      clientIp.startsWith("172.24.") ||
      clientIp.startsWith("172.25.") ||
      clientIp.startsWith("172.26.") ||
      clientIp.startsWith("172.27.") ||
      clientIp.startsWith("172.28.") ||
      clientIp.startsWith("172.29.") ||
      clientIp.startsWith("172.30.") ||
      clientIp.startsWith("172.31.");

    const targetUrl = isPrivate
      ? "https://ipwho.is/"
      : `https://ipwho.is/${clientIp}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch geo ip" },
        { status: 502 }
      );
    }

    const data = await res.json();
    if (data.latitude && data.longitude) {
      return NextResponse.json({
        success: true,
        lat: data.latitude,
        lng: data.longitude,
        city: data.city || null,
        region: data.region || null,
        country: data.country || null,
        isp: data.connection?.isp || null,
      });
    }

    return NextResponse.json(
      { success: false, error: "Coordinates not available" },
      { status: 404 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Geo lookup timed out or failed" },
      { status: 500 }
    );
  }
}
