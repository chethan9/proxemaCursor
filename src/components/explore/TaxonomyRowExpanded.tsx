import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Save, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateCategory, deleteCategory, updateTag, deleteTag, type CategoryRow, type TagRow } from "@/services/taxonomyService";

type Props =
  | { mode: "categories"; storeId: string; row: CategoryRow; parents: CategoryRow[]; onSaved: (r: CategoryRow) => void; onDeleted: (id: string) => void }
  | { mode: "tags"; storeId: string; row: TagRow; parents?: never; onSaved: (r: TagRow) => void; onDeleted: (id: string) => void };

export function TaxonomyRowExpanded(props: Props) {
  const { mode, storeId, row, onSaved, onDeleted } = props;
  const { toast } = useToast();
  const [name, setName] = useState(row.name || "");
  const [slug, setSlug] = useState(row.slug || "");
  const [description, setDescription] = useState((row as CategoryRow).description || "");
  const [parentId, setParentId] = useState<string>(
    mode === "categories" ? String((row as CategoryRow).parent_id ?? 0) : "0"
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const optimistic = { ...row, name, slug, description, ...(mode === "categories" ? { parent_id: parseInt(parentId, 10) } : {}) };
    onSaved(optimistic as CategoryRow & TagRow);
    try {
      const updates: Record<string, unknown> = { name, slug, description };
      if (mode === "categories") updates.parent = parseInt(parentId, 10);
      const updated = mode === "categories"
        ? await updateCategory(storeId, row.id, updates)
        : await updateTag(storeId, row.id, updates);
      onSaved(updated as CategoryRow & TagRow);
      toast({ title: `${mode === "categories" ? "Category" : "Tag"} updated`, description: updated.name });
    } catch (e) {
      onSaved(row as CategoryRow & TagRow);
      setName(row.name || "");
      setSlug(row.slug || "");
      setDescription((row as CategoryRow).description || "");
      toast({ title: "Update failed — reverted", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (mode === "categories") await deleteCategory(storeId, row.id);
      else await deleteTag(storeId, row.id);
      onDeleted(row.id);
      toast({ title: `${mode === "categories" ? "Category" : "Tag"} deleted`, description: row.name || "" });
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="px-6 py-5">
      <div className="flex items-start gap-6 mb-5 pb-4 border-b border-border/60">
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">ID</div>
          <div className="font-mono text-sm">{row.woo_id}</div>
        </div>
        <div className="flex-1">
          <div className="font-semibold text-base">{row.name}</div>
        </div>
        {mode === "categories" && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground mb-0.5">Parent Category ID</div>
            <div className="font-mono text-sm">{(row as CategoryRow).parent_id ?? 0}</div>
          </div>
        )}
        <div className="text-right">
          <div className="text-xs text-muted-foreground mb-0.5">Products</div>
          <div className="font-mono text-sm">{row.count ?? 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-6">
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="h-9 mt-1 font-mono text-xs" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 text-sm" />
          </div>
        </div>

        <div className="space-y-3">
          {mode === "categories" && (
            <div>
              <Label className="text-xs">Parent category</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None (root)</SelectItem>
                  {props.parents
                    .filter((p) => p.id !== row.id)
                    .map((p) => (
                      <SelectItem key={p.id} value={String(p.woo_id)}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 min-w-[140px]">
          <Label className="text-xs">Actions</Label>
          <Button onClick={handleSave} disabled={saving} size="sm" className="h-9 justify-start">
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-2" />}
            Update
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={deleting} variant="outline" size="sm" className="h-9 justify-start text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {mode === "categories" ? "category" : "tag"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{row.name}&quot; from WooCommerce. Products assigned to it will lose the association. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}