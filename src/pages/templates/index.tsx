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
import { FileText, Receipt, Plus, Search, Sparkles, MoreVertical, Copy, Trash2, Pencil, Star, BarChart2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TemplateRow, TemplateType } from "@/lib/templates/document";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { SEO } from "@/components/SEO";
import { useBranding } from "@/contexts/BrandingProvider";

const TYPE_META: Record<
  "invoice" | "pickslip" | "report",
  { label: string; icon: typeof FileText; description: string }
> = {
  invoice: { label: "Invoices", icon: Receipt, description: "Customer-facing PDFs sent or downloaded with orders." },
  pickslip: { label: "Pick Slips", icon: FileText, description: "Warehouse documents for fulfillment and packing." },
  report: { label: "Reports", icon: BarChart2, description: "PDF summaries and tabular sales reports from store orders." },
};

function TemplatesInner() {
  const router = useRouter();
  const { brandName } = useBranding();
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? null;
  const [activeType, setActiveType] = useState<"invoice" | "pickslip" | "report">("invoice");
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
    mutationFn: ({ id, type }: { id: string; type: TemplateType }) => {
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
      <SEO title={`Templates · ${brandName}`} />
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-10">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">PDF templates</h1>
            <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
              Build invoice, pick slip, and report layouts. Start from a polished sample or create a blank template—then open the visual editor.
            </p>
          </div>
          <Button onClick={() => router.push(`/templates/new?type=${activeType}`)} className="gap-2 shrink-0 shadow-sm h-10 px-5">
            <Plus className="h-4 w-4" /> New template
          </Button>
        </div>

        <Tabs value={activeType} onValueChange={(v) => setActiveType(v as "invoice" | "pickslip" | "report")} className="w-full">
          <TabsList className="bg-slate-100/80 border border-slate-200/80 flex-wrap h-auto gap-1 py-1.5 px-1 rounded-xl">
            <TabsTrigger value="invoice" className="gap-1.5"><Receipt className="h-3.5 w-3.5" /> Invoices</TabsTrigger>
            <TabsTrigger value="pickslip" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Pick Slips</TabsTrigger>
            <TabsTrigger value="report" className="gap-1.5"><BarChart2 className="h-3.5 w-3.5" /> Reports</TabsTrigger>
          </TabsList>

          {(["invoice", "pickslip", "report"] as const).map((type) => (
            <TabsContent key={type} value={type} className="mt-8 focus-visible:outline-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <p className="text-sm text-slate-500">{TYPE_META[type].description}</p>
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" className="pl-10 h-10 border-slate-200 bg-white shadow-sm" />
                </div>
              </div>

              {isLoading ? (
                <div className="text-sm text-slate-500 py-16 text-center">Loading templates…</div>
              ) : (
                <div className="space-y-12">
                  {samples.length > 0 && (
                    <section className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 md:p-8">
                      <div className="flex flex-wrap items-center gap-2 mb-6">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <h2 className="text-base font-semibold text-slate-900">Starter layouts</h2>
                        <span className="text-xs text-slate-500">Duplicate to customize</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                        {samples.map((t) => (
                          <TemplateCard key={t.id} t={t} onUse={() => router.push(`/templates/${t.id}`)} onFork={() => forkMutation.mutate(t.id)} onDelete={() => deleteMutation.mutate(t.id)} onSetDefault={() => setDefaultMutation.mutate({ id: t.id, type: t.type as TemplateType })} forking={forkMutation.isPending} />
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
                    <div className="flex items-center gap-2 mb-6">
                      <h2 className="text-base font-semibold text-slate-900">Your templates</h2>
                      <span className="text-xs text-slate-500">Saved to your workspace</span>
                    </div>
                    {custom.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center max-w-lg mx-auto shadow-sm">
                        <TypeIcon className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <h3 className="text-sm font-semibold text-slate-900 mb-1">No custom {TYPE_META[type].label.toLowerCase()} yet</h3>
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed">Duplicate a starter above or create a blank template to open the editor.</p>
                        <Button size="sm" variant="outline" className="border-slate-200" onClick={() => router.push(`/templates/new?type=${type}`)}><Plus className="h-3.5 w-3.5 mr-1.5" /> Blank template</Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                        {custom.map((t) => (
                          <TemplateCard key={t.id} t={t} onUse={() => router.push(`/templates/${t.id}`)} onFork={() => forkMutation.mutate(t.id)} onDelete={() => deleteMutation.mutate(t.id)} onSetDefault={() => setDefaultMutation.mutate({ id: t.id, type: t.type as TemplateType })} forking={forkMutation.isPending} />
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
      </div>
    </>
  );
}

function TemplateCard({ t, onUse, onFork, onDelete, onSetDefault, forking }: { t: TemplateRow; onUse: () => void; onFork: () => void; onDelete: () => void; onSetDefault: () => void; forking: boolean }) {
  return (
    <div className="group rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all overflow-hidden shadow-sm">
      <div className="aspect-[3/4] bg-gradient-to-b from-slate-50 to-white flex items-center justify-center border-b border-slate-100 relative">
        <FileText className="h-10 w-10 text-slate-200 group-hover:text-slate-300 transition-colors" />
        {t.is_default_for_type && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-900 text-[10px] font-medium border border-amber-100 shadow-sm">
            <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Default
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-1 mb-1">
          <h3 className="text-sm font-semibold truncate leading-snug text-slate-900">{t.name}</h3>
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
        <div className="flex items-center gap-1.5 mb-3">
          {t.is_sample ? <Badge variant="outline" className="h-5 text-[10px] gap-0.5 px-1.5 border-amber-200 text-amber-900 bg-amber-50/80"><Sparkles className="h-2.5 w-2.5" /> Sample</Badge> : <Badge variant="outline" className="h-5 text-[10px] px-1.5 border-slate-200 text-slate-600">Custom</Badge>}
          <span className="text-[10px] text-slate-400">{format(new Date(t.updated_at), "MMM d, yyyy")}</span>
        </div>
        {t.is_sample ? (
          <Button size="sm" variant="outline" className="w-full h-9 text-xs border-slate-200" onClick={onFork} disabled={forking}>
            {forking ? "Copying…" : "Customize"}
          </Button>
        ) : (
          <Button size="sm" className="w-full h-9 text-xs shadow-sm" onClick={onUse}>Edit</Button>
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