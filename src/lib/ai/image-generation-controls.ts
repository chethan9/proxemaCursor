export type AspectRatioValue = "1:1" | "4:5" | "3:4" | "16:9" | "9:16";

export type SizePresetValue = "sm" | "md" | "lg" | "xl" | "hero" | "custom";

export const ASPECT_RATIO_OPTIONS: Array<{ value: AspectRatioValue; label: string }> = [
  { value: "1:1", label: "Square" },
  { value: "4:5", label: "Portrait" },
  { value: "3:4", label: "Classic portrait" },
  { value: "16:9", label: "Landscape" },
  { value: "9:16", label: "Story" },
];

export const SIZE_PRESET_OPTIONS: Array<{ value: Exclude<SizePresetValue, "custom">; label: string; width: number; height: number }> = [
  { value: "sm", label: "Small (768 x 768)", width: 768, height: 768 },
  { value: "md", label: "Medium (1024 x 1024)", width: 1024, height: 1024 },
  { value: "lg", label: "Large (1280 x 1280)", width: 1280, height: 1280 },
  { value: "xl", label: "XL (1536 x 1536)", width: 1536, height: 1536 },
  { value: "hero", label: "Hero (1920 x 1080)", width: 1920, height: 1080 },
];

export const DEFAULT_ASPECT_RATIO: AspectRatioValue = "1:1";
export const DEFAULT_SIZE_PRESET: SizePresetValue = "md";
export const DEFAULT_CUSTOM_WIDTH = 1024;
export const DEFAULT_CUSTOM_HEIGHT = 1024;

export type ResolvedImageControls = {
  aspectRatio: AspectRatioValue;
  sizePreset: SizePresetValue;
  width: number;
  height: number;
  openAiSize: "1024x1024" | "1536x1024" | "1024x1536";
  instruction: string;
};

function isAspectRatioValue(value: string): value is AspectRatioValue {
  return ASPECT_RATIO_OPTIONS.some((option) => option.value === value);
}

function isSizePresetValue(value: string): value is SizePresetValue {
  return [...SIZE_PRESET_OPTIONS.map((option) => option.value), "custom"].includes(value as SizePresetValue);
}

function parsePositiveInt(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded > 0 ? rounded : null;
}

function clampPx(v: number): number {
  return Math.min(4096, Math.max(256, v));
}

function resolveOpenAiSize(width: number, height: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const ratio = width / height;
  if (ratio >= 1.2) return "1536x1024";
  if (ratio <= 0.84) return "1024x1536";
  return "1024x1024";
}

export function resolveImageControls(input: Record<string, string>): ResolvedImageControls {
  const ratioRaw = (input.aspect_ratio || "").trim();
  const presetRaw = (input.output_size_preset || "").trim();
  const aspectRatio: AspectRatioValue = isAspectRatioValue(ratioRaw) ? ratioRaw : DEFAULT_ASPECT_RATIO;
  const sizePreset: SizePresetValue = isSizePresetValue(presetRaw) ? presetRaw : DEFAULT_SIZE_PRESET;

  const presetDims = SIZE_PRESET_OPTIONS.find((option) => option.value === sizePreset);
  const customWidth = parsePositiveInt(input.custom_width);
  const customHeight = parsePositiveInt(input.custom_height);

  const width = clampPx(sizePreset === "custom" ? customWidth ?? DEFAULT_CUSTOM_WIDTH : presetDims?.width ?? DEFAULT_CUSTOM_WIDTH);
  const height = clampPx(sizePreset === "custom" ? customHeight ?? DEFAULT_CUSTOM_HEIGHT : presetDims?.height ?? DEFAULT_CUSTOM_HEIGHT);

  const openAiSize = resolveOpenAiSize(width, height);
  const instruction = `Aspect ratio: ${aspectRatio}. Target resolution: ${width}x${height}px. Keep composition and framing consistent with this format.`;

  return {
    aspectRatio,
    sizePreset,
    width,
    height,
    openAiSize,
    instruction,
  };
}
