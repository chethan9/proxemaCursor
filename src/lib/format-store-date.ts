/**
 * Date/time formatters that render timestamps in a store's native timezone
 * so agency operators see dates matching what customers/store admins see on the site.
 */

function safeTz(tz?: string | null): string | undefined {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

export function formatStoreDateTime(date: string | Date | null | undefined, tz?: string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const timeZone = safeTz(tz);
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export function formatStoreDate(date: string | Date | null | undefined, tz?: string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const timeZone = safeTz(tz);
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

export function formatStoreTime(date: string | Date | null | undefined, tz?: string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const timeZone = safeTz(tz);
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return d.toLocaleTimeString();
  }
}

export function getTzAbbreviation(tz?: string | null): string {
  const timeZone = safeTz(tz);
  if (!timeZone) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}