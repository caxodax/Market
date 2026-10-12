/**
 * Timezone and Date Utilities for MarketOS
 * Specialized for America/Caracas (Venezuela Standard Time: UTC-4, No DST)
 */

export const CARACAS_TIMEZONE = "America/Caracas";

/**
 * Returns current timestamp formatted as YYYY-MM-DD in America/Caracas timezone
 */
export function getCaracasDateKey(dateInput?: Date | string | number | null): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";

  // en-CA outputs ISO format YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CARACAS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

/**
 * Format timestamp into standard Caracas presentation: DD/MM/YYYY hh:mm A
 */
export function formatCaracasDateTime(
  dateInput?: Date | string | number | null,
  includeSeconds: boolean = false
): string {
  if (!dateInput) return "N/A";
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "N/A";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: CARACAS_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };

  if (includeSeconds) {
    options.second = "2-digit";
  }

  return new Intl.DateTimeFormat("es-VE", options).format(d);
}

/**
 * Format timestamp into Caracas date string: DD/MM/YYYY
 */
export function formatCaracasDate(dateInput?: Date | string | number | null): string {
  if (!dateInput) return "N/A";
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "N/A";

  return new Intl.DateTimeFormat("es-VE", {
    timeZone: CARACAS_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Format timestamp into Caracas time string: hh:mm A
 */
export function formatCaracasTime(dateInput?: Date | string | number | null): string {
  if (!dateInput) return "N/A";
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "N/A";

  return new Intl.DateTimeFormat("es-VE", {
    timeZone: CARACAS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Returns exact UTC boundaries corresponding to a local Caracas date range
 * Venezuela is fixed UTC-4 (00:00:00 Caracas = 04:00:00 UTC)
 */
export function getCaracasRangeBounds(
  range: "today" | "week" | "month" | "all"
): { startUtc: Date | null; endUtc: Date } {
  const now = new Date();
  const endUtc = now;

  if (range === "all") {
    return { startUtc: null, endUtc };
  }

  // Current year, month, day in Caracas
  const caracasKey = getCaracasDateKey(now);
  const [yearStr, monthStr, dayStr] = caracasKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (range === "today") {
    // 00:00:00 in Caracas (UTC-4) = 04:00:00 UTC
    const startUtc = new Date(Date.UTC(year, month - 1, day, 4, 0, 0, 0));
    return { startUtc, endUtc };
  }

  if (range === "week") {
    // 7 days ago at 00:00:00 Caracas
    const startUtc = new Date(Date.UTC(year, month - 1, day - 6, 4, 0, 0, 0));
    return { startUtc, endUtc };
  }

  if (range === "month") {
    // 1st of month at 00:00:00 Caracas
    const startUtc = new Date(Date.UTC(year, month - 1, 1, 4, 0, 0, 0));
    return { startUtc, endUtc };
  }

  return { startUtc: null, endUtc };
}
