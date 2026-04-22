import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Trash2, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";

type Taxon = {
  id: string;
  woo_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  parent_woo_id?: number | null;
  count: number | null;
  store_id: string;
};

export function TaxonomyRowExpanded({ taxon, mode, allTaxons, storeUrl }: { taxon: Taxon; mode: "categories" | "tags"; allTaxons: Taxon[]; storeUrl?: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(taxon.name);
  const [slug, setSlug] = useState(taxon.slug);
  const [description, setDescription] = useState(taxon.description || "");
  const [parent, setParent] = useState<string>(taxon.parent_woo_id ? String(taxon.parent_woo_id) : "0");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const endpoint = mode === "categories" ? "categories" : "tags";
  const parentOptions = allTaxons.filter((t) => t.id !== taxon.id && t.woo_id);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/stores/${taxon.store_id}/${endpoint}/${taxon.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          ...(mode === "categories" ? { parent: Number(parent) || 0 } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Save failed (${res.status})`);
      }
      toast({ title: "Saved", description: `${mode === "categories" ? "Category" : "Tag"} updated in WooCommerce.` });
      qc.invalidateQueries({ queryKey: queryKeys.taxonomy(taxon.store_id, mode) });
      qc.invalidateQueries({ queryKey: ["woo", "taxonomy", taxon.store_id, mode] });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/stores/${taxon.store_id}/${endpoint}/${taxon.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Delete failed (${res.status})`);
      }
      await supabase.from(mode === "categories" ? "categories" : "tags").delete().eq("id", taxon.id);
      toast({ title: "Deleted", description: `${mode === "categories" ? "Category" : "Tag"} deleted from WooCommerce.` });
      qc.invalidateQueries({ queryKey: queryKeys.taxonomy(taxon.store_id, mode) });
      qc.invalidateQueries({ queryKey: ["woo", "taxonomy", taxon.store_id, mode] });
    } catch (e) {
      toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  const wooViewUrl = storeUrl && taxon.slug ? `${storeUrl.replace(/\/$/, "")}/${mode === "categories" ? "product-category" : "product-tag"}/${taxon.slug}/` : null;

  return (
    <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-5">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ID</div>
            <div className="text-sm font-mono mt-0.5">{taxon.woo_id ?? "—"}</div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Current</div>
            <div className="text-sm font-medium mt-0.5">{taxon.name}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Products</div>
            <div className="text-sm font-semibold mt-0.5 text-right">{taxon.count ?? 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`name-${taxon.id}`} className="text-xs">Name</Label>
            <Input id={`name-${taxon.id}`} value={name} onChange={(e) => setName(e.target.value)} className="h-9 bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`slug-${taxon.id}`} className="text-xs">Slug</Label>
            <Input id={`slug-${taxon.id}`} value={slug} onChange={(e) => setSlug(e.target.value)} className="h-9 font-mono text-sm bg-background" />
          </div>
          {mode === "categories" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Parent category</Label>
              <Select value={parent} onValueChange={setParent}>
                <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None (root)</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={String(p.woo_id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor={`desc-${taxon.id}`} className="text-xs">Description</Label>
            <Textarea id={`desc-${taxon.id}`} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="bg-background resize-none" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Actions</div>
          <div className="space-y-2">
            <button onClick={handleSave} disabled={saving || deleting} className="w-full flex items-center gap-2 h-10 px-3 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>Save changes</span>
              <span className="ml-auto">→</span>
            </button>
            {wooViewUrl && (
              <a href={wooViewUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 h-10 rounded-md text-sm border border-border bg-background hover:bg-muted transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
                <span>View on store</span>
                <span className="ml-auto text-muted-foreground">→</span>
              </a>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button disabled={saving || deleting} className="w-full flex items-center gap-2 h-10 px-3 rounded-md text-sm font-medium bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-100 transition-colors disabled:opacity-50 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900">
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  <span>Delete</span>
                  <span className="ml-auto">→</span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {mode === "categories" ? "category" : "tag"}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &ldquo;{taxon.name}&rdquo; from WooCommerce. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 text-white">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}