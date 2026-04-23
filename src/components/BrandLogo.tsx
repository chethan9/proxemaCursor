import { useBranding } from "@/contexts/BrandingProvider";
import { cn } from "@/lib/utils";

type BrandLogoSize = "xs" | "sm" | "md" | "lg" | "xl";

interface BrandLogoProps {
  size?: BrandLogoSize;
  withTile?: boolean;
  className?: string;
}

const SIZE_MAP: Record<BrandLogoSize, { tile: string; img: string; text: string }> = {
  xs: { tile: "h-5 w-5 rounded", img: "h-5 w-5", text: "text-[10px]" },
  sm: { tile: "h-6 w-6 rounded", img: "h-6 w-6", text: "text-xs" },
  md: { tile: "h-10 w-10 rounded-lg", img: "h-10 w-10", text: "text-base" },
  lg: { tile: "h-14 w-14 rounded-xl", img: "h-14 w-14", text: "text-xl" },
  xl: { tile: "h-20 w-20 rounded-2xl", img: "h-20 w-20", text: "text-3xl" },
};

export function BrandLogo({ size = "md", withTile = false, className }: BrandLogoProps) {
  const { brandName, logoUrl } = useBranding();
  const sz = SIZE_MAP[size];
  const initial = (brandName || "P").trim().charAt(0).toUpperCase();

  if (logoUrl) {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={brandName}
        className={cn("object-contain", sz.img, !withTile && className)}
      />
    );
    if (!withTile) return img;
    return (
      <div className={cn("flex items-center justify-center bg-primary/10 border border-primary/20", sz.tile, className)}>
        {img}
      </div>
    );
  }

  return (
    <div
      aria-label={brandName}
      className={cn(
        "flex items-center justify-center font-bold tracking-tight bg-primary text-primary-foreground",
        sz.tile,
        sz.text,
        className,
      )}
    >
      {initial}
    </div>
  );
}