import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shop Market C.A. | Catálogo Digital",
    short_name: "Shop Market",
    description: "Catálogo digital y pedidos directos en Barquisimeto",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#DC2626",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
