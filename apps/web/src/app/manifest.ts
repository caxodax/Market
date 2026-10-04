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
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
