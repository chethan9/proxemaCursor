import { useState } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listTemplates, forkSampleTemplate, deleteTemplate, setDefaultForType } from "@/services/templateService";
import { useAuth } from "@/contexts/AuthProvider";
import { FileText, Receipt, Plus, Search, Sparkles, MoreVertical, Copy, Trash2, Pencil, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TemplateType, TemplateRow } from "@/lib/templates/document";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { SEO } from "@/components/SEO";

const TYPE_META: Record<"invoice" | "pickslip", { label: string; icon: typeof FileText; description: string }> = {
  invoice: { label: "Invoices", icon: Receipt, description: "Customer-facing PDFs sent or downloaded with orders." },
  pickslip: { label: "Pick Slips", icon: FileText, description: "Warehouse documents for fulfillment and packing." },
};

function TemplatesInner() {
  const router = useRouter();
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? null;
  const [activeType, setActiveType] = useState<"invoice" | "pickslip">("invoice");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates", activeType],
    queryFn: () => listTemplates(activeType),
  });

  const forkMutation = useMutation({
    mutationFn: async (sampleId: string) => {
      if (!clientId) throw new Error("No client");
      return forkSampleTemplate(sampleId, clientId);
    },
    onSuccess: (newId) => {
      toast({ title: "Template copied", description: "Opening editor…" });
      qc.invalidateQueries({ queryKey: ["templates"] });
      router.push(`/templates/${newId}`);
    },
    onError: (e: Error) => toast({ title: "Could not fork", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      toast({ title: "Template deleted" });
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: "invoice" | "pickslip" }) => {
      if (!clientId) throw new Error("No client");
      return setDefaultForType(clientId, type, id);
    },
    onSuccess: () => {
      toast({ title: "Default updated" });
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const filtered = templates.filter((t) => !search.trim() || t.name.toLowerCase().includes(search.toLowerCase()));
  const samples = filtered.filter((t) => t.is_sample);
  const custom = filtered.filter((t) => !t.is_sample);
  const meta = TYPE_META[activeType];
  const TypeIcon = meta.icon;

  return (
    <>
      <SEO title="Templates · WooSync" />
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
            <p className="text-sm text-muted-foreground mt-1">Design invoice and pick-slip layouts. Start from a sample or build your own.</p>
          </div>
          <Button onClick={() => router.push(`/templates/new?type=${activeType}`)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New template
          </Button>
        </div>

        <Tabs value={activeType} onValueChange={(v) => setActiveType(v as "invoice" | "pickslip")} className="w-full">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="invoice" className="gap-1.5"><Receipt className="h-3.5 w-3.5" /> Invoices</TabsTrigger>
            <TabsTrigger value="pickslip" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Pick Slips</TabsTrigger>
          </TabsList>

          {(["invoice", "pickslip"] as const).map((type) => (
            <TabsContent key={type} value={type} className="mt-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-muted-foreground">{TYPE_META[type].description}</div>
                <div className="relative w-72">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…" className="pl-8 h-9" />
                </div>
              </div>

              {isLoading ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
              ) : (
                <div className="space-y-8">
                  {samples.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <h2 className="text-sm font-semibold">Sample templates</h2>
                        <span className="text-xs text-muted-foreground">— ready to use or customize</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {samples.map((t) => (
                          <TemplateCard key={t.id} t={t} onUse={() => router.push(`/templates/${t.id}`)} onFork={() => forkMutation.mutate(t.id)} onDelete={() => deleteMutation.mutate(t.id)} onSetDefault={() => setDefaultMutation.mutate({ id: t.id, type: t.type as "invoice" | "pickslip" })} forking={forkMutation.isPending} />
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className="text-sm font-semibold">Your templates</h2>
                      <span className="text-xs text-muted-foreground">— custom designs</span>
                    </div>
                    {custom.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
                        <TypeIcon className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                        <h3 className="text-sm font-semibold mb-1">No custom {TYPE_META[type].label.toLowerCase()} yet</h3>
                        <p className="text-xs text-muted-foreground mb-4">Start from a sample above to customize, or build one from scratch.</p>
                        <Button size="sm" variant="outline" onClick={() => router.push(`/templates/new?type=${type}`)}><Plus className="h-3.5 w-3.5 mr-1.5" /> Build from scratch</Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {custom.map((t) => (
                          <TemplateCard key={t.id} t={t} onUse={() => router.push(`/templates/${t.id}`)} onFork={() => forkMutation.mutate(t.id)} onDelete={() => deleteMutation.mutate(t.id)} onSetDefault={() => setDefaultMutation.mutate({ id: t.id, type: t.type as "invoice" | "pickslip" })} forking={forkMutation.isPending} />
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  );
}

function TemplateCard({ t, onUse, onFork, onDelete, onSetDefault, forking }: { t: TemplateRow; onUse: () => void; onFork: () => void; onDelete: () => void; onSetDefault: () => void; forking: boolean }) {
  return (
    <div className="group rounded-md border border-border bg-card hover:border-foreground/20 hover:shadow-sm transition-all overflow-hidden">
      <div className="aspect-[4/5] bg-muted/40 flex items-center justify-center border-b border-border relative">
        <FileText className="h-6 w-6 text-muted-foreground/40" />
        {t.is_default_for_type && (
          <div className="absolute top-1 right-1 flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-medium">
            <Star className="h-2 w-2 fill-amber-500 text-amber-500" /> Default
          </div>
        )}
      </div>
      <div className="p-2">
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <h3 className="text-xs font-semibold truncate leading-tight">{t.name}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 -mr-1 -mt-0.5 shrink-0"><MoreVertical className="h-3 w-3" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {t.is_sample ? (
                <DropdownMenuItem onClick={onFork} disabled={forking}><Copy className="h-3.5 w-3.5 mr-2" /> Customize a copy</DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={onUse}><Pencil className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={onSetDefault} disabled={t.is_default_for_type}><Star className={`h-3.5 w-3.5 mr-2 ${t.is_default_for_type ? "fill-amber-500 text-amber-500" : ""}`} /> {t.is_default_for_type ? "Default template" : "Set as default"}</DropdownMenuItem>
                  <DropdownMenuItem onClick={onFork} disabled={forking}><Copy className="h-3.5 w-3.5 mr-2" /> Duplicate</DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1 mb-2">
          {t.is_sample ? <Badge variant="outline" className="h-4 text-[9px] gap-0.5 px-1 border-amber-300 text-amber-800 bg-amber-50"><Sparkles className="h-2 w-2" /> Sample</Badge> : <Badge variant="outline" className="h-4 text-[9px] px-1">Custom</Badge>}
          <span className="text-[9px] text-muted-foreground">{format(new Date(t.updated_at), "MMM d")}</span>
        </div>
        {t.is_sample ? (
          <Button size="sm" variant="outline" className="w-full h-6 text-[10px]" onClick={onFork} disabled={forking}>
            {forking ? "Copying…" : "Customize"}
          </Button>
        ) : (
          <Button size="sm" className="w-full h-6 text-[10px]" onClick={onUse}>Edit</Button>
        )}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <AuthGuard>
      <AppLayout><TemplatesInner /></AppLayout>
    </AuthGuard>
  );
}