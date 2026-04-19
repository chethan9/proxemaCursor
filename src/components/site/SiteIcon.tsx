import { cn } from "@/lib/utils";

type SiteLike = { name?: string | null; url?: string | null; logo_url?: string | null };
type SizeToken = "sm" | "md" | "lg" | number;

const PALETTE = [
  "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-lime-600",
  "bg-emerald-600", "bg-teal-600", "bg-cyan-600", "bg-sky-600",
  "bg-blue-600", "bg-indigo-600", "bg-violet-600", "bg-purple-600",
  "bg-fuchsia-600", "bg-pink-600",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickColor(seed: string) {
  return PALETTE[hashString(seed) % PALETTE.length];
}

function resolveSize(size: SizeToken): number {
  if (typeof size === "number") return size;
  if (size === "sm") return 20;
  if (size === "lg") return 40;
  return 28;
}

export function SiteIcon({
  site,
  size = 20,
  className,
}: {
  site: SiteLike;
  size?: SizeToken;
  className?: string;
}) {
  const px = resolveSize(size);
  const label = (site.name || site.url || "?").trim();
  const initial = label.charAt(0).toUpperCase() || "?";
  const seed = (site.url || site.name || "x").toLowerCase();
  const colorBg = pickColor(seed);
  const style = { width: px, height: px };
  const fontSize = px <= 18 ? 10 : px <= 22 ? 11 : px <= 28 ? 12 : px <= 36 ? 15 : 18;

  if (site.logo_url) {
    return (
      <span
        style={style}
        className={cn(
          "inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 bg-muted ring-1 ring-border/60",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.logo_url} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      style={{ ...style, fontSize }}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold text-white flex-shrink-0 select-none",
        colorBg,
        className
      )}
    >
      {initial}
    </span>
  );
}