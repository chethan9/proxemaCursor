export type LocaleCode = "en" | "ar" | "es" | "fr" | "de" | "pt" | "hi" | "zh" | "ja" | "ru";

export interface LocaleMeta {
  code: LocaleCode;
  name: string;
  nativeName: string;
  dir: "ltr" | "rtl";
}

export const LOCALES: LocaleMeta[] = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr" },
  { code: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl" },
  { code: "es", name: "Spanish", nativeName: "Español", dir: "ltr" },
  { code: "fr", name: "French", nativeName: "Français", dir: "ltr" },
  { code: "de", name: "German", nativeName: "Deutsch", dir: "ltr" },
  { code: "pt", name: "Portuguese", nativeName: "Português", dir: "ltr" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", dir: "ltr" },
  { code: "ja", name: "Japanese", nativeName: "日本語", dir: "ltr" },
  { code: "ru", name: "Russian", nativeName: "Русский", dir: "ltr" },
];

export const ALL_LOCALE_CODES: LocaleCode[] = LOCALES.map((l) => l.code);

export const DEFAULT_LOCALE: LocaleCode = "en";

// Must match the actual JSON files in public/locales/{code}/*.json
export const NAMESPACES = ["common", "auth", "site", "pricing", "billing", "admin", "settings", "referrals"] as const;
export type Namespace = typeof NAMESPACES[number];

export function getLocaleMeta(code: string | undefined): LocaleMeta {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

export function isRtl(code: string | undefined): boolean {
  return getLocaleMeta(code).dir === "rtl";
}