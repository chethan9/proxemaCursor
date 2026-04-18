import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS } from "@/lib/permissions";
import { listRoles, createRole, updateRole, deleteRole, type RoleRow } from "@/services/userService";
import { Loader2, Plus, Shield, Trash2, Save, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";

const PERMISSION_GROUPS = [
  { label: "Clients", perms: [PERMISSIONS.CLIENTS_VIEW, PERMISSIONS.CLIENTS_MANAGE] },
  { label: "Sites", perms: [PERMISSIONS.SITES_VIEW, PERMISSIONS.SITES_MANAGE, PERMISSIONS.SITES_SYNC] },
  { label: "Sync", perms: [PERMISSIONS.SYNC_VIEW, PERMISSIONS.SYNC_RUN] },
  { label: "Webhooks", perms: [PERMISSIONS.WEBHOOKS_VIEW, PERMISSIONS.WEBHOOKS_MANAGE] },
  { label: "API", perms: [PERMISSIONS.API_VIEW, PERMISSIONS.API_MANAGE] },
  { label: "Users", perms: [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE] },
  { label: "Roles", perms: [PERMISSIONS.ROLES_VIEW, PERMISSIONS.ROLES_MANAGE] },
  { label: "Settings", perms: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_MANAGE] },
];

export default function RolesPage() {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [form, setForm] = useState({ name: "", description: "", permissions: [] as string[] });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRoles(await listRoles());
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", permissions: [] });
    setCreateOpen(true);
  };

  const openEdit = (r: RoleRow) => {
    setEditing(r);
    setForm({ name: r.name, description: r.description || "", permissions: r.permissions || [] });
    setCreateOpen(true);
  };

  const togglePerm = (p: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
    }));
  };

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateRole(editing.id, { description: form.description, permissions: form.permissions });
        toast({ title: "Role updated" });
      } else {
        await createRole(form.name.trim(), form.description, form.permissions);
        toast({ title: "Role created" });
      }
      setCreateOpen(false);
      await load();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: RoleRow) => {
    if (!confirm(`Delete role "${r.name}"? Users with this role will need reassignment.`)) return;
    try {
      await deleteRole(r.id);
      toast({ title: "Role deleted" });
      await load();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  return (
    <AppLayout title="Roles & Permissions" requirePermission={PERMISSIONS.ROLES_VIEW}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Roles & Permissions</h1>
            <p className="text-sm text-muted-foreground mt-1">Define what each role can see and do</p>
          </div>
          {isSuperAdmin && (
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New role</Button>
          )}
        </div>

        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {roles.map(r => {
              const hasAll = r.permissions.includes("*");
              return (
                <Card key={r.id} className={r.is_system ? "border-primary/30" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Shield className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {r.name}
                            {r.is_system && <Badge variant="outline" className="text-[10px]"><Lock className="h-2.5 w-2.5 mr-1" />system</Badge>}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">{r.description || "No description"}</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        {hasAll ? "Permissions" : `${r.permissions.length} permission${r.permissions.length !== 1 ? "s" : ""}`}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {hasAll ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20" variant="outline">All permissions (*)</Badge>
                        ) : r.permissions.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No permissions assigned</span>
                        ) : (
                          r.permissions.slice(0, 8).map(p => (
                            <Badge key={p} variant="secondary" className="text-[10px] font-mono">{p}</Badge>
                          ))
                        )}
                        {!hasAll && r.permissions.length > 8 && (
                          <Badge variant="outline" className="text-[10px]">+{r.permissions.length - 8}</Badge>
                        )}
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)} disabled={r.name === "super_admin"}>
                          Edit permissions
                        </Button>
                        {!r.is_system && (
                          <Button size="sm" variant="ghost" onClick={() => remove(r)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit role: ${editing.name}` : "Create new role"}</DialogTitle>
            <DialogDescription>
              {editing ? "Adjust permissions for this role" : "Define a new role with specific permissions"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. support_agent"
                disabled={!!editing}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this role do?"
                rows={2}
              />
            </div>
            <div className="space-y-3">
              <Label>Permissions</Label>
              <div className="space-y-3 border rounded-lg p-3">
                {PERMISSION_GROUPS.map(g => (
                  <div key={g.label}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">{g.label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {g.perms.map(p => (
                        <label key={p} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-muted">
                          <Checkbox checked={form.permissions.includes(p)} onCheckedChange={() => togglePerm(p)} />
                          <span className="font-mono text-xs">{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editing ? "Save changes" : "Create role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}