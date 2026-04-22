import { useState } from "react";
import { Store } from "lucide-react";

interface Props {
  url: string;
  name: string;
  size?: number;
  className?: string;
}

function hashToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function SiteAvatar({ url, name, size = 40, className = "" }: Props) {
  const [errored, setErrored] = useState(false);

  let faviconUrl: string | null = null;
  let bgColor = "hsl(220, 15%, 92%)";
  try {
    const domain = new URL(url).hostname;
    faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=${size * 2}`;
    const hue = hashToHue(domain);
    bgColor = `hsl(${hue}, 40%, 88%)`;
  } catch {
    faviconUrl = null;
  }

  const sizeStyle = { width: size, height: size, backgroundColor: bgColor };
  const padding = Math.max(2, Math.round(size * 0.12));

  if (!faviconUrl || errored) {
    return (
      <div
        className={`rounded-lg flex items-center justify-center shrink-0 ring-1 ring-black/5 ${className}`}
        style={sizeStyle}
      >
        <Store className="text-slate-700" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-black/5 ${className}`}
      style={sizeStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={faviconUrl}
        alt={name}
        className="w-full h-full object-contain"
        style={{ padding: `${padding}px` }}
        onError={() => setErrored(true)}
        loading="lazy"
      />
    </div>
  );
}