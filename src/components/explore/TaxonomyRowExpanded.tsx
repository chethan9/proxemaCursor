import { useState, useEffect } from "react";
import { useTranslation } from "next-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Loader2 } from "lucide-react";
import { LockedSlugField } from "@/components/ui/locked-slug-field";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";
import { slugify } from "@/lib/slugify";
import { updateCategory, deleteCategory, updateTag, deleteTag, updateBrand, deleteBrand } from "@/services/taxonomyService";
import { cn } from "@/lib/utils";

type Taxonomy = {
  id: string;
  store_id: string;
  woo_id: number | null;
  name: string;
  slug: string | null;
  description: string | null;
  parent_id?: number | null;
  count: number | null;
};

type Props = {
  item: Taxonomy;
  mode: "categories" | "tags" | "brands";
  storeId: string;
  onClose: () => void;
  locked?: boolean;
};

export function TaxonomyRowExpanded({ item, mode, storeId, onClose, locked = false }: Props) {
  const { t } = useTranslation("site");
  const qc = useQueryClient();
  const [name, setName] = useState(item.name);
  const [slug, setSlug] = useState(item.slug || "");
  const [description, setDescription] = useState(item.description || "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; slug?: string }>({});

  useEffect(() => {
    setName(item.name);
    setSlug(item.slug || "");
    setDescription(item.description || "");
    setSlugTouched(false);
  }, [item.id, item.name, item.slug, item.description]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const updateMut = useSiteMutation<Taxonomy, { name: string; slug: string; description: string }>({
    mutationFn: (vars) => {
      if (mode === "categories") return updateCategory(storeId, item.id, vars) as Promise<Taxonomy>;
      if (mode === "tags") return updateTag(storeId, item.id, vars) as Promise<Taxonomy>;
      return updateBrand(storeId, item.id, vars) as Promise<Taxonomy>;
    },
    invalidateKeys: [
      ["taxonomy", mode, storeId],
      queryKeys.taxonomy(storeId, mode),
      ["woo", "taxonomy", storeId, mode],
      ...(mode === "categories"
        ? [queryKeys.productCategoryOptions(storeId), [...queryKeys.taxonomy(storeId, "categories"), "all"]]
        : []),
    ],
    successToast: "Synced to WooCommerce",
    onSuccessExtra: () => {
      void qc.refetchQueries({ queryKey: ["taxonomy", mode, storeId], type: "active" });
      setFieldErrors({});
    },
  });

  const deleteMut = useSiteMutation<void, void>({
    mutationFn: async () => {
      if (mode === "categories") await deleteCategory(storeId, item.id);
      else if (mode === "tags") await deleteTag(storeId, item.id);
      else await deleteBrand(storeId, item.id);
    },
    invalidateKeys: [
      ["taxonomy", mode, storeId],
      queryKeys.taxonomy(storeId, mode),
      ["woo", "taxonomy", storeId, mode],
      ...(mode === "categories"
        ? [queryKeys.productCategoryOptions(storeId), [...queryKeys.taxonomy(storeId, "categories"), "all"]]
        : []),
    ],
    successToast: "Deleted from WooCommerce",
    onSuccessExtra: () => {
      void qc.refetchQueries({ queryKey: ["taxonomy", mode, storeId], type: "active" });
      onClose();
    },
  });

  const singular =
    mode === "categories" ? t("taxonomy.expanded.singularCategory") : mode === "tags" ? t("taxonomy.expanded.singularTag") : t("taxonomy.expanded.singularBrand");

  const dirty = name !== item.name || slug !== (item.slug || "") || description !== (item.description || "");

  const nameTrim = name.trim();
  const slugTrim = slug.trim();
  const requiredOk = nameTrim.length > 0 && slugTrim.length > 0;

  async function handleDelete() {
    if (!confirm(t("taxonomy.expanded.deleteConfirm", { singular }))) return;
    deleteMut.mutate();
  }

  function handleSave() {
    if (locked) return;
    const next: { name?: string; slug?: string } = {};
    if (!nameTrim) next.name = t("taxonomy.expanded.errors.nameRequired");
    if (!slugTrim) next.slug = t("taxonomy.expanded.errors.slugRequired");
    if (next.name || next.slug) {
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    updateMut.mutate({ name: nameTrim, slug: slugTrim, description });
  }

  const titleKey =
    mode === "categories" ? "titleCategory" : mode === "tags" ? "titleTag" : "titleBrand";

  return (
    <div className="bg-muted/25 px-4 pb-4 pt-0 sm:px-6">
      <Card className="mx-auto max-w-3xl rounded-t-none rounded-b-xl border-border/80 shadow-sm">
        <CardHeader className="space-y-1 border-b border-border/60 pb-4 pt-4">
          <CardTitle className="text-base font-semibold">{t(`taxonomy.expanded.${titleKey}`)}</CardTitle>
          <CardDescription className="text-xs">{t("taxonomy.expanded.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`tax-edit-name-${item.id}`} className="text-sm font-medium">
                {t("taxonomy.create.nameLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`tax-edit-name-${item.id}`}
                value={name}
                disabled={locked}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: undefined }));
                }}
                className={cn("h-10 bg-background", fieldErrors.name && "border-destructive")}
                aria-invalid={!!fieldErrors.name}
              />
              {fieldErrors.name ? <p className="text-xs text-destructive">{fieldErrors.name}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`tax-edit-slug-${item.id}`} className="text-sm font-medium">
                {t("taxonomy.create.slugLabel")} <span className="text-destructive">*</span>
              </Label>
              <LockedSlugField
                id={`tax-edit-slug-${item.id}`}
                value={slug}
                committedValue={item.slug ?? ""}
                disabled={locked}
                maxLength={200}
                onChange={(next) => {
                  setSlugTouched(true);
                  setSlug(slugify(next));
                  if (fieldErrors.slug) setFieldErrors((f) => ({ ...f, slug: undefined }));
                }}
                placeholder={t("taxonomy.create.slugPlaceholder")}
              />
              {fieldErrors.slug ? <p className="text-xs text-destructive">{fieldErrors.slug}</p> : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`tax-edit-desc-${item.id}`} className="text-sm font-medium">
              {t("taxonomy.create.descriptionLabel")}
            </Label>
            <Textarea
              id={`tax-edit-desc-${item.id}`}
              value={description}
              disabled={locked}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none bg-background min-h-[88px] text-sm"
            />
          </div>
        </CardContent>
        <div className="flex flex-col-reverse gap-3 border-t border-border/70 bg-muted/20 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start text-destructive hover:bg-destructive/10 hover:text-destructive sm:-ml-2"
            onClick={handleDelete}
            disabled={deleteMut.isPending || locked}
            title={locked ? t("products.toolbar.lockedHint") : undefined}
          >
            {deleteMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {t("taxonomy.expanded.delete")}
          </Button>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="default" onClick={onClose}>
              {t("taxonomy.expanded.cancel")}
            </Button>
            <Button
              type="button"
              size="default"
              disabled={!dirty || !requiredOk || updateMut.isPending || locked}
              title={locked ? t("products.toolbar.lockedHint") : undefined}
              onClick={handleSave}
            >
              {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("taxonomy.expanded.save")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
