import { supabase } from "@/integrations/supabase/client";

export type Locale = {
  code: string;
  name: string;
  native_name: string;
  dir: "ltr" | "rtl";
  enabled: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type Translation = {
  id: string;
  locale: string;
  namespace: string;
  key: string;
  value: string;
  needs_review: boolean;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

export async function listLocales(): Promise<Locale[]> {
  const { data, error } = await supabase
    .from("locales")
    .select("*")
    .order("is_default", { ascending: false })
    .order("code", { ascending: true });
  if (error) throw error;
  return (data || []) as Locale[];
}

export async function updateLocale(code: string, patch: Partial<Pick<Locale, "enabled" | "is_default" | "name" | "native_name" | "dir">>): Promise<Locale> {
  if (patch.is_default === true) {
    await supabase.from("locales").update({ is_default: false }).neq("code", code);
  }
  const { data, error } = await supabase
    .from("locales")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("code", code)
    .select()
    .single();
  if (error) throw error;
  return data as Locale;
}

export async function listTranslations(locale: string, namespace?: string): Promise<Translation[]> {
  let query = supabase.from("translations").select("*").eq("locale", locale);
  if (namespace) query = query.eq("namespace", namespace);
  const { data, error } = await query.order("namespace").order("key");
  if (error) throw error;
  return (data || []) as Translation[];
}

export async function upsertTranslation(input: {
  locale: string;
  namespace: string;
  key: string;
  value: string;
  needs_review?: boolean;
}): Promise<Translation> {
  const { data, error } = await supabase
    .from("translations")
    .upsert(
      {
        locale: input.locale,
        namespace: input.namespace,
        key: input.key,
        value: input.value,
        needs_review: input.needs_review ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "locale,namespace,key" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Translation;
}

export async function deleteTranslation(id: string): Promise<void> {
  const { error } = await supabase.from("translations").delete().eq("id", id);
  if (error) throw error;
}

export async function bulkImportTranslations(locale: string, namespace: string, json: Record<string, unknown>): Promise<{ inserted: number; updated: number }> {
  const flat: { key: string; value: string }[] = [];
  const flatten = (obj: Record<string, unknown>, prefix = "") => {
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        flatten(v as Record<string, unknown>, fullKey);
      } else if (typeof v === "string") {
        flat.push({ key: fullKey, value: v });
      }
    }
  };
  flatten(json);

  const rows = flat.map((f) => ({
    locale,
    namespace,
    key: f.key,
    value: f.value,
    needs_review: false,
  }));

  if (rows.length === 0) return { inserted: 0, updated: 0 };

  const { error } = await supabase.from("translations").upsert(rows, { onConflict: "locale,namespace,key" });
  if (error) throw error;
  return { inserted: rows.length, updated: 0 };
}