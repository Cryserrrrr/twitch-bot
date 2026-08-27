export function formatDuration(ms: number, locale = "fr"): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const dayLabel = locale === "fr" ? "j" : "d";

  if (days > 0) return `${days}${dayLabel} ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

/**
 * SQLite stores timestamps as "YYYY-MM-DD HH:MM:SS" in UTC with no marker.
 * Turning them into proper ISO strings avoids relying on engine-specific
 * parsing of the space-separated form.
 */
function parseTimestamp(value: number | string): Date {
  if (typeof value === "number") return new Date(value);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }
  return new Date(value);
}

export function formatTime(value: number | string, locale = "fr"): string {
  const date = parseTimestamp(value);
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDate(value: number | string, locale = "fr"): string {
  // Chart labels are plain local dates: parse them as local, not as UTC.
  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : parseTimestamp(value);
  return date.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

export function formatRelative(value: number | string, locale = "fr"): string {
  const date = parseTimestamp(value);
  const diff = Date.now() - date.getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
    ["second", 1000],
  ];

  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms || unit === "second") {
      return formatter.format(-Math.round(diff / ms), unit);
    }
  }

  return "";
}

export function formatNumber(value: number, locale = "fr"): string {
  return new Intl.NumberFormat(locale, { notation: value > 9999 ? "compact" : "standard" }).format(value);
}
