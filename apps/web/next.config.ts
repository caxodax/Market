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
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xiklunkmdpqzlhmrfkql.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "sb_publishable_TFxsLCzYcvAAXM3yf65CuA_excYmDR7",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      "sb_publishable_TFxsLCzYcvAAXM3yf65CuA_excYmDR7",
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa2x1bmttZHBxemxobXJma3FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTEyNDQ3NywiZXhwIjoyMTA2NzAwNDc3fQ.JfPA42wthygKWPs7KaAR1BJDnMH4t1wydQ_zTSKZjRM",
    DEFAULT_TENANT_ID: process.env.DEFAULT_TENANT_ID || "shop-market-ca",
    CLOUDFLARE_ACCOUNT_ID:
      process.env.CLOUDFLARE_ACCOUNT_ID || "e96fb9441d9085bf6ebe215d152ec37d",
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "16fd1412b0cb0d4b071c4544ff0880e4",
    R2_SECRET_ACCESS_KEY:
      process.env.R2_SECRET_ACCESS_KEY ||
      "da39b83a69bcd9080f03c4000bbb2f3011dc2816952c479d05a9b9866258ee53",
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || "marketos-media",
    UPSTASH_REDIS_REST_URL:
      process.env.UPSTASH_REDIS_REST_URL || "https://neutral-imp-197913.upstash.io",
    UPSTASH_REDIS_REST_TOKEN:
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      "gQAAAAAAAwUZAAIgcDE3M2ZiMjczOGQyOGQ0NDJlOWNlMDZhMTBiYmFmZjY0Mw",
  },
};

export default nextConfig;
