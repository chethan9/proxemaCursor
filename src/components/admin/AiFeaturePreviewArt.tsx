import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = { slug: string; className?: string };

/** Decorative before/after illustrations for admin AI feature cards (not literal photo output). */
export function AiFeaturePreviewArt({ slug, className }: Props) {
  const inner = (() => {
    switch (slug) {
      case "model_replacement":
        return <ModelReplacement />;
      case "real_scene":
        return <RealScene />;
      case "auto_gallery":
        return <AutoGallery />;
      case "angle_generator":
        return <AngleGenerator />;
      case "hand_usage_shot":
        return <HandUsage />;
      case "ecommerce_catalog_polish":
        return <EcommercePolish />;
      case "premium_white_background":
        return <PremiumWhiteBg />;
      case "custom_prompt":
        return <CustomPrompt />;
      case "dia_magic":
        return <DiaMagic />;
      default:
        return <GenericFeature />;
    }
  })();

  return (
    <div className={cn("relative h-full min-h-[132px] w-full", className)} aria-hidden>
      {inner}
    </div>
  );
}

function Panel({ children, label, tone }: { children: ReactNode; label: string; tone: "before" | "after" }) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col rounded-lg border p-2 shadow-inner",
        tone === "before"
          ? "border-amber-200/80 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/40"
          : "border-emerald-200/80 bg-emerald-50/90 dark:border-emerald-900/50 dark:bg-emerald-950/40"
      )}
    >
      <span className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex flex-1 items-center justify-center">{children}</div>
    </div>
  );
}

function SplitPreview({ before, after }: { before: ReactNode; after: ReactNode }) {
  return (
    <div className="flex h-full w-full gap-2">
      <Panel tone="before" label="Before">
        {before}
      </Panel>
      <Panel tone="after" label="After">
        {after}
      </Panel>
    </div>
  );
}

const VB = "0 0 140 100";

function ModelReplacement() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect x="48" y="38" width="44" height="52" rx="3" fill="oklch(0.55 0.02 250)" opacity={0.85} />
          <circle cx="70" cy="28" r="10" fill="oklch(0.72 0.08 30)" />
          <rect x="54" y="36" width="32" height="40" rx="2" fill="oklch(0.78 0.04 250)" />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect x="48" y="38" width="44" height="52" rx="3" fill="oklch(0.55 0.02 250)" opacity={0.85} />
          <circle cx="70" cy="28" r="10" fill="oklch(0.62 0.06 280)" />
          <rect x="54" y="36" width="32" height="40" rx="2" fill="oklch(0.78 0.04 250)" />
          <path d="M58 52 L82 52" stroke="oklch(0.45 0.02 250)" strokeWidth="1.5" />
        </svg>
      }
    />
  );
}

function RealScene() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="oklch(0.92 0.01 260)" />
          <rect x="48" y="42" width="44" height="44" rx="3" fill="oklch(0.55 0.02 250)" />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <defs>
            <linearGradient id="rs-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.88 0.03 200)" />
              <stop offset="100%" stopColor="oklch(0.82 0.05 140)" />
            </linearGradient>
          </defs>
          <rect width="140" height="100" fill="url(#rs-bg)" />
          <rect x="38" y="28" width="64" height="8" rx="1" fill="oklch(0.7 0.02 80)" opacity={0.5} />
          <ellipse cx="70" cy="92" rx="50" ry="6" fill="oklch(0.4 0.02 250)" opacity={0.15} />
          <rect x="48" y="42" width="44" height="44" rx="3" fill="oklch(0.55 0.02 250)" />
        </svg>
      }
    />
  );
}

function AutoGallery() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="oklch(0.94 0.01 260)" />
          <rect x="38" y="28" width="64" height="48" rx="3" fill="oklch(0.55 0.02 250)" />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="oklch(0.96 0.01 260)" />
          <rect x="12" y="18" width="52" height="36" rx="2" fill="oklch(0.6 0.02 250)" />
          <rect x="76" y="18" width="52" height="36" rx="2" fill="oklch(0.58 0.03 250)" />
          <rect x="12" y="58" width="52" height="36" rx="2" fill="oklch(0.56 0.02 250)" />
          <rect x="76" y="58" width="52" height="36" rx="2" fill="oklch(0.59 0.02 250)" />
        </svg>
      }
    />
  );
}

function AngleGenerator() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="oklch(0.94 0.01 260)" />
          <rect x="45" y="35" width="50" height="48" rx="3" fill="oklch(0.55 0.02 250)" transform="rotate(-12 70 59)" />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="oklch(0.96 0.01 260)" />
          <rect x="45" y="35" width="50" height="48" rx="3" fill="oklch(0.55 0.02 250)" />
          <line x1="70" y1="95" x2="70" y2="87" stroke="oklch(0.5 0.02 250)" strokeWidth="2" opacity={0.35} />
        </svg>
      }
    />
  );
}

function HandUsage() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="oklch(0.94 0.01 260)" />
          <rect x="48" y="38" width="44" height="48" rx="3" fill="oklch(0.55 0.02 250)" />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="oklch(0.94 0.01 260)" />
          <ellipse cx="52" cy="62" rx="14" ry="18" fill="oklch(0.78 0.05 40)" opacity={0.9} />
          <rect x="58" y="40" width="40" height="44" rx="3" fill="oklch(0.55 0.02 250)" />
          <ellipse cx="58" cy="68" rx="10" ry="8" fill="oklch(0.78 0.05 40)" opacity={0.7} />
        </svg>
      }
    />
  );
}

