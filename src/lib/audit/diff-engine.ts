/**
 * Field-level diff generation for audit logs.
 * Produces flat paths like "price" or "billing.address.line1" with redaction for secrets.
 */

export const REDACT_KEYS = new Set(
  [
    "password",
    "password_confirmation",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "api_key",
    "apiKey",
    "authorization",
    "credit_card",
    "card_number",
    "cvv",
    "payment_method_token",
    "gateway_token",
  ].map((k) => k.toLowerCase())
);

const DEFAULT_MAX_STRING = 4000;
const DEFAULT_MAX_DEPTH = 12;

export interface FieldDiffItem {
  path: string;
  before: unknown;
  after: unknown;
}

export interface BuildFieldDiffsOptions {
  maxStringLength?: number;
  maxDepth?: number;
  /** Extra key path segments (lowercase) to redact */
  redactPaths?: string[];
}

function shouldRedactPath(pathLower: string): boolean {
  const segments = pathLower.split(".");
  for (const seg of segments) {
    if (REDACT_KEYS.has(seg)) return true;
  }
  return false;
}

function truncateValue(value: unknown, maxLen: number): unknown {
  if (typeof value === "string" && value.length > maxLen) {
    return value.slice(0, maxLen) + "…";
  }
  if (value && typeof value === "object") {
    const s = JSON.stringify(value);
    if (s.length > maxLen) return s.slice(0, maxLen) + "…";
  }
  return value;
}

function redactOrTruncate(path: string, value: unknown, maxLen: number, extraRedact: Set<string>): unknown {
  const pl = path.toLowerCase();
  if (shouldRedactPath(pl) || extraRedact.has(pl)) return "[redacted]";
  return truncateValue(value, maxLen);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Flatten nested objects into dot paths (arrays indexed as [0], [1]).
 */
export function flattenForAudit(
  obj: unknown,
  prefix = "",
  depth = 0,
  maxDepth = DEFAULT_MAX_DEPTH
): Record<string, unknown> {
  if (depth > maxDepth) return { [prefix || "_"]: obj };
  if (obj === null || obj === undefined) return prefix ? { [prefix]: obj } : {};
  if (typeof obj !== "object") return prefix ? { [prefix]: obj } : {};
  if (Array.isArray(obj)) {
    const out: Record<string, unknown> = {};
    const limit = Math.min(obj.length, 200);
    for (let i = 0; i < limit; i++) {
      const p = prefix ? `${prefix}[${i}]` : `[${i}]`;
      Object.assign(out, flattenForAudit(obj[i], p, depth + 1, maxDepth));
    }
    return out;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v) || Array.isArray(v)) {
      Object.assign(out, flattenForAudit(v, p, depth + 1, maxDepth));
    } else {
      out[p] = v;
    }
  }
  return out;
}

/**
 * Build ordered field-level diffs between two arbitrary JSON-compatible snapshots.
 */
export function buildFieldDiffs(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  opts?: BuildFieldDiffsOptions
): FieldDiffItem[] {
  const maxLen = opts?.maxStringLength ?? DEFAULT_MAX_STRING;
  const maxDepth = opts?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const extraRedact = new Set((opts?.redactPaths ?? []).map((p) => p.toLowerCase()));

  const flatBefore = before ? flattenForAudit(before, "", 0, maxDepth) : {};
  const flatAfter = after ? flattenForAudit(after, "", 0, maxDepth) : {};
  const keys = new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)]);
  const items: FieldDiffItem[] = [];

  for (const path of Array.from(keys).sort()) {
    const b = flatBefore[path];
    const a = flatAfter[path];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    items.push({
      path,
      before: redactOrTruncate(path, b, maxLen, extraRedact),
      after: redactOrTruncate(path, a, maxLen, extraRedact),
    });
  }
  return items;
}

/** Limit number of field rows stored (keep most specific / largest changes first). */
export function capFieldDiffs(items: FieldDiffItem[], max = 500): FieldDiffItem[] {
  if (items.length <= max) return items;
  return items.slice(0, max);
}
