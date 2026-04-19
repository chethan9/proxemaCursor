import { useState } from "react";
import { cn } from "@/lib/utils";

type SiteLike = { name?: string | null; url?: string | null };

const PALETTE = [
  { bg: "bg-rose-500", fg: "text-white" },
  { bg: "bg-orange-500", fg: "text-white" },
  { bg: "bg-amber-500", fg: "text-white" },
  { bg: "bg-lime-600", fg: "text-white" },
  { bg: "bg-emerald-600", fg: "text-white" },
  { bg: "bg-teal-600", fg: "text-white" },
  { bg: "bg-cyan-600", fg: "text-white" },
  { bg: "bg-sky-600", fg: "text-white" },
  { bg: "bg-blue-600", fg: "text-white" },
  { bg: "bg-indigo-600", fg: "text-white" },
  { bg: "bg-violet-600", fg: "text-white" },
  { bg: "bg-purple-600", fg: "text-white" },
  { bg: "bg-fuchsia-600", fg: "text-white" },
  { bg: "bg-pink-600", fg: "text-white" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickColor(seed: string) {
  return PALETTE[hashString(seed) % PALETTE.length];
}

function getFaviconUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch { return null; }
}

export function SiteIcon({ site, size = 20, className }: { site: SiteLike; size?: number; className?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const favicon = getFaviconUrl(site.url);
  const label = (site.name || site.url || "?").trim();
  const initial = label.charAt(0).toUpperCase();
  const seed = (site.url || site.name || "x").toLowerCase();
  const color = pickColor(seed);
  const style = { width: size, height: size };
  const fontSize = size <= 18 ? 10 : size <= 22 ? 11 : size <= 28 ? 12 : 14;

  if (favicon && !imgFailed) {
    return (
      <span
        style={style}
        className={cn(
          "relative inline-flex items-center justify-center rounded-md overflow-hidden flex-shrink-0 ring-1 ring-border/60",
          color.bg,
          className
        )}
      >
        <span className={cn("absolute inset-0 flex items-center justify-center font-semibold select-none", color.fg)}
          style={{ fontSize }}>
          {initial}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={favicon}
          alt=""
          onError={() => setImgFailed(true)}
          className="relative h-full w-full object-contain p-0.5"
          style={{ background: "transparent" }}
        />
      </span>
    );
  }

  return (
    <span
      style={{ ...style, fontSize }}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold flex-shrink-0 select-none",
        color.bg,
        color.fg,
        className
      )}
    >
      {initial}
    </span>
  );
}