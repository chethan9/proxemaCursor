import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragOverlay, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { AuthGuard } from "@/components/AuthGuard";
import { ElementsPanel } from "@/components/template-builder/ElementsPanel";
import { Canvas } from "@/components/template-builder/Canvas";
import { PreviewPane } from "@/components/template-builder/PreviewPane";
import { PropertyInspector } from "@/components/template-builder/PropertyInspector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Pencil, Loader2 } from "lucide-react";
import { getTemplate, saveNewVersion, renameTemplate, createTemplate } from "@/services/templateService";
import { defaultStyles, emptyDocument, type AnyBlock, type BlockType, type TemplateDocument, type DocumentStyles } from "@/lib/templates/document";
import { createBlock } from "@/lib/templates/block-defaults";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { cn } from "@/lib/utils";

function findAndUpdate(blocks: AnyBlock[], id: string, fn: (b: AnyBlock) => AnyBlock): AnyBlock[] {
  return blocks.map((b) => (b.id === id ? fn(b) : b));
}
function findAndRemove(blocks: AnyBlock[], id: string): AnyBlock[] {
  return blocks.filter((b) => b.id !== id);
}
function findBlock(blocks: AnyBlock[], id: string): AnyBlock | null {
  return blocks.find((b) => b.id === id) ?? null;
}

function BuilderInner() {
  const router = useRouter();
  const id = router.query.id as string;
  const isNew = id === "new";
  const newType = (router.query.type as string) === "pickslip" ? "pickslip" : "invoice";
  const qc = useQueryClient();
  const { toast } = useToast();
  const creatingRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || !isNew || creatingRef.current) return;
    creatingRef.current = true;
    (async () => {
      try {
        const created = await createTemplate({
          name: newType === "invoice" ? "Untitled invoice" : "Untitled pick slip",
          type: newType,
        });
        router.replace(`/templates/${created.id}`);
      } catch (e) {
        toast({ title: "Failed to create template", description: (e as Error).message, variant: "destructive" });
        router.replace("/templates");
      }
    })();
  }, [router.isReady, isNew, newType, router, toast]);

  const { data, isLoading } = useQuery({
    queryKey: ["template", id],
    queryFn: () => getTemplate(id),
    enabled: !!id && !isNew,
  });

  const [doc, setDoc] = useState<TemplateDocument>(emptyDocument());
  const [styles, setStyles] = useState<DocumentStyles>(defaultStyles());
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (data && !initialized.current) {
      setName(data.template.name);
      if (data.version) {
        setDoc(data.version.document);
        setStyles(data.version.styles);
      }
      initialized.current = true;
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => saveNewVersion(id, doc, styles),
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

  const updateBlocks = useCallback((updater: (blocks: AnyBlock[]) => AnyBlock[]) => {
    setDoc((d) => ({ ...d, blocks: updater(d.blocks) }));
    setDirty(true);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const fromLib = String(active.id).startsWith("lib-");
    if (fromLib) {
      const blockType = active.data.current?.blockType as BlockType;
      if (!blockType) return;
      const newBlock = createBlock(blockType);
      if (over.id === "canvas-root") {
        updateBlocks((bs) => [...bs, newBlock]);
      } else {
        updateBlocks((bs) => {
          const idx = bs.findIndex((b) => b.id === over.id);
          if (idx === -1) return [...bs, newBlock];
          return [...bs.slice(0, idx + 1), newBlock, ...bs.slice(idx + 1)];
        });
      }
      setSelectedId(newBlock.id);
    } else {
      if (active.id === over.id) return;
      updateBlocks((bs) => {
        const oldIdx = bs.findIndex((b) => b.id === active.id);
        const newIdx = bs.findIndex((b) => b.id === over.id);
        if (oldIdx < 0 || newIdx < 0) return bs;
        return arrayMove(bs, oldIdx, newIdx);
      });
    }
  };

  const updateSelectedProps = (updates: Partial<AnyBlock["props"]>) => {
    if (!selectedId) return;
    updateBlocks((bs) => findAndUpdate(bs, selectedId, (b) => ({ ...b, props: { ...b.props, ...updates } } as AnyBlock)));
  };

  const deleteBlock = (blockId: string) => {
    updateBlocks((bs) => findAndRemove(bs, blockId));
    if (selectedId === blockId) setSelectedId(null);
  };

  const duplicateBlock = (blockId: string) => {
    updateBlocks((bs) => {
      const idx = bs.findIndex((b) => b.id === blockId);
      if (idx === -1) return bs;
      const orig = bs[idx];
      const clone = { ...orig, id: `${orig.id}_${Date.now().toString(36)}` } as AnyBlock;
      return [...bs.slice(0, idx + 1), clone, ...bs.slice(idx + 1)];
    });
  };

  const selectedBlock = selectedId ? findBlock(doc.blocks, selectedId) : null;

  if (isNew || isLoading || !data) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const isSample = data.template.is_sample;

  return (
    <>
      <SEO title={`${name || "Template"} · Builder`} />
      <div className="h-screen flex flex-col bg-background">
        <div className="h-12 border-b border-border bg-card px-3 flex items-center gap-3 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/templates")}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex items-center gap-2 flex-1">
            <Badge variant="outline" className="capitalize text-[10px]">{data.template.type}</Badge>
            {editingName ? (
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => { setEditingName(false); if (name !== data.template.name) renameMutation.mutate(name); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setEditingName(false); if (name !== data.template.name) renameMutation.mutate(name); } if (e.key === "Escape") { setName(data.template.name); setEditingName(false); } }}
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
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !dirty || isSample}>
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Save
          </Button>
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex-1 flex overflow-hidden">
            <div className={cn("w-[260px] border-r border-border bg-card shrink-0")}>
              {selectedBlock ? (
                <PropertyInspector block={selectedBlock} onChange={updateSelectedProps} onBack={() => setSelectedId(null)} />
              ) : (
                <ElementsPanel />
              )}
            </div>
            <Canvas
              doc={doc}
              styles={styles}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDelete={deleteBlock}
              onDuplicate={duplicateBlock}
              width={720}
            />
            <div className="w-[420px] border-l border-border shrink-0">
              <PreviewPane doc={doc} styles={styles} />
            </div>
          </div>
          <DragOverlay />
        </DndContext>
      </div>
    </>
  );
}

export default function TemplateBuilderPage() {
  return <AuthGuard><BuilderInner /></AuthGuard>;
}