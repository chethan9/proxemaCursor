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
    <div className={cn("relative h-full w-full min-h-[132px]", className)} aria-hidden>
      {inner}
    </div>
  );
}

/** Strong silhouettes so icons read on orange + white panel backgrounds */
const FIG = "#334155";
const FIG_SOFT = "#64748b";

function Panel({ children, tone }: { children: ReactNode; tone: "before" | "after" }) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col rounded-md border p-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.65)]",
        tone === "before"
          ? "border-orange-300 bg-orange-50 dark:border-orange-700/70 dark:bg-orange-950/55 dark:shadow-none"
          : "border-slate-200 bg-white shadow-sm dark:border-border dark:bg-background dark:shadow-none"
      )}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">{children}</div>
    </div>
  );
}

function SplitPreview({ before, after }: { before: ReactNode; after: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 w-full gap-1.5">
      <Panel tone="before">{before}</Panel>
      <Panel tone="after">{after}</Panel>
    </div>
  );
}

const VB = "0 0 140 100";

function ModelReplacement() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <rect x="48" y="38" width="44" height="52" rx="3" fill={FIG} opacity={0.92} />
          <circle cx="70" cy="28" r="10" fill="#c2410c" />
          <rect x="54" y="36" width="32" height="40" rx="2" fill="#94a3b8" />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <rect x="48" y="38" width="44" height="52" rx="3" fill={FIG} opacity={0.92} />
          <circle cx="70" cy="28" r="10" fill="#7c3aed" />
          <rect x="54" y="36" width="32" height="40" rx="2" fill="#94a3b8" />
          <path d="M58 52 L82 52" stroke={FIG} strokeWidth="2" strokeLinecap="round" />
        </svg>
      }
    />
  );
}

function RealScene() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <rect x="48" y="42" width="44" height="44" rx="3" fill={FIG} opacity={0.9} />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <defs>
            <linearGradient id="rs-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.88 0.03 200)" />
              <stop offset="100%" stopColor="oklch(0.82 0.05 140)" />
            </linearGradient>
          </defs>
          <rect width="140" height="100" fill="url(#rs-bg)" opacity={0.42} />
          <rect x="38" y="28" width="64" height="8" rx="1" fill="#64748b" opacity={0.45} />
          <ellipse cx="70" cy="92" rx="50" ry="6" fill="oklch(0.4 0.02 250)" opacity={0.15} />
          <rect x="48" y="42" width="44" height="44" rx="3" fill={FIG} opacity={0.92} />
        </svg>
      }
    />
  );
}

function AutoGallery() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <rect x="38" y="28" width="64" height="48" rx="3" fill={FIG} opacity={0.9} />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <rect x="12" y="18" width="52" height="36" rx="2" fill={FIG_SOFT} />
          <rect x="76" y="18" width="52" height="36" rx="2" fill="#526479" />
          <rect x="12" y="58" width="52" height="36" rx="2" fill="#475569" />
          <rect x="76" y="58" width="52" height="36" rx="2" fill="#64748b" />
        </svg>
      }
    />
  );
}

function AngleGenerator() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <rect x="45" y="35" width="50" height="48" rx="3" fill={FIG} opacity={0.92} transform="rotate(-12 70 59)" />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <rect x="45" y="35" width="50" height="48" rx="3" fill={FIG} opacity={0.95} />
          <line x1="70" y1="95" x2="70" y2="87" stroke="#ea580c" strokeWidth="2.5" opacity={0.85} />
        </svg>
      }
    />
  );
}

function HandUsage() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <rect x="48" y="38" width="44" height="48" rx="3" fill={FIG} opacity={0.9} />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <ellipse cx="52" cy="62" rx="14" ry="18" fill="#fdba74" opacity={0.95} />
          <rect x="58" y="40" width="40" height="44" rx="3" fill={FIG} opacity={0.92} />
          <ellipse cx="58" cy="68" rx="10" ry="8" fill="#fb923c" opacity={0.85} />
        </svg>
      }
    />
  );
}

