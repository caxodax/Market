/**
 * MarketOS Tenant Analytics Domain Types
 * Privacy-first, lightweight web & conversion analytics
 */

export interface TenantPageView {
  id: string;
  tenant_id: string;
  path: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  session_id: string | null;
  device_type?: "mobile" | "desktop" | "tablet" | "other";
  created_at: string;
}

export interface RecordPageViewInput {
  tenantId: string;
  path: string;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  sessionId?: string | null;
  deviceType?: "mobile" | "desktop" | "tablet" | "other";
}

export type AnalyticsTimeRange = 7 | 14 | 30 | 90;

export interface AnalyticsDailyTrend {
  date: string;       // YYYY-MM-DD
  dayLabel: string;   // "Lun 26", "Mar 27", etc.
  views: number;
  visitors: number;
}

export interface AnalyticsTopPage {
  path: string;
  label: string;
  category: "Portada" | "Catálogo" | "Producto" | "Checkout" | "Cuenta" | "General";
  views: number;
  percentage: number;
}

export type AcquisitionChannelType =
  | "direct"
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "google"
  | "tiktok"
  | "twitter"
  | "other";

export interface AnalyticsAcquisitionSource {
  name: string;
  type: AcquisitionChannelType;
  views: number;
  percentage: number;
}

export interface AnalyticsSummary {
  timeRangeDays: AnalyticsTimeRange;
  totalViews: number;
  uniqueVisitors: number;
  dailyAverageViews: number;
  completedOrdersCount: number;
  conversionRatePercent: number; // (completedOrdersCount / uniqueVisitors) * 100
  topSource: string;
  trendData: AnalyticsDailyTrend[];
  topPages: AnalyticsTopPage[];
  sources: AnalyticsAcquisitionSource[];
}
