import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "next-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";
import { createCategory, createTag, createBrand } from "@/services/taxonomyService";
import { slugify } from "@/lib/slugify";
import { LockedSlugField } from "@/components/ui/locked-slug-field";

type ParentOption = { id: string; woo_id: number | null; name: string };

export type TaxonomyCreateFormProps = {
  storeId: string;
  siteName?: string;
  mode: "categories" | "tags" | "brands";
  parentOptions?: ParentOption[];
  /** Disable Woo writes (e.g. initial catalog sync). */
  locked?: boolean;
  variant?: "card" | "plain";
  className?: string;
};

export function TaxonomyCreateForm({
  storeId,
  siteName,
  mode,
  parentOptions = [],
  locked = false,
  variant = "card",
  className,
}: TaxonomyCreateFormProps) {
  const { t } = useTranslation("site");
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parent, setParent] = useState("0");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const singular = mode === "categories" ? "category" : mode === "tags" ? "tag" : "brand";

  const create = useSiteMutation<void, { name: string; slug?: string; description?: string; parent?: number }>({
    mutationFn: async (payload) => {
      if (mode === "categories") {
        await createCategory(storeId, payload);
      } else if (mode === "tags") {
        await createTag(storeId, { name: payload.name, slug: payload.slug, description: payload.description });
      } else {
        await createBrand(storeId, { name: payload.name, slug: payload.slug, description: payload.description });
      }
    },
    invalidateKeys: [
      ["taxonomy", mode, storeId],
      queryKeys.taxonomy(storeId, mode),
      ["woo", "taxonomy", storeId, mode],
      ...(mode === "categories"
        ? [queryKeys.productCategoryOptions(storeId), [...queryKeys.taxonomy(storeId, "categories"), "all"]]
        : []),
    ],
    siteName,
    successToast:
      mode === "categories"
        ? t("taxonomy.create.successCategory")
        : mode === "tags"
          ? t("taxonomy.create.successTag")
          : t("taxonomy.create.successBrand"),
    onSuccessExtra: () => {
      void qc.refetchQueries({ queryKey: ["taxonomy", mode, storeId], type: "active" });
      setName("");
      setSlug("");
      setDescription("");
      setParent("0");
      setSlugTouched(false);
      setFieldError(null);
      setSlugError(null);
      setServerError(null);
    },
    onErrorExtra: (err) => setServerError((err as Error).message),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    setFieldError(null);
    setSlugError(null);
    setServerError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setFieldError(t("taxonomy.create.errors.nameRequired"));
      return;
    }
    if (trimmed.length > 120) {
      setFieldError(t("taxonomy.create.errors.nameLength"));
      return;
    }
    const slugFinal = slug.trim() || slugify(trimmed);
    if (!slugFinal) {
      setSlugError(t("taxonomy.create.errors.slugMissing"));
      return;
    }
    create.mutate({
      name: trimmed,
      slug: slugFinal,
      description: description || undefined,
      parent: Number(parent) || 0,
    });
  }

  const cardTitleKey =
    mode === "categories" ? "taxonomy.addCard.titleCategories" : mode === "tags" ? "taxonomy.addCard.titleTags" : "taxonomy.addCard.titleBrands";
  const cardHintKey =
    mode === "categories" ? "taxonomy.addCard.hintCategories" : mode === "tags" ? "taxonomy.addCard.hintTags" : "taxonomy.addCard.hintBrands";

  const formInner = (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tx-create-name" className="text-sm font-medium">
          {t("taxonomy.create.nameLabel")} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="tx-create-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldError) setFieldError(null);
          }}
          autoFocus={variant === "card"}
          maxLength={120}
          placeholder={t("taxonomy.create.namePlaceholder", { singular })}
          disabled={locked}
          {...(fieldError ? ({ "aria-invalid": true as const, "aria-describedby": "tx-create-name-error" } as const) : {})}
          className={`h-10 bg-background ${fieldError ? "border-destructive focus-visible:ring-ring" : ""}`}
        />
        {fieldError ? (
          <p id="tx-create-name-error" className="text-xs text-destructive" role="alert">
            {fieldError}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="tx-create-slug" className="text-sm font-medium">
          {t("taxonomy.create.slugLabel")} <span className="text-destructive">*</span>
        </Label>
        <LockedSlugField
          id="tx-create-slug"
          value={slug}
          onChange={(v) => {
            setSlugTouched(true);
            setSlug(slugify(v));
            if (slugError) setSlugError(null);
          }}
          disabled={locked}
          placeholder={t("taxonomy.create.slugPlaceholder")}
          showHint
        />
        {slugError ? (
          <p className="text-xs text-destructive" role="alert">
            {slugError}
          </p>
        ) : null}
      </div>
      {mode === "categories" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("taxonomy.create.parentLabel")}</Label>
          <Select value={parent} onValueChange={setParent} disabled={locked}>
            <SelectTrigger className="h-10 bg-background">
              <SelectValue placeholder={t("taxonomy.create.parentNone")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t("taxonomy.create.parentNone")}</SelectItem>
              {parentOptions.filter((p) => p.woo_id).map((p) => (
                <SelectItem key={p.id} value={String(p.woo_id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="tx-create-desc" className="text-sm font-medium">
          {t("taxonomy.create.descriptionLabel")}
        </Label>
        <Textarea
          id="tx-create-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="resize-none bg-background min-h-[88px] text-sm"
          placeholder={t("taxonomy.create.descriptionPlaceholder")}
          disabled={locked}
        />
      </div>
      {serverError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </div>
      ) : null}
      <Button type="submit" className="w-full gap-2" disabled={create.isPending || locked} title={locked ? t("products.toolbar.lockedHint") : undefined}>
        {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("taxonomy.create.submit", { singular })}
      </Button>
    </form>
  );

  if (variant === "plain") {
    return <div className={className}>{formInner}</div>;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t(cardTitleKey)}</CardTitle>
        <CardDescription className="text-xs">{t(cardHintKey)}</CardDescription>
      </CardHeader>
      <CardContent>{formInner}</CardContent>
    </Card>
  );
}
