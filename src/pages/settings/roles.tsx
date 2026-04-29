import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation, Trans } from "next-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
}

const PERMISSION_GROUPS: Record<string, string[]> = {
  Clients: ["clients.read", "clients.write", "clients.delete"],
  Sites: ["sites.read", "sites.write", "sites.delete"],
  Sync: ["sync.read", "sync.run", "sync.cancel"],
  Webhooks: ["webhooks.read", "webhooks.write", "webhooks.delete"],
  API: ["api.read", "api.write"],
  Users: ["users.read", "users.write", "users.delete"],
  Roles: ["roles.read", "roles.write", "roles.delete"],
  Settings: ["settings.read", "settings.write"],
};

export default function RolesPage() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Role | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", permissions: [] as string[] });

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("roles" as never).select("*").order("name");
    setRoles(((data as unknown) as Role[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", permissions: [] });
    setShowDialog(true);
  }

  function openEdit(role: Role) {
    setEditing(role);
    setForm({ name: role.name, description: role.description ?? "", permissions: role.permissions ?? [] });
    setShowDialog(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: t("roles.toast.nameRequired"), variant: "destructive" });
      return;
    }
    try {
      if (editing) {
        const { error } = await supabase
          .from("roles" as never)
          .update({ name: form.name, description: form.description, permissions: form.permissions } as never)
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: t("roles.toast.roleUpdated") });
      } else {
        const { error } = await supabase
          .from("roles" as never)
          .insert({ name: form.name, description: form.description, permissions: form.permissions } as never);
        if (error) throw error;
        toast({ title: t("roles.toast.roleCreated") });
      }
      setShowDialog(false);
      await load();
    } catch (e) {
      toast({ title: t("roles.toast.failed"), description: e instanceof Error ? e.message : t("roles.toast.error"), variant: "destructive" });
    }
  }

  async function remove(role: Role) {
    if (!confirm(t("roles.confirmDelete", { name: role.name }))) return;
    try {
      const { error } = await supabase.from("roles" as never).delete().eq("id", role.id);
      if (error) throw error;
      toast({ title: t("roles.toast.roleDeleted") });
      await load();
    } catch (e) {
      toast({ title: t("roles.toast.failed"), description: e instanceof Error ? e.message : t("roles.toast.error"), variant: "destructive" });
    }
  }

  function togglePermission(perm: string) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm) ? f.permissions.filter((p) => p !== perm) : [...f.permissions, perm],
    }));
  }

  return (
    <AppLayout title={t("roles.title")} requireSuperAdmin>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("roles.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("roles.subtitle")}</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t("roles.newRole")}
          </Button>
        </div>

        <div className="grid gap-4">
          {loading ? null : roles.map((role) => (
            <Card key={role.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {role.name}
                    {role.is_system ? <Badge variant="secondary" className="text-[10px]">{t("roles.system")}</Badge> : null}
                  </CardTitle>
                  {role.description ? <p className="text-sm text-muted-foreground mt-1">{role.description}</p> : null}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(role)} aria-label={t("roles.editPermissions")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!role.is_system && (
                    <Button variant="ghost" size="sm" onClick={() => remove(role)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-2">
                  {role.permissions?.includes("*")
                    ? t("roles.allPermissions")
                    : role.permissions?.length
                    ? t("roles.permissionCount", { count: role.permissions.length })
                    : t("roles.noPermissions")}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(role.permissions ?? []).slice(0, 12).map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px] font-mono">{p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editing ? <Trans i18nKey="roles.dialog.editTitle" t={t} values={{ name: editing.name }} /> : t("roles.dialog.createTitle")}
              </DialogTitle>
              <DialogDescription>
                {editing ? t("roles.dialog.editDescription") : t("roles.dialog.createDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">{t("roles.dialog.name")}</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("roles.dialog.namePlaceholder")} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">{t("roles.dialog.description")}</label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("roles.dialog.descriptionPlaceholder")} rows={2} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">{t("roles.dialog.permissions")}</label>
                <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto border rounded-md p-3">
                  {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                    <div key={group}>
                      <div className="text-xs font-semibold text-muted-foreground mb-1">{t(`roles.groups.${group}`, { defaultValue: group })}</div>
                      <div className="space-y-1">
                        {perms.map((perm) => (
                          <label key={perm} className="flex items-center gap-2 text-xs cursor-pointer">
                            <Checkbox checked={form.permissions.includes(perm)} onCheckedChange={() => togglePermission(perm)} />
                            <span className="font-mono">{perm}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowDialog(false)}>{t("roles.dialog.cancel")}</Button>
              <Button onClick={save}>{editing ? t("roles.dialog.save") : t("roles.dialog.create")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "settings"])),
  },
});
