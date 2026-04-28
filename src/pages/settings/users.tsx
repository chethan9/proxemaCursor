import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthProvider";
import { PERMISSIONS } from "@/lib/permissions";
import { listUsers, updateUserRole, updateUserClient, updateUserActive, type UserProfile, listRoles, type RoleRow } from "@/services/userService";
import { getClients } from "@/services/clientService";
import { Loader2, UserPlus, ShieldAlert } from "lucide-react";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation, Trans } from "next-i18next";

export default function UsersPage() {
  const { toast } = useToast();
  const { t } = useTranslation("settings");
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmSuperAdmin, setConfirmSuperAdmin] = useState<{ userId: string; email: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [u, r, c] = await Promise.all([listUsers(), listRoles(), getClients()]);
      setUsers(u);
      setRoles(r);
      setClients(c.map(x => ({ id: x.id, name: x.name })));
    } catch (e) {
      toast({ title: t("users.toast.loadFailed"), description: e instanceof Error ? e.message : t("users.toast.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const superAdminCount = users.filter(u => u.role === "super_admin" && u.is_active).length;

  const handleRoleChange = async (u: UserProfile, newRole: string) => {
    if (newRole === "super_admin" && u.role !== "super_admin") {
      setConfirmSuperAdmin({ userId: u.id, email: u.email || "" });
      return;
    }
    if (u.role === "super_admin" && newRole !== "super_admin" && superAdminCount <= 1) {
      toast({ title: t("users.toast.cannotDemote"), description: t("users.toast.lastSuperAdmin"), variant: "destructive" });
      return;
    }
    try {
      await updateUserRole(u.id, newRole);
      toast({ title: t("users.toast.roleUpdated") });
      await load();
    } catch (e) {
      toast({ title: t("users.toast.failed"), description: e instanceof Error ? e.message : t("users.toast.error"), variant: "destructive" });
    }
  };

  const confirmPromoteSuperAdmin = async () => {
    if (!confirmSuperAdmin) return;
    try {
      await updateUserRole(confirmSuperAdmin.userId, "super_admin");
      toast({ title: t("users.toast.superAdminGranted") });
      setConfirmSuperAdmin(null);
      await load();
    } catch (e) {
      toast({ title: t("users.toast.failed"), description: e instanceof Error ? e.message : t("users.toast.error"), variant: "destructive" });
    }
  };

  const handleClientChange = async (u: UserProfile, clientId: string) => {
    try {
      await updateUserClient(u.id, clientId === "__none__" ? null : clientId);
      toast({ title: t("users.toast.clientUpdated") });
      await load();
    } catch (e) {
      toast({ title: t("users.toast.failed"), description: e instanceof Error ? e.message : t("users.toast.error"), variant: "destructive" });
    }
  };

  const handleActiveToggle = async (u: UserProfile, active: boolean) => {
    if (u.id === currentUser?.id && !active) {
      toast({ title: t("users.toast.cannotDeactivateSelf"), variant: "destructive" });
      return;
    }
    if (u.role === "super_admin" && !active && superAdminCount <= 1) {
      toast({ title: t("users.toast.cannotDeactivate"), description: t("users.toast.lastSuperAdminActive"), variant: "destructive" });
      return;
    }
    try {
      await updateUserActive(u.id, active);
      toast({ title: active ? t("users.toast.userActivated") : t("users.toast.userDeactivated") });
      await load();
    } catch (e) {
      toast({ title: t("users.toast.failed"), description: e instanceof Error ? e.message : t("users.toast.error"), variant: "destructive" });
    }
  };

  return (
    <AppLayout title={t("users.title")} requirePermission={PERMISSIONS.USERS_VIEW}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("users.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("users.subtitle")}</p>
          </div>
          {isSuperAdmin && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button><UserPlus className="h-4 w-4 mr-2" />{t("users.invite")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("users.inviteTitle")}</DialogTitle>
                  <DialogDescription>{t("users.inviteDescription")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label>{t("users.signupLink")}</Label>
                  <Input readOnly value={typeof window !== "undefined" ? `${window.location.origin}/auth/signup` : ""} />
                </div>
                <DialogFooter>
                  <Button onClick={() => setInviteOpen(false)}>{t("users.close")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("users.allUsers", { count: users.length })}</CardTitle>
            <CardDescription>{t("users.superAdminCount", { count: superAdminCount })}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">{t("users.empty")}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("users.columns.user")}</TableHead>
                    <TableHead>{t("users.columns.role")}</TableHead>
                    <TableHead>{t("users.columns.client")}</TableHead>
                    <TableHead>{t("users.columns.active")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {u.role === "super_admin" && <ShieldAlert className="h-4 w-4 text-primary" />}
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {u.full_name || t("users.unnamed")}
                              {u.id === currentUser?.id && <Badge variant="outline" className="text-[10px]">{t("users.you")}</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isSuperAdmin ? (
                          <Select value={u.role} onValueChange={(v) => handleRoleChange(u, v)}>
                            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {roles.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">{u.role}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isSuperAdmin && u.role !== "super_admin" ? (
                          <Select value={u.client_id || "__none__"} onValueChange={(v) => handleClientChange(u, v)}>
                            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{t("users.noClient")}</SelectItem>
                              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {u.role === "super_admin" ? t("users.allClients") : (clients.find(c => c.id === u.client_id)?.name || "—")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.is_active}
                          onCheckedChange={(v) => handleActiveToggle(u, v)}
                          disabled={!isSuperAdmin || u.id === currentUser?.id}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!confirmSuperAdmin} onOpenChange={(o) => !o && setConfirmSuperAdmin(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              {t("users.confirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans
                i18nKey="users.confirm.body"
                ns="settings"
                values={{ email: confirmSuperAdmin?.email || "" }}
                components={{ strong: <strong /> }}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("users.confirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPromoteSuperAdmin}>{t("users.confirm.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "settings"])),
  },
});