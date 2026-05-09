import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { ArrowLeft, Check, Loader2, SquarePen, Trash2, X } from "lucide-react";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { SyncLockBanner, useSyncLocked } from "@/components/site/SyncLockBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useWooAttribute,
  useWooAttributeTerms,
  useCreateWooAttributeTerm,
  useUpdateWooAttributeTerm,
  useDeleteWooAttributeTerm,
} from "@/hooks/queries/useWooAttributes";
import type { WooAttributeTerm } from "@/services/wooAttributeService";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from "@/lib/format-number";
import { slugify } from "@/lib/slugify";
import { cn } from "@/lib/utils";

function AttributeTermsInner() {
  const router = useRouter();
  const { id: storeId, store, loading } = useSiteFromRoute();
  const rawAttr = router.query.attrId;
  const attributeId =
    typeof rawAttr === "string" ? Number.parseInt(rawAttr, 10) : Number.NaN;

  const { t, i18n } = useTranslation("site");
  const { t: tc } = useTranslation("common");
  const { toast } = useToast();
  const { locked } = useSyncLocked(storeId);

  const [termName, setTermName] = useState("");
  const [termSlug, setTermSlug] = useState("");
  const [termDesc, setTermDesc] = useState("");

  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlineName, setInlineName] = useState("");
  const [inlineSlug, setInlineSlug] = useState("");
  const [inlineDesc, setInlineDesc] = useState("");
  const [inlineSlugTouched, setInlineSlugTouched] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<WooAttributeTerm | null>(null);

  const { data: attribute, isLoading: attrLoading } = useWooAttribute(
    storeId,
    Number.isFinite(attributeId) ? attributeId : null,
  );
  const { data: terms, isLoading: termsLoading } = useWooAttributeTerms(
    storeId,
    Number.isFinite(attributeId) ? attributeId : null,
  );

  const createMut = useCreateWooAttributeTerm(storeId, attributeId);
  const updateMut = useUpdateWooAttributeTerm(storeId, attributeId);
  const deleteMut = useDeleteWooAttributeTerm(storeId, attributeId);

  const sortedTerms = useMemo(() => {
    if (!terms?.length) return [];
    return [...terms].sort(
      (a, b) => (a.menu_order ?? 0) - (b.menu_order ?? 0) || a.name.localeCompare(b.name),
    );
  }, [terms]);

  useEffect(() => {
    if (inlineEditId == null) return;
    if (!inlineSlugTouched && inlineName) setInlineSlug(slugify(inlineName));
    if (!inlineSlugTouched && !inlineName) setInlineSlug("");
  }, [inlineName, inlineSlugTouched, inlineEditId]);

  useEffect(() => {
    if (inlineEditId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelInlineEdit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inlineEditId]);

  function beginInlineEdit(term: WooAttributeTerm) {
    if (locked) {
      toast({ title: t("products.toolbar.lockedHint"), variant: "destructive" });
      return;
    }
    setInlineEditId(term.id);
    setInlineName(term.name);
    setInlineSlug(term.slug || "");
    setInlineDesc(term.description || "");
    setInlineSlugTouched(false);
  }

  function cancelInlineEdit() {
    setInlineEditId(null);
    setInlineSlugTouched(false);
  }

  function activateRowEdit(term: WooAttributeTerm) {
    if (disableWrites) return;
    if (inlineEditId === term.id) return;
    if (inlineEditId != null) cancelInlineEdit();
    beginInlineEdit(term);
  }

  async function saveInlineEdit() {
    if (inlineEditId == null || !inlineName.trim() || locked) return;
    try {
      await updateMut.mutateAsync({
        termId: inlineEditId,
        payload: {
          name: inlineName.trim(),
          slug: inlineSlug.trim() || undefined,
          description: inlineDesc.trim() || undefined,
        },
      });
      cancelInlineEdit();
      toast({ title: t("attributes.terms.toast.updated") });
    } catch (err) {
      toast({
        title: t("attributes.terms.errors.updateFailed"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!termName.trim() || locked || !Number.isFinite(attributeId)) return;
    try {
      await createMut.mutateAsync({
        name: termName.trim(),
        ...(termSlug.trim() ? { slug: termSlug.trim() } : {}),
        ...(termDesc.trim() ? { description: termDesc.trim() } : {}),
      });
      setTermName("");
      setTermSlug("");
      setTermDesc("");
      toast({ title: t("attributes.terms.toast.created") });
    } catch (err) {
      toast({
        title: t("attributes.terms.errors.createFailed"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || locked) return;
    const deletedId = deleteTarget.id;
    try {
      await deleteMut.mutateAsync(deletedId);
      setDeleteTarget(null);
      if (inlineEditId === deletedId) cancelInlineEdit();
      toast({ title: t("attributes.terms.toast.deleted") });
    } catch (err) {
      toast({
        title: t("attributes.terms.errors.deleteFailed"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">{tc("errors.storeNotFound", "Store not found")}</div>;
  if (!router.isReady) return <SiteLoadingSkeleton />;
  if (!Number.isFinite(attributeId)) {
    return (
      <div className="p-6 text-sm text-muted-foreground">{t("attributes.terms.errors.invalidAttribute")}</div>
    );
  }

  const disableWrites = locked;
  const heading = attribute?.name
    ? t("attributes.terms.title", { name: attribute.name })
    : attrLoading
      ? "…"
      : t("attributes.terms.title", { name: `#${attributeId}` });

  return (
    <div className="p-6 space-y-4 max-w-[1200px] mx-auto">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          href={`/sites/${storeId}/attributes`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "h-8 gap-1.5 -ms-2 inline-flex w-fit shrink-0 items-center",
          )}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {t("attributes.terms.back")}
        </Link>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h1 className="text-lg font-semibold truncate">{heading}</h1>
          <p className="text-sm text-muted-foreground">{t("attributes.terms.subtitle")}</p>
        </div>
      </div>

      <SyncLockBanner storeId={storeId} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,340px)_1fr] gap-4 items-start">
        <Card className="border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("attributes.terms.addTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="term-name">{t("attributes.terms.fields.name")}</Label>
                <Input
                  id="term-name"
                  value={termName}
                  onChange={(e) => setTermName(e.target.value)}
                  disabled={disableWrites || attrLoading}
                  className="h-9"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="term-slug">{t("attributes.terms.fields.slug")}</Label>
                <Input
                  id="term-slug"
                  value={termSlug}
                  onChange={(e) => setTermSlug(e.target.value)}
                  disabled={disableWrites || attrLoading}
                  className="h-9 font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="term-desc">{t("attributes.terms.fields.description")}</Label>
                <Textarea
                  id="term-desc"
                  value={termDesc}
                  onChange={(e) => setTermDesc(e.target.value)}
                  disabled={disableWrites || attrLoading}
                  rows={3}
                  className="text-sm resize-y min-h-[72px]"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-9"
                disabled={disableWrites || !termName.trim() || attrLoading || createMut.isPending}
                title={locked ? t("products.toolbar.lockedHint") : undefined}
              >
                {createMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("attributes.terms.addSubmit")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border shadow-none">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-sm font-medium">{t("attributes.terms.tableTitle")}</CardTitle>
            <p className="text-xs text-muted-foreground font-normal pt-0.5">{t("attributes.terms.inlineHint")}</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>{t("attributes.terms.columns.name")}</TableHead>
                    <TableHead>{t("attributes.terms.columns.slug")}</TableHead>
                    <TableHead className="max-w-[200px]">{t("attributes.terms.columns.description")}</TableHead>
                    <TableHead className="text-right w-[100px]">{t("attributes.terms.columns.products")}</TableHead>
                    <TableHead className="min-w-[7.5rem] text-right">{t("attributes.terms.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {termsLoading || attrLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={`sk-${i}`}>
                        <TableCell colSpan={5}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : sortedTerms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                        {t("attributes.terms.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedTerms.map((term) => {
                      const isEditing = inlineEditId === term.id;
                      return (
                        <TableRow
                          key={term.id}
                          role={isEditing ? undefined : "button"}
                          tabIndex={disableWrites || isEditing ? undefined : 0}
                          className={cn(
                            "hover:bg-muted/30",
                            !disableWrites && !isEditing && "cursor-pointer",
                            isEditing && "bg-muted/25",
                          )}
                          onClick={() => activateRowEdit(term)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              activateRowEdit(term);
                            }
                          }}
                        >
                          <TableCell className="font-medium align-top">
                            {isEditing ? (
                              <div onClick={(e) => e.stopPropagation()} className="py-0.5">
                                <Input
                                  value={inlineName}
                                  onChange={(e) => setInlineName(e.target.value)}
                                  className="h-9 font-medium"
                                  disabled={updateMut.isPending}
                                  autoFocus
                                  aria-label={t("attributes.terms.fields.name")}
                                />
                              </div>
                            ) : (
                              term.name
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground align-top">
                            {isEditing ? (
                              <div onClick={(e) => e.stopPropagation()} className="py-0.5">
                                <Input
                                  value={inlineSlug}
                                  onChange={(e) => {
                                    setInlineSlugTouched(true);
                                    setInlineSlug(slugify(e.target.value));
                                  }}
                                  className="h-9 font-mono text-xs"
                                  disabled={updateMut.isPending}
                                  aria-label={t("attributes.terms.fields.slug")}
                                />
                              </div>
                            ) : (
                              term.slug
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[220px] align-top">
                            {isEditing ? (
                              <div onClick={(e) => e.stopPropagation()} className="py-0.5">
                                <Textarea
                                  value={inlineDesc}
                                  onChange={(e) => setInlineDesc(e.target.value)}
                                  rows={2}
                                  className="text-xs resize-y min-h-[52px]"
                                  disabled={updateMut.isPending}
                                  aria-label={t("attributes.terms.fields.description")}
                                />
                              </div>
                            ) : (
                              <span className="line-clamp-2">{term.description || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs align-middle">
                            {formatNumber(term.count ?? 0, i18n.language)}
                          </TableCell>
                          <TableCell className="text-right align-middle" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex shrink-0 items-center justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    disabled={updateMut.isPending || !inlineName.trim()}
                                    onClick={() => void saveInlineEdit()}
                                    aria-label={tc("actions.save", "Save")}
                                  >
                                    {updateMut.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    disabled={updateMut.isPending}
                                    onClick={cancelInlineEdit}
                                    aria-label={tc("actions.cancel", "Cancel")}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  disabled={disableWrites}
                                  title={locked ? t("products.toolbar.lockedHint") : t("attributes.terms.editTitle")}
                                  aria-label={t("attributes.terms.editTitle")}
                                  onClick={() => activateRowEdit(term)}
                                >
                                  <SquarePen className="h-4 w-4" />
                                </Button>
                              )}
                              {!isEditing && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  disabled={disableWrites}
                                  title={locked ? t("products.toolbar.lockedHint") : tc("actions.delete", "Delete")}
                                  aria-label={tc("actions.delete", "Delete")}
                                  onClick={() => setDeleteTarget(term)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("attributes.terms.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? t("attributes.terms.deleteDescription", { name: deleteTarget.name }) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("actions.cancel", "Cancel")}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMut.isPending || disableWrites}
              onClick={() => void confirmDelete()}
            >
              {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : tc("actions.delete", "Delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SiteAttributeTermsPage() {
  return (
    <SitePageShell>
      <AttributeTermsInner />
    </SitePageShell>
  );
}
