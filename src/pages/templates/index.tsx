import { useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
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

const TYPE_ICON = {
  invoice: Receipt,
  pickslip: FileText,
  report: BarChart2,
} as const;

function TemplatesInner() {
  const router = useRouter();
  const { t } = useTranslation("common");
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
      toast({ title: t("templatesPage.toastCopied"), description: t("templatesPage.toastCopiedDesc") });
      qc.invalidateQueries({ queryKey: ["templates"] });
      router.push(`/templates/${newId}`);
    },
    onError: (e: Error) => toast({ title: t("templatesPage.toastForkFail"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      toast({ title: t("templatesPage.toastDeleted") });
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (e: Error) => toast({ title: t("templatesPage.toastDeleteFail"), description: e.message, variant: "destructive" }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: TemplateType }) => {
      if (!clientId) throw new Error("No client");
      return setDefaultForType(clientId, type, id);
    },
    onSuccess: () => {
      toast({ title: t("templatesPage.toastDefaultUpdated") });
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (e: Error) => toast({ title: t("templatesPage.toastFailed"), description: e.message, variant: "destructive" }),
  });

  const filtered = templates.filter((row) => !search.trim() || row.name.toLowerCase().includes(search.toLowerCase()));
  const samples = filtered.filter((row) => row.is_sample);
  const custom = filtered.filter((row) => !row.is_sample);
  const typeDesc = (type: "invoice" | "pickslip" | "report") =>
    type === "invoice" ? t("templatesPage.typeDescInvoice") : type === "pickslip" ? t("templatesPage.typeDescPickslip") : t("templatesPage.typeDescReport");

  const typeNoun = (type: "invoice" | "pickslip" | "report") =>
    type === "invoice" ? t("templatesPage.typeInvoice") : type === "pickslip" ? t("templatesPage.typePickslip") : t("templatesPage.typeReport");

  return (
    <>
      <SEO title={t("templatesPage.seoTitle", { brand: brandName })} />
      <div className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t("templatesPage.title")}</h1>
            <p className="text-xs text-slate-500 max-w-lg leading-snug">
              {t("templatesPage.subtitle")}
            </p>
          </div>
          <Button onClick={() => router.push(`/templates/new?type=${activeType}`)} size="sm" className="gap-1.5 shrink-0 h-9">
            <Plus className="h-3.5 w-3.5" /> {t("templatesPage.newTemplate")}
          </Button>
        </div>

        <Tabs value={activeType} onValueChange={(v) => setActiveType(v as "invoice" | "pickslip" | "report")} className="w-full">
          <TabsList className="bg-slate-100/80 border border-slate-200/80 flex-wrap h-auto gap-0.5 py-1 px-1 rounded-lg text-sm">
            <TabsTrigger value="invoice" className="gap-1.5"><Receipt className="h-3.5 w-3.5" /> {t("templatesPage.tabInvoice")}</TabsTrigger>
            <TabsTrigger value="pickslip" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> {t("templatesPage.tabPickslip")}</TabsTrigger>
            <TabsTrigger value="report" className="gap-1.5"><BarChart2 className="h-3.5 w-3.5" /> {t("templatesPage.tabReport")}</TabsTrigger>
          </TabsList>

          {(["invoice", "pickslip", "report"] as const).map((type) => {
            const TabIcon = TYPE_ICON[type];
            return (
            <TabsContent key={type} value={type} className="mt-5 focus-visible:outline-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <p className="text-xs text-slate-500 max-w-md">{typeDesc(type)}</p>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("templatesPage.searchPlaceholder")} className="ps-9 h-9 text-sm border-slate-200 bg-white" />
                </div>
              </div>

              {isLoading ? (
                <div className="text-sm text-slate-500 py-12 text-center">{t("templatesPage.loading")}</div>
              ) : (
                <div className="space-y-8">
                  {samples.length > 0 && (
                    <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <h2 className="text-sm font-semibold text-slate-900">{t("templatesPage.starterSection")}</h2>
                        <span className="text-[11px] text-slate-500">{t("templatesPage.starterHint")}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {samples.map((tpl) => (
                          <TemplateCard key={tpl.id} template={tpl} onUse={() => router.push(`/templates/${tpl.id}`)} onFork={() => forkMutation.mutate(tpl.id)} onDelete={() => deleteMutation.mutate(tpl.id)} onSetDefault={() => setDefaultMutation.mutate({ id: tpl.id, type: tpl.type as TemplateType })} forking={forkMutation.isPending} />
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-sm font-semibold text-slate-900">{t("templatesPage.yourTemplates")}</h2>
                      <span className="text-[11px] text-slate-500">{t("templatesPage.workspace")}</span>
                    </div>
                    {custom.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center max-w-md mx-auto">
                        <TabIcon className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <h3 className="text-sm font-medium text-slate-900 mb-1">{t("templatesPage.noCustom", { type: typeNoun(type) })}</h3>
                        <p className="text-[11px] text-slate-500 mb-4">{t("templatesPage.noCustomHint")}</p>
                        <Button size="sm" variant="outline" className="border-slate-200 h-8 text-xs" onClick={() => router.push(`/templates/new?type=${type}`)}><Plus className="h-3 w-3 me-1" /> {t("templatesPage.blankTemplate")}</Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {custom.map((tpl) => (
                          <TemplateCard key={tpl.id} template={tpl} onUse={() => router.push(`/templates/${tpl.id}`)} onFork={() => forkMutation.mutate(tpl.id)} onDelete={() => deleteMutation.mutate(tpl.id)} onSetDefault={() => setDefaultMutation.mutate({ id: tpl.id, type: tpl.type as TemplateType })} forking={forkMutation.isPending} />
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </TabsContent>
            );
          })}
        </Tabs>
        </div>
      </div>
    </>
  );
}

function TemplateCard({ template, onUse, onFork, onDelete, onSetDefault, forking }: { template: TemplateRow; onUse: () => void; onFork: () => void; onDelete: () => void; onSetDefault: () => void; forking: boolean }) {
  const { t } = useTranslation("common");
  return (
    <div className="group rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all overflow-hidden">
      <div className="aspect-[4/3] bg-gradient-to-b from-slate-50 to-white flex items-center justify-center border-b border-slate-100 relative">
        <FileText className="h-8 w-8 text-slate-200 group-hover:text-slate-300 transition-colors" />
        {template.is_default_for_type && (
          <div className="absolute top-1.5 end-1.5 flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-50 text-amber-900 text-[9px] font-medium border border-amber-100">
            <Star className="h-2 w-2 fill-amber-500 text-amber-500" /> {t("templatesPage.default")}
          </div>
        )}
      </div>
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <h3 className="text-xs font-semibold truncate leading-snug text-slate-900">{template.name}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 -me-1 -mt-0.5 shrink-0"><MoreVertical className="h-3 w-3" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {template.is_sample ? (
                <>
                  <DropdownMenuItem onClick={onSetDefault} disabled={template.is_default_for_type}>
                    <Star className={`h-3.5 w-3.5 me-2 ${template.is_default_for_type ? "fill-amber-500 text-amber-500" : ""}`} />
                    {template.is_default_for_type ? t("templatesPage.accountDefault") : t("templatesPage.setAsDefault")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onFork} disabled={forking}><Copy className="h-3.5 w-3.5 me-2" /> {t("templatesPage.customizeCopy")}</DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={onUse}><Pencil className="h-3.5 w-3.5 me-2" /> {t("templatesPage.edit")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={onSetDefault} disabled={template.is_default_for_type}><Star className={`h-3.5 w-3.5 me-2 ${template.is_default_for_type ? "fill-amber-500 text-amber-500" : ""}`} /> {template.is_default_for_type ? t("templatesPage.defaultTemplate") : t("templatesPage.setAsDefault")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={onFork} disabled={forking}><Copy className="h-3.5 w-3.5 me-2" /> {t("templatesPage.duplicate")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5 me-2" /> {t("templatesPage.delete")}</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1.5 mb-2">
          {template.is_sample ? <Badge variant="outline" className="h-5 text-[9px] gap-0.5 px-1 border-amber-200 text-amber-900 bg-amber-50/80"><Sparkles className="h-2 w-2" /> {t("templatesPage.sample")}</Badge> : <Badge variant="outline" className="h-5 text-[9px] px-1 border-slate-200 text-slate-600">{t("templatesPage.custom")}</Badge>}
          <span className="text-[9px] text-slate-400">{format(new Date(template.updated_at), "MMM d")}</span>
        </div>
        {template.is_sample ? (
          <Button size="sm" className="w-full h-8 text-[11px]" onClick={onUse}>
            {t("templatesPage.open")}
          </Button>
        ) : (
          <Button size="sm" className="w-full h-8 text-[11px]" onClick={onUse}>{t("templatesPage.edit")}</Button>
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
