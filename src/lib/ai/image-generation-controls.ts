export type AspectRatioValue = "1:1" | "4:5" | "3:4" | "16:9" | "9:16";

/** Pixel presets vs aspect-first mode — only one drives output geometry (see `resolveImageControls`). */
export type ImageDimensionMode = "size" | "aspect";

export type SizePresetValue = "original" | "sm" | "md" | "lg" | "xl" | "hero" | "custom";

export const ASPECT_RATIO_OPTIONS: Array<{ value: AspectRatioValue; label: string }> = [
  { value: "1:1", label: "Square" },
  { value: "4:5", label: "Portrait" },
  { value: "3:4", label: "Classic portrait" },
  { value: "16:9", label: "Landscape" },
  { value: "9:16", label: "Story" },
];

/** Fixed pixel presets (excluding Original + Custom). */
export const SIZE_PRESET_OPTIONS: Array<{
  value: Exclude<SizePresetValue, "custom" | "original">;
  label: string;
  width: number;
  height: number;
}> = [
  { value: "sm", label: "Small (768 x 768)", width: 768, height: 768 },
  { value: "md", label: "Medium (1024 x 1024)", width: 1024, height: 1024 },
  { value: "lg", label: "Large (1280 x 1280)", width: 1280, height: 1280 },
  { value: "xl", label: "XL (1536 x 1536)", width: 1536, height: 1536 },
  { value: "hero", label: "Hero (1920 x 1080)", width: 1920, height: 1080 },
];

/** First pill in the output-size row — matches reference image pixels when provided. */
export const ORIGINAL_SIZE_OPTION = { value: "original" as const, label: "Original (match reference)" };

/** Max simultaneous outputs per generation request (UI + API). */
export const MAX_AI_IMAGE_OUTPUT_COUNT = 5;

export const DEFAULT_ASPECT_RATIO: AspectRatioValue = "1:1";
export const DEFAULT_IMAGE_DIMENSION_MODE: ImageDimensionMode = "size";
export const DEFAULT_SIZE_PRESET: SizePresetValue = "original";
export const DEFAULT_CUSTOM_WIDTH = 1024;
export const DEFAULT_CUSTOM_HEIGHT = 1024;

export type OpenAiImageSizeParam = "1024x1024" | "1536x1024" | "1024x1536" | "auto";

/** Passed through to Gemini `generationConfig.responseFormat.image`. */
export type GeminiImageParams = {
  aspectRatio: string;
  imageSize: "512" | "1K" | "2K" | "4K";
};

export type ResolvedImageControls = {
  dimensionMode: ImageDimensionMode;
  /** User-selected aspect when UI is in aspect mode; in size mode mirrors `outputAspectRatio`. */
  aspectRatio: AspectRatioValue;
  sizePreset: SizePresetValue;
  width: number;
  height: number;
  /** Effective aspect string for Gemini `responseFormat.image.aspectRatio`. */
  outputAspectRatio: string;
  geminiImageSize: GeminiImageParams["imageSize"];
  openAiSize: OpenAiImageSizeParam;
  instruction: string;
};

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

