import { useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FolderTree, Award, Plus, X, Search, Loader2 } from "lucide-react";
import type { ProductFormState } from "@/services/productEditService";
import { useWooTaxonomy, useCreateWooTaxonomy } from "@/hooks/queries/useWooTaxonomy";
import { categoryBreadcrumb, sortCategoriesForPicker } from "@/components/product-edit/product-taxonomy-helpers";

type Props = {
  storeId: string;
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
};

export function ProductTaxonomyFields({ storeId, form, setForm }: Props) {
  const { t } = useTranslation("site");
  const [catSearch, setCatSearch] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);

  const { data: categories = [] } = useWooTaxonomy(storeId, "categories");
  const { data: brands = [] } = useWooTaxonomy(storeId, "brands");
  const createCategory = useCreateWooTaxonomy(storeId, "categories");
  const createBrand = useCreateWooTaxonomy(storeId, "brands");

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const displaySelectedCategory = (id: number, fallback: string) => {
    const term = catById.get(id);
    if (!term) return fallback || `#${id}`;
    return categoryBreadcrumb(categories, term);
  };

  const sortedPickableCategories = useMemo(() => sortCategoriesForPicker(categories), [categories]);

  const filteredCats = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    const selected = new Set(form.categories.map((c) => c.id));
    return sortedPickableCategories.filter((c) => {
      if (selected.has(c.id)) return false;
      if (!q) return true;
      const path = categoryBreadcrumb(categories, c).toLowerCase();
      return path.includes(q) || c.name.toLowerCase().includes(q);
    });
  }, [catSearch, sortedPickableCategories, categories, form.categories]);

  const canCreateCat =
    catSearch.trim().length > 0 &&
    !categories.find((c) => c.name.toLowerCase() === catSearch.trim().toLowerCase());

  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    const selected = new Set(form.brands.map((b) => b.id));
    return brands.filter((b) => !selected.has(b.id) && (!q || b.name.toLowerCase().includes(q)));
  }, [brandSearch, brands, form.brands]);

  const canCreateBrand =
    brandSearch.trim().length > 0 &&
    !brands.find((b) => b.name.toLowerCase() === brandSearch.trim().toLowerCase());

  const addCategoryById = (id: number, name: string) => {
    if (!form.categories.find((c) => c.id === id)) {
      setForm((p) => ({ ...p, categories: [...p.categories, { id, name }] }));
    }
    setCatSearch("");
    setCatOpen(false);
  };

  const createAndAddCategory = async () => {
    const name = catSearch.trim();
    if (!name) return;
    const created = await createCategory.mutateAsync({ name });
    setForm((p) => ({ ...p, categories: [...p.categories, { id: created.id, name: created.name }] }));
    setCatSearch("");
    setCatOpen(false);
  };

  const addBrandById = (id: number, name: string) => {
    if (!form.brands.find((b) => b.id === id)) {
      setForm((p) => ({ ...p, brands: [...p.brands, { id, name }] }));
    }
    setBrandSearch("");
    setBrandOpen(false);
  };

  const createAndAddBrand = async () => {
    const name = brandSearch.trim();
    if (!name) return;
    const created = await createBrand.mutateAsync({ name });
    setForm((p) => ({ ...p, brands: [...p.brands, { id: created.id, name: created.name }] }));
    setBrandSearch("");
    setBrandOpen(false);
  };

  return (
    <>
      <div className="space-y-1.5">
        <Label className="inline-flex items-center gap-1.5">
          <FolderTree className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {t("products.columns.categories")}
        </Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {form.categories.map((c) => (
            <Badge key={c.id} variant="secondary" className="gap-1.5 py-1 max-w-full">
              <span className="truncate" title={displaySelectedCategory(c.id, c.name || "")}>
                {displaySelectedCategory(c.id, c.name || "")}
              </span>
              <button
                type="button"
                className="shrink-0"
                onClick={() => setForm((p) => ({ ...p, categories: p.categories.filter((x) => x.id !== c.id) }))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Popover open={catOpen} onOpenChange={setCatOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {t("products.edit.taxonomy.addCategory", { defaultValue: "Add category" })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden />
                  <Input
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                    placeholder={t("products.edit.taxonomy.searchOrCreate", { defaultValue: "Search or create…" })}
                    className="h-8 ps-7 text-sm"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filteredCats.slice(0, 50).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => addCategoryById(c.id, c.name)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted text-start gap-2"
                  >
                    <span className="truncate min-w-0" title={categoryBreadcrumb(categories, c)}>
                      {categoryBreadcrumb(categories, c)}
                    </span>
                  </button>
                ))}
                {filteredCats.length === 0 && !canCreateCat && (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                    {t("products.edit.taxonomy.noCategories", { defaultValue: "No categories" })}
                  </div>
                )}
              </div>
              {canCreateCat && (
                <button
                  type="button"
                  onClick={() => void createAndAddCategory()}
                  disabled={createCategory.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm border-t border-border hover:bg-muted disabled:opacity-60"
                >
                  {createCategory.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                  ) : (
                    <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="truncate text-start">
                    {t("products.edit.taxonomy.createNamed", {
                      defaultValue: 'Create "{{name}}"',
                      name: catSearch.trim(),
                    })}
                  </span>
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="inline-flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {t("products.columns.brands")}
        </Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {form.brands.map((b) => (
            <Badge key={b.id} variant="secondary" className="gap-1.5">
              {b.name || `#${b.id}`}
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, brands: p.brands.filter((x) => x.id !== b.id) }))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Popover open={brandOpen} onOpenChange={setBrandOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {t("products.edit.taxonomy.addBrand", { defaultValue: "Add brand" })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden />
                  <Input
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    placeholder={t("products.edit.taxonomy.searchOrCreateBrand", { defaultValue: "Search or create brand…" })}
                    className="h-8 ps-7 text-sm"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filteredBrands.slice(0, 50).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => addBrandById(b.id, b.name)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted text-start"
                  >
                    <span className="truncate">{b.name}</span>
                  </button>
                ))}
                {filteredBrands.length === 0 && !canCreateBrand && (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                    {t("products.edit.taxonomy.noBrands", { defaultValue: "No brands" })}
                  </div>
                )}
              </div>
              {canCreateBrand && (
                <button
                  type="button"
                  onClick={() => void createAndAddBrand()}
                  disabled={createBrand.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm border-t border-border hover:bg-muted disabled:opacity-60"
                >
                  {createBrand.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                  ) : (
                    <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="truncate text-start">
                    {t("products.edit.taxonomy.createBrandNamed", {
                      defaultValue: 'Create "{{name}}"',
                      name: brandSearch.trim(),
                    })}
                  </span>
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </>
  );
}
