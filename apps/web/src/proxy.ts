import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();

  // Known platform domains that should not trigger custom domain rewrite
  const platformDomain = (process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "").toLowerCase();
  const isPlatformDomain =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".vercel.app") ||
    (Boolean(platformDomain) && hostname === platformDomain);

  let customDomainRewrite = false;

  // If request arrives on a custom domain (e.g. tiendasanpedro.com or pedidos.fruteria.com)
  if (!isPlatformDomain && hostname) {
    // Check if it is a subdomain of the platform domain (e.g. mitienda.marketos.app)
    let tenantIdentifier = hostname;
    if (platformDomain && hostname.endsWith(`.${platformDomain}`)) {
      tenantIdentifier = hostname.replace(`.${platformDomain}`, "");
    }

    // Pass tenant to URL searchParams invisibly via internal rewrite
    // Only if not explicitly overridden by query string
    if (!url.searchParams.has("tenant")) {
      url.searchParams.set("tenant", tenantIdentifier);
      customDomainRewrite = true;
    }
  }

  // Multi-tenant header & cookie propagation for /admin
  const requestHeaders = new Headers(request.headers);
  const tenantFromQuery = url.searchParams.get("tenant");
  const tenantFromCookie = request.cookies.get("marketos_admin_tenant")?.value;
  const activeTenant = tenantFromQuery || (url.pathname.startsWith("/admin") ? tenantFromCookie : null);

  if (activeTenant) {
    requestHeaders.set("x-marketos-tenant", activeTenant);
  }

  const response = customDomainRewrite
    ? NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });

  if (tenantFromQuery && url.pathname.startsWith("/admin")) {
    response.cookies.set("marketos_admin_tenant", tenantFromQuery, {
      path: "/admin",
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - api routes
     * - static assets: favicon.ico, icon.svg, manifest.webmanifest
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)",
  ],
};
