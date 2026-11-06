import { redirect } from "next/navigation";
import { resolveAuthorizedAdminContext } from "./admin-context";

interface AdminPageProps {
  searchParams: Promise<{ tenant?: string; store?: string; tab?: string }>;
}

export const dynamic = "force-dynamic";

const TAB_TO_ROUTE: Record<string, string> = {
  PAYMENTS: "/admin/payments",
  ORDERS: "/admin/orders",
  INVENTORY: "/admin/inventory",
  RATES: "/admin/rates",
  REPORTS: "/admin/reports",
  SETTINGS: "/admin/settings",
  DELIVERY: "/admin/delivery",
  COUPONS: "/admin/coupons",
  PUSH: "/admin/push",
  STORES: "/admin/stores",
  STAFF: "/admin/staff",
  AUDIT: "/admin/audit",
  PLUGINS: "/admin/plugins",
  INVOICING: "/admin/invoicing",
  PURCHASING: "/admin/purchasing",
  ACCOUNTING: "/admin/accounting",
  CRAFT_WORKSHOP: "/admin/craft",
  STOREFRONT_STUDIO: "/admin/storefront-studio",
  RAW_MATERIALS: "/admin/food-service",
  RECIPES: "/admin/food-service",
  MODIFIERS: "/admin/food-service",
  MTO_CPQ: "/admin/mto-cpq",
  POS: "/admin/pos",
};

/**
 * Root /admin entrypoint.
 * Validates session authorization and immediately redirects to the dedicated sub-route
 * with streaming loading skeleton and localized data fetch.
 */
export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  await resolveAuthorizedAdminContext(params);

  const tab = params?.tab ? params.tab.toUpperCase() : "PAYMENTS";
  const targetRoute = TAB_TO_ROUTE[tab] || "/admin/payments";

  // Preserve query parameters (e.g. ?tenant=... or ?store=...)
  const query = new URLSearchParams();
  if (params?.tenant) query.set("tenant", params.tenant);
  if (params?.store) query.set("store", params.store);
  const qs = query.toString() ? `?${query.toString()}` : "";

  redirect(`${targetRoute}${qs}`);
}
