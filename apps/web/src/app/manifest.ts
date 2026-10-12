import type { MetadataRoute } from "next";
import { MarketOSRepository } from "@marketos/database";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const defaultTenantId = process.env.DEFAULT_TENANT_ID || "shop-market-ca";
  const settings = await MarketOSRepository.getTenantSettings(defaultTenantId);

  const iconUrl = settings.logo_url || "/brand/logo.png";
  const iconType = iconUrl.endsWith(".svg")
    ? "image/svg+xml"
    : iconUrl.endsWith(".webp") || iconUrl.startsWith("data:image/webp")
    ? "image/webp"
    : "image/png";

  return {
    name: `${settings.business_name} | Catálogo Digital`,
    short_name: settings.business_name,
    description:
      settings.operational_settings?.announcement_banner ||
      `Catálogo digital y pedidos directos en ${settings.business_name}`,
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: settings.primary_color || "#DC2626",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: iconUrl,
        sizes: "512x512",
        type: iconType,
        purpose: "any",
      },
      {
        src: iconUrl,
        sizes: "512x512",
        type: iconType,
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
