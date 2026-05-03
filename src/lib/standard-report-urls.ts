/**
 * HTTPS URL allowlist for Standard Reports (Metabase site URLs and legacy external links).
 * Prefer ALLOWED_STANDARD_REPORT_HOSTS; METABASE_ALLOWED_HOSTS is an optional alias.
 */

export function parseAllowedStandardReportHosts(): string[] {
  const raw =
    process.env.ALLOWED_STANDARD_REPORT_HOSTS?.trim() ||
    process.env.METABASE_ALLOWED_HOSTS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedStandardReportUrl(url: string): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Only https URLs are allowed" };
  }
  const hosts = parseAllowedStandardReportHosts();
  if (hosts.length === 0) {
    return {
      ok: false,
      reason:
        "ALLOWED_STANDARD_REPORT_HOSTS is not configured (comma-separated hostnames, no protocol — e.g. metabase.example.com)",
    };
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = hosts.some((h) => host === h || host.endsWith(`.${h}`));
  if (!allowed) {
    return { ok: false, reason: `Host must match one of: ${hosts.join(", ")}` };
  }
  return { ok: true };
}
