import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { createCategory, createTag } from "@/services/taxonomyService";

type ParentOption = { id: string; woo_id: number | null; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  mode: "categories" | "tags";
  parentOptions?: ParentOption[];
};

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

export function TaxonomyDialog({ open, onOpenChange, storeId, mode, parentOptions = [] }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parent, setParent] = useState("0");
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setSlug("");
      setDescription("");
      setParent("0");
      setSlugTouched(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const singular = mode === "categories" ? "category" : "tag";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (trimmed.length > 120) {
      setError("Name must be 120 characters or fewer");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "categories") {
        await createCategory(storeId, {
          name: trimmed,
          slug: slug || undefined,
          description: description || undefined,
          parent: Number(parent) || 0,
        });
      } else {
        await createTag(storeId, {
          name: trimmed,
          slug: slug || undefined,
          description: description || undefined,
        });
      }
      toast({ title: "Created", description: `${singular.charAt(0).toUpperCase() + singular.slice(1)} created in WooCommerce.` });
      qc.invalidateQueries({ queryKey: queryKeys.taxonomy(storeId, mode) });
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New {singular}</DialogTitle>
            <DialogDescription>Create a new {singular} in WooCommerce. It will sync back immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="tx-name" className="text-xs">Name <span className="text-rose-600">*</span></Label>
              <Input id="tx-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-slug" className="text-xs">Slug</Label>
              <Input id="tx-slug" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} className="font-mono text-sm" placeholder="auto-generated from name" />
            </div>
            {mode === "categories" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Parent category</Label>
                <Select value={parent} onValueChange={setParent}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">None (root)</SelectItem>
                    {parentOptions.filter((p) => p.woo_id).map((p) => (
                      <SelectItem key={p.id} value={String(p.woo_id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="tx-desc" className="text-xs">Description</Label>
              <Textarea id="tx-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="resize-none" />
            </div>
            {error && <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 rounded-md">{error}</div>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Create {singular}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}