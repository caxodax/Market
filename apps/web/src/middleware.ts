import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
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
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
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
