import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/components/AuthGuard";
import { Loader2 } from "lucide-react";
import { getTemplate, saveNewVersion, renameTemplate, createTemplate, setDefaultForType } from "@/services/templateService";
import { blankInvoiceHtml, blankPickslipHtml, blankReportHtml, type TemplateConfig } from "@/lib/templates/document";
import { VARIABLE_GROUPS } from "@/lib/templates/templateVariableGroups";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthProvider";
import { TemplateBuilderShell } from "@/components/templates/builder/TemplateBuilderShell";

function BuilderInner() {
  const router = useRouter();
  const id = router.query.id as string;
  const isNew = id === "new";
  const rawType = router.query.type as string;
  const newType =
    rawType === "pickslip" ? "pickslip" : rawType === "report" ? "report" : "invoice";
  const qc = useQueryClient();
  const { toast } = useToast();
  const { profile } = useAuth();
  const creatingRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || !isNew || creatingRef.current) return;
    if (!profile?.client_id) return;
    creatingRef.current = true;
    (async () => {
      try {
        const defaultName =
          newType === "pickslip" ? "Untitled pick slip" : newType === "report" ? "Untitled report" : "Main Invoice";
        const defaultHtml =
          newType === "pickslip" ? blankPickslipHtml() : newType === "report" ? blankReportHtml() : blankInvoiceHtml();
        const newId = await createTemplate({
          name: defaultName,
          type: newType,
          clientId: profile.client_id as string,
          html: defaultHtml,
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

  const [document, setDocument] = useState<TemplateConfig>({ html: "" });
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const initialized = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initialized.current = false;
  }, [id]);

  useEffect(() => {
    if (data && !initialized.current) {
      setName(data.template.name);
      const cfg = (data.version?.document as TemplateConfig | undefined) ?? { html: "" };
      setDocument({
        html: cfg.html ?? "",
        css: cfg.css,
        grapesProject: cfg.grapesProject,
        filenamePattern: cfg.filenamePattern,
        page: cfg.page,
      });
      initialized.current = true;
    }
  }, [data]);

  useEffect(() => {
    if (!dirty) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPreviewKey((k) => k + 1), 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [document.html, dirty]);

  const saveMutation = useMutation({
    mutationFn: async () => saveNewVersion(id, document),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["template", id] });
      qc.invalidateQueries({ queryKey: ["templates"] });
      setPreviewKey((k) => k + 1);
      toast({ title: "Template saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: async (newName: string) => renameTemplate(id, newName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template", id] }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.client_id || !data) return;
      await setDefaultForType(profile.client_id as string, data.template.type, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["template", id] });
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Set as default" });
    },
  });

  const previewSrc = useMemo(() => `/api/templates/${id}/render?format=html&sample=1&_=${previewKey}`, [id, previewKey]);

  const variableGroups = useMemo(
    () =>
      data?.template.type === "report"
        ? VARIABLE_GROUPS
        : VARIABLE_GROUPS.filter((g) => g.label !== "Report (report templates)"),
    [data?.template.type],
  );

  const copyToken = (token: string) => {
    navigator.clipboard?.writeText(token).catch(() => {});
    toast({ title: "Copied", description: token });
  };

  if (isNew || isLoading || !data) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const isSample = data.template.is_sample;
  const canvasKey = `${data.version?.id ?? id}`;

  return (
    <>
      <SEO title={`${name || "Template"} · Editor`} />
      <TemplateBuilderShell
        canvasKey={canvasKey}
        document={document}
        onDocumentSnapshot={(doc) => {
          setDocument(doc);
          setDirty(true);
        }}
        readOnly={isSample}
        name={name}
        editingName={editingName}
        onEditingNameChange={setEditingName}
        onNameChange={setName}
        onNameCommit={() => {
          setEditingName(false);
          if (name !== data.template.name) renameMutation.mutate(name);
        }}
        onNameCancel={() => {
          setName(data.template.name);
          setEditingName(false);
        }}
        templateType={data.template.type}
        dirty={dirty}
        isSample={isSample}
        isDefaultForType={data.template.is_default_for_type}
        onBack={() => router.push("/templates")}
        onSave={() => saveMutation.mutate()}
        onSaveAndClose={() => {
          void (async () => {
            try {
              if (dirty) await saveMutation.mutateAsync();
              await router.push("/templates");
            } catch {
              /* mutation surfaces toast */
            }
          })();
        }}
        savePending={saveMutation.isPending}
        onRefreshPreview={() => setPreviewKey((k) => k + 1)}
        onDownloadPdf={() => window.open(`/api/templates/${id}/render?format=pdf&sample=1`, "_blank")}
        pdfDisabled={dirty}
        onSetDefault={() => setDefaultMutation.mutate()}
        setDefaultPending={setDefaultMutation.isPending}
        previewSrc={previewSrc}
        previewKey={previewKey}
        onOpenPreviewInTab={() => window.open(previewSrc, "_blank")}
        variableGroups={variableGroups}
        onCopyToken={copyToken}
        onFilenamePatternChange={(pattern) => {
          setDocument((d) => ({ ...d, filenamePattern: pattern }));
          setDirty(true);
        }}
      />
    </>
  );
}

export default function TemplateEditorPage() {
  return (
    <AuthGuard>
      <BuilderInner />
    </AuthGuard>
  );
}
