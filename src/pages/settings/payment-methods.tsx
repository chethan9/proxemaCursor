import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, CreditCard, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthProvider";
import { listPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod, type PaymentMethodRow } from "@/services/paymentMethodService";

export default function PaymentMethodsPage() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethodRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethodRow | null>(null);

  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await listPaymentMethods();
      setRows(data);
    } catch (e) {
      toast({ title: "Failed to load", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setKey(""); setLabel(""); setDescription(""); setIconUrl("");
    setEditOpen(true);
  };

  const openEdit = (row: PaymentMethodRow) => {
    setEditing(row);
    setKey(row.key);
    setLabel(row.label);
    setDescription(row.description || "");
    setIconUrl(row.icon_url || "");
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!key.trim() || !label.trim()) {
      toast({ title: "Key and label required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { key: key.trim(), label: label.trim(), description: description.trim() || null, icon_url: iconUrl.trim() || null };
      if (editing) {
        const updated = await updatePaymentMethod(editing.id, payload);
        setRows((prev) => prev.map((r) => r.id === updated.id ? updated : r));
        toast({ title: "Updated", description: updated.label });
      } else {
        const created = await createPaymentMethod(payload);
        setRows((prev) => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)));
        toast({ title: "Created", description: created.label });
      }
      setEditOpen(false);
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePaymentMethod(deleteTarget.id);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast({ title: "Deleted", description: deleteTarget.label });
      setDeleteTarget(null);
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  if (!isSuperAdmin) {
    return (
      <AppLayout title="Payment Methods">
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Super admin access required.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Payment Methods">
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold">Payment Methods</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Define payment gateways. The <code className="text-xs bg-muted px-1 py-0.5 rounded">key</code> must match the exact WooCommerce <code className="text-xs bg-muted px-1 py-0.5 rounded">payment_method</code> value.</p>
            </div>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add method
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-14">Icon</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16">
                      <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No payment methods defined yet</p>
                      <Button onClick={openCreate} size="sm" className="mt-3 gap-1.5">
                        <Plus className="h-4 w-4" /> Add your first
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.icon_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.icon_url} alt="" className="h-6 w-6 rounded object-contain bg-white p-0.5" />
                        ) : (
                          <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.key}</code></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[360px] truncate">{r.description || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(r)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit payment method" : "Add payment method"}</DialogTitle>
            <DialogDescription>The <strong>key</strong> must match exactly what WooCommerce sends in <code className="text-xs">payment_method</code> (e.g. <code className="text-xs">myfatoorah_v2</code>, <code className="text-xs">stripe</code>, <code className="text-xs">cod</code>).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Key *</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="myfatoorah_v2" className="h-9 mt-1 font-mono text-sm" />
            </div>
            <div>
              <Label className="text-xs">Label *</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="MyFatoorah" className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Icon URL</Label>
              <Input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="https://..." className="h-9 mt-1 font-mono text-xs" />
              {iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconUrl} alt="preview" className="h-10 w-10 mt-2 rounded bg-white p-1 object-contain border border-border" />
              )}
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment method?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.label}&quot;? Orders with this method will fall back to showing the raw key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}