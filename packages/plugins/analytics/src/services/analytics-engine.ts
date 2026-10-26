import type {
  TenantPageView,
  AnalyticsTimeRange,
  AnalyticsDailyTrend,
  AnalyticsTopPage,
  AnalyticsAcquisitionSource,
  AnalyticsSummary,
  AcquisitionChannelType,
} from "@marketos/types";

const SPANISH_DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * Humanizes raw web routes into friendly e-commerce categories and titles
 */
export function humanizePagePath(path: string): {
  label: string;
  category: AnalyticsTopPage["category"];
} {
  const p = (path || "/").toLowerCase().trim();

  if (p === "/" || p === "") {
    return { label: "Inicio (Vitrina Principal)", category: "Portada" };
  }
  if (p === "/catalog" || p === "/catalogo" || p === "/tienda" || p === "/menu") {
    return { label: "Catálogo Completo", category: "Catálogo" };
  }
  if (p.startsWith("/product/") || p.startsWith("/producto/") || p.startsWith("/p/")) {
    const slug = path.split("/").filter(Boolean).pop() || "producto";
    const cleanSlug = decodeURIComponent(slug).replace(/[-_]/g, " ");
    return {
      label: `Producto: ${cleanSlug.charAt(0).toUpperCase() + cleanSlug.slice(1)}`,
      category: "Producto",
    };
  }
  if (p === "/checkout" || p === "/carrito" || p === "/cart") {
    return { label: "Proceso de Pago (Checkout)", category: "Checkout" };
  }
  if (p.startsWith("/admin")) {
    return { label: "Panel Administrativo", category: "Cuenta" };
  }
  if (p === "/login" || p === "/register" || p.startsWith("/perfil")) {
    return { label: "Área de Usuario & Perfil", category: "Cuenta" };
  }

  // Fallback for custom category or landing routes
  return { label: path, category: "General" };
}

/**
 * Normalizes referrer and UTM inputs into high-level marketing channels
 */
export function normalizeAcquisitionSource(
  referrer?: string | null,
  utmSource?: string | null
): { name: string; type: AcquisitionChannelType } {
  const ref = (referrer || "").toLowerCase().trim();
  const utm = (utmSource || "").toLowerCase().trim();
  const source = utm || ref;

  if (!source || source === "directo" || source === "direct") {
    return { name: "Tráfico Directo", type: "direct" };
  }
  if (source.includes("wa.me") || source.includes("whatsapp")) {
    return { name: "WhatsApp Chat / Catálogo", type: "whatsapp" };
  }
  if (source.includes("instagram") || source.includes("l.instagram")) {
    return { name: "Instagram (Bio & Stories)", type: "instagram" };
  }
  if (source.includes("facebook") || source.includes("fb.me")) {
    return { name: "Facebook Ads & Posts", type: "facebook" };
  }
  if (source.includes("google") || source.includes("googlequicksearchbox")) {
    return { name: "Búsqueda Google (SEO / Ads)", type: "google" };
  }
  if (source.includes("tiktok")) {
    return { name: "TikTok", type: "tiktok" };
  }
  if (source.includes("twitter") || source.includes("x.com") || source.includes("t.co")) {
    return { name: "X / Twitter", type: "twitter" };
  }

  // Capitalize custom UTM sources
  const formattedCustom = (utmSource || referrer || "Otro")
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");

  return { name: formattedCustom || "Otros Canales", type: "other" };
}

/**
 * Aggregates raw page view events and orders into a structured analytics summary
 */
export function buildAnalyticsSummary(
  views: TenantPageView[],
  completedOrdersCount: number = 0,
  days: AnalyticsTimeRange = 30
): AnalyticsSummary {
  const totalViews = views.length;

  // 1. Unique visitors & session tracking
  const uniqueVisitorSet = new Set<string>();
  const viewsByPath: Record<string, number> = {};
  const viewsBySource: Record<string, { count: number; type: AcquisitionChannelType }> = {};

  // 2. Initialize day buckets (zero-filled for continuity)
  const now = new Date();
  const dailyBuckets: Record<string, { views: number; visitors: Set<string>; dayLabel: string }> = {};

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0]; // YYYY-MM-DD
    const dayLabel = `${SPANISH_DAYS[d.getDay()]} ${d.getDate()}`;
    dailyBuckets[dateKey] = { views: 0, visitors: new Set(), dayLabel };
  }

  // 3. Process views
  for (const view of views) {
    const sessionKey = view.session_id || view.id;
    uniqueVisitorSet.add(sessionKey);

    // Date grouping
    const dateKey = (view.created_at || "").split("T")[0];
    if (dailyBuckets[dateKey]) {
      dailyBuckets[dateKey].views++;
      dailyBuckets[dateKey].visitors.add(sessionKey);
    }

    // Path grouping
    const cleanPath = (view.path || "/").split("?")[0];
    viewsByPath[cleanPath] = (viewsByPath[cleanPath] || 0) + 1;

    // Source grouping
    const { name, type } = normalizeAcquisitionSource(view.referrer, view.utm_source);
    if (!viewsBySource[name]) {
      viewsBySource[name] = { count: 0, type };
    }
    viewsBySource[name].count++;
  }

  const uniqueVisitors = uniqueVisitorSet.size;
  const dailyAverageViews = Number((totalViews / Math.max(1, days)).toFixed(1));

  // 4. Calculate conversion rate: (completed orders / unique visitors) * 100
  const conversionRatePercent = uniqueVisitors > 0
    ? Number(((completedOrdersCount / uniqueVisitors) * 100).toFixed(1))
    : 0;

  // 5. Build trend data array
  const trendData: AnalyticsDailyTrend[] = Object.entries(dailyBuckets).map(([date, data]) => ({
    date,
    dayLabel: data.dayLabel,
    views: data.views,
    visitors: data.visitors.size,
  }));

  // 6. Build top pages
  const topPages: AnalyticsTopPage[] = Object.entries(viewsByPath)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([path, count]) => {
      const meta = humanizePagePath(path);
      return {
        path,
        label: meta.label,
        category: meta.category,
        views: count,
        percentage: totalViews > 0 ? Number(((count / totalViews) * 100).toFixed(1)) : 0,
      };
    });

  // 7. Build sources
  const sources: AnalyticsAcquisitionSource[] = Object.entries(viewsBySource)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 6)
    .map(([name, data]) => ({
      name,
      type: data.type,
      views: data.count,
      percentage: totalViews > 0 ? Number(((data.count / totalViews) * 100).toFixed(1)) : 0,
    }));

  const topSource = sources.length > 0 ? sources[0].name : "Tráfico Directo";

  return {
    timeRangeDays: days,
    totalViews,
    uniqueVisitors,
    dailyAverageViews,
    completedOrdersCount,
    conversionRatePercent,
    topSource,
    trendData,
    topPages,
    sources,
  };
}
