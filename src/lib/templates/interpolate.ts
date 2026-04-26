export function resolvePath(data: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = data;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

const FORMATTERS: Record<string, (v: unknown) => string> = {
  uppercase: (v) => String(v ?? "").toUpperCase(),
  lowercase: (v) => String(v ?? "").toLowerCase(),
  currency: (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : "";
  },
};

export function interpolate(template: string, data: unknown): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([^}|\s]+)(?:\s*\|\s*([^}\s]+))?\s*\}\}/g, (_, path: string, fmt?: string) => {
    const val = resolvePath(data, path);
    if (val === undefined || val === null) return "";
    if (fmt && FORMATTERS[fmt]) return FORMATTERS[fmt](val);
    return String(val);
  });
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));
}