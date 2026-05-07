import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Camera,
  Hand,
  LayoutGrid,
  MessageSquareText,
  Mountain,
  Scan,
  ShoppingBag,
  Sparkles,
  UserRound,
  Wand2,
} from "lucide-react";

const SLUG_ICON: Record<string, LucideIcon> = {
  dia_magic: Wand2,
  model_replacement: UserRound,
  real_scene: Mountain,
  auto_gallery: LayoutGrid,
  angle_generator: Camera,
  hand_usage_shot: Hand,
  ecommerce_catalog_polish: ShoppingBag,
  premium_white_background: BadgeCheck,
  custom_prompt: MessageSquareText,
};

/**
 * Small before → after strip for the product AI picker: orange / white with a single feature icon.
 * Replaces large SVG artwork in the compact dialog.
 */
export function AIFeatureCompactGlyph({ slug }: { slug: string }) {
  const Icon = SLUG_ICON[slug] ?? Scan;

  return (
    <div
      className="flex h-7 w-[3.25rem] shrink-0 overflow-hidden rounded border border-orange-200/90 bg-white shadow-sm"
      aria-hidden
    >
      <div className="flex flex-1 items-center justify-center bg-orange-100">
        <Icon className="h-3 w-3 text-slate-800" strokeWidth={2.25} />
      </div>
      <div className="flex flex-1 items-center justify-center bg-white">
        <Sparkles className="h-3 w-3 text-orange-600" strokeWidth={2.25} />
      </div>
    </div>
  );
}
