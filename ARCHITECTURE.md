# MarketOS Architecture

## Frontend
Next.js 16 (App Router)
TypeScript
Tailwind CSS

## Database
Supabase PostgreSQL

## Authentication
Supabase Auth (Multi-Role RBAC)

## Cache & Acceleration
Next.js Native Edge Data Cache (`unstable_cache` with SWR & on-demand tag revalidation)

## Storage
Cloudflare R2 Object Storage (S3 API compatible, 10 GB Free, 0 Egress)

## External Services & APIs
- **BCV Exchange Rate API**: Portal: `https://bcv.today/api/` | Endpoint: `https://bcv.today/api/v1/rate.json` (Native in-memory cache, automated daily sync for USD/VES official rate)
