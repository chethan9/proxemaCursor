import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import {
  useWooAttributes,
  useWooAttributeTerms,
  useCreateWooAttributeTerm,
  useUpdateWooAttributeTerm,
  useDeleteWooAttributeTerm,
} from "@/hooks/queries/useWooAttributes";
import type { WooAttributeTerm } from "@/services/wooAttributeService";
import { slugify } from "@/lib/slugify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  storeId: string;
  attributeId: number;
  /** When true, Woo writes are disabled until initial catalog sync completes. */
  locked?: boolean;
};

export function AttributeTermsTab({ storeId, attributeId, locked = false }: Props) {
  const { t } = useTranslation("site");
  const { toast } = useToast();
  const { data: attributes = [] } = useWooAttributes(storeId);
  const attr = useMemo(() => attributes.find((a) => a.id === attributeId), [attributes, attributeId]);

  const { data: terms = [], isLoading } = useWooAttributeTerms(storeId, attributeId);
  const sortedTerms = useMemo(() => {
    return [...terms].sort((a, b) => {
      const mo = (a.menu_order ?? 0) - (b.menu_order ?? 0);
      if (mo !== 0) return mo;
      return a.name.localeCompare(b.name);
    });
  }, [terms]);

  const createTerm = useCreateWooAttributeTerm(storeId, attributeId);
  const updateTerm = useUpdateWooAttributeTerm(storeId, attributeId);
  const deleteTerm = useDeleteWooAttributeTerm(storeId, attributeId);

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newSlugTouched, setNewSlugTouched] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<WooAttributeTerm | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editOrder, setEditOrder] = useState("");
  const [editSlugTouched, setEditSlugTouched] = useState(false);

  const [deleteRow, setDeleteRow] = useState<WooAttributeTerm | null>(null);

  useEffect(() => {
    if (!newSlugTouched && newName) setNewSlug(slugify(newName));
    if (!newSlugTouched && !newName) setNewSlug("");
  }, [newName, newSlugTouched]);

  useEffect(() => {
    if (!editSlugTouched && editName) setEditSlug(slugify(editName));
    if (!editSlugTouched && !editName) setEditSlug("");
  }, [editName, editSlugTouched]);

  async function handleAddTerm(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    const n = newName.trim();
    if (!n) {
      toast({ title: t("attributes.terms.errors.nameRequired"), variant: "destructive" });
      return;
    }
    try {
      await createTerm.mutateAsync({
        name: n,
        slug: newSlug.trim() || undefined,
      });
      toast({ title: t("attributes.terms.toast.created") });
      setNewName("");
      setNewSlug("");
      setNewSlugTouched(false);
    } catch (err) {
      toast({
        title: t("attributes.terms.errors.createFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }

  function openEdit(row: WooAttributeTerm) {
    setEditRow(row);
    setEditName(row.name);
    setEditSlug(row.slug);
    setEditDesc(row.description || "");
    setEditOrder(String(row.menu_order ?? 0));
    setEditSlugTouched(true);
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (locked || !editRow) return;
    const n = editName.trim();
    if (!n) {
      toast({ title: t("attributes.terms.errors.nameRequired"), variant: "destructive" });
      return;
    }
    const mo = parseInt(editOrder, 10);
    try {
      await updateTerm.mutateAsync({
        termId: editRow.id,
        payload: {
          name: n,
          slug: editSlug.trim() || undefined,
          description: editDesc.trim() || undefined,
          menu_order: Number.isFinite(mo) ? mo : 0,
        },
      });
      toast({ title: t("attributes.terms.toast.updated") });
      setEditOpen(false);
      setEditRow(null);
    } catch (err) {
      toast({
        title: t("attributes.terms.errors.updateFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }

  async function confirmDelete() {
    if (locked || !deleteRow) return;
    try {
      await deleteTerm.mutateAsync(deleteRow.id);
      toast({ title: t("attributes.terms.toast.deleted") });
      setDeleteRow(null);
    } catch (err) {
      toast({
        title: t("attributes.terms.errors.deleteFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" className="w-fit gap-1.5 -ms-2" asChild>
          <Link href={`/sites/${storeId}/attributes`}>
            <ArrowLeft className="h-4 w-4" />
            {t("attributes.terms.back")}
          </Link>
        </Button>
      </div>

      <div>
        <h2 className="text-lg font-semibold">
          {t("attributes.terms.title", { name: attr?.name ?? `#${attributeId}` })}
        </h2>
        <p className="text-sm text-muted-foreground">{t("attributes.terms.subtitle")}</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("attributes.terms.addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddTerm} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
            <div className="space-y-1 flex-1 min-w-[160px]">
              <Label className="text-xs">{t("attributes.terms.fields.name")}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-9 bg-background"
                disabled={locked}
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <Label className="text-xs">{t("attributes.terms.fields.slug")}</Label>
              <Input
                value={newSlug}
                onChange={(e) => {
                  setNewSlugTouched(true);
                  setNewSlug(slugify(e.target.value));
                }}
                className="h-9 font-mono text-xs bg-background"
                disabled={locked}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={createTerm.isPending || locked}
              className="gap-1.5"
              title={locked ? t("products.toolbar.lockedHint") : undefined}
            >
              {createTerm.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {t("attributes.terms.addSubmit")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("attributes.terms.tableTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-2">
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("attributes.terms.columns.name")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("attributes.terms.columns.slug")}</TableHead>
                  <TableHead className="hidden md:table-cell w-24">{t("attributes.terms.columns.order")}</TableHead>
                  <TableHead className="w-[100px] text-end">{t("attributes.terms.columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      {t("attributes.loading")}
                    </TableCell>
                  </TableRow>
                ) : sortedTerms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      {t("attributes.terms.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedTerms.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">
                        {row.slug}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs tabular-nums">{row.menu_order ?? 0}</TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(row)}
                            aria-label={t("attributes.table.edit")}
                            disabled={locked}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteRow(row)}
                            aria-label={t("attributes.table.delete")}
                            disabled={locked}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) setEditRow(null); setEditOpen(o); }}>
        <DialogContent className="sm:max-w-md border-border bg-background">
          <DialogHeader>
            <DialogTitle>{t("attributes.terms.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">{t("attributes.terms.fields.name")}</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-9 bg-background"
                disabled={locked}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("attributes.terms.fields.slug")}</Label>
              <Input
                value={editSlug}
                onChange={(e) => {
                  setEditSlugTouched(true);
                  setEditSlug(slugify(e.target.value));
                }}
                className="h-9 font-mono text-xs bg-background"
                disabled={locked}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("attributes.terms.fields.description")}</Label>
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="h-9 bg-background"
                disabled={locked}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("attributes.terms.fields.menuOrder")}</Label>
              <Input
                type="number"
                value={editOrder}
                onChange={(e) => setEditOrder(e.target.value)}
                className="h-9 bg-background"
                disabled={locked}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
              {t("attributes.edit.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSaveEdit()}
              disabled={updateTerm.isPending || locked}
              title={locked ? t("products.toolbar.lockedHint") : undefined}
            >
              {updateTerm.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t("attributes.edit.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("attributes.terms.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("attributes.terms.deleteDescription", { name: deleteRow?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("attributes.delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleteTerm.isPending || locked}
            >
              {deleteTerm.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("attributes.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
