import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";
import { updateCategory, deleteCategory, updateTag, deleteTag, updateBrand, deleteBrand } from "@/services/taxonomyService";

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
};

export function TaxonomyRowExpanded({ item, mode, storeId, onClose }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(item.name);
  const [slug, setSlug] = useState(item.slug || "");
  const [description, setDescription] = useState(item.description || "");

  const updateMut = useSiteMutation<Taxonomy, { name: string; slug: string; description: string }>({
    mutationFn: (vars) => {
      if (mode === "categories") return updateCategory(storeId, item.id, vars) as Promise<Taxonomy>;
      if (mode === "tags") return updateTag(storeId, item.id, vars) as Promise<Taxonomy>;
      return updateBrand(storeId, item.id, vars) as Promise<Taxonomy>;
    },
    invalidateKeys: [["taxonomy", mode, storeId], queryKeys.taxonomy(storeId, mode)],
    successToast: "Synced to WooCommerce",
    onSuccessExtra: () => {
      void qc.refetchQueries({ queryKey: ["taxonomy", mode, storeId], type: "active" });
    },
  });

  const deleteMut = useSiteMutation<void, void>({
    mutationFn: async () => {
      if (mode === "categories") await deleteCategory(storeId, item.id);
      else if (mode === "tags") await deleteTag(storeId, item.id);
      else await deleteBrand(storeId, item.id);
    },
    invalidateKeys: [["taxonomy", mode, storeId], queryKeys.taxonomy(storeId, mode)],
    successToast: "Deleted from WooCommerce",
    onSuccessExtra: () => {
      void qc.refetchQueries({ queryKey: ["taxonomy", mode, storeId], type: "active" });
      onClose();
    },
  });

  const singular = mode === "categories" ? "category" : mode === "tags" ? "tag" : "brand";
  const dirty = name !== item.name || slug !== (item.slug || "") || description !== (item.description || "");

  async function handleDelete() {
    if (!confirm(`Delete this ${singular}? This will remove it from WooCommerce.`)) return;
    deleteMut.mutate();
  }

  return (
    <div className="bg-muted/20 border-t px-6 py-4">
      <div className="max-w-3xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono text-sm" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="resize-none" />
        </div>
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={handleDelete} disabled={deleteMut.isPending}>
            {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              disabled={!dirty || updateMut.isPending}
              onClick={() => updateMut.mutate({ name, slug, description })}
            >
              {updateMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