/** Maps output pixels to the closest standard ratio label supported by Gemini image models. */
export function snapToStandardAspectRatio(width: number, height: number): string {
  const r = width / height;
  const standards: Array<{ tag: string; v: number }> = [
    { tag: "1:1", v: 1 },
    { tag: "4:5", v: 4 / 5 },
    { tag: "3:4", v: 3 / 4 },
    { tag: "16:9", v: 16 / 9 },
    { tag: "9:16", v: 9 / 16 },
  ];
  let best = standards[0]!;
  let bestD = Math.abs(r - best.v);
  for (const s of standards) {
    const d = Math.abs(r - s.v);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  if (bestD <= 0.06) return best.tag;
  const g = gcd(width, height);
  return `${Math.round(width / g)}:${Math.round(height / g)}`;
}

function geminiImageSizeFromLongEdge(maxPx: number): GeminiImageParams["imageSize"] {
  if (maxPx <= 640) return "512";
  if (maxPx <= 1400) return "1K";
  if (maxPx <= 2200) return "2K";
  return "4K";
}

function isAspectRatioValue(value: string): value is AspectRatioValue {
  return ASPECT_RATIO_OPTIONS.some((option) => option.value === value);
}

const ALL_SIZE_PRESETS: SizePresetValue[] = ["original", "sm", "md", "lg", "xl", "hero", "custom"];

function isSizePresetValue(value: string): value is SizePresetValue {
  return ALL_SIZE_PRESETS.includes(value as SizePresetValue);
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

/** OpenAI image edits only expose three square buckets + `auto`; map requested pixels to the closest bucket. */
export function resolveOpenAiSize(width: number, height: number): Exclude<OpenAiImageSizeParam, "auto"> {
  const ratio = width / height;
  if (ratio >= 1.2) return "1536x1024";
  if (ratio <= 0.84) return "1024x1536";
  return "1024x1024";
}

/**
 * Canonical pixels + OpenAI size for each aspect option (aspect-first mode).
 * Non-standard ratios use `auto` so the API is not forced into the wrong 1024 bucket.
 */
const ASPECT_OUTPUT_SPECS: Record<
  AspectRatioValue,
  { width: number; height: number; openAi: OpenAiImageSizeParam; geminiImageSize: GeminiImageParams["imageSize"] }
> = {
  "1:1": { width: 1024, height: 1024, openAi: "1024x1024", geminiImageSize: "1K" },
  "16:9": { width: 1536, height: 1024, openAi: "1536x1024", geminiImageSize: "2K" },
  "9:16": { width: 1024, height: 1536, openAi: "1024x1536", geminiImageSize: "2K" },
  "4:5": { width: 1024, height: 1280, openAi: "auto", geminiImageSize: "2K" },
  "3:4": { width: 1024, height: 1365, openAi: "auto", geminiImageSize: "2K" },
};

export function resolveImageControls(input: Record<string, string>): ResolvedImageControls {
  const modeRaw = (input.image_dimension_mode || "").trim();
  const dimensionMode: ImageDimensionMode = modeRaw === "aspect" ? "aspect" : "size";

  const ratioRaw = (input.aspect_ratio || "").trim();
  const presetRaw = (input.output_size_preset || "").trim();

  const aspectPick: AspectRatioValue = isAspectRatioValue(ratioRaw) ? ratioRaw : DEFAULT_ASPECT_RATIO;
  const sizePreset: SizePresetValue = isSizePresetValue(presetRaw) ? presetRaw : DEFAULT_SIZE_PRESET;

  if (dimensionMode === "aspect") {
    const spec = ASPECT_OUTPUT_SPECS[aspectPick];
    const width = clampPx(spec.width);
    const height = clampPx(spec.height);
    const instruction = `Use aspect ratio ${aspectPick} as the output frame (approximately ${width}×${height}px). Do not crop to a conflicting aspect.`;
    return {
      dimensionMode,
      aspectRatio: aspectPick,
      sizePreset,
      width,
      height,
      outputAspectRatio: aspectPick,
      geminiImageSize: spec.geminiImageSize,
      openAiSize: spec.openAi,
      instruction,
    };
  }

  // Size-first: ignore user's aspect ratio toggle — geometry comes only from presets / custom / original.
  const customWidth = parsePositiveInt(input.custom_width);
  const customHeight = parsePositiveInt(input.custom_height);
  const sourceW = parsePositiveInt(input.source_width);
  const sourceH = parsePositiveInt(input.source_height);

  let width: number;
  let height: number;
  let openAiSize: OpenAiImageSizeParam;
  let instruction: string;

  if (sizePreset === "original") {
    if (sourceW && sourceH) {
      width = clampPx(sourceW);
      height = clampPx(sourceH);
      openAiSize = "auto";
      instruction = `Match the reference image dimensions (${width}×${height}px). Do not change canvas size unless the prompt explicitly asks to.`;
    } else {
      width = clampPx(DEFAULT_CUSTOM_WIDTH);
      height = clampPx(DEFAULT_CUSTOM_HEIGHT);
      openAiSize = "1024x1024";
      instruction =
        "Match reference image dimensions (preview dimensions unknown — defaulting to 1024×1024). Select the reference again or wait for the preview to load, then use Original for exact pixels.";
    }
  } else if (sizePreset === "custom") {
    width = clampPx(customWidth ?? DEFAULT_CUSTOM_WIDTH);
    height = clampPx(customHeight ?? DEFAULT_CUSTOM_HEIGHT);
    openAiSize = resolveOpenAiSize(width, height);
    instruction = `Target output resolution ${width}×${height}px (provider may round to a supported size).`;
  } else {
    const presetDims = SIZE_PRESET_OPTIONS.find((option) => option.value === sizePreset);
    width = clampPx(presetDims?.width ?? DEFAULT_CUSTOM_WIDTH);
    height = clampPx(presetDims?.height ?? DEFAULT_CUSTOM_HEIGHT);
    openAiSize = resolveOpenAiSize(width, height);
    instruction = `Target output resolution ${width}×${height}px (provider may round to a supported size).`;
  }

  const outputAspectRatio = snapToStandardAspectRatio(width, height);
  const geminiImageSize = geminiImageSizeFromLongEdge(Math.max(width, height));

  return {
    dimensionMode,
    aspectRatio: aspectPick,
    sizePreset,
    width,
    height,
    outputAspectRatio,
    geminiImageSize,
    openAiSize,
    instruction,
  };
}
