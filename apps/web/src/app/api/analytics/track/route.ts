import { NextResponse } from "next/server";
import { createSupabaseClient } from "@marketos/database";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      tenantId,
      path,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      sessionId,
      deviceType,
    } = body || {};

    if (!tenantId || typeof tenantId !== "string" || !path || typeof path !== "string") {
      return NextResponse.json(
        { error: "tenantId and path are required" },
        { status: 400 }
      );
    }

    // Input sanitization & boundary defense (AgentShield / ECC)
    const sanitizedTenantId = tenantId.trim().slice(0, 100);
    const sanitizedPath = path.trim().slice(0, 500);
    const sanitizedReferrer = referrer ? String(referrer).trim().slice(0, 500) : null;
    const sanitizedUtmSource = utmSource ? String(utmSource).trim().slice(0, 100) : null;
    const sanitizedUtmMedium = utmMedium ? String(utmMedium).trim().slice(0, 100) : null;
    const sanitizedUtmCampaign = utmCampaign ? String(utmCampaign).trim().slice(0, 100) : null;
    const sanitizedSessionId = sessionId ? String(sessionId).trim().slice(0, 100) : null;
    const validDeviceTypes = ["mobile", "desktop", "tablet", "other"];
    const sanitizedDevice = validDeviceTypes.includes(deviceType) ? deviceType : "desktop";

    const supabase = createSupabaseClient();

    const { error } = await supabase.from("tenant_page_views").insert({
      tenant_id: sanitizedTenantId,
      path: sanitizedPath,
      referrer: sanitizedReferrer,
      utm_source: sanitizedUtmSource,
      utm_medium: sanitizedUtmMedium,
      utm_campaign: sanitizedUtmCampaign,
      session_id: sanitizedSessionId,
      device_type: sanitizedDevice,
    });

    if (error) {
      console.warn("[Analytics API] Supabase insert warning:", error.message);
      // Still return 200/success:false so frontend beacon does not throw
      return NextResponse.json({ success: false, warning: error.message }, { status: 200 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.warn("[Analytics API] Unexpected error:", err?.message);
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 200 });
  }
}
