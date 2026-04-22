import { useState } from "react";
import { Store } from "lucide-react";

interface Props {
  url: string;
  name: string;
  size?: number;
  className?: string;
}

export function SiteAvatar({ url, name, size = 40, className = "" }: Props) {
  const [errored, setErrored] = useState(false);

  let faviconUrl: string | null = null;
  try {
    const domain = new URL(url).hostname;
    faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=${Math.max(64, size * 2)}`;
  } catch {
    faviconUrl = null;
  }

  const sizeStyle = { width: size, height: size };

  if (!faviconUrl || errored) {
    return (
      <div
        className={`rounded-lg bg-primary/10 flex items-center justify-center shrink-0 ${className}`}
        style={sizeStyle}
      >
        <Store className="text-primary" style={{ width: Math.max(14, size * 0.5), height: Math.max(14, size * 0.5) }} />
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0 border border-border ${className}`}
      style={sizeStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={faviconUrl}
        alt={name}
        className="w-full h-full object-contain p-1"
        onError={() => setErrored(true)}
        loading="lazy"
      />
    </div>
  );
}