"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PAGE_SETTINGS,
  type PageBox,
  type PageOrientation,
  type PageSettings,
  type PageSize,
  resolvePageSettings,
} from "@/lib/templates/document";
import { Link2, Link2Off } from "lucide-react";

const SIZES: PageSize[] = ["A4", "Letter", "Legal", "A3", "A5"];
const ORIENTATIONS: { id: PageOrientation; label: string }[] = [
  { id: "portrait", label: "Portrait" },
  { id: "landscape", label: "Landscape" },
];

const SWATCHES = ["#ffffff", "#f8fafc", "#fefce8", "#f0fdf4", "#eff6ff", "#0f172a"] as const;

export type BuilderPageSettingsProps = {
  page?: PageSettings;
  onChange: (next: PageSettings) => void;
  disabled?: boolean;
};

export function BuilderPageSettings({ page, onChange, disabled }: BuilderPageSettingsProps) {
  const resolved = useMemo(() => resolvePageSettings(page), [page]);

  const update = (patch: Partial<PageSettings>) => {
    onChange({ ...resolved, ...patch });
  };

  const reset = () => onChange({ ...DEFAULT_PAGE_SETTINGS });

  return (
    <div className="space-y-4 px-1 py-2">
      <Section title="Paper">
        <Field label="Size">
          <Select
            value={resolved.size}
            disabled={disabled}
            onChange={(v) => update({ size: v as PageSize })}
            options={SIZES.map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="Orientation">
          <Pills
            value={resolved.orientation}
            disabled={disabled}
            options={ORIENTATIONS}
            onChange={(v) => update({ orientation: v as PageOrientation })}
          />
        </Field>
      </Section>

      <Section title="Background">
        <ColorRow
          value={resolved.background}
          onChange={(v) => update({ background: v })}
          disabled={disabled}
        />
      </Section>

      <Section title="Margin (mm)" hint="Outer print margin (paper edge → content)">
        <BoxInput
          value={resolved.margin}
          onChange={(margin) => update({ margin })}
          disabled={disabled}
        />
      </Section>

      <Section title="Padding (mm)" hint="Inner content padding inside the page">
        <BoxInput
          value={resolved.padding}
          onChange={(padding) => update({ padding })}
          disabled={disabled}
        />
      </Section>

      <button
        type="button"
        onClick={reset}
        disabled={disabled}
        className="w-full text-xs font-medium text-slate-500 hover:text-slate-900 py-2 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
      >
        Reset to defaults
      </button>
    </div>
  );
}

/* ---------------- Internal pieces ---------------- */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="px-3 py-2.5 border-b border-slate-100">
        <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
        {hint ? <p className="text-[10.5px] text-slate-500 mt-0.5 leading-relaxed">{hint}</p> : null}
      </header>
      <div className="p-3 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-center gap-3">
      <label className="text-[11px] font-medium text-slate-700">{label}</label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="appearance-none w-full h-8 pl-3 pr-7 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-900 hover:border-slate-300 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 10 6"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-1.5 w-2.5 text-slate-400"
      >
        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

function Pills<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex p-0.5 rounded-md bg-slate-100 border border-slate-200">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={cn(
            "flex-1 h-7 px-2 text-[11px] font-medium rounded-[5px] transition-colors",
            value === o.id
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ColorRow({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value);
  // Keep local input synced if external value changes (e.g. preset / reset),
  // but don't fight with the user while they're typing in this input.
  useEffect(() => {
    const focused =
      typeof document !== "undefined" &&
      document.activeElement?.classList?.contains("page-color-input");
    if (!focused) setText(value);
  }, [value]);
  const commit = (v: string) => {
    setText(v);
    if (/^#?[0-9a-f]{3,8}$/i.test(v.trim())) {
      onChange(v.startsWith("#") ? v : `#${v}`);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label
          className={cn(
            "h-9 w-9 rounded-md border border-slate-200 cursor-pointer overflow-hidden relative shrink-0",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          style={{ background: value }}
          aria-label="Pick page background colour"
        >
          <input
            type="color"
            value={normalizeHex(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <input
          type="text"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="page-color-input flex-1 h-9 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-mono text-slate-900 hover:border-slate-300 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
          placeholder="#ffffff"
        />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {SWATCHES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onChange(s)}
            className={cn(
              "h-5 w-5 rounded-md border border-slate-200 hover:scale-110 transition-transform",
              value.toLowerCase() === s.toLowerCase() && "ring-2 ring-primary ring-offset-1",
              disabled && "opacity-50 cursor-not-allowed",
            )}
            style={{ background: s }}
            aria-label={`Set background ${s}`}
            title={s}
          />
        ))}
      </div>
    </div>
  );
}

function BoxInput({
  value,
  onChange,
  disabled,
}: {
  value: PageBox;
  onChange: (v: PageBox) => void;
  disabled?: boolean;
}) {
  const allEqual =
    value.top === value.right && value.right === value.bottom && value.bottom === value.left;
  const [linked, setLinked] = useState(allEqual);

  const setOne = (key: keyof PageBox, raw: string) => {
    const num = clampNum(raw);
    if (linked) {
      onChange({ top: num, right: num, bottom: num, left: num });
    } else {
      onChange({ ...value, [key]: num });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const next = !linked;
            setLinked(next);
            if (next) {
              onChange({
                top: value.top,
                right: value.top,
                bottom: value.top,
                left: value.top,
              });
            }
          }}
          className={cn(
            "flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-md transition-colors",
            linked ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          aria-pressed={linked}
        >
          {linked ? <Link2 className="h-3 w-3" /> : <Link2Off className="h-3 w-3" />}
          {linked ? "Linked" : "Independent"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Top" value={value.top} disabled={disabled} onChange={(v) => setOne("top", v)} />
        <NumField label="Right" value={value.right} disabled={disabled || linked} onChange={(v) => setOne("right", v)} />
        <NumField label="Bottom" value={value.bottom} disabled={disabled || linked} onChange={(v) => setOne("bottom", v)} />
        <NumField label="Left" value={value.left} disabled={disabled || linked} onChange={(v) => setOne("left", v)} />
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10.5px] font-medium text-slate-500 mb-1">{label}</label>
      <div
        className={cn(
          "flex items-center rounded-md border border-slate-200 bg-white h-8 overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-colors",
          disabled && "bg-slate-50 opacity-60",
        )}
      >
        <input
          type="number"
          step="1"
          min="0"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 px-2 bg-transparent text-xs font-medium text-slate-900 outline-none disabled:cursor-not-allowed"
        />
        <span className="px-2 h-full flex items-center bg-slate-50 text-[10.5px] font-medium text-slate-500 border-l border-slate-200">
          mm
        </span>
      </div>
    </div>
  );
}

function clampNum(raw: string): number {
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normalizeHex(v: string): string {
  if (!v) return "#ffffff";
  if (v.startsWith("#")) return v;
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v}`;
  return "#ffffff";
}
