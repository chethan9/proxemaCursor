import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import {
  useWooAttributes,
  useCreateWooAttribute,
  useUpdateWooAttribute,
  useDeleteWooAttribute,
} from "@/hooks/queries/useWooAttributes";
import type { WooAttribute } from "@/services/wooAttributeService";
import { slugify } from "@/lib/slugify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Loader2, Pencil, Plus, Trash2, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
const ATTR_SLUG_MAX = 28;

const ORDER_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "menu_order", labelKey: "orderMenu" },
  { value: "name", labelKey: "orderName" },
  { value: "name_num", labelKey: "orderNameNum" },
  { value: "id", labelKey: "orderId" },
];

type Props = {
  storeId: string;
  search: string;
  onSearchChange: (v: string) => void;
  /** When true, Woo writes are disabled until initial catalog sync completes. */
  locked?: boolean;
};

function clampSlug(s: string): string {
  const t = slugify(s).slice(0, ATTR_SLUG_MAX);
  return t;
}

export function AttributesTab({ storeId, search, onSearchChange, locked = false }: Props) {
  const { t } = useTranslation("site");
  const { toast } = useToast();
  const { data: attributes = [], isLoading } = useWooAttributes(storeId);
  const createAttr = useCreateWooAttribute(storeId);
  const updateAttr = useUpdateWooAttribute(storeId);
  const deleteAttr = useDeleteWooAttribute(storeId);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [orderBy, setOrderBy] = useState("menu_order");
  const [hasArchives, setHasArchives] = useState(false);
  const [attrType, setAttrType] = useState<"select" | "text">("select");

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<WooAttribute | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editSlugTouched, setEditSlugTouched] = useState(false);
  const [editOrderBy, setEditOrderBy] = useState("menu_order");
  const [editArchives, setEditArchives] = useState(false);
  const [editType, setEditType] = useState<"select" | "text">("select");

  const [deleteRow, setDeleteRow] = useState<WooAttribute | null>(null);

  useEffect(() => {
    if (!slugTouched && name) setSlug(clampSlug(name));
    if (!slugTouched && !name) setSlug("");
  }, [name, slugTouched]);

  useEffect(() => {
    if (!editSlugTouched && editName) setEditSlug(clampSlug(editName));
    if (!editSlugTouched && !editName) setEditSlug("");
  }, [editName, editSlugTouched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return attributes;
    return attributes.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.slug || "").toLowerCase().includes(q),
    );
  }, [attributes, search]);

  function openEdit(row: WooAttribute) {
    setEditRow(row);
    setEditName(row.name);
    setEditSlug(row.slug);
    setEditSlugTouched(true);
    setEditOrderBy(row.order_by || "menu_order");
    setEditArchives(!!row.has_archives);
    setEditType(row.type === "text" ? "text" : "select");
    setEditOpen(true);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      toast({ title: t("attributes.errors.nameRequired"), variant: "destructive" });
      return;
    }
    try {
      await createAttr.mutateAsync({
        name: n,
        slug: slug.trim() || undefined,
        type: attrType,
        order_by: orderBy,
        has_archives: hasArchives,
      });
      toast({ title: t("attributes.toast.created") });
      setName("");
      setSlug("");
      setSlugTouched(false);
      setOrderBy("menu_order");
      setHasArchives(false);
      setAttrType("select");
    } catch (err) {
      toast({
        title: t("attributes.errors.createFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }

  async function handleSaveEdit() {
    if (!editRow) return;
    const n = editName.trim();
    if (!n) {
      toast({ title: t("attributes.errors.nameRequired"), variant: "destructive" });
      return;
    }
    try {
      await updateAttr.mutateAsync({
        attributeId: editRow.id,
        payload: {
          name: n,
          slug: editSlug.trim() || undefined,
          type: editType,
          order_by: editOrderBy,
          has_archives: editArchives,
        },
      });
      toast({ title: t("attributes.toast.updated") });
      setEditOpen(false);
      setEditRow(null);
    } catch (err) {
      toast({
        title: t("attributes.errors.updateFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }

  async function confirmDelete() {
    if (!deleteRow) return;
    try {
      await deleteAttr.mutateAsync(deleteRow.id);
      toast({ title: t("attributes.toast.deleted") });
      setDeleteRow(null);
    } catch (err) {
      toast({
        title: t("attributes.errors.deleteFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }

  function orderLabel(value: string): string {
    const opt = ORDER_OPTIONS.find((o) => o.value === value);
    return opt ? t(`attributes.orderBy.${opt.labelKey}`) : value;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("attributes.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("attributes.subtitle")}</p>
        </div>
        <div className="w-full max-w-sm">
          <Input
            placeholder={t("attributes.searchPlaceholder")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9"
            aria-label={t("attributes.searchPlaceholder")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <Card className="border-border bg-card lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("attributes.addCard.title")}</CardTitle>
            <CardDescription className="text-xs">{t("attributes.addCard.hint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("attributes.fields.name")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 bg-background"
                  required
                  disabled={locked}
                />
                <p className="text-[11px] text-muted-foreground">{t("attributes.fields.nameHint")}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("attributes.fields.slug")}</Label>
                <Input
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(clampSlug(e.target.value));
                  }}
                  className="h-9 font-mono text-xs bg-background"
                  maxLength={ATTR_SLUG_MAX}
                  disabled={locked}
                />
                <p className="text-[11px] text-muted-foreground">{t("attributes.fields.slugHint")}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("attributes.fields.type")}</Label>
                <Select value={attrType} onValueChange={(v) => setAttrType(v as "select" | "text")} disabled={locked}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select">{t("attributes.fields.typeSelect")}</SelectItem>
                    <SelectItem value="text">{t("attributes.fields.typeText")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("attributes.fields.orderBy")}</Label>
                <Select value={orderBy} onValueChange={setOrderBy} disabled={locked}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {t(`attributes.orderBy.${o.labelKey}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <Label className="text-xs cursor-pointer" htmlFor="has-archives-new">
                  {t("attributes.fields.hasArchives")}
                </Label>
                <Switch id="has-archives-new" checked={hasArchives} onCheckedChange={setHasArchives} disabled={locked} />
              </div>
              <Button
                type="submit"
                size="sm"
                className="w-full gap-1.5"
                disabled={createAttr.isPending || locked}
                title={locked ? t("products.toolbar.lockedHint") : undefined}
              >
                {createAttr.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {t("attributes.addCard.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border bg-card lg:col-span-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("attributes.table.title")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-2">
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("attributes.table.name")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("attributes.table.slug")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("attributes.table.type")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("attributes.table.orderBy")}</TableHead>
                    <TableHead className="w-[160px] text-end">{t("attributes.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                        <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                        {t("attributes.loading")}
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                        {t("attributes.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          <span className="text-foreground">{row.name}</span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">
                          {row.slug}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs capitalize text-muted-foreground">
                          {row.type}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          {orderLabel(row.order_by)}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex justify-end gap-1 flex-wrap">
                            <Button variant="outline" size="sm" className="h-8 gap-1" asChild>
                              <Link
                                href={`/sites/${storeId}/attributes/${row.id}`}
                                className={cn("inline-flex items-center gap-1", locked && "pointer-events-none opacity-50")}
                                tabIndex={locked ? -1 : undefined}
                                aria-disabled={locked}
                                title={locked ? t("products.toolbar.lockedHint") : undefined}
                              >
                                <Settings2 className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t("attributes.table.configureTerms")}</span>
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(row)}
                              aria-label={t("attributes.table.edit")}
                              disabled={locked}
                              title={locked ? t("products.toolbar.lockedHint") : undefined}
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
                              title={locked ? t("products.toolbar.lockedHint") : undefined}
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
      </div>

      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) setEditRow(null); setEditOpen(o); }}>
        <DialogContent className="sm:max-w-md border-border bg-background">
          <DialogHeader>
            <DialogTitle>{t("attributes.edit.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">{t("attributes.fields.name")}</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-9 bg-background"
                disabled={locked}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("attributes.fields.slug")}</Label>
              <Input
                value={editSlug}
                onChange={(e) => {
                  setEditSlugTouched(true);
                  setEditSlug(clampSlug(e.target.value));
                }}
                className="h-9 font-mono text-xs bg-background"
                maxLength={ATTR_SLUG_MAX}
                disabled={locked}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("attributes.fields.type")}</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as "select" | "text")} disabled={locked}>
                <SelectTrigger className="h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="select">{t("attributes.fields.typeSelect")}</SelectItem>
                  <SelectItem value="text">{t("attributes.fields.typeText")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("attributes.fields.orderBy")}</Label>
              <Select value={editOrderBy} onValueChange={setEditOrderBy} disabled={locked}>
                <SelectTrigger className="h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {t(`attributes.orderBy.${o.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
              <Label className="text-xs cursor-pointer" htmlFor="has-archives-edit">
                {t("attributes.fields.hasArchives")}
              </Label>
              <Switch id="has-archives-edit" checked={editArchives} onCheckedChange={setEditArchives} disabled={locked} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
              {t("attributes.edit.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSaveEdit()}
              disabled={updateAttr.isPending || locked}
              title={locked ? t("products.toolbar.lockedHint") : undefined}
            >
              {updateAttr.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t("attributes.edit.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("attributes.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("attributes.delete.description", { name: deleteRow?.name ?? "" })}
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
              disabled={deleteAttr.isPending || locked}
            >
              {deleteAttr.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("attributes.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
