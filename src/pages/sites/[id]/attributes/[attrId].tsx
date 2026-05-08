import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { ArrowLeft, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { SyncLockBanner, useSyncLocked } from "@/components/site/SyncLockBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function AttributeTermsInner() {
  const router = useRouter();
  const { id: storeId, store, loading } = useSiteFromRoute();
  const rawAttr = router.query.attrId;
  const attributeId =
    typeof rawAttr === "string" ? Number.parseInt(rawAttr, 10) : Number.NaN;

  const { t, i18n } = useTranslation("site");
  const { t: tc } = useTranslation("common");
  const { toast } = useToast();
  const { locked, ready: syncReady } = useSyncLocked(storeId);

  const [termName, setTermName] = useState("");
  const [termSlug, setTermSlug] = useState("");
  const [termDesc, setTermDesc] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<WooAttributeTerm | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDesc, setEditDesc] = useState("");

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

  function openEdit(term: WooAttributeTerm) {
    setEditing(term);
    setEditName(term.name);
    setEditSlug(term.slug || "");
    setEditDesc(term.description || "");
    setEditOpen(true);
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

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editName.trim() || locked) return;
    try {
      await updateMut.mutateAsync({
        termId: editing.id,
        payload: {
          name: editName.trim(),
          slug: editSlug.trim() || undefined,
          description: editDesc.trim() || undefined,
        },
      });
      setEditOpen(false);
      setEditing(null);
      toast({ title: t("attributes.terms.toast.updated") });
    } catch (err) {
      toast({
        title: t("attributes.terms.errors.updateFailed"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || locked) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
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

  const disableWrites = locked || !syncReady;
  const heading = attribute?.name
    ? t("attributes.terms.title", { name: attribute.name })
    : attrLoading
      ? "…"
      : t("attributes.terms.title", { name: `#${attributeId}` });

  return (
    <div className="p-6 space-y-4 max-w-[1200px] mx-auto">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 -ms-2" asChild>
          <Link href={`/sites/${storeId}/attributes`}>
            <ArrowLeft className="h-4 w-4" />
            {t("attributes.terms.back")}
          </Link>
        </Button>
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
                    <TableHead className="w-[52px] text-right">{t("attributes.terms.columns.actions")}</TableHead>
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
                    sortedTerms.map((term) => (
                      <TableRow key={term.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{term.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{term.slug}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                          {term.description || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {formatNumber(term.count ?? 0, i18n.language)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={disableWrites}
                                title={locked ? t("products.toolbar.lockedHint") : undefined}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEdit(term)}
                                disabled={disableWrites}
                                className="gap-2"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                {t("attributes.terms.editTitle")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(term)}
                                disabled={disableWrites}
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {tc("actions.delete", "Delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submitEdit}>
            <DialogHeader>
              <DialogTitle>{t("attributes.terms.editTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-term-name">{t("attributes.terms.fields.name")}</Label>
                <Input
                  id="edit-term-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9"
                  required
                  disabled={disableWrites}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-term-slug">{t("attributes.terms.fields.slug")}</Label>
                <Input
                  id="edit-term-slug"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  className="h-9 font-mono text-xs"
                  disabled={disableWrites}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-term-desc">{t("attributes.terms.fields.description")}</Label>
                <Textarea
                  id="edit-term-desc"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="text-sm resize-y min-h-[72px]"
                  disabled={disableWrites}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                {tc("actions.cancel", "Cancel")}
              </Button>
              <Button
                type="submit"
                disabled={disableWrites || updateMut.isPending}
                title={locked ? t("products.toolbar.lockedHint") : undefined}
              >
                {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : tc("actions.save", "Save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
