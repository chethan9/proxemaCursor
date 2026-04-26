import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/core";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Pencil, Loader2, Eye } from "lucide-react";
import { getTemplate, saveNewVersion, renameTemplate, createTemplate } from "@/services/templateService";
import { emptyDocument, type TemplateDocument } from "@/lib/templates/document";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthProvider";
import { wooExtensions } from "@/lib/templates/nodes";
import { WooBlocksToolbar } from "@/components/template-builder/WooBlocksToolbar";

import "@maily-to/core/style.css";

const MailyEditor = dynamic(
  () => import("@maily-to/core").then((m) => m.Editor),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> }
);

function BuilderInner() {
  const router = useRouter();
  const id = router.query.id as string;
  const isNew = id === "new";
  const newType = (router.query.type as string) === "pickslip" ? "pickslip" : "invoice";
  const qc = useQueryClient();
  const { toast } = useToast();
  const { profile } = useAuth();
  const creatingRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    if (!router.isReady || !isNew || creatingRef.current) return;
    if (!profile?.client_id) return;
    creatingRef.current = true;
    (async () => {
      try {
        const newId = await createTemplate({
          name: newType === "invoice" ? "Untitled invoice" : "Untitled pick slip",
          type: newType,
          clientId: profile.client_id as string,
        });
        router.replace(`/templates/${newId}`);
      } catch (e) {
        toast({ title: "Failed to create template", description: (e as Error).message, variant: "destructive" });
        router.replace("/templates");
      }
    })();
  }, [router.isReady, isNew, newType, profile?.client_id, router, toast]);

  const { data, isLoading } = useQuery({
    queryKey: ["template", id],
    queryFn: () => getTemplate(id),
    enabled: !!id && !isNew,
  });

  const [doc, setDoc] = useState<TemplateDocument>(emptyDocument());
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [dirty, setDirty] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (data && !initialized.current) {
      setName(data.template.name);
      if (data.version?.document) setDoc(data.version.document);
      initialized.current = true;
    }
  }, [data]);

  const handleEditorUpdate = useCallback((editor: Editor) => {
    editorRef.current = editor;
    const json = editor.getJSON();
    setDoc(json);
    setDirty(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => saveNewVersion(id, doc, {}),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["template", id] });
      toast({ title: "Template saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: async (newName: string) => renameTemplate(id, newName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template", id] }),
  });

  const openPreview = () => {
    window.open(`/api/templates/${id}/render?format=html&sample=1`, "_blank");
  };

  if (isNew || isLoading || !data) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const isSample = data.template.is_sample;

  return (
    <>
      <SEO title={`${name || "Template"} · Builder`} />
      <div className="h-screen flex flex-col bg-background">
        <div className="h-14 border-b border-border bg-card px-4 flex items-center gap-3 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/templates")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <Badge variant="outline" className="capitalize text-[10px]">{data.template.type}</Badge>
            {editingName ? (
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => { setEditingName(false); if (name !== data.template.name) renameMutation.mutate(name); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { setEditingName(false); if (name !== data.template.name) renameMutation.mutate(name); }
                  if (e.key === "Escape") { setName(data.template.name); setEditingName(false); }
                }}
                className="h-7 max-w-xs text-sm"
              />
            ) : (
              <button className="flex items-center gap-1.5 group" onClick={() => !isSample && setEditingName(true)} disabled={isSample}>
                <span className="text-sm font-semibold">{name}</span>
                {!isSample && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />}
              </button>
            )}
            {dirty && <span className="text-[10px] text-amber-600">• unsaved</span>}
            {isSample && <Badge variant="outline" className="h-5 text-[10px] border-amber-300 text-amber-800 bg-amber-50">Read-only sample</Badge>}
          </div>
          <Button size="sm" variant="outline" onClick={openPreview}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Preview
          </Button>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !dirty || isSample}>
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Save
          </Button>
        </div>

        <div className="flex-1 overflow-hidden bg-muted/30 flex flex-col">
          <WooBlocksToolbar editor={editorRef.current} />
          <div className="flex-1 overflow-auto">
            <div className="max-w-5xl mx-auto bg-background">
              <MailyEditor
                contentJson={doc}
                onUpdate={handleEditorUpdate}
                extensions={wooExtensions()}
                config={{ hasMenuBar: true, autofocus: false }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function TemplateBuilderPage() {
  return <AuthGuard><BuilderInner /></AuthGuard>;
}