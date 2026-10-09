import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@marketos/ui",
    "@marketos/utils",
    "@marketos/database",
    "@marketos/auth",
    "@marketos/types",
  ],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
