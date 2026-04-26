import bwipjs from "bwip-js/node";
import QRCode from "qrcode";
import type Handlebars from "handlebars";

interface HelperOptions {
  hash?: Record<string, unknown>;
}

export function registerHelpers(hb: typeof Handlebars) {
  hb.registerHelper("currency", function (amount: unknown, currency?: unknown) {
    const n = Number(amount);
    if (isNaN(n)) return "";
    const code = typeof currency === "string" ? currency : "USD";
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(n);
    } catch {
      return n.toFixed(2);
    }
  });

  hb.registerHelper("date", function (value: unknown, format?: unknown) {
    if (!value) return "";
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return String(value);
    const fmt = typeof format === "string" ? format : "default";
    if (fmt === "short") return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (fmt === "long") return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (fmt === "iso") return d.toISOString().split("T")[0];
    if (fmt === "datetime") return d.toLocaleString("en-US");
    if (fmt === "time") return d.toLocaleTimeString("en-US");
    return d.toLocaleDateString("en-US");
  });

  hb.registerHelper("barcode", function (value: unknown, options?: HelperOptions) {
    const text = String(value || "");
    if (!text) return "";
    const opts = options?.hash || {};
    const format = String(opts.format || "code128");
    const width = Number(opts.width) || 220;
    const height = Number(opts.height) || 12;
    const showText = opts.showText !== false;
    try {
      const svg = bwipjs.toSVG({
        bcid: format,
        text,
        height,
        includetext: showText,
        textxalign: "center",
        scale: 2,
      });
      return new hb.SafeString(`<div class="hb-barcode" style="display:inline-block;max-width:${width}px;">${svg}</div>`);
    } catch (e) {
      return new hb.SafeString(`<span style="color:#dc2626;font-family:monospace;font-size:11px">[barcode error: ${text}]</span>`);
    }
  });

  hb.registerHelper("qrcode", function (value: unknown, options?: HelperOptions) {
    const text = String(value || "");
    if (!text) return "";
    const opts = options?.hash || {};
    const size = Number(opts.size) || 120;
    const token = `__QR_TOKEN_${Buffer.from(JSON.stringify({ text, size })).toString("base64")}__`;
    return new hb.SafeString(token);
  });

  hb.registerHelper("eq", (a: unknown, b: unknown) => a === b);
  hb.registerHelper("neq", (a: unknown, b: unknown) => a !== b);
  hb.registerHelper("gt", (a: unknown, b: unknown) => Number(a) > Number(b));
  hb.registerHelper("lt", (a: unknown, b: unknown) => Number(a) < Number(b));
  hb.registerHelper("gte", (a: unknown, b: unknown) => Number(a) >= Number(b));
  hb.registerHelper("lte", (a: unknown, b: unknown) => Number(a) <= Number(b));
  hb.registerHelper("and", (...args: unknown[]) => args.slice(0, -1).every(Boolean));
  hb.registerHelper("or", (...args: unknown[]) => args.slice(0, -1).some(Boolean));
  hb.registerHelper("not", (a: unknown) => !a);

  hb.registerHelper("multiply", (a: unknown, b: unknown) => Number(a) * Number(b));
  hb.registerHelper("add", (a: unknown, b: unknown) => Number(a) + Number(b));
  hb.registerHelper("subtract", (a: unknown, b: unknown) => Number(a) - Number(b));
  hb.registerHelper("divide", (a: unknown, b: unknown) => {
    const d = Number(b);
    return d === 0 ? 0 : Number(a) / d;
  });
  hb.registerHelper("round", (n: unknown, decimals?: unknown) => {
    const d = Number(decimals) || 0;
    const m = Math.pow(10, d);
    return Math.round(Number(n) * m) / m;
  });

  hb.registerHelper("uppercase", (s: unknown) => String(s ?? "").toUpperCase());
  hb.registerHelper("lowercase", (s: unknown) => String(s ?? "").toLowerCase());
  hb.registerHelper("capitalize", (s: unknown) => {
    const str = String(s ?? "");
    return str.charAt(0).toUpperCase() + str.slice(1);
  });
  hb.registerHelper("titlecase", (s: unknown) => String(s ?? "").replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()));

  hb.registerHelper("default", (value: unknown, fallback: unknown) => (value === null || value === undefined || value === "" ? fallback : value));
  hb.registerHelper("concat", (...args: unknown[]) => args.slice(0, -1).map(String).join(""));
  hb.registerHelper("json", (obj: unknown) => JSON.stringify(obj, null, 2));

  hb.registerHelper("address", function (obj: unknown) {
    const a = (obj as Record<string, unknown>) || {};
    const lines: string[] = [];
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ");
    if (name) lines.push(escape(name));
    if (a.company) lines.push(escape(String(a.company)));
    if (a.address_1) lines.push(escape(String(a.address_1)));
    if (a.address_2) lines.push(escape(String(a.address_2)));
    const cityLine = [a.city, a.state, a.postcode].filter(Boolean).join(", ");
    if (cityLine) lines.push(escape(cityLine));
    if (a.country) lines.push(escape(String(a.country)));
    return new hb.SafeString(lines.map((l) => `<div>${l}</div>`).join(""));
  });
}

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export async function resolveAsyncTokens(html: string): Promise<string> {
  const tokenRegex = /__QR_TOKEN_([A-Za-z0-9+/=]+)__/g;
  const matches = Array.from(html.matchAll(tokenRegex));
  if (matches.length === 0) return html;

  const replacements = new Map<string, string>();
  for (const match of matches) {
    const full = match[0];
    if (replacements.has(full)) continue;
    try {
      const config = JSON.parse(Buffer.from(match[1], "base64").toString("utf8")) as { text: string; size: number };
      const dataUrl = await QRCode.toDataURL(config.text, { width: config.size, margin: 1 });
      replacements.set(full, `<img src="${dataUrl}" width="${config.size}" height="${config.size}" alt="QR" style="display:inline-block;" />`);
    } catch {
      replacements.set(full, `<span style="color:#dc2626">[QR error]</span>`);
    }
  }

  return html.replace(tokenRegex, (m) => replacements.get(m) || m);
}