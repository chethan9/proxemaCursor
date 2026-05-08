import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

type ParentOption = { id: string; woo_id: number | null; name: string };

const slugReadOnlyClass =
  "flex min-h-10 w-full cursor-default items-center rounded-md border border-transparent bg-muted/30 px-3 py-2 text-left font-mono text-sm outline-none transition-colors select-none hover:bg-muted/45";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  siteName?: string;
  mode: "categories" | "tags" | "brands";
  parentOptions?: ParentOption[];
};

export function TaxonomyDialog({ open, onOpenChange, storeId, siteName, mode, parentOptions = [] }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parent, setParent] = useState("0");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugEditing, setSlugEditing] = useState(false);
  const slugInputRef = useRef<HTMLInputElement>(null);
  /** Client-side validation for Name (shown inline); API errors use serverError. */
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setSlug("");
      setDescription("");
      setParent("0");
      setSlugTouched(false);
      setSlugEditing(false);
      setFieldError(null);
      setSlugError(null);
      setServerError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  useEffect(() => {
    if (slugEditing) slugInputRef.current?.focus();
  }, [slugEditing]);

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
      ...(mode === "categories" ? [queryKeys.productCategoryOptions(storeId)] : []),
    ],
    siteName,
    successToast: `${singular.charAt(0).toUpperCase() + singular.slice(1)} created`,
    onSuccessExtra: () => {
      void qc.refetchQueries({ queryKey: ["taxonomy", mode, storeId], type: "active" });
      onOpenChange(false);
    },
    onErrorExtra: (err) => setServerError((err as Error).message),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setSlugError(null);
    setServerError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setFieldError("Name is required.");
      return;
    }
    if (trimmed.length > 120) {
      setFieldError("Name must be 120 characters or fewer.");
      return;
    }
    const slugFinal = slug.trim() || slugify(trimmed);
    if (!slugFinal) {
      setSlugError("Slug could not be generated — adjust the name or double-click Slug to set it manually.");
      return;
    }
    create.mutate({
      name: trimmed,
      slug: slugFinal,
      description: description || undefined,
      parent: Number(parent) || 0,
    });
  }

  const cardTitle = mode === "categories" ? "New category" : mode === "tags" ? "New tag" : "New brand";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl gap-0 overflow-hidden p-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="sr-only">
            <DialogTitle>New {singular}</DialogTitle>
          </DialogHeader>

          <Card className="border-0 shadow-none rounded-none">
            <CardHeader className="space-y-1 border-b border-border/70 px-5 pb-4 pt-5">
              <CardTitle className="text-lg font-semibold tracking-tight">{cardTitle}</CardTitle>
              <CardDescription className="text-sm">
                Creates the {singular} in WooCommerce and syncs it to this list. Double-click the slug to edit it (it follows the name until you change it).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-5 py-5">
              <div className="space-y-2">
                <Label htmlFor="tx-name" className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tx-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldError) setFieldError(null);
                  }}
                  autoFocus
                  maxLength={120}
                  placeholder={`Enter ${singular} name`}
                  {...(fieldError ? ({ "aria-invalid": true as const, "aria-describedby": "tx-name-error" } as const) : {})}
                  className={`h-10 bg-background ${fieldError ? "border-destructive focus-visible:ring-ring" : ""}`}
                />
                {fieldError ? (
                  <p id="tx-name-error" className="text-xs text-destructive" role="alert">
                    {fieldError}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tx-slug" className="text-sm font-medium">
                  Slug <span className="text-destructive">*</span>
                </Label>
                {slugEditing ? (
                  <Input
                    ref={slugInputRef}
                    id="tx-slug"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                      if (slugError) setSlugError(null);
                    }}
                    onBlur={() => setSlugEditing(false)}
                    className="h-10 bg-background font-mono text-sm"
                    placeholder="url-slug"
                  />
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    id="tx-slug-preview"
                    className={cn(slugReadOnlyClass, slugError && "border-destructive/50")}
                    title="Double-click to edit slug"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSlugEditing(true);
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      setSlugEditing(true);
                    }}
                  >
                    {slug.trim() ? (
                      slug
                    ) : (
                      <span className="font-sans text-muted-foreground">Double-click to set slug — auto-filled from name</span>
                    )}
                  </div>
                )}
                {slugError ? (
                  <p className="text-xs text-destructive" role="alert">
                    {slugError}
                  </p>
                ) : null}
              </div>
              {mode === "categories" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Parent category</Label>
                  <Select value={parent} onValueChange={setParent}>
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue placeholder="None (root)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">None (root)</SelectItem>
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
                <Label htmlFor="tx-desc" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="tx-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="resize-none bg-background min-h-[88px] text-sm"
                  placeholder="Optional description"
                />
              </div>
              {serverError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
                  {serverError}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <DialogFooter className="gap-2 border-t border-border/70 bg-muted/25 px-5 py-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create {singular}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