function EcommercePolish() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="oklch(0.78 0.06 55)" />
          <rect x="46" y="40" width="48" height="48" rx="3" fill="oklch(0.52 0.02 250)" transform="rotate(-4 70 64)" />
          <line x1="20" y1="20" x2="120" y2="85" stroke="oklch(0.65 0.08 85)" strokeWidth="0.5" opacity={0.4} />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <defs>
            <linearGradient id="ep-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.92 0.02 260)" />
              <stop offset="100%" stopColor="oklch(0.85 0.03 280)" />
            </linearGradient>
          </defs>
          <rect width="140" height="100" fill="url(#ep-bg)" />
          <ellipse cx="70" cy="88" rx="36" ry="5" fill="oklch(0.35 0.02 250)" opacity={0.2} />
          <rect x="48" y="38" width="44" height="48" rx="3" fill="oklch(0.52 0.02 250)" />
        </svg>
      }
    />
  );
}

function PremiumWhiteBg() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="oklch(0.72 0.04 250)" />
          <circle cx="40" cy="35" r="12" fill="oklch(0.65 0.12 140)" opacity={0.5} />
          <rect x="50" y="40" width="40" height="44" rx="3" fill="oklch(0.5 0.02 250)" />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="#ffffff" />
          <line x1="0" y1="98" x2="140" y2="98" stroke="oklch(0.92 0.01 260)" strokeWidth="1" />
          <ellipse cx="70" cy="92" rx="28" ry="4" fill="oklch(0.4 0.02 250)" opacity={0.12} />
          <rect x="50" y="38" width="40" height="44" rx="3" fill="oklch(0.48 0.02 250)" />
          <rect x="54" y="52" width="14" height="6" rx="1" fill="oklch(0.75 0.02 250)" opacity={0.6} />
        </svg>
      }
    />
  );
}

function CustomPrompt() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="oklch(0.94 0.01 260)" />
          <rect x="16" y="22" width="108" height="6" rx="1" fill="oklch(0.7 0.02 250)" opacity={0.45} />
          <rect x="16" y="34" width="88" height="5" rx="1" fill="oklch(0.75 0.02 250)" opacity={0.4} />
          <rect x="16" y="44" width="96" height="5" rx="1" fill="oklch(0.75 0.02 250)" opacity={0.35} />
          <rect x="48" y="58" width="44" height="36" rx="2" fill="oklch(0.58 0.02 250)" />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <defs>
            <linearGradient id="cp-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.92 0.02 200)" />
              <stop offset="100%" stopColor="oklch(0.88 0.03 260)" />
            </linearGradient>
          </defs>
          <rect width="140" height="100" fill="url(#cp-bg)" />
          <path d="M16 24 L124 24" stroke="oklch(0.55 0.12 145)" strokeWidth="2" strokeLinecap="round" opacity={0.6} />
          <rect x="48" y="44" width="44" height="44" rx="3" fill="oklch(0.52 0.02 250)" />
          <circle cx="98" cy="32" r="5" fill="oklch(0.65 0.15 145)" opacity={0.85} />
        </svg>
      }
    />
  );
}

function DiaMagic() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="oklch(0.94 0.01 260)" />
          <path
            d="M50 30 Q70 24 90 30 L96 44 L88 50 L88 86 L52 86 L52 50 L44 44 Z"
            fill="oklch(0.6 0.04 250)"
            opacity={0.7}
          />
          <path d="M62 38 Q70 42 78 38" stroke="oklch(0.5 0.02 250)" strokeWidth="1" fill="none" opacity={0.6} />
          <path d="M58 70 Q70 74 82 70" stroke="oklch(0.5 0.02 250)" strokeWidth="1" fill="none" opacity={0.5} />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="#ffffff" />
          <ellipse cx="70" cy="92" rx="22" ry="3" fill="oklch(0.4 0.02 250)" opacity={0.16} />
          <path
            d="M50 30 Q70 22 90 30 L98 46 L88 52 L88 86 L52 86 L52 52 L42 46 Z"
            fill="oklch(0.32 0.02 260)"
          />
          <path
            d="M52 52 L52 86 L88 86 L88 52"
            stroke="oklch(0.18 0.02 260)"
            strokeWidth="0.6"
            fill="none"
            opacity={0.6}
          />
          <g transform="translate(106 24)">
            <circle cx="0" cy="0" r="3.5" fill="#FFFFFF" stroke="oklch(0.7 0.01 260)" strokeWidth="0.5" />
            <circle cx="0" cy="9" r="3.5" fill="#0A0A0A" />
            <circle cx="0" cy="18" r="3.5" fill="#1E3A8A" />
            <circle cx="0" cy="27" r="3.5" fill="#15803D" />
            <circle cx="0" cy="36" r="3.5" fill="#6D28D9" />
          </g>
        </svg>
      }
    />
  );
}

function GenericFeature() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="oklch(0.9 0.02 260)" />
          <rect x="45" y="35" width="50" height="40" rx="2" fill="oklch(0.6 0.02 250)" opacity={0.7} />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-[72px] w-full max-w-[140px]">
          <rect width="140" height="100" fill="oklch(0.95 0.01 260)" />
          <rect x="45" y="35" width="50" height="40" rx="2" fill="oklch(0.55 0.02 250)" />
          <circle cx="70" cy="28" r="3" fill="oklch(0.65 0.15 145)" />
        </svg>
      }
    />
  );
}