function EcommercePolish() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <rect x="46" y="40" width="48" height="48" rx="3" fill={FIG} opacity={0.88} transform="rotate(-4 70 64)" />
          <line x1="20" y1="20" x2="120" y2="85" stroke="#ea580c" strokeWidth="1.25" opacity={0.45} />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <defs>
            <linearGradient id="ep-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.92 0.02 260)" />
              <stop offset="100%" stopColor="oklch(0.85 0.03 280)" />
            </linearGradient>
          </defs>
          <rect width="140" height="100" fill="url(#ep-bg)" opacity={0.38} />
          <ellipse cx="70" cy="88" rx="36" ry="5" fill={FIG} opacity={0.18} />
          <rect x="48" y="38" width="44" height="48" rx="3" fill={FIG} opacity={0.92} />
        </svg>
      }
    />
  );
}

function PremiumWhiteBg() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <circle cx="40" cy="35" r="12" fill="#22c55e" opacity={0.55} />
          <rect x="50" y="40" width="40" height="44" rx="3" fill={FIG} opacity={0.9} />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <line x1="0" y1="98" x2="140" y2="98" stroke="#e2e8f0" strokeWidth="1" />
          <ellipse cx="70" cy="92" rx="28" ry="4" fill={FIG} opacity={0.12} />
          <rect x="50" y="38" width="40" height="44" rx="3" fill={FIG} opacity={0.88} />
          <rect x="54" y="52" width="14" height="6" rx="1" fill="#94a3b8" opacity={0.85} />
        </svg>
      }
    />
  );
}

function CustomPrompt() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <rect x="16" y="22" width="108" height="6" rx="1" fill={FIG_SOFT} opacity={0.55} />
          <rect x="16" y="34" width="88" height="5" rx="1" fill={FIG_SOFT} opacity={0.45} />
          <rect x="16" y="44" width="96" height="5" rx="1" fill={FIG_SOFT} opacity={0.4} />
          <rect x="48" y="58" width="44" height="36" rx="2" fill={FIG} opacity={0.88} />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <defs>
            <linearGradient id="cp-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.92 0.02 200)" />
              <stop offset="100%" stopColor="oklch(0.88 0.03 260)" />
            </linearGradient>
          </defs>
          <rect width="140" height="100" fill="url(#cp-bg)" opacity={0.4} />
          <path d="M16 24 L124 24" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" opacity={0.75} />
          <rect x="48" y="44" width="44" height="44" rx="3" fill={FIG} opacity={0.92} />
          <circle cx="98" cy="32" r="5" fill="#22c55e" opacity={0.9} />
        </svg>
      }
    />
  );
}

function DiaMagic() {
  return (
    <SplitPreview
      before={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <path
            d="M50 30 Q70 24 90 30 L96 44 L88 50 L88 86 L52 86 L52 50 L44 44 Z"
            fill={FIG}
            opacity={0.82}
          />
          <path d="M62 38 Q70 42 78 38" stroke="#0f172a" strokeWidth="1.25" fill="none" opacity={0.55} />
          <path d="M58 70 Q70 74 82 70" stroke="#0f172a" strokeWidth="1.25" fill="none" opacity={0.45} />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <ellipse cx="70" cy="92" rx="22" ry="3" fill={FIG} opacity={0.14} />
          <path
            d="M50 30 Q70 22 90 30 L98 46 L88 52 L88 86 L52 86 L52 52 L42 46 Z"
            fill="#1e293b"
          />
          <path
            d="M52 52 L52 86 L88 86 L88 52"
            stroke="#0f172a"
            strokeWidth="1"
            fill="none"
            opacity={0.55}
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
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <rect x="45" y="35" width="50" height="40" rx="2" fill={FIG} opacity={0.85} />
        </svg>
      }
      after={
        <svg viewBox={VB} className="h-full max-h-full w-full max-w-none">
          <rect x="45" y="35" width="50" height="40" rx="2" fill={FIG} opacity={0.92} />
          <circle cx="70" cy="28" r="4" fill="#ea580c" opacity={0.95} />
        </svg>
      }
    />
  );
}
