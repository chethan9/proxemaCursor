import { supabase } from "@/integrations/supabase/client";

export type ViewPreferences = Record<string, unknown>;

export async function fetchPreferences(viewKey: string): Promise<ViewPreferences | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("user_view_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .eq("view_key", viewKey)
    .maybeSingle();
  if (error || !data) return null;
  return (data.preferences as ViewPreferences) || null;
}

export async function savePreferences(viewKey: string, preferences: ViewPreferences): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("user_view_preferences")
    .upsert(
      { user_id: user.id, view_key: viewKey, preferences, updated_at: new Date().toISOString() },
      { onConflict: "user_id,view_key" }
    );
}