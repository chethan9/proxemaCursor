import { supabase } from "@/integrations/supabase/client";
import { emptyDocument, defaultStyles, type TemplateDocument, type DocumentStyles, type TemplateRow, type TemplateVersionRow, type TemplateType } from "@/lib/templates/document";

export async function listTemplates(type?: TemplateType): Promise<TemplateRow[]> {
  let q = supabase.from("templates").select("*").order("is_sample", { ascending: false }).order("created_at", { ascending: false });
  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as TemplateRow[];
}

export async function getTemplate(id: string): Promise<{ template: TemplateRow; version: TemplateVersionRow | null }> {
  const { data: tpl, error: e1 } = await supabase.from("templates").select("*").eq("id", id).single();
  if (e1) throw e1;
  let version: TemplateVersionRow | null = null;
  const tplRow = tpl as unknown as TemplateRow;
  if (tplRow.current_version_id) {
    const { data: ver, error: e2 } = await supabase.from("template_versions").select("*").eq("id", tplRow.current_version_id).single();
    if (e2) throw e2;
    version = ver as unknown as TemplateVersionRow;
  }
  return { template: tplRow, version };
}

export async function createTemplate(input: { name: string; type: TemplateType; description?: string; clientId: string; document?: TemplateDocument; styles?: DocumentStyles }): Promise<string> {
  const { data: tpl, error: e1 } = await supabase.from("templates").insert({
    name: input.name,
    type: input.type,
    description: input.description ?? null,
    client_id: input.clientId,
    is_sample: false,
  }).select("*").single();
  if (e1) throw e1;
  const tplId = (tpl as { id: string }).id;
  const verPayload = {
    template_id: tplId,
    version_number: 1,
    document: (input.document ?? emptyDocument()) as unknown as Record<string, unknown>,
    styles: (input.styles ?? defaultStyles()) as unknown as Record<string, unknown>,
  };
  const { data: ver, error: e2 } = await supabase.from("template_versions").insert(verPayload as never).select("*").single();
  if (e2) throw e2;
  await supabase.from("templates").update({ current_version_id: (ver as { id: string }).id }).eq("id", tplId);
  return tplId;
}

export async function forkSampleTemplate(sampleId: string, clientId: string, newName?: string): Promise<string> {
  const { template, version } = await getTemplate(sampleId);
  if (!template.is_sample) throw new Error("Not a sample template");
  return createTemplate({
    name: newName ?? `Copy of ${template.name}`,
    type: template.type,
    description: template.description ?? undefined,
    clientId,
    document: version?.document ?? emptyDocument(),
    styles: version?.styles ?? defaultStyles(),
  });
}

export async function saveNewVersion(templateId: string, document: TemplateDocument, styles: DocumentStyles, changeNote?: string): Promise<string> {
  const { data: latest } = await supabase.from("template_versions").select("version_number").eq("template_id", templateId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const nextVersion = ((latest as { version_number?: number } | null)?.version_number ?? 0) + 1;
  const verPayload = {
    template_id: templateId,
    version_number: nextVersion,
    document: document as unknown as Record<string, unknown>,
    styles: styles as unknown as Record<string, unknown>,
    change_note: changeNote ?? null,
  };
  const { data: ver, error } = await supabase.from("template_versions").insert(verPayload as never).select("*").single();
  if (error) throw error;
  await supabase.from("templates").update({ current_version_id: (ver as { id: string }).id, updated_at: new Date().toISOString() }).eq("id", templateId);
  return (ver as { id: string }).id;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("templates").delete().eq("id", id);
  if (error) throw error;
}

export async function renameTemplate(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("templates").update({ name, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function setDefaultForType(clientId: string, type: TemplateType, templateId: string): Promise<void> {
  await supabase.from("templates").update({ is_default_for_type: false }).eq("client_id", clientId).eq("type", type);
  const { error } = await supabase.from("templates").update({ is_default_for_type: true }).eq("id", templateId);
  if (error) throw error;
}